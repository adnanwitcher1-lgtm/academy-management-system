from django.conf import settings
from django.db import models


class OtherCollection(models.Model):
    """Money the academy receives that is NOT a monthly fee: sheets, notes, books, etc."""

    class Category(models.TextChoices):
        SHEETS = "sheets", "Sheets"
        NOTES = "notes", "Notes"
        BOOKS = "books", "Books"
        STATIONERY = "stationery", "Stationery"
        REGISTRATION = "registration", "Registration / admission"
        TEST = "test", "Test / exam fee"
        OTHER = "other", "Other"

    date = models.DateField()
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    item = models.CharField(max_length=150, help_text="What was sold or collected, e.g. Chemistry notes")
    quantity = models.PositiveIntegerField(default=1)
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total amount received")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="other_collections", limit_choices_to={"role": "student"},
    )
    payer_name = models.CharField(max_length=150, blank=True, help_text="Who paid (if not a registered student)")
    received_by_name = models.CharField(max_length=150, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.item} - {self.amount}"
