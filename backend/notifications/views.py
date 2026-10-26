from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Announcement, Notification
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


class InboxView(APIView):
    """The signed-in user's personal notifications (newest first) and the unread count."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        rows = [
            {
                "id": n.id, "title": n.title, "body": n.body, "kind": n.kind,
                "link": n.link, "is_read": n.is_read, "created_at": n.created_at,
            }
            for n in qs[:50]
        ]
        return Response({"results": rows, "unread": qs.filter(is_read=False).count()})


class InboxReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        Notification.objects.filter(user=request.user, pk=pk).update(is_read=True)
        return Response({"ok": True})


class InboxReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"ok": True})
