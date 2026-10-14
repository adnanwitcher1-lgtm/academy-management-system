from django.db import models
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
    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        PENDING = "pending", "Pending"

    student = models.ForeignKey(
        User, on_delete=models.CASCADE, limit_choices_to={"role": "student"}, related_name="fee_payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_on = models.DateField(null=True, blank=True)