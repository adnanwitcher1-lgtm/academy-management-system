from rest_framework import serializers

from .models import Inquiry


class InquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = [
            "id", "student_name", "guardian_name", "guardian_phone", "intended_class",
            "current_school", "subjects", "source", "status", "follow_up_date",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]