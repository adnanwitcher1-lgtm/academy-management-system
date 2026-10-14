from django.conf import settings
from django.db import models


class UserSettings(models.Model):
    """Self-service profile extras and preferences for any signed-in user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="settings_profile")
    phone = models.CharField(max_length=30, blank=True)
    bio = models.CharField(max_length=240, blank=True)
    photo = models.TextField(blank=True)  # small cropped image stored as a data URL
    email_updates = models.BooleanField(default=True)
    class_reminders = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.user}"