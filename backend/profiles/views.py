import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TeacherProfile

from .models import UserSettings

MAX_PHOTO_CHARS = 400_000
PHONE_RE = re.compile(r"^[0-9+()\-\s]{0,30}$")


def _bad(message, status=400):
    return Response({"detail": message}, status=status)


def _payload(user):
    prefs, _ = UserSettings.objects.get_or_create(user=user)
    teacher = TeacherProfile.objects.filter(user=user).first()
    return {
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name(),
        "email": user.email,
        "role": getattr(user, "role", ""),
        "specialization": getattr(teacher, "subject_specialization", "") if teacher else "",
        "phone": prefs.phone,
        "bio": prefs.bio,
        "photo": prefs.photo,
        "email_updates": prefs.email_updates,
        "class_reminders": prefs.class_reminders,
    }


class MeView(APIView):
    """The signed-in user's own profile: GET to read, PATCH to edit."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_payload(request.user))

    def patch(self, request):
        user = request.user
        prefs, _ = UserSettings.objects.get_or_create(user=user)
        data = request.data
        errors = []

        if "full_name" in data:
            name = " ".join(str(data.get("full_name") or "").split())
            if not name:
                errors.append("Full name is required.")
            else:
                parts = name.split(" ", 1)
                user.first_name = parts[0][:150]
                user.last_name = parts[1][:150] if len(parts) > 1 else ""

        if "email" in data:
            email = str(data.get("email") or "").strip()
            if email:
                try:
                    validate_email(email)
                except ValidationError:
                    errors.append("Enter a valid email address.")
                else:
                    user.email = email
            else:
                user.email = ""

        if "phone" in data:
            phone = str(data.get("phone") or "").strip()
            if PHONE_RE.match(phone):
                prefs.phone = phone
            else:
                errors.append("Phone number can only contain digits, spaces, + ( ) and -.")

        if "bio" in data:
            bio = str(data.get("bio") or "").strip()
            if len(bio) > 240:
                errors.append("Bio can be at most 240 characters.")
            else:
                prefs.bio = bio

        if "photo" in data:
            photo = data.get("photo") or ""
            if photo == "":
                prefs.photo = ""
            elif isinstance(photo, str) and photo.startswith("data:image/") and len(photo) <= MAX_PHOTO_CHARS:
                prefs.photo = photo
            else:
                errors.append("That photo is not valid or is too large.")

        for key in ("email_updates", "class_reminders"):
            if key in data:
                value = data.get(key)
                if isinstance(value, bool):
                    setattr(prefs, key, value)
                else:
                    errors.append("Notification settings must be true or false.")

        if errors:
            return _bad(" ".join(errors))

        user.save()
        prefs.save()
        return Response(_payload(user))


class PasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current = str(request.data.get("current_password") or "")
        new = str(request.data.get("new_password") or "")
        if not user.check_password(current):
            return _bad("Your current password is incorrect.")
        if new == current:
            return _bad("Choose a new password that is different from the current one.")
        try:
            validate_password(new, user)
        except ValidationError as e:
            return _bad(" ".join(e.messages))
        user.set_password(new)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})