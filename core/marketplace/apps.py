from django.apps import AppConfig


class MarketplaceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.marketplace'
    verbose_name = 'Creator Marketplace'

    def ready(self):
        # Import signals when app is ready
        pass
