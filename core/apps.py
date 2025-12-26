from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """Import signal handlers and configure admin when app is ready."""
        import sys

        import core.admin_site  # noqa - Apply custom admin configuration
        import core.auth.oauth_middleware  # noqa - Register OAuth JWT signals
        import core.signals  # noqa
        import core.taxonomy.signals  # noqa - Auto-tag from search interactions
        import services.weaviate.signals  # noqa - Connect Weaviate sync signals

        # Skip Phoenix for management commands (they don't use AI)
        # This saves ~2-3 seconds per command
        if len(sys.argv) > 1 and sys.argv[0].endswith('manage.py'):
            skip_commands = (
                'migrate',
                'makemigrations',
                'shell',
                'dbshell',
                'collectstatic',
                'createsuperuser',
                'seed_',
                'load_',
                'export_',
                'create_',
                'setup_',
                'check',
                'showmigrations',
                'test',
            )
            command = sys.argv[1]
            if any(command.startswith(prefix) for prefix in skip_commands):
                return

        # Initialize Phoenix LLM observability (traces at localhost:6006)
        from services.ai.phoenix import initialize_phoenix

        initialize_phoenix()
