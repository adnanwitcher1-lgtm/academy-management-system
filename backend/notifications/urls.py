from django.urls import path

from .daily_feed import DailyFeedView
from .views import AnnouncementDetailView, AnnouncementListCreateView

urlpatterns = [
    path("announcements/", AnnouncementListCreateView.as_view(), name="announcement-list-create"),
    path("announcements/<int:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),
    path("daily/", DailyFeedView.as_view(), name="daily-feed"),
]