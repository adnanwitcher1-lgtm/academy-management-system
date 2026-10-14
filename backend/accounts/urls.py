from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    MyTokenObtainPairView,
    CreateTeacherView,
    EnrollStudentRosterView,
    StudentRosterListView,
    StudentSignUpView,
    PendingStudentsListView,
    ApproveStudentView,
    RejectStudentView,
)

from .views import StudentRosterManageListView, StudentRosterManageDetailView

urlpatterns = [
    path("login/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("login/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("teachers/create/", CreateTeacherView.as_view(), name="create-teacher"),
    path("students/roster/enroll/", EnrollStudentRosterView.as_view(), name="enroll-student-roster"),
    path("students/roster/", StudentRosterListView.as_view(), name="student-roster-list"),
    path("students/manage/", StudentRosterManageListView.as_view(), name="student-manage-list"),
    path("students/manage/<int:pk>/", StudentRosterManageDetailView.as_view(), name="student-manage-detail"),
    path("students/signup/", StudentSignUpView.as_view(), name="student-signup"),
    path("students/pending/", PendingStudentsListView.as_view(), name="pending-students"),
    path("students/pending/<int:pk>/approve/", ApproveStudentView.as_view(), name="approve-student"),
    path("students/pending/<int:pk>/reject/", RejectStudentView.as_view(), name="reject-student"),
]
from .views import TeacherListView

urlpatterns += [
    path("teachers/", TeacherListView.as_view(), name="teacher-list"),
]

from .views import TeacherListView

urlpatterns += [
    path("teachers/", TeacherListView.as_view(), name="teacher-list"),
]

from .views import TeacherProfileListView, TeacherProfileDetailView

urlpatterns += [
    path("teachers/profiles/", TeacherProfileListView.as_view(), name="teacher-profile-list"),
    path("teachers/profiles/<int:pk>/", TeacherProfileDetailView.as_view(), name="teacher-profile-detail"),
]


from .teacher_extras import TeacherLecturesView, task_router

urlpatterns += [
    path("teachers/profiles/<int:pk>/lectures/", TeacherLecturesView.as_view(), name="teacher-lectures"),
]
urlpatterns += task_router.urls

from .teacher_extras import LectureOptionsView

urlpatterns += [
    path("teachers/lecture-options/", LectureOptionsView.as_view(), name="teacher-lecture-options"),
]
from .views import ResetTeacherPasswordView

urlpatterns += [
    path("teachers/profiles/<int:pk>/reset-password/", ResetTeacherPasswordView.as_view(), name="teacher-reset-password"),
]
