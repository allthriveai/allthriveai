from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """Import signal handlers and configure admin when app is ready."""
        import core.signals  # noqa
        import core.auth.oauth_middleware  # noqa - Register OAuth JWT signals
        import core.admin_site  # noqa - Apply custom admin configuration
