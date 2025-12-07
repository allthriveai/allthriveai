"""Django app configuration for Battles."""

from django.apps import AppConfig


class BattlesConfig(AppConfig):
    """Configuration for the battles app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.battles'
    verbose_name = 'Prompt Battles'
