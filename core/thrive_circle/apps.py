"""App configuration for Thrive Circle."""

from django.apps import AppConfig


class ThriveCircleConfig(AppConfig):
    """Configuration for the Thrive Circle app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.thrive_circle'
    verbose_name = 'Thrive Circle'

    def ready(self):
        """Import signals when the app is ready."""
        # Import signals here if needed
        pass
