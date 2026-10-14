from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import StudentRoster
from .permissions import IsAdmin
from .serializers import (
    MyTokenObtainPairSerializer,
    CreateTeacherSerializer,
    EnrollStudentRosterSerializer,
    StudentSignUpSerializer,
    PendingStudentSerializer,
)

User = get_user_model()


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class CreateTeacherView(generics.CreateAPIView):
    serializer_class = CreateTeacherSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "username": serializer._generated_username,
                "temporary_password": serializer._generated_password,
                "message": "Teacher account created. Share these credentials securely; "
                           "the teacher must change the password on first login.",
            },
            status=status.HTTP_201_CREATED,
        )


class EnrollStudentRosterView(generics.CreateAPIView):
    queryset = StudentRoster.objects.all()
    serializer_class = EnrollStudentRosterSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        roster = serializer.save()
        return Response(
            {
                "username": serializer._generated_username,
                "phone_number": roster.phone_number,
                "full_name": roster.full_name,
                "message": "Student account created.",
            },
            status=status.HTTP_201_CREATED,
        )


class StudentRosterListView(generics.ListAPIView):
    queryset = StudentRoster.objects.all().order_by("roll_no")
    serializer_class = EnrollStudentRosterSerializer
    permission_classes = [IsAdmin]


class StudentSignUpView(generics.CreateAPIView):
    serializer_class = StudentSignUpSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if serializer._is_pre_enrolled:
            message = "Account created. You can now log in."
        else:
            message = "Signup submitted. An admin needs to approve your account before you can log in."
        return Response(
            {"username": user.username, "pending_approval": not serializer._is_pre_enrolled, "message": message},
            status=status.HTTP_201_CREATED,
        )


class PendingStudentsListView(generics.ListAPIView):
    serializer_class = PendingStudentSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return User.objects.filter(
            role=User.Role.STUDENT, is_active=False, student_profile__roster_entry__source=StudentRoster.Source.SELF,
        ).select_related("student_profile__roster_entry")


class ApproveStudentView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, role=User.Role.STUDENT)
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"username": user.username, "message": "Student account approved and activated."})


class RejectStudentView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, role=User.Role.STUDENT, is_active=False)
        username = user.username
        roster_entry = user.student_profile.roster_entry if hasattr(user, "student_profile") else None
        user.delete()
        if roster_entry:
            roster_entry.delete()
        return Response({"username": username, "message": "Signup rejected and removed."})


from .serializers import TeacherListSerializer


class TeacherListView(generics.ListAPIView):
    queryset = User.objects.filter(role=User.Role.TEACHER).order_by("username")
    serializer_class = TeacherListSerializer
    permission_classes = [IsAdmin]


from .models import TeacherProfile
from .serializers import TeacherProfileSerializer


class TeacherProfileListView(generics.ListAPIView):
    queryset = TeacherProfile.objects.select_related("user").order_by("user__username")
    serializer_class = TeacherProfileSerializer
    permission_classes = [IsAdmin]


class TeacherProfileDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TeacherProfile.objects.select_related("user")
    serializer_class = TeacherProfileSerializer
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        from academics.models import Subject

        profile = self.get_object()
        user = profile.user
        subjects = Subject.objects.filter(teacher=user)
        if subjects.exists():
            if Subject._meta.get_field("teacher").null:
                subjects.update(teacher=None)
            else:
                return Response(
                    {"detail": "This teacher still has subjects. Assign those subjects to another teacher first, then delete."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


from rest_framework import generics
from rest_framework.response import Response
from .models import StudentRoster
from .serializers import StudentRosterManageSerializer


class StudentRosterManageListView(generics.ListAPIView):
    queryset = StudentRoster.objects.all().order_by("-id")
    serializer_class = StudentRosterManageSerializer
    permission_classes = [IsAdmin]


class StudentRosterManageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = StudentRoster.objects.all()
    serializer_class = StudentRosterManageSerializer
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        entry = self.get_object()
        if entry.is_claimed or hasattr(entry, "student_account"):
            return Response(
                {"detail": "This student already has a login account, so the roster record cannot be deleted."},
                status=400,
            )
        entry.delete()
        return Response(status=204)

class ResetTeacherPasswordView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        import secrets
        from .models import TeacherProfile

        profile = get_object_or_404(TeacherProfile, pk=pk)
        user = profile.user
        temp_password = secrets.token_urlsafe(6)
        user.set_password(temp_password)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
        return Response(
            {
                "username": user.username,
                "temporary_password": temp_password,
                "message": "Password reset. Share the new credentials securely; "
                           "the teacher must change the password on first login.",
            },
            status=status.HTTP_200_OK,
        )


class ResetTeacherPasswordView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        import secrets
        from .models import TeacherProfile

        profile = get_object_or_404(TeacherProfile, pk=pk)
        user = profile.user
        temp_password = secrets.token_urlsafe(6)
        user.set_password(temp_password)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
        return Response(
            {
                "username": user.username,
                "temporary_password": temp_password,
                "message": "Password reset. Share the new credentials securely; "
                           "the teacher must change the password on first login.",
            },
            status=status.HTTP_200_OK,
        )
