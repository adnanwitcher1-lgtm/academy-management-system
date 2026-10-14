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
