from decimal import Decimal

from django.db import models
from django.db.models import Q
from accounts.models import User


class FeeStructure(models.Model):
    """The monthly fee for one class, used to generate challans without typing the amount each time."""

    class_name = models.CharField(max_length=50, blank=True)
    school_class = models.OneToOneField(
        "academics.SchoolClass",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fee_structure",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        if self.school_class_id:
            self.class_name = str(self.school_class)[:50]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.class_name} - {self.amount}"


class FeePayment(models.Model):
    """One fee challan. total = monthly fee + arrears carried from older unpaid months + fine."""

    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        PENDING = "pending", "Pending"
        # Unpaid, but added into a newer challan's arrears. Never counted twice.
        CARRIED = "carried", "Carried forward"

    student = models.ForeignKey(
        User, on_delete=models.CASCADE, limit_choices_to={"role": "student"}, related_name="fee_payments"
    )
    # The monthly fee for this challan (kept as `amount` so older code keeps working).
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_on = models.DateField(null=True, blank=True)

    # Which month this challan bills (always the 1st). Empty for challans added by hand.
    month = models.DateField(null=True, blank=True)
    arrears = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fine = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fine_note = models.CharField(max_length=200, blank=True)
    carried_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="carried_from"
    )

    received_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="fees_received"
    )
    received_by_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "month"],
                condition=Q(month__isnull=False),
                name="one_challan_per_student_per_month",
            )
        ]

    @property
    def total(self):
        return (self.amount or Decimal("0")) + (self.arrears or Decimal("0")) + (self.fine or Decimal("0"))

    @property
    def challan_no(self):
        return "FEE-" + str(self.pk).zfill(5)

    def __str__(self):
        return f"{self.challan_no} {self.student} {self.total}"
