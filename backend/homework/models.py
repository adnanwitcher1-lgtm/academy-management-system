from django.db import models
from accounts.models import User
from academics.models import Subject


class Homework(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="homework_items")
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    attachment = models.FileField(upload_to="homework/", blank=True, null=True)
    due_date = models.DateField()
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="homework_assigned")


class HomeworkSubmission(models.Model):
    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"}, related_name="homework_submissions")
    file = models.FileField(upload_to="submissions/", blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("homework", "student")
