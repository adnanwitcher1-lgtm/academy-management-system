from rest_framework import permissions, viewsets

from .models import Expense
from .serializers import ExpenseSerializer


class IsStaffRole(permissions.BasePermission):
    """Admins and staff only: students and teachers are not allowed."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", "") not in ("student", "teacher"))


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsStaffRole]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)