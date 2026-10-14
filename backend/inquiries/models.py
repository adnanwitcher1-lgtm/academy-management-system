from django.db import models


class Inquiry(models.Model):
    class Source(models.TextChoices):
        WALK_IN = "walk_in", "Walk-in"
        PHONE = "phone", "Phone call"
        SOCIAL = "social", "Social media"
        WEBSITE = "website", "Website"

    class Status(models.TextChoices):
        NEW = "new", "New lead"
        TRIAL = "trial", "Trial class assigned"
        FOLLOW_UP = "follow_up", "Follow-up call"
        ENROLLED = "enrolled", "Enrolled"
        DROPPED = "dropped", "Dropped"

    student_name = models.CharField(max_length=120)
    guardian_name = models.CharField(max_length=120, blank=True)
    guardian_phone = models.CharField(max_length=30)
    intended_class = models.CharField(max_length=50)
    current_school = models.CharField(max_length=150, blank=True)
    subjects = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.WALK_IN)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "inquiries"

    def __str__(self):
        return f"{self.student_name} ({self.get_status_display()})"