from django.db import models
from accounts.models import User
from academics.models import SchoolClass


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LEAVE = "leave", "Leave"

    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"}, related_name="attendance_records")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="attendance_marked")

    class Meta:
        unique_together = ("student", "date")


from django.utils import timezone as _tz


class AttendanceEntry(models.Model):
    """One student's attendance for one day."""

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"
        LEAVE = "leave", "Leave"

    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        limit_choices_to={"role": "student"},
        related_name="attendance_day_entries",
    )
    school_class = models.ForeignKey(
        "academics.SchoolClass", on_delete=models.CASCADE, related_name="attendance_day_entries"
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    note = models.CharField(max_length=200, blank=True)
    marked_at = models.DateTimeField(default=_tz.now)
    marked_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_day_marked"
    )

    class Meta:
        ordering = ["-date", "student"]
        unique_together = ("student", "date")
        indexes = [models.Index(fields=["school_class", "date"])]

    def __str__(self):
        return f"{self.student} {self.date} {self.status}"




class TeacherAttendance(models.Model):
    """One teacher's attendance for one day, marked by the admin."""

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"
        LEAVE = "leave", "Leave"

    teacher = models.ForeignKey(
        "accounts.TeacherProfile", on_delete=models.CASCADE, related_name="attendance_entries"
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    note = models.CharField(max_length=200, blank=True)
    marked_at = models.DateTimeField(default=_tz.now)
    marked_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="teacher_attendance_marked",
    )

    class Meta:
        ordering = ["-date", "id"]
        unique_together = ("teacher", "date")

    def __str__(self):
        return f"{self.teacher} {self.date} {self.status}"