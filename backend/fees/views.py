from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Count
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from academics.models import SchoolClass
from accounts.models import StudentProfile
from accounts.permissions import IsAdmin
from notifications.models import Notification
from notifications.service import notify

from . import billing
from .models import FeePayment, FeeStructure
from .pdf import fee_slip_response
from .serializers import (
    FeePaymentSerializer,
    FeeStructureSerializer,
    GenerateChallansSerializer,
)


def _display_name(user):
    profile = getattr(user, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    return (entry.full_name if entry and entry.full_name else user.get_full_name()) or user.username


def _class_label(user):
    profile = getattr(user, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    school_class = getattr(entry, "school_class", None) if entry else None
    return str(school_class) if school_class else ""


class FeeStructureViewSet(viewsets.ModelViewSet):
    """Staff only. One monthly fee per class."""

    queryset = FeeStructure.objects.select_related("school_class").order_by("class_name")
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=["get"])
    def overview(self, request):
        """Every class with its fee (if set) and how many registered students it has."""
        by_class = {
            fs.school_class_id: fs
            for fs in FeeStructure.objects.filter(school_class__isnull=False)
        }
        counts = {
            r["roster_entry__school_class"]: r["n"]
            for r in StudentProfile.objects.filter(
                roster_entry__is_claimed=True, roster_entry__school_class__isnull=False
            )
            .values("roster_entry__school_class")
            .annotate(n=Count("id"))
        }
        rows = []
        for c in SchoolClass.objects.all():
            fs = by_class.get(c.id)
            rows.append(
                {
                    "school_class": c.id,
                    "label": str(c),
                    "students": counts.get(c.id, 0),
                    "structure_id": fs.id if fs else None,
                    "amount": fs.amount if fs else None,
                }
            )
        rows.sort(key=lambda r: r["label"])
        return Response(rows)


class FeePaymentViewSet(viewsets.ModelViewSet):
    """
    Staff: full control (generate challans, mark paid, see dues).
    Student: read-only, and only their own challans. Teachers see none.
    """

    serializer_class = FeePaymentSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "slip"):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = FeePayment.objects.select_related(
            "student__student_profile__roster_entry__school_class"
        ).order_by("-due_date", "student__username")
        user = self.request.user
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "teacher":
            return qs.none()
        return qs

    def list(self, request, *args, **kwargs):
        # Make sure this month's challans exist (they are created automatically once a month).
        billing.ensure_current_month()
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        payment = serializer.save()
        self._after_save(payment, old_fine=0, old_status=None)

    def perform_update(self, serializer):
        old = serializer.instance
        old_fine, old_status = old.fine, old.status
        payment = serializer.save()
        self._after_save(payment, old_fine=old_fine, old_status=old_status)

    def _after_save(self, payment, old_fine, old_status):
        """Tell the student when a fine is added or a payment is received."""
        if payment.fine and payment.fine > (old_fine or 0):
            note = f" Reason: {payment.fine_note}." if payment.fine_note else ""
            notify(
                payment.student,
                "A fine was added to your fee challan",
                f"Challan {payment.challan_no} now has a fine of {billing.money(payment.fine)}. "
                f"New total: {billing.money(payment.total)}.{note}",
                kind=Notification.Kind.FINE,
                link="/student/fees",
            )
        if payment.status == FeePayment.Status.PAID and old_status != FeePayment.Status.PAID:
            by = f" Received by {payment.received_by_name}." if payment.received_by_name else ""
            notify(
                payment.student,
                "Fee payment received",
                f"We received {billing.money(payment.total)} for challan {payment.challan_no}.{by}",
                kind=Notification.Kind.PAYMENT,
                link="/student/fees",
            )

    def perform_destroy(self, instance):
        # If older unpaid challans were folded into this one, bring them back.
        FeePayment.objects.filter(carried_to=instance).update(
            status=FeePayment.Status.PENDING, carried_to=None
        )
        instance.delete()

    @action(detail=True, methods=["get"])
    def slip(self, request, pk=None):
        """Download this challan (or receipt, once paid) as a PDF."""
        return fee_slip_response(self.get_object())

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Only the unpaid challans (the live ones, not carried forward), oldest first."""
        billing.ensure_current_month()
        rows = list(self.get_queryset().filter(status=FeePayment.Status.PENDING).order_by("due_date", "student__username"))
        data = self.get_serializer(rows, many=True).data
        today = date.today()
        total = sum((r.total for r in rows), Decimal("0"))
        overdue = sum((r.total for r in rows if r.due_date < today), Decimal("0"))
        return Response(
            {
                "results": data,
                "summary": {
                    "count": len(data),
                    "total": total,
                    "overdue_total": overdue,
                    "students": len({r.student_id for r in rows}),
                },
            }
        )

    @action(detail=False, methods=["post"], url_path="generate-month")
    def generate_month(self, request):
        """Create a month's challans right now. Body: {"month": "2026-11"} (default: this month)."""
        raw = str(request.data.get("month") or "")
        try:
            year, month = (int(x) for x in raw.split("-")) if raw else (date.today().year, date.today().month)
            target = date(year, month, 1)
        except ValueError:
            return Response({"detail": "Use a month like 2026-11."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(billing.generate_for_month(target))

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """
        Create one pending challan per registered student.
        - class + amount: bill that class a custom amount
        - class only: bill that class at its fee structure amount
        - neither: bill every class that has a fee structure
        """
        ser = GenerateChallansSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        klass = data.get("school_class")
        amount = data.get("amount")
        due = data["due_date"]

        if klass and amount:
            targets = [(klass, amount)]
        elif klass:
            fs = FeeStructure.objects.filter(school_class=klass).first()
            if not fs:
                return Response(
                    {"detail": "This class has no fee set. Set it on the Fee structure page or enter an amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            targets = [(klass, fs.amount)]
        else:
            if amount:
                return Response(
                    {"detail": "Pick a class to bill a custom amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            targets = [
                (fs.school_class, fs.amount)
                for fs in FeeStructure.objects.select_related("school_class").filter(school_class__isnull=False)
            ]
            if not targets:
                return Response(
                    {"detail": "No class fees are set yet. Set them on the Fee structure page."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        created = skipped = 0
        with transaction.atomic():
            for school_class, amt in targets:
                profiles = StudentProfile.objects.select_related("user").filter(
                    roster_entry__school_class=school_class,
                    roster_entry__is_claimed=True,
                )
                for p in profiles:
                    if FeePayment.objects.filter(student=p.user, due_date=due).exists():
                        skipped += 1
                        continue
                    FeePayment.objects.create(student=p.user, amount=amt, due_date=due)
                    created += 1
        return Response({"created": created, "skipped": skipped, "classes": len(targets)})

    @action(detail=False, methods=["get"])
    def dues(self, request):
        """Outstanding amount per student, oldest dues first."""
        today = date.today()
        pending = (
            FeePayment.objects.select_related("student__student_profile__roster_entry__school_class")
            .filter(status=FeePayment.Status.PENDING)
            .order_by("due_date")
        )
        rows = {}
        for p in pending:
            row = rows.get(p.student_id)
            if row is None:
                row = rows[p.student_id] = {
                    "student": p.student_id,
                    "student_name": _display_name(p.student),
                    "class_label": _class_label(p.student),
                    "pending_count": 0,
                    "overdue_count": 0,
                    "outstanding": Decimal("0"),
                    "overdue_amount": Decimal("0"),
                    "oldest_due": p.due_date,
                }
            row["pending_count"] += 1
            row["outstanding"] += p.total
            if p.due_date < today:
                row["overdue_count"] += 1
                row["overdue_amount"] += p.total
        data = sorted(rows.values(), key=lambda r: (r["oldest_due"], r["student_name"]))
        return Response(data)

    @action(detail=False, methods=["get"])
    def students(self, request):
        """Registered students for the Add Fee Payment dropdown."""
        rows = []
        profiles = StudentProfile.objects.select_related(
            "user", "roster_entry__school_class"
        ).order_by("roster_entry__roll_no")
        for p in profiles:
            school_class = p.roster_entry.school_class
            rows.append(
                {
                    "id": p.user_id,
                    "name": p.roster_entry.full_name or p.user.get_full_name() or p.user.username,
                    "father_name": p.roster_entry.father_name,
                    "roll_no": p.roster_entry.roll_no,
                    "monthly_fee": p.roster_entry.monthly_fee,
                    "class_label": str(school_class) if school_class else "",
                }
            )
        return Response(rows)