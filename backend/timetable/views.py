from rest_framework import permissions, viewsets
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