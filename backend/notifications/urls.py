from django.urls import path

from .daily_feed import DailyFeedView
from .views import (
    AnnouncementDetailView,
    AnnouncementListCreateView,
    InboxReadAllView,
    InboxReadView,
    InboxView,
)

urlpatterns = [
    path("announcements/", AnnouncementListCreateView.as_view(), name="announcement-list-create"),
    path("announcements/<int:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),
    path("daily/", DailyFeedView.as_view(), name="daily-feed"),
    path("inbox/", InboxView.as_view(), name="inbox"),
    path("inbox/read-all/", InboxReadAllView.as_view(), name="inbox-read-all"),
    path("inbox/<int:pk>/read/", InboxReadView.as_view(), name="inbox-read"),
]
