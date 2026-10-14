from django.contrib import admin

# Register your models here.


from django.contrib import admin as _adm

from .models import AttendanceEntry as _AttendanceEntry


@_adm.register(_AttendanceEntry)
class AttendanceEntryAdmin(_adm.ModelAdmin):
    list_display = ("student_name", "school_class", "date", "status", "marked_at", "marked_by")
    list_filter = ("status", "school_class", "date")
    search_fields = ("student__username", "student__first_name", "student__last_name")
    date_hierarchy = "date"
    list_select_related = ("student", "school_class", "marked_by")

    @_adm.display(description="Student", ordering="student__username")
    def student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username