"""Avatars app configuration."""

from django.apps import AppConfig


class AvatarsConfig(AppConfig):
    """Configuration for the avatars app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.avatars'
    verbose_name = 'Avatars'
