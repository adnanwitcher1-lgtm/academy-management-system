from rest_framework import serializers
from .models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = Announcement
        fields = ["id", "title", "body", "target_role", "created_by_name", "created_at"]
        read_only_fields = ["created_by_name", "created_at"]