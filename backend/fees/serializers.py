from datetime import date

from rest_framework import serializers

from academics.models import SchoolClass

from .models import FeePayment, FeeStructure


class FeeStructureSerializer(serializers.ModelSerializer):
    class_label = serializers.SerializerMethodField()

    class Meta:
        model = FeeStructure
        fields = ["id", "school_class", "class_label", "amount"]
        extra_kwargs = {"school_class": {"required": True, "allow_null": False}}

    def get_class_label(self, obj):
        return str(obj.school_class) if obj.school_class_id else obj.class_name

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The fee must be more than zero.")
        return value


class FeePaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    father_name = serializers.SerializerMethodField()
    roll_no = serializers.SerializerMethodField()
    school_class = serializers.SerializerMethodField()
    class_label = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    challan_no = serializers.ReadOnlyField()
    month_label = serializers.SerializerMethodField()
    status = serializers.ChoiceField(choices=["paid", "pending"], required=False)
    received_by_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta:
        model = FeePayment
        fields = [
            "id", "challan_no", "student", "student_name", "father_name", "roll_no",
            "school_class", "class_label", "month", "month_label",
            "amount", "arrears", "fine", "fine_note", "total",
            "due_date", "status", "paid_on", "received_by_name",
        ]
        extra_kwargs = {
            "arrears": {"required": False},
            "fine": {"required": False},
            "fine_note": {"required": False},
            "month": {"read_only": True},
        }

    def _roster_entry(self, obj):
        profile = getattr(obj.student, "student_profile", None)
        return getattr(profile, "roster_entry", None) if profile else None

    def get_student_name(self, obj):
        entry = self._roster_entry(obj)
        if entry and entry.full_name:
            return entry.full_name
        return obj.student.get_full_name() or obj.student.username

    def get_father_name(self, obj):
        entry = self._roster_entry(obj)
        return entry.father_name if entry else ""

    def get_roll_no(self, obj):
        entry = self._roster_entry(obj)
        return entry.roll_no if entry else ""

    def get_school_class(self, obj):
        entry = self._roster_entry(obj)
        school_class = getattr(entry, "school_class", None) if entry else None
        return school_class.id if school_class else None

    def get_class_label(self, obj):
        entry = self._roster_entry(obj)
        school_class = getattr(entry, "school_class", None) if entry else None
        return str(school_class) if school_class else ""

    def get_total(self, obj):
        return obj.total

    def get_month_label(self, obj):
        return obj.month.strftime("%B %Y") if obj.month else ""

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Carried-forward challans are shown as such instead of looking like live dues.
        if obj.status == FeePayment.Status.CARRIED:
            data["status"] = "carried"
        return data

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount must be more than zero.")
        return value

    def validate_arrears(self, value):
        if value < 0:
            raise serializers.ValidationError("Arrears cannot be negative.")
        return value

    def validate_fine(self, value):
        if value < 0:
            raise serializers.ValidationError("The fine cannot be negative.")
        return value

    def _who(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None, ""
        return user, (user.get_full_name() or user.username)

    def validate(self, attrs):
        current = self.instance
        if current and current.status == FeePayment.Status.CARRIED:
            raise serializers.ValidationError(
                "This challan was carried forward into a newer challan. Edit the newer challan instead."
            )
        status = attrs.get("status", current.status if current else FeePayment.Status.PENDING)
        if status == FeePayment.Status.PAID:
            paid_on = attrs.get("paid_on", current.paid_on if current else None)
            attrs["paid_on"] = paid_on or date.today()
            user, default_name = self._who()
            name = (attrs.get("received_by_name") or "").strip()
            if not name and current and current.received_by_name:
                name = current.received_by_name
            attrs["received_by_name"] = name or default_name
            if user and not (current and current.received_by_id):
                attrs["received_by"] = user
        else:
            attrs["paid_on"] = None
            attrs["received_by_name"] = ""
            attrs["received_by"] = None
        return attrs


class GenerateChallansSerializer(serializers.Serializer):
    school_class = serializers.PrimaryKeyRelatedField(
        queryset=SchoolClass.objects.all(), required=False, allow_null=True
    )
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=1, required=False, allow_null=True
    )
    due_date = serializers.DateField()