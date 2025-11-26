"""App configuration for social connections."""

from django.apps import AppConfig


class SocialConfig(AppConfig):
    """Configuration for the social app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.social'
    verbose_name = 'Social Connections'

    def ready(self):
        """Import signal handlers when the app is ready."""
        import core.social.signals  # noqa: F401
