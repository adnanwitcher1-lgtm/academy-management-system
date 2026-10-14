from rest_framework.routers import DefaultRouter

from .views import InquiryViewSet

router = DefaultRouter()
router.register("leads", InquiryViewSet, basename="inquiry")

urlpatterns = router.urls