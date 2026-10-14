from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, SchoolClassViewSet

router = DefaultRouter()
router.register("subjects", SubjectViewSet, basename="subject")
router.register("classes", SchoolClassViewSet, basename="schoolclass")

urlpatterns = router.urls

from .views import SubjectStudentsView

urlpatterns += [
    path("subjects/<int:pk>/students/", SubjectStudentsView.as_view(), name="subject-students"),
]
