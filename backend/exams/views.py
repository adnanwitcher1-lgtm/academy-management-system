from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.models import StudentProfile
from accounts.permissions import IsAdmin, IsTeacher
from .models import Exam, Mark
from .pdf import result_card_response
from .serializers import ExamSerializer, MarkSerializer


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.select_related("school_class").all()
    serializer_class = ExamSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    @action(detail=True, methods=["get"], url_path=r"report-card/(?P<student_id>\d+)", permission_classes=[permissions.IsAuthenticated])
    def report_card(self, request, pk=None, student_id=None):
        """Result card PDF. Admin can download any student's; a student only their own."""
        user = request.user
        if user.role == "student" and str(user.id) != str(student_id):
            return Response({"detail": "You can only download your own result card."}, status=403)
        if user.role not in ("admin", "student"):
            return Response({"detail": "Not allowed."}, status=403)
        exam = self.get_object()
        student = get_user_model().objects.filter(pk=student_id, role="student").first()
        if not student:
            return Response({"detail": "Student not found."}, status=404)
        return result_card_response(exam, student)

    @action(detail=True, methods=["get"], permission_classes=[IsAdmin])
    def results(self, request, pk=None):
        exam = self.get_object()
        marks = (
            Mark.objects.select_related("subject", "student")
            .filter(exam=exam)
            .order_by("student__first_name", "student__username", "subject__name")
        )
        profiles = {
            p.user_id: p
            for p in StudentProfile.objects.select_related("roster_entry").filter(
                user_id__in=[m.student_id for m in marks]
            )
        }
        by_student = {}
        for m in marks:
            sid = m.student_id
            if sid not in by_student:
                profile = profiles.get(sid)
                by_student[sid] = {
                    "student_id": sid,
                    "student_name": (
                        getattr(getattr(profile, "roster_entry", None), "full_name", "")
                        or m.student.get_full_name()
                        or m.student.username
                    ),
                    "roll_no": getattr(getattr(profile, "roster_entry", None), "roll_no", None),
                    "rows": [],
                    "obtained_total": 0.0,
                    "total_total": 0.0,
                }
            entry = by_student[sid]
            entry["rows"].append({
                "subject_name": m.subject.name,
                "date": m.date.isoformat() if m.date else None, "obtained_marks": float(m.obtained_marks),
                "total_marks": float(m.total_marks),
            })
            entry["obtained_total"] += float(m.obtained_marks)
            entry["total_total"] += float(m.total_marks)

        results = []
        for entry in by_student.values():
            entry["percentage"] = (
                round(entry["obtained_total"] / entry["total_total"] * 100, 2)
                if entry["total_total"] else 0
            )
            results.append(entry)
        results.sort(key=lambda r: r["student_name"])
        return Response(results)


class MarkViewSet(viewsets.ModelViewSet):
    serializer_class = MarkSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        if getattr(self.request.user, "role", None) == "admin":
            return [permissions.IsAuthenticated()]
        return [IsTeacher()]

    def get_queryset(self):
        user = self.request.user
        qs = Mark.objects.select_related("subject", "student", "exam")
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "teacher":
            return qs.filter(subject__teacher=user)
        return qs  # admin sees everything
