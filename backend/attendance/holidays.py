"""Which days is the academy closed?  Sundays always, plus any day added as a Holiday."""

from datetime import date, timedelta

from django.db import transaction

from accounts.models import StudentProfile

from .models import AttendanceEntry, Holiday

WEEKLY_OFF = {6: "Sunday"}  # Python weekday(): Monday=0 ... Sunday=6


def holiday_title(day):
    """The reason the academy is closed on `day`, or None if it is a working day."""
    row = Holiday.objects.filter(date=day).first()
    if row:
        return row.title
    if day.weekday() in WEEKLY_OFF:
        return WEEKLY_OFF[day.weekday()] + " (weekly off)"
    return None


def holiday_map(start, end):
    """{date: title} for every closed day between two dates (inclusive)."""
    out = {}
    named = {h.date: h.title for h in Holiday.objects.filter(date__gte=start, date__lte=end)}
    day = start
    while day <= end:
        if day in named:
            out[day] = named[day]
        elif day.weekday() in WEEKLY_OFF:
            out[day] = WEEKLY_OFF[day.weekday()] + " (weekly off)"
        day += timedelta(days=1)
    return out


def mark_holiday_for_students(day, students=None):
    """Give every student without a record on `day` a "holiday" record. Never overwrites a real mark."""
    if students is None:
        students = list(
            StudentProfile.objects.select_related("roster_entry")
            .filter(roster_entry__is_claimed=True, user__is_active=True)
        )
    have = set(AttendanceEntry.objects.filter(date=day).values_list("student_id", flat=True))
    rows = [
        AttendanceEntry(
            student_id=p.user_id,
            school_class_id=p.roster_entry.school_class_id,
            date=day,
            status=AttendanceEntry.Status.HOLIDAY,
        )
        for p in students
        if p.user_id not in have and p.roster_entry.school_class_id
    ]
    if rows:
        with transaction.atomic():
            AttendanceEntry.objects.bulk_create(rows, ignore_conflicts=True)
    return len(rows)


def clear_holiday_rows(day):
    """Remove the automatic holiday rows of a day that is no longer a holiday."""
    AttendanceEntry.objects.filter(
        date=day, status=AttendanceEntry.Status.HOLIDAY, marked_by__isnull=True
    ).delete()
