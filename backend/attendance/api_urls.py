from django.urls import path

from .attendance_api import (
    AttendanceClassesView,
    AttendanceSearchView,
    AttendanceSheetView,
    AttendanceTodayView,
    AttendanceTrendView,
    HolidayDetailView,
    HolidayListView,
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
    path("holidays/", HolidayListView.as_view(), name="attendance-holidays"),
    path("holidays/<int:pk>/", HolidayDetailView.as_view(), name="attendance-holiday-detail"),
    path("teachers/sheet/", TeacherAttendanceSheetView.as_view(), name="attendance-teacher-sheet"),
    path("teachers/history/", TeacherAttendanceHistoryView.as_view(), name="attendance-teacher-history"),
]