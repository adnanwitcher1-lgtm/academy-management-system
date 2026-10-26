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
        """Used by the Django admin and by the API serializer, so both enforce the same rules.

        A class may have several subjects in the SAME time slot (for example BIO and COMP together),
        but two different time slots of one class may not overlap, and a teacher cannot be in
        two classes at once."""
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

        for other in clashes.filter(school_class_id=self.school_class_id):
            same_cell = other.start_time == self.start_time and other.end_time == self.end_time
            if not same_cell:
                raise ValidationError(
                    f"{other.school_class} already has {other.subject.name} from "
                    f"{_fmt(other.start_time)} to {_fmt(other.end_time)} on {self.day_of_week}, "
                    "which overlaps this time. Use the same start and end time to add another subject to that slot."
                )
            if other.subject_id == self.subject_id:
                raise ValidationError(f"{self.subject.name} is already in this slot.")

        teacher = self.subject.teacher
        if teacher:
            busy = clashes.filter(subject__teacher_id=teacher.id).exclude(school_class_id=self.school_class_id).first()
            if busy:
                name = teacher.get_full_name() or teacher.username
                raise ValidationError(
                    f"{name} is already teaching {busy.subject.name} to {busy.school_class} from "
                    f"{_fmt(busy.start_time)} to {_fmt(busy.end_time)} on {self.day_of_week}."
                )
