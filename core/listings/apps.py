from django.apps import AppConfig


class ListingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.listings'
    verbose_name = 'Listings'

    def ready(self):
        # Import signals when app is ready
        import core.listings.signals  # noqa: F401
