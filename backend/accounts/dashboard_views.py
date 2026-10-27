from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import SchoolClass, Subject
from attendance.models import AttendanceEntry
from exams.models import Exam
from expenses.models import Expense
from fees import billing
from fees.models import FeePayment
from otherincome.models import OtherCollection
from accounts.models import StudentRoster, TeacherProfile, TeacherTask

User = get_user_model()
FEE_GOAL_PCT = 90
# What a challan really asks for: monthly fee + arrears + fine.
TOTAL = ExpressionWrapper(F("amount") + F("arrears") + F("fine"), output_field=DecimalField(max_digits=12, decimal_places=2))


def _sum(qs):
    return float(qs.aggregate(t=Sum(TOTAL))["t"] or 0)


def month_starts(n=6):
    today = date.today()
    y, m = today.year, today.month
    out = []
    for i in range(n - 1, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        out.append(date(yy, mm, 1))
    return out


def next_month(d):
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def billing_name(user):
    entry = getattr(getattr(user, "student_profile", None), "roster_entry", None)
    return (entry.full_name if entry and entry.full_name else user.get_full_name()) or user.username


def billing_class(user):
    entry = getattr(getattr(user, "student_profile", None), "roster_entry", None)
    klass = getattr(entry, "school_class", None) if entry else None
    return str(klass) if klass else ""


def finance_summary(today):
    """Money in, money out and what is still owed, for the admin dashboard.

    income = fees actually received (by the day they were paid) + other collections (sheets, notes...); expenses = the Expenses page.
    A negative net means the academy is running at a loss."""
    live = FeePayment.objects.exclude(status=FeePayment.Status.CARRIED)
    paid = live.filter(status=FeePayment.Status.PAID)
    pending = live.filter(status=FeePayment.Status.PENDING)
    this_month = month_starts(1)[0]

    months = []
    for d in month_starts(6):
        nxt = next_month(d)
        fees_in = _sum(paid.filter(paid_on__gte=d, paid_on__lt=nxt))
        other_in = float(OtherCollection.objects.filter(date__gte=d, date__lt=nxt).aggregate(t=Sum("amount"))["t"] or 0)
        income = fees_in + other_in
        spent = float(Expense.objects.filter(date__gte=d, date__lt=nxt).aggregate(t=Sum("amount"))["t"] or 0)
        months.append(
            {"month": d.strftime("%b"), "income": income, "fee_income": fees_in, "other_income": other_in,
             "expenses": spent, "net": income - spent}
        )
    now = months[-1]

    billed = _sum(live.filter(month=this_month))
    collected_of_billed = _sum(paid.filter(month=this_month))

    owed = {}
    for p in pending.select_related("student__student_profile__roster_entry__school_class").order_by("due_date"):
        row = owed.setdefault(
            p.student_id,
            {"student": billing_name(p.student), "class_label": billing_class(p.student), "outstanding": 0.0, "oldest_due": p.due_date.isoformat()},
        )
        row["outstanding"] += float(p.total)
    defaulters = sorted(owed.values(), key=lambda r: -r["outstanding"])[:5]

    categories = (
        Expense.objects.filter(date__gte=this_month, date__lt=next_month(this_month))
        .values("category")
        .annotate(t=Sum("amount"))
        .order_by("-t")[:4]
    )
    salaries = TeacherProfile.objects.aggregate(t=Sum("salary"))["t"] or 0
    return {
        "month_label": this_month.strftime("%B %Y"),
        "income": now["income"],
        "fee_income": now["fee_income"],
        "other_income": now["other_income"],
        "other_by_category": [
            {"label": dict(OtherCollection.Category.choices).get(c["category"], c["category"]), "amount": float(c["t"])}
            for c in OtherCollection.objects.filter(date__gte=this_month, date__lt=next_month(this_month))
            .values("category").annotate(t=Sum("amount")).order_by("-t")
        ],
        "expenses": now["expenses"],
        "net": now["net"],
        "is_loss": now["net"] < 0,
        "billed_this_month": billed,
        "collected_of_billed": collected_of_billed,
        "collection_rate": round(collected_of_billed * 100 / billed) if billed else None,
        "pending_total": _sum(pending),
        "overdue_total": _sum(pending.filter(due_date__lt=today)),
        "pending_students": pending.values("student").distinct().count(),
        "salaries_monthly": float(salaries),
        "months": months,
        "top_defaulters": defaulters,
        "expense_categories": [{"category": c["category"], "amount": float(c["t"])} for c in categories],
        "new_admissions": StudentRoster.objects.filter(created_at__date__gte=this_month).count(),
    }


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = str(getattr(request.user, "role", "")).lower()
        if not (request.user.is_superuser or role in ("admin", "hod")):
            return Response({"detail": "Admins only."}, status=403)

        students = User.objects.filter(role__iexact="student")
        teachers = User.objects.filter(role__iexact="teacher")

        enrollment = [
            {
                "month": d.strftime("%b"),
                "count": students.filter(date_joined__date__lt=next_month(d)).count(),
            }
            for d in month_starts(6)
        ]

        billing.ensure_current_month()
        live = FeePayment.objects.exclude(status=FeePayment.Status.CARRIED)
        total_due = _sum(live)
        total_paid = _sum(live.filter(status="paid"))
        collected = round(total_paid * 100 / total_due) if total_due else 0

        today = date.today()
        recent = live.select_related("student__student_profile__roster_entry").order_by("-due_date", "-id")[:5]

        day_marks = list(AttendanceEntry.objects.filter(date=today).values_list("status", flat=True))
        worked = [x for x in day_marks if x != "holiday"]
        attended = sum(1 for x in worked if x in ("present", "late"))
        present_pct = round(attended * 100 / len(worked)) if worked else None

        def fee_status(f):
            if f.status == "paid":
                return "paid"
            return "overdue" if f.due_date < today else "pending"

        return Response({
            "counts": {
                "students": students.filter(is_active=True).count(),
                "teachers": teachers.count(),
                "classes": SchoolClass.objects.count(),
                "subjects": Subject.objects.count(),
                "exams": Exam.objects.count(),
                "pending_signups": students.filter(is_active=False).count(),
            },
            "enrollment": enrollment,
            "attendance": {
                "present_pct": present_pct,
                "label": "Today" if present_pct is not None else "No attendance marked today",
            },
            "finance": finance_summary(today),
            "fees": {
                "collected_pct": collected,
                "goal_pct": FEE_GOAL_PCT,
                "recent": [
                    {
                        "id": f.id,
                        "student": billing_name(f.student),
                        "due_date": f.due_date.strftime("Due %b %d"),
                        "amount": float(f.total),
                        "status": fee_status(f),
                    }
                    for f in recent
                ],
            },
            "homework_pending": 0,
            "tasks": {"pending": TeacherTask.objects.filter(is_done=False).count(), "done": TeacherTask.objects.filter(is_done=True).count()},
            "teachers": [
                {
                    "id": t.id,
                    "name": t.get_full_name() or t.username,
                    "subject": getattr(getattr(t, "teacher_profile", None), "subject_specialization", None),
                    "active": t.is_active,
                }
                for t in teachers[:5]
            ],
        })
