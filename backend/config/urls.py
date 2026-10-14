from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/academics/', include('academics.urls')),
    path('api/exams/', include('exams.urls')),
    path('api/fees/', include('fees.urls')),
    path('api/inquiries/', include('inquiries.urls')),
    path('api/timetable/', include('timetable.urls')),
]

from accounts.dashboard_views import DashboardSummaryView
urlpatterns += [path("api/dashboard/summary/", DashboardSummaryView.as_view()),
    path('api/attendance/', include('attendance.api_urls')),
    path('api/expenses/', include('expenses.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/profiles/', include('profiles.urls')),
]
