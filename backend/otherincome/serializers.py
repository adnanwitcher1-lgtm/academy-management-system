from rest_framework import serializers

from .models import OtherCollection


def _student_name(user):
    if not user:
        return ""
    profile = getattr(user, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    return (entry.full_name if entry and entry.full_name else user.get_full_name()) or user.username


class OtherCollectionSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    student_name = serializers.SerializerMethodField()
    paid_by = serializers.SerializerMethodField()

    class Meta:
        model = OtherCollection
        fields = [
            "id", "date", "category", "category_label", "item", "quantity", "amount",
            "student", "student_name", "payer_name", "paid_by", "received_by_name", "note", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_student_name(self, obj):
        return _student_name(obj.student)

    def get_paid_by(self, obj):
        return _student_name(obj.student) or obj.payer_name

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (attrs.get("received_by_name") or (self.instance and self.instance.received_by_name)):
            if user and user.is_authenticated:
                attrs["received_by_name"] = user.get_full_name() or user.username
        return attrs
