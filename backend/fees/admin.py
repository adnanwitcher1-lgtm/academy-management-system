from datetime import date

from django.contrib import admin

from .models import FeePayment, FeeStructure


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    fields = ("school_class", "amount")
    list_display = ("class_label", "amount")
    search_fields = ("class_name",)

    @admin.display(description="Class")
    def class_label(self, obj):
        return str(obj.school_class) if obj.school_class_id else obj.class_name


@admin.register(FeePayment)
class FeePaymentAdmin(admin.ModelAdmin):
    list_display = ("student_name", "amount", "due_date", "status", "paid_on")
    list_filter = ("status", "due_date")
    list_select_related = ("student",)
    search_fields = ("student__username", "student__first_name", "student__last_name")
    date_hierarchy = "due_date"
    actions = ["mark_paid"]

    @admin.display(description="Student", ordering="student__username")
    def student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    @admin.action(description="Mark selected challans as paid")
    def mark_paid(self, request, queryset):
        updated = queryset.filter(status=FeePayment.Status.PENDING).update(
            status=FeePayment.Status.PAID, paid_on=date.today()
        )
        self.message_user(request, str(updated) + " challan(s) marked as paid.")

    def save_model(self, request, obj, form, change):
        if obj.status == FeePayment.Status.PAID and not obj.paid_on:
            obj.paid_on = date.today()
        elif obj.status != FeePayment.Status.PAID:
            obj.paid_on = None
        super().save_model(request, obj, form, change)