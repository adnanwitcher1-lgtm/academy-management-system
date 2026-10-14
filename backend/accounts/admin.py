from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, StudentRoster, StudentProfile, TeacherProfile


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "role", "first_name", "last_name", "is_active"]
    fieldsets = UserAdmin.fieldsets + (
        ("Role info", {"fields": ("role", "phone_number", "must_change_password")}),
    )


admin.site.register(StudentRoster)
admin.site.register(StudentProfile)
admin.site.register(TeacherProfile)


# ---- Teacher profile admin: also shows the login's name, email and contact number ----
from django import forms as _forms
from django.contrib import admin as _admin
from django.contrib.admin.sites import NotRegistered as _NotRegistered

from .models import TeacherProfile as _TeacherProfile


class _TeacherProfileForm(_forms.ModelForm):
    first_name = _forms.CharField(required=False)
    last_name = _forms.CharField(required=False)
    phone_number = _forms.CharField(required=False, label="Contact No")
    email = _forms.EmailField(required=False)

    class Meta:
        model = _TeacherProfile
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            user = self.instance.user
            for name in ("first_name", "last_name", "phone_number", "email"):
                self.fields[name].initial = getattr(user, name)


class _TeacherProfileAdmin(_admin.ModelAdmin):
    form = _TeacherProfileForm
    fields = (
        "user", "first_name", "last_name", "phone_number", "email", "cnic", "address",
        "subject_specialization", "joining_date", "shift_start", "shift_end", "salary",
    )
    list_display = (
        "full_name", "username", "contact_no", "cnic", "joining_date",
        "shift_start", "shift_end", "salary",
    )
    list_select_related = ("user",)
    search_fields = (
        "user__username", "user__first_name", "user__last_name", "user__phone_number", "cnic",
    )

    @_admin.display(description="Name")
    def full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    @_admin.display(description="Username")
    def username(self, obj):
        return obj.user.username

    @_admin.display(description="Contact No")
    def contact_no(self, obj):
        return obj.user.phone_number

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        user = obj.user
        for name in ("first_name", "last_name", "phone_number", "email"):
            value = form.cleaned_data.get(name, "")
            # When adding, leave the login's existing values alone unless something was typed.
            if change or value:
                setattr(user, name, value)
        user.save()


try:
    _admin.site.unregister(_TeacherProfile)
except _NotRegistered:
    pass
_admin.site.register(_TeacherProfile, _TeacherProfileAdmin)

# ---- Teacher profile admin, part 2: tasks table and lectures (subjects) picker ----
from academics.models import Subject as _Subject

from .models import TeacherTask as _TeacherTask


class _TeacherProfileFormV2(_TeacherProfileForm):
    lectures = _forms.ModelMultipleChoiceField(
        queryset=_Subject.objects.select_related("school_class").order_by("name"),
        required=False,
        label="Lectures (subjects)",
        help_text="Subjects this teacher teaches, from the Subject List. A subject has one teacher.",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["lectures"].initial = _Subject.objects.filter(teacher=self.instance.user)


class _TeacherTaskInline(_admin.TabularInline):
    model = _TeacherTask
    extra = 1
    fields = ("title", "frequency", "due_date", "is_done")


class _TeacherProfileAdminV2(_TeacherProfileAdmin):
    form = _TeacherProfileFormV2
    inlines = [_TeacherTaskInline]
    fields = _TeacherProfileAdmin.fields + ("lectures",)
    list_display = _TeacherProfileAdmin.list_display + ("lecture_count", "open_tasks")

    @_admin.display(description="Lectures")
    def lecture_count(self, obj):
        return _Subject.objects.filter(teacher=obj.user).count()

    @_admin.display(description="Open tasks")
    def open_tasks(self, obj):
        return obj.tasks.filter(is_done=False).count()

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        chosen = form.cleaned_data.get("lectures")
        if chosen is None:
            return
        user = form.instance.user
        chosen_ids = [s.pk for s in chosen]
        # Only unassign when the Subject.teacher column allows an empty value.
        if _Subject._meta.get_field("teacher").null:
            _Subject.objects.filter(teacher=user).exclude(pk__in=chosen_ids).update(teacher=None)
        _Subject.objects.filter(pk__in=chosen_ids).update(teacher=user)


_admin.site.unregister(_TeacherProfile)
_admin.site.register(_TeacherProfile, _TeacherProfileAdminV2)