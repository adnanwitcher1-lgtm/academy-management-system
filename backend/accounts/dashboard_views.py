from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import SchoolClass, Subject
from exams.models import Exam
from fees.models import FeePayment
from accounts.models import TeacherTask

User = get_user_model()
FEE_GOAL_PCT = 90


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


def student_name(s):
    full = s.get_full_name() if hasattr(s, "get_full_name") else ""
    return full or getattr(s, "username", None) or getattr(s, "name", None) or str(s)


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

        total_due = FeePayment.objects.aggregate(t=Sum("amount"))["t"] or 0
        total_paid = (
            FeePayment.objects.filter(status="paid").aggregate(t=Sum("amount"))["t"] or 0
        )
        collected = round(total_paid * 100 / total_due) if total_due else 0

        today = date.today()
        recent = FeePayment.objects.select_related("student").order_by("-due_date")[:5]

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
            "attendance": {"present_pct": None, "label": ""},
            "fees": {
                "collected_pct": collected,
                "goal_pct": FEE_GOAL_PCT,
                "recent": [
                    {
                        "id": f.id,
                        "student": student_name(f.student),
                        "due_date": f.due_date.strftime("Due %b %d"),
                        "amount": float(f.amount),
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
                    "subject": getattr(getattr(t, "teacher_profile", None), "subject", None),
                    "active": t.is_active,
                }
                for t in teachers[:5]
            ],
        })