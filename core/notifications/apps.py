"""App configuration for notifications module."""

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """Configuration for the notifications app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.notifications'
    verbose_name = 'Email Notifications'
