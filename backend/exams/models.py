from django.db import models
from accounts.models import User
from academics.models import Subject, SchoolClass


class Exam(models.Model):
    name = models.CharField(max_length=100)  # e.g. "Mid Term 2026"
    date = models.DateField()
    school_class = models.ForeignKey(
        SchoolClass, on_delete=models.SET_NULL, null=True, blank=True, related_name="exams"
    )

    def __str__(self):
        return self.name


class Mark(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="marks")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="marks")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"}, related_name="marks")
    obtained_marks = models.DecimalField(max_digits=6, decimal_places=2)
    total_marks = models.DecimalField(max_digits=6, decimal_places=2, default=100)
    entered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="marks_entered")
    updated_at = models.DateTimeField(auto_now=True)
    date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("exam", "subject", "student")

    @property
    def percentage(self):
        if not self.total_marks:
            return 0
        return round((self.obtained_marks / self.total_marks) * 100, 2)

    def __str__(self):
        return f"{self.student} - {self.subject.code} - {self.obtained_marks}/{self.total_marks}"
