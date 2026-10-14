from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import DAYS, TimetableSlot


class TimetableSlotSerializer(serializers.ModelSerializer):
    day_of_week = serializers.ChoiceField(choices=DAYS)
    class_label = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    teacher_id = serializers.IntegerField(source="subject.teacher_id", read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = TimetableSlot
        fields = [
            "id", "school_class", "class_label", "subject", "subject_name", "subject_code",
            "teacher_id", "teacher_name", "day_of_week", "start_time", "end_time", "room",
        ]

    def get_class_label(self, obj):
        return str(obj.school_class)

    def get_teacher_name(self, obj):
        teacher = obj.subject.teacher
        if not teacher:
            return ""
        return teacher.get_full_name() or teacher.username

    def validate(self, attrs):
        inst = self.instance

        def pick(name):
            return attrs.get(name, getattr(inst, name) if inst else None)

        probe = TimetableSlot(
            pk=inst.pk if inst else None,
            school_class=pick("school_class"),
            subject=pick("subject"),
            day_of_week=pick("day_of_week"),
            start_time=pick("start_time"),
            end_time=pick("end_time"),
        )
        try:
            probe.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return attrs