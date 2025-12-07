from django.apps import AppConfig


class VendorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.vendors'
    verbose_name = 'Vendor Analytics'

    def ready(self):
        # Import signals when app is ready
        pass
