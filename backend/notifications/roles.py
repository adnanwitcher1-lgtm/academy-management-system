from rest_framework import permissions

ADMIN_ROLES = ("admin", "hod", "staff")


def is_admin_user(user):
    if not (user and user.is_authenticated):
        return False
    return user.is_superuser or str(getattr(user, "role", "")).lower() in ADMIN_ROLES


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)