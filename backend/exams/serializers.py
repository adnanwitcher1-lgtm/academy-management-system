from rest_framework import serializers
from .models import Exam, Mark


class ExamSerializer(serializers.ModelSerializer):
    school_class_name = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = ["id", "name", "date", "school_class", "school_class_name"]

    def get_school_class_name(self, obj):
        if not obj.school_class_id:
            return None
        return f"{obj.school_class.name} {obj.school_class.section}".strip()


class MarkSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    exam_name = serializers.CharField(source="exam.name", read_only=True)
    exam_date = serializers.DateField(source="exam.date", read_only=True)
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    percentage = serializers.ReadOnlyField()

    class Meta:
        model = Mark
        fields = [
            "id", "exam", "exam_name", "exam_date", "subject", "subject_name", "student", "student_name",
            "obtained_marks", "total_marks", "percentage", "date", "entered_by", "updated_at",
        ]
        read_only_fields = ["entered_by", "updated_at"]

    def validate_subject(self, subject):
        request = self.context["request"]
        if request.user.role == "teacher" and subject.teacher_id != request.user.id:
            raise serializers.ValidationError("You can only enter marks for subjects assigned to you.")
        return subject

    def create(self, validated_data):
        validated_data["entered_by"] = self.context["request"].user
        return super().create(validated_data)
