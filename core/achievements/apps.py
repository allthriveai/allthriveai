"""Achievements app configuration."""

from django.apps import AppConfig


class AchievementsConfig(AppConfig):
    """Configuration for the achievements app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.achievements'
    verbose_name = 'Achievements'

    def ready(self):
        """Import signals when app is ready."""
        import core.achievements.signals  # noqa: F401
