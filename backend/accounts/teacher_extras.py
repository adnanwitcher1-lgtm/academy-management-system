from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.routers import SimpleRouter
from rest_framework.views import APIView

from academics.models import Subject

from .models import TeacherProfile, TeacherTask
from .permissions import IsAdmin


class TeacherTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherTask
        fields = ["id", "teacher", "title", "frequency", "due_date", "is_done", "created_at"]
        read_only_fields = ["created_at"]


class TeacherTaskViewSet(viewsets.ModelViewSet):
    """Staff: full control. Teacher: own tasks only, and may only tick them done. Students: nothing."""

    serializer_class = TeacherTaskSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "partial_update"):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = TeacherTask.objects.select_related("teacher__user")
        user = self.request.user
        if user.role == "student":
            return qs.none()
        if user.role == "teacher":
            qs = qs.filter(teacher__user=user)
        teacher = self.request.query_params.get("teacher")
        if teacher and teacher.isdigit():
            qs = qs.filter(teacher_id=int(teacher))
        return qs

    def partial_update(self, request, *args, **kwargs):
        if request.user.role == "teacher" and set(request.data.keys()) - {"is_done"}:
            raise PermissionDenied("Teachers can only mark a task done or not done.")
        return super().partial_update(request, *args, **kwargs)


def _subject_rows(profile):
    rows = []
    for s in Subject.objects.select_related("school_class", "teacher").order_by("name"):
        rows.append(
            {
                "id": s.id,
                "name": s.name,
                "class_name": str(s.school_class) if s.school_class_id else "",
                "teacher_id": s.teacher_id,
                "teacher_name": (s.teacher.get_full_name() or s.teacher.username) if s.teacher_id else "",
                "mine": s.teacher_id == profile.user_id,
            }
        )
    return rows


class TeacherLecturesView(APIView):
    """Which subjects (lectures) a teacher teaches. Same link as the Subjects page."""

    permission_classes = [IsAdmin]

    def _payload(self, profile):
        return {
            "subjects": _subject_rows(profile),
            "unassign_supported": bool(Subject._meta.get_field("teacher").null),
        }

    def get(self, request, pk):
        profile = get_object_or_404(TeacherProfile.objects.select_related("user"), pk=pk)
        return Response(self._payload(profile))

    def post(self, request, pk):
        profile = get_object_or_404(TeacherProfile.objects.select_related("user"), pk=pk)
        ids = request.data.get("subject_ids")
        if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            raise ValidationError({"subject_ids": "Send a list of subject ids."})
        ids = sorted(set(ids))
        if Subject.objects.filter(pk__in=ids).count() != len(ids):
            raise ValidationError({"subject_ids": "One or more subjects do not exist."})
        if Subject._meta.get_field("teacher").null:
            Subject.objects.filter(teacher=profile.user).exclude(pk__in=ids).update(teacher=None)
        Subject.objects.filter(pk__in=ids).update(teacher=profile.user)
        return Response(self._payload(profile))


task_router = SimpleRouter()
task_router.register("teachers/tasks", TeacherTaskViewSet, basename="teachertask")

class LectureOptionsView(APIView):
    """Every subject with its current teacher, for the Add Teacher form's Lectures picker."""

    permission_classes = [IsAdmin]

    def get(self, request):
        rows = []
        for s in Subject.objects.select_related("school_class", "teacher").order_by("name"):
            rows.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "class_name": str(s.school_class) if s.school_class_id else "",
                    "teacher_id": s.teacher_id,
                    "teacher_name": (s.teacher.get_full_name() or s.teacher.username) if s.teacher_id else "",
                }
            )
        return Response(rows)