"""Instagram integration app configuration."""

from django.apps import AppConfig


class InstagramConfig(AppConfig):
    """Configuration for Instagram integration app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.integrations.instagram'
    label = 'instagram_integration'
    verbose_name = 'Instagram Integration'
