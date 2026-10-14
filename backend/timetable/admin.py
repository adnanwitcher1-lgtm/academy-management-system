from django.contrib import admin

from .models import TimetableSlot


@admin.register(TimetableSlot)
class TimetableSlotAdmin(admin.ModelAdmin):
    list_display = ("school_class", "day_of_week", "start_time", "end_time", "subject", "room")
    list_filter = ("school_class", "day_of_week")
    search_fields = ("subject__name", "subject__code")