from django.core.exceptions import ValidationError
from django.db import models

from academics.models import SchoolClass, Subject

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _fmt(t):
    return t.strftime("%I:%M %p").lstrip("0")


class TimetableSlot(models.Model):
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="timetable_slots")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="timetable_slots")
    day_of_week = models.CharField(max_length=10, choices=[(d, d) for d in DAYS])  # Monday..Saturday
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return f"{self.school_class} - {self.day_of_week} {_fmt(self.start_time)} to {_fmt(self.end_time)}"

    def clean(self):
        """Used by the Django admin and by the API serializer, so both enforce the same rules."""
        if not (self.school_class_id and self.subject_id and self.day_of_week and self.start_time and self.end_time):
            return
        if self.end_time <= self.start_time:
            raise ValidationError("The end time must be after the start time.")
        if self.subject.school_class_id != self.school_class_id:
            raise ValidationError("That subject belongs to another class.")

        clashes = TimetableSlot.objects.filter(
            day_of_week=self.day_of_week,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
        ).select_related("school_class", "subject__teacher")
        if self.pk:
            clashes = clashes.exclude(pk=self.pk)

        same_class = clashes.filter(school_class_id=self.school_class_id).first()
        if same_class:
            raise ValidationError(
                f"{same_class.school_class} already has {same_class.subject.name} from "
                f"{_fmt(same_class.start_time)} to {_fmt(same_class.end_time)} on {self.day_of_week}."
            )

        teacher = self.subject.teacher
        if teacher:
            busy = clashes.filter(subject__teacher_id=teacher.id).first()
            if busy:
                name = teacher.get_full_name() or teacher.username
                raise ValidationError(
                    f"{name} is already teaching {busy.subject.name} to {busy.school_class} from "
                    f"{_fmt(busy.start_time)} to {_fmt(busy.end_time)} on {self.day_of_week}."
                )