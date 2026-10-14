from rest_framework.routers import DefaultRouter
from .views import ExamViewSet, MarkViewSet

router = DefaultRouter()
router.register("exams", ExamViewSet, basename="exam")
router.register("marks", MarkViewSet, basename="mark")

urlpatterns = router.urls
