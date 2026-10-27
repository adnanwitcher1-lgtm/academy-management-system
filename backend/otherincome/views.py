from datetime import date

from django.db.models import Count, Sum
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import OtherCollection
from .serializers import OtherCollectionSerializer


class IsStaffRole(permissions.BasePermission):
    """Admins and staff only: students and teachers are not allowed."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", "") not in ("student", "teacher"))


class OtherCollectionViewSet(viewsets.ModelViewSet):
    queryset = OtherCollection.objects.select_related("student__student_profile__roster_entry")
    serializer_class = OtherCollectionSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("month"):  # e.g. 2026-10
            try:
                y, m = (int(x) for x in p["month"].split("-"))
                qs = qs.filter(date__year=y, date__month=m)
            except ValueError:
                pass
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Totals for this month, all time, and by category (this month)."""
        today = date.today()
        month = OtherCollection.objects.filter(date__year=today.year, date__month=today.month)
        total = lambda qs: float(qs.aggregate(t=Sum("amount"))["t"] or 0)
        labels = dict(OtherCollection.Category.choices)
        by_cat = month.values("category").annotate(t=Sum("amount"), n=Count("id")).order_by("-t")
        return Response(
            {
                "month_total": total(month),
                "month_count": month.count(),
                "all_time_total": total(OtherCollection.objects),
                "by_category": [
                    {"category": c["category"], "label": labels.get(c["category"], c["category"]), "amount": float(c["t"]), "count": c["n"]}
                    for c in by_cat
                ],
            }
        )
