from rest_framework.routers import DefaultRouter

from .views import OtherCollectionViewSet

router = DefaultRouter()
router.register("", OtherCollectionViewSet, basename="collections")

urlpatterns = router.urls
