"""Django app configuration for Community messaging."""

from django.apps import AppConfig


class CommunityConfig(AppConfig):
    """Configuration for the community messaging app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.community'
    verbose_name = 'Community Messaging'
