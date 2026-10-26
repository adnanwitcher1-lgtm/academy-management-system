from datetime import time

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from academics.models import SchoolClass, Subject
from accounts.permissions import IsAdmin

from .models import DAYS, TimetableSlot
from .serializers import TimetableSlotSerializer


def _student_class(user):
    profile = getattr(user, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    return getattr(entry, "school_class", None) if entry else None


class TimetableSlotViewSet(viewsets.ModelViewSet):
    """
    Staff: full control, optionally filtered with ?school_class=<id>.
    Teacher: read-only, only the lectures of their own subjects.
    Student: read-only, only their own class.
    """

    serializer_class = TimetableSlotSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = TimetableSlot.objects.select_related("school_class", "subject__teacher").order_by("start_time", "id")
        user = self.request.user
        if user.role == "teacher":
            return qs.filter(subject__teacher=user)
        if user.role == "student":
            klass = _student_class(user)
            return qs.filter(school_class=klass) if klass else qs.none()
        class_id = self.request.query_params.get("school_class")
        if class_id and class_id.isdigit():
            qs = qs.filter(school_class_id=int(class_id))
        return qs

    @action(detail=False, methods=["get"])
    def options(self, request):
        """Classes and subjects for the Add Lecture form."""
        classes = [{"id": c.id, "label": str(c)} for c in SchoolClass.objects.all()]
        classes.sort(key=lambda c: c["label"])
        subjects = []
        for s in Subject.objects.select_related("teacher").order_by("name"):
            subjects.append(
                {
                    "id": s.id,
                    "label": f"{s.name} ({s.code})",
                    "school_class": s.school_class_id,
                    "teacher_name": (s.teacher.get_full_name() or s.teacher.username) if s.teacher_id else "",
                }
            )
        return Response({"classes": classes, "subjects": subjects, "days": DAYS})

    # ------------------------------------------------------------------
    # Whole-cell editing: one cell = one class, one time slot, many subjects
    # ------------------------------------------------------------------

    @staticmethod
    def _bad(message):
        return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def _time(raw):
        try:
            parts = [int(x) for x in str(raw).split(":")[:2]]
            return time(parts[0], parts[1])
        except (ValueError, IndexError, TypeError):
            return None

    def _days(self, raw):
        if raw == "all":
            return list(DAYS)
        days = raw if isinstance(raw, list) else [raw]
        return [d for d in days if d in DAYS]

    @action(detail=False, methods=["post"], url_path="set-cell")
    def set_cell(self, request):
        """
        Save one cell of the timetable for one or more days.
        Body: {school_class, days: ["Monday", ...] or "all", start_time, end_time, subject_ids: [..], room}
        Whatever was in that exact cell before is replaced, so this is also how you edit a cell.
        """
        d = request.data
        klass = SchoolClass.objects.filter(pk=d.get("school_class")).first()
        start, end = self._time(d.get("start_time")), self._time(d.get("end_time"))
        days = self._days(d.get("days"))
        ids = d.get("subject_ids") or []
        if not klass:
            return self._bad("Pick a class.")
        if not days:
            return self._bad("Pick at least one day.")
        if not start or not end or end <= start:
            return self._bad("The end time must be after the start time.")
        if not isinstance(ids, list) or not ids:
            return self._bad("Pick at least one subject.")
        subjects = list(Subject.objects.select_related("teacher").filter(pk__in=ids, school_class=klass))
        if len(subjects) != len(set(ids)):
            return self._bad("One of the subjects does not belong to this class.")
        room = str(d.get("room") or "")[:30]

        try:
            with transaction.atomic():
                for day in days:
                    TimetableSlot.objects.filter(
                        school_class=klass, day_of_week=day, start_time=start, end_time=end
                    ).delete()
                    for subject in subjects:
                        slot = TimetableSlot(
                            school_class=klass, subject=subject, day_of_week=day,
                            start_time=start, end_time=end, room=room,
                        )
                        slot.clean()
                        slot.save()
        except DjangoValidationError as e:
            return self._bad(" ".join(e.messages))
        return Response({"saved": len(subjects) * len(days), "days": days})

    @action(detail=False, methods=["post"], url_path="delete-cell")
    def delete_cell(self, request):
        """Remove every subject in one cell. Body: {school_class, days, start_time, end_time}."""
        d = request.data
        start, end = self._time(d.get("start_time")), self._time(d.get("end_time"))
        days = self._days(d.get("days"))
        if not (start and end and days and d.get("school_class")):
            return self._bad("Pick the class, day and time to remove.")
        deleted, _ = TimetableSlot.objects.filter(
            school_class_id=d.get("school_class"), day_of_week__in=days, start_time=start, end_time=end
        ).delete()
        return Response({"deleted": deleted})

    @action(detail=False, methods=["post"], url_path="copy-day")
    def copy_day(self, request):
        """Copy a whole day to other days. Body: {from_day, to_days: [...] or "all"}. Replaces the target days."""
        d = request.data
        source = d.get("from_day")
        targets = [x for x in self._days(d.get("to_days")) if x != source]
        if source not in DAYS or not targets:
            return self._bad("Pick the day to copy from and at least one different day to copy to.")
        slots = list(TimetableSlot.objects.filter(day_of_week=source))
        if not slots:
            return self._bad(f"{source} has no lectures to copy.")
        with transaction.atomic():
            TimetableSlot.objects.filter(day_of_week__in=targets).delete()
            TimetableSlot.objects.bulk_create(
                [
                    TimetableSlot(
                        school_class_id=s.school_class_id, subject_id=s.subject_id, day_of_week=day,
                        start_time=s.start_time, end_time=s.end_time, room=s.room,
                    )
                    for day in targets
                    for s in slots
                ]
            )
        return Response({"copied": len(slots) * len(targets), "days": targets})

    @action(detail=False, methods=["post"], url_path="clear-day")
    def clear_day(self, request):
        """Delete every lecture of a day (optionally only one class). Body: {day, school_class?}."""
        d = request.data
        days = self._days(d.get("day"))
        if not days:
            return self._bad("Pick a day.")
        qs = TimetableSlot.objects.filter(day_of_week__in=days)
        if d.get("school_class"):
            qs = qs.filter(school_class_id=d.get("school_class"))
        deleted, _ = qs.delete()
        return Response({"deleted": deleted})
