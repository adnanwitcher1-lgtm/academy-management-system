"""Monthly challan generation.

Every month each active student gets one challan:
  * the amount is the student's own monthly fee, or else their class fee;
  * the due date is the 10th;
  * any older unpaid challan is folded into `arrears` and marked "carried forward",
    so the newest challan always shows everything the student owes.

It runs automatically the first time anyone opens the app in a new month (see
`ensure_current_month`) and can also be run by hand:  manage.py generate_monthly_challans
"""

import logging
import time
from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction

from accounts.models import StudentProfile
from notifications.models import Notification
from notifications.service import admin_users, notify

from .models import FeePayment, FeeStructure

log = logging.getLogger(__name__)
DUE_DAY = 10
_last_check = {"key": None, "at": 0.0}


def month_start(day):
    return date(day.year, day.month, 1)


def month_label(day):
    return day.strftime("%B %Y")


def money(value):
    value = Decimal(value or 0)
    return "Rs {:,.0f}".format(value) if value == value.to_integral_value() else "Rs {:,.2f}".format(value)


def monthly_fee_for(profile, class_fees):
    """The fee to bill this student: their own fee, else their class fee, else nothing."""
    entry = profile.roster_entry
    if entry.monthly_fee is not None and entry.monthly_fee > 0:
        return entry.monthly_fee
    return class_fees.get(entry.school_class_id)


def generate_for_month(month, notify_people=True):
    """Create the challans for `month` (a date on the 1st). Safe to run again: it only fills gaps."""
    month = month_start(month)
    last_day = date(month.year, month.month, monthrange(month.year, month.month)[1])
    due = date(month.year, month.month, DUE_DAY)
    class_fees = {
        fs.school_class_id: fs.amount for fs in FeeStructure.objects.filter(school_class__isnull=False)
    }

    profiles = (
        StudentProfile.objects.select_related("user", "roster_entry")
        .filter(user__is_active=True, roster_entry__is_claimed=True)
    )
    created, skipped_no_fee = [], 0
    for profile in profiles:
        user = profile.user
        if profile.roster_entry.created_at.date() > last_day:
            continue  # enrolled after this month
        if FeePayment.objects.filter(student=user, month=month).exists():
            continue
        fee = monthly_fee_for(profile, class_fees)
        if not fee:
            skipped_no_fee += 1
            continue
        try:
            with transaction.atomic():
                older = list(
                    FeePayment.objects.select_for_update()
                    .filter(student=user, status=FeePayment.Status.PENDING)
                    .exclude(month=month)
                    .filter(due_date__lt=month)
                )
                arrears = sum((p.total for p in older), Decimal("0"))
                challan = FeePayment.objects.create(
                    student=user, amount=fee, due_date=due, month=month, arrears=arrears,
                )
                for p in older:
                    p.status = FeePayment.Status.CARRIED
                    p.carried_to = challan
                    p.save(update_fields=["status", "carried_to"])
        except IntegrityError:
            continue  # another request created it a moment ago
        created.append(challan)

    if created and notify_people:
        label = month_label(month)
        for c in created:
            extra = f" It includes {money(c.arrears)} unpaid from earlier months." if c.arrears else ""
            notify(
                c.student,
                f"Fee challan for {label}",
                f"Your challan of {money(c.total)} is ready. Due date: {due.strftime('%d %b %Y')}.{extra}",
                kind=Notification.Kind.CHALLAN,
                link="/student/fees",
            )
        notify(
            admin_users(),
            f"{len(created)} fee challans generated for {label}",
            f"Challans were created automatically. Due date {due.strftime('%d %b %Y')}."
            + (f" {skipped_no_fee} students were skipped because no fee is set for them." if skipped_no_fee else ""),
            kind=Notification.Kind.CHALLAN,
            link="/fees/pending",
        )
    return {"month": month.isoformat(), "created": len(created), "skipped_no_fee": skipped_no_fee}


def ensure_current_month():
    """Called from a few busy endpoints. Cheap: only does real work once per month (re-checked every 10 min)."""
    today = date.today()
    key = (today.year, today.month)
    now = time.time()
    if _last_check["key"] == key and now - _last_check["at"] < 600:
        return None
    try:
        result = generate_for_month(today)
    except Exception:  # never break a page because billing failed
        log.exception("Automatic challan generation failed")
        return None
    _last_check["key"] = key
    _last_check["at"] = now
    return result
