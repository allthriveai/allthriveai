"""SMS app configuration."""

from django.apps import AppConfig


class SmsConfig(AppConfig):
    """Configuration for SMS notification app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.sms'
    verbose_name = 'SMS Notifications'
