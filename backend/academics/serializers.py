from rest_framework import serializers
from .models import Subject, SchoolClass


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = ["id", "name", "section"]


class SubjectSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.username", read_only=True)
    school_class_name = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = ["id", "name", "code", "school_class", "school_class_name", "teacher", "teacher_name"]

    def get_school_class_name(self, obj):
        c = obj.school_class
        return f"{c.name} {c.section}".strip() if c else None

from accounts.models import StudentProfile


class SubjectStudentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="roster_entry.full_name", read_only=True)
    roll_no = serializers.CharField(source="roster_entry.roll_no", read_only=True)

    class Meta:
        model = StudentProfile
        fields = ["id", "username", "full_name", "roll_no"]


# Adds the student's User id: Mark.student is a ForeignKey to User, not StudentProfile.
_BaseSubjectStudentSerializer = SubjectStudentSerializer


class SubjectStudentSerializer(_BaseSubjectStudentSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["user_id"] = instance.user_id
        return data