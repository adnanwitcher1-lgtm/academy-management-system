from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, viewsets

from accounts.models import StudentProfile
from accounts.permissions import IsAdmin

from .models import Subject, SchoolClass
from .serializers import (
    SchoolClassSerializer,
    SubjectSerializer,
    SubjectStudentSerializer,
)


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.all()
    serializer_class = SchoolClassSerializer
    permission_classes = [IsAdmin]


class SubjectViewSet(viewsets.ModelViewSet):
    """
    Admin: full CRUD (manages the Subject List).
    Teacher/Student: read-only - this is exactly the live list the
    marks-entry dropdown (frontend) fetches from.
    """

    queryset = Subject.objects.select_related("school_class", "teacher").all()
    serializer_class = SubjectSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "teacher":
            # a teacher's dropdown only needs their own subjects
            return qs.filter(teacher=user)
        return qs


class SubjectStudentsView(generics.ListAPIView):
    serializer_class = SubjectStudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subject = get_object_or_404(Subject, pk=self.kwargs["pk"])
        user = self.request.user
        if user.role == "student":
            return StudentProfile.objects.none()
        if user.role == "teacher" and subject.teacher_id != user.id:
            return StudentProfile.objects.none()
        if not subject.school_class_id:
            return StudentProfile.objects.none()
        return (
            StudentProfile.objects.select_related("user", "roster_entry")
            .filter(
                roster_entry__school_class_id=subject.school_class_id,
                roster_entry__is_claimed=True,
            )
            .order_by("pk")
        )