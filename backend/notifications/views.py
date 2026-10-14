from rest_framework import generics, permissions

from .models import Announcement
from .roles import IsAdminRole, is_admin_user
from .serializers import AnnouncementSerializer


class AnnouncementListCreateView(generics.ListCreateAPIView):
    serializer_class = AnnouncementSerializer

    def get_queryset(self):
        qs = Announcement.objects.select_related("created_by").order_by("-created_at")
        if is_admin_user(self.request.user):
            return qs
        role = str(getattr(self.request.user, "role", "")).lower()
        return qs.filter(target_role__in=["all", role])

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AnnouncementDetailView(generics.DestroyAPIView):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminRole]