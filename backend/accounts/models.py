from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        TEACHER = "teacher", "Teacher"
        STUDENT = "student", "Student"

    role = models.CharField(max_length=10, choices=Role.choices)
    phone_number = models.CharField(max_length=20, blank=True)
    must_change_password = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"


class StudentRoster(models.Model):
    class Source(models.TextChoices):
        ADMIN = "admin", "Enrolled by admin (pre-verified)"
        SELF = "self", "Submitted by student at signup (needs admin approval)"

    roll_no = models.CharField(max_length=30, unique=True)
    full_name = models.CharField(max_length=150)
    class_name = models.CharField(max_length=50)
    section = models.CharField(max_length=10, blank=True)
    school_class = models.ForeignKey(
        "academics.SchoolClass", on_delete=models.SET_NULL, null=True, blank=True, related_name="student_rosters"
    )
    date_of_birth = models.DateField(null=True, blank=True)
    cnic_or_bform = models.CharField(max_length=30, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    activation_code = models.CharField(max_length=10, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.ADMIN)
    is_claimed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.roll_no} - {self.full_name}"




class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    roster_entry = models.OneToOneField(StudentRoster, on_delete=models.PROTECT, related_name="student_account")

    def __str__(self):
        return f"{self.user.username} - Roll No {self.roster_entry.roll_no}"


class TeacherProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="teacher_profile")
    subject_specialization = models.CharField(max_length=100, blank=True)
    cnic = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    shift_start = models.TimeField(null=True, blank=True)
    shift_end = models.TimeField(null=True, blank=True)

    def __str__(self):
        return self.user.username








class TeacherTask(models.Model):
    class Frequency(models.TextChoices):
        DAILY = "daily", "Task of the day"
        WEEKLY = "weekly", "Task of the week"
        MONTHLY = "monthly", "Task of the month"

    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.DAILY)
    due_date = models.DateField(null=True, blank=True)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_done", "due_date", "-created_at"]

    def __str__(self):
        return self.title