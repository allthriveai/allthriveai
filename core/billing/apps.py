from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.billing'
    verbose_name = 'Billing & Subscriptions'

    def ready(self):
        """Import signals when app is ready."""
        import core.billing.signals  # noqa
