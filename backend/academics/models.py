from django.db import models
from accounts.models import User


class SchoolClass(models.Model):
    name = models.CharField(max_length=50)  # e.g. "9th", "O-Level"
    section = models.CharField(max_length=10, blank=True)

    class Meta:
        unique_together = ("name", "section")

    def __str__(self):
        return f"{self.name} {self.section}".strip()


class Subject(models.Model):
    """
    Admin-maintained Subject List (Section 5.1). Teacher marks-entry dropdowns
    are populated live from this table so teachers can only pick real subjects.
    """

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="subjects")
    teacher = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        limit_choices_to={"role": "teacher"}, related_name="subjects_taught",
    )

    def __str__(self):
        return f"{self.code} — {self.name} ({self.school_class})"
