from django.contrib import admin

from .models import OtherCollection


@admin.register(OtherCollection)
class OtherCollectionAdmin(admin.ModelAdmin):
    list_display = ("date", "item", "category", "amount", "payer_name", "received_by_name")
    list_filter = ("category", "date")
    search_fields = ("item", "payer_name", "received_by_name")
