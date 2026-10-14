from django.urls import path

from .views import MeView, PasswordView

urlpatterns = [
    path("me/", MeView.as_view(), name="profile-me"),
    path("password/", PasswordView.as_view(), name="profile-password"),
]