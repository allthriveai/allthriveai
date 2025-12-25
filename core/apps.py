from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """Import signal handlers and configure admin when app is ready."""
        import core.signals  # noqa
        import core.auth.oauth_middleware  # noqa - Register OAuth JWT signals
        import core.admin_site  # noqa - Apply custom admin configuration
        import services.weaviate.signals  # noqa - Connect Weaviate sync signals
        import core.taxonomy.signals  # noqa - Auto-tag from search interactions

        # Initialize Phoenix LLM observability (traces at localhost:6006)
        from services.ai.phoenix import initialize_phoenix

        initialize_phoenix()
