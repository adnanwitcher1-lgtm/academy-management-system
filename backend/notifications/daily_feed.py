from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from exams.models import Exam
from fees.models import FeePayment
from inquiries.models import Inquiry
from timetable.models import TimetableSlot

from .models import Announcement
from .roles import IsAdminRole

try:
    from expenses.models import Expense
except (ImportError, RuntimeError):
    Expense = None

User = get_user_model()
AUDIENCE = {"all": "everyone", "teacher": "teachers", "student": "students"}


def _name(user):
    return (user.get_full_name() or user.username) if user else ""


def _fmt_time(t):
    return t.strftime("%I:%M %p").lstrip("0")


def _stamp(value):
    """Return (naive local datetime, has_time) so dates and datetimes sort together."""
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.replace(tzinfo=None), True
    return datetime.combine(value, time.min), False


class DailyFeedView(APIView):
    """Live feed for the admin 'Daily Queries' page, built from existing data."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        raw = request.query_params.get("days", "1")
        days = int(raw) if str(raw).isdigit() else 1
        days = max(1, min(days, 30))
        today = timezone.localdate()
        since = today - timedelta(days=days - 1)

        events = []

        def add(kind, title, detail, value):
            stamp, has_time = _stamp(value)
            events.append(
                {"type": kind, "title": title, "detail": detail, "at": stamp.isoformat(), "has_time": has_time, "_k": stamp}
            )

        students = list(User.objects.filter(role__iexact="student", date_joined__date__gte=since))
        for u in students:
            add("student", _name(u), "New student registered" if u.is_active else "New student signup, awaiting approval", u.date_joined)

        teachers = list(User.objects.filter(role__iexact="teacher", date_joined__date__gte=since))
        for u in teachers:
            add("teacher", _name(u), "New teacher added", u.date_joined)

        inquiries = list(Inquiry.objects.filter(created_at__date__gte=since).order_by("-created_at"))
        for i in inquiries:
            add("inquiry", i.student_name, f"New inquiry for {i.intended_class}", i.created_at)

        fees = list(FeePayment.objects.filter(status="paid", paid_on__gte=since).select_related("student"))
        fee_total = 0
        for f in fees:
            fee_total += float(f.amount)
            add("fee", _name(f.student), f"Fee of Rs {f.amount:,.0f} collected", f.paid_on)

        notices = list(Announcement.objects.filter(created_at__date__gte=since).select_related("created_by"))
        for a in notices:
            add("announcement", a.title, f"Announcement for {AUDIENCE.get(a.target_role, a.target_role)}", a.created_at)

        if Expense is not None:
            for e in Expense.objects.filter(created_at__date__gte=since):
                add("expense", e.title, f"Expense of Rs {e.amount:,.0f} ({e.category})", e.created_at)

        events.sort(key=lambda e: e["_k"], reverse=True)
        for e in events:
            del e["_k"]

        weekday = today.strftime("%A")
        lectures = [
            {
                "id": s.id,
                "start": _fmt_time(s.start_time),
                "end": _fmt_time(s.end_time),
                "class": str(s.school_class),
                "subject": s.subject.name,
                "teacher": _name(s.subject.teacher) if s.subject.teacher else "",
                "room": s.room,
            }
            for s in TimetableSlot.objects.filter(day_of_week=weekday)
            .select_related("school_class", "subject__teacher")
            .order_by("start_time")
        ]
        exams = [
            {"id": x.id, "name": x.name, "class": str(x.school_class) if x.school_class else ""}
            for x in Exam.objects.filter(date=today).select_related("school_class")
        ]

        return Response(
            {
                "date": today.isoformat(),
                "weekday": weekday,
                "days": days,
                "counts": {
                    "new_students": len(students),
                    "new_teachers": len(teachers),
                    "new_inquiries": len(inquiries),
                    "fees_collected": fee_total,
                    "fees_count": len(fees),
                    "announcements": len(notices),
                },
                "activity": events[:40],
                "inquiries": [
                    {
                        "id": i.id,
                        "student_name": i.student_name,
                        "guardian_name": i.guardian_name,
                        "guardian_phone": i.guardian_phone,
                        "intended_class": i.intended_class,
                        "source": i.get_source_display(),
                        "status": i.get_status_display(),
                        "created_at": i.created_at,
                    }
                    for i in inquiries[:50]
                ],
                "schedule": {"lectures": lectures, "exams": exams},
            }
        )