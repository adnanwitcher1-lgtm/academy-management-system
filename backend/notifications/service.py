"""Create personal notifications."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import Notification


def admin_users():
    User = get_user_model()
    return list(User.objects.filter(is_active=True).filter(Q(role__in=["admin", "hod", "staff"]) | Q(is_superuser=True)))


def notify(users, title, body="", kind=Notification.Kind.GENERAL, link=""):
    """Send one notification to a user or to a list of users."""
    if not isinstance(users, (list, tuple, set)):
        users = [users]
    rows = [Notification(user=u, title=title[:150], body=body, kind=kind, link=link[:120]) for u in users if u]
    Notification.objects.bulk_create(rows)
    return len(rows)
