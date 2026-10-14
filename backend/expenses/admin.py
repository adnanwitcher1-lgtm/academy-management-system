from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("title", "amount", "date", "category")
    list_filter = ("category", "date")
    search_fields = ("title", "category", "description")