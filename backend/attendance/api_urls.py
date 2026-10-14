from django.urls import path

from .attendance_api import (
    AttendanceClassesView,
    AttendanceSearchView,
    AttendanceSheetView,
    AttendanceTodayView,
    AttendanceTrendView,
    StudentAttendanceView,
    TeacherAttendanceHistoryView,
    TeacherAttendanceSheetView,
)

urlpatterns = [
    path("classes/", AttendanceClassesView.as_view(), name="attendance-classes"),
    path("sheet/", AttendanceSheetView.as_view(), name="attendance-sheet"),
    path("search/", AttendanceSearchView.as_view(), name="attendance-search"),
    path("student/<int:user_id>/", StudentAttendanceView.as_view(), name="attendance-student"),
    path("summary/", AttendanceTodayView.as_view(), name="attendance-today"),
    path("trend/", AttendanceTrendView.as_view(), name="attendance-trend"),
    path("teachers/sheet/", TeacherAttendanceSheetView.as_view(), name="attendance-teacher-sheet"),
    path("teachers/history/", TeacherAttendanceHistoryView.as_view(), name="attendance-teacher-history"),
]