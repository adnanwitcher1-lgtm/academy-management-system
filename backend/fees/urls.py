from rest_framework.routers import DefaultRouter

from .views import FeePaymentViewSet, FeeStructureViewSet

router = DefaultRouter()
router.register("payments", FeePaymentViewSet, basename="feepayment")
router.register("structures", FeeStructureViewSet, basename="feestructure")

urlpatterns = router.urls