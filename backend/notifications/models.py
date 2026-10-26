from django.db import models
from accounts.models import User


class Announcement(models.Model):
    title = models.CharField(max_length=150)
    body = models.TextField()
    target_role = models.CharField(
        max_length=10,
        choices=[("all", "All"), ("teacher", "Teachers"), ("student", "Students")],
        default="all",
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="announcements")
    created_at = models.DateTimeField(auto_now_add=True)



class Notification(models.Model):
    """A personal notice for one user (a new challan, a fine, a payment received)."""

    class Kind(models.TextChoices):
        GENERAL = "general", "General"
        CHALLAN = "challan", "Fee challan"
        FINE = "fine", "Fine"
        PAYMENT = "payment", "Payment"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.GENERAL)
    link = models.CharField(max_length=120, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.user} - {self.title}"
