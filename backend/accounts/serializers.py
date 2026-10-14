from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import StudentRoster, StudentProfile, TeacherProfile

User = get_user_model()


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = self.user.role
        data["username"] = self.user.username
        data["must_change_password"] = self.user.must_change_password
        return data


class NewTeacherTaskSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    frequency = serializers.ChoiceField(choices=["daily", "weekly", "monthly"], default="daily")
    due_date = serializers.DateField(required=False, allow_null=True)

class CreateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    username = serializers.CharField(required=False)
    subject_specialization = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    cnic = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    joining_date = serializers.DateField(required=False, allow_null=True)
    salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    shift_start = serializers.TimeField(required=False, allow_null=True)
    shift_end = serializers.TimeField(required=False, allow_null=True)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    tasks = NewTeacherTaskSerializer(many=True, required=False)

    def validate_subject_ids(self, ids):
        from academics.models import Subject
        if Subject.objects.filter(pk__in=ids).count() != len(set(ids)):
            raise serializers.ValidationError("One or more subjects do not exist.")
        return ids

    def validate_cnic(self, value):
        import re
        if value and not re.fullmatch(r"\d{5}-\d{7}-\d", value):
            raise serializers.ValidationError("Use the format 00000-0000000-0.")
        return value

    def create(self, validated_data):
        import secrets

        username = validated_data.get("username") or (
            f"{validated_data['first_name']}.{validated_data.get('last_name', '')}".strip(".").lower()
        )
        base_username, suffix = username, 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        temp_password = validated_data.get("password") or secrets.token_urlsafe(6)
        user = User.objects.create_user(
            username=username,
            password=temp_password,
            first_name=validated_data["first_name"],
            last_name=validated_data.get("last_name", ""),
            email=validated_data.get("email", ""),
            phone_number=validated_data.get("phone_number", ""),
            role=User.Role.TEACHER,
            must_change_password=True,
        )
        profile = TeacherProfile.objects.create(
            user=user,
            subject_specialization=validated_data.get("subject_specialization", ""),
            cnic=validated_data.get("cnic", ""),
            address=validated_data.get("address", ""),
            joining_date=validated_data.get("joining_date"),
            salary=validated_data.get("salary"),
            shift_start=validated_data.get("shift_start"),
            shift_end=validated_data.get("shift_end"),
        )
        from academics.models import Subject
        from .models import TeacherTask

        subject_ids = validated_data.get("subject_ids") or []
        if subject_ids:
            Subject.objects.filter(pk__in=subject_ids).update(teacher=user)
        for t in validated_data.get("tasks") or []:
            TeacherTask.objects.create(
                teacher=profile,
                title=t["title"],
                frequency=t.get("frequency", "daily"),
                due_date=t.get("due_date"),
            )
        self._generated_username = username
        self._generated_password = temp_password
        return user


class EnrollStudentRosterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = StudentRoster
        fields = [
            "roll_no", "full_name", "class_name", "section", "school_class",
            "date_of_birth", "cnic_or_bform", "phone_number", "activation_code", "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")

        roster = StudentRoster.objects.create(**validated_data, source=StudentRoster.Source.ADMIN)

        username = roster.roll_no.strip().lower()
        base_username, suffix = username, 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=roster.full_name,
            role=User.Role.STUDENT,
            must_change_password=False,
        )
        StudentProfile.objects.create(user=user, roster_entry=roster)
        roster.is_claimed = True
        roster.save(update_fields=["is_claimed"])

        self._generated_username = username
        return roster


class StudentSignUpSerializer(serializers.Serializer):
    roll_no = serializers.CharField()
    full_name = serializers.CharField()
    class_name = serializers.CharField(required=False, allow_blank=True)
    section = serializers.CharField(required=False, allow_blank=True)
    activation_code = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        roster_entry = StudentRoster.objects.filter(roll_no=attrs["roll_no"]).first()

        if roster_entry:
            if roster_entry.is_claimed:
                raise serializers.ValidationError({"roll_no": "An account already exists for this Roll No."})
            if roster_entry.full_name.strip().lower() != attrs["full_name"].strip().lower():
                raise serializers.ValidationError({"full_name": "Name does not match our records for this Roll No."})
            if roster_entry.activation_code and roster_entry.activation_code != attrs.get("activation_code"):
                raise serializers.ValidationError({"activation_code": "Invalid or missing activation code."})
        else:
            if not attrs.get("class_name"):
                raise serializers.ValidationError(
                    {"class_name": "Required when your Roll No. hasn't already been enrolled by admin."}
                )

        if User.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "That username is already taken."})

        attrs["roster_entry"] = roster_entry
        return attrs

    def create(self, validated_data):
        roster_entry = validated_data["roster_entry"]
        is_pre_enrolled = roster_entry is not None

        if not is_pre_enrolled:
            roster_entry = StudentRoster.objects.create(
                roll_no=validated_data["roll_no"],
                full_name=validated_data["full_name"],
                class_name=validated_data.get("class_name", ""),
                section=validated_data.get("section", ""),
                source=StudentRoster.Source.SELF,
            )

        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            first_name=roster_entry.full_name.split(" ")[0],
            role=User.Role.STUDENT,
            is_active=is_pre_enrolled,
        )
        StudentProfile.objects.create(user=user, roster_entry=roster_entry)
        roster_entry.is_claimed = True
        roster_entry.save(update_fields=["is_claimed"])
        self._is_pre_enrolled = is_pre_enrolled
        return user


class PendingStudentSerializer(serializers.ModelSerializer):
    roll_no = serializers.CharField(source="student_profile.roster_entry.roll_no", read_only=True)
    class_name = serializers.CharField(source="student_profile.roster_entry.class_name", read_only=True)
    section = serializers.CharField(source="student_profile.roster_entry.section", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "date_joined", "roll_no", "class_name", "section"]
class TeacherListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]

class TeacherProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    phone_number = serializers.CharField(source="user.phone_number", required=False, allow_blank=True)
    is_active = serializers.BooleanField(source="user.is_active", required=False)
    assigned_lectures = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True)

    def get_assigned_lectures(self, obj):
        from academics.models import Subject
        subjects = Subject.objects.select_related("school_class").filter(teacher=obj.user)
        return [
            {"id": x.id, "name": x.name, "class_name": str(x.school_class) if x.school_class_id else ""}
            for x in subjects
        ]

    def validate_cnic(self, value):
        import re
        if value and not re.fullmatch(r"\d{5}-\d{7}-\d", value):
            raise serializers.ValidationError("Use the format 00000-0000000-0.")
        return value

    class Meta:
        model = TeacherProfile
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone_number",
            "subject_specialization", "cnic", "address", "joining_date", "salary",
            "shift_start", "shift_end", "is_active", "assigned_lectures", "date_joined",
        ]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        instance.user.save()
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class StudentRosterManageSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StudentRoster
        fields = [
            "id", "roll_no", "full_name", "class_name", "section", "school_class",
            "date_of_birth", "cnic_or_bform", "phone_number", "activation_code",
            "source", "is_claimed", "created_at", "password", "username",
        ]
        read_only_fields = ["source", "is_claimed", "created_at"]

    def get_username(self, obj):
        account = getattr(obj, "student_account", None)
        return account.user.username if account else None

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "")

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if password:
            account = getattr(instance, "student_account", None)
            if account:
                account.user.set_password(password)
                account.user.must_change_password = True
                account.user.save(update_fields=["password", "must_change_password"])

        return instance