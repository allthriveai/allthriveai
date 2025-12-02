"""App configuration for Learning Paths."""

from django.apps import AppConfig


class LearningPathsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.learning_paths'
    verbose_name = 'Learning Paths'

    def ready(self):
        # Import signals to register them
        from . import signals  # noqa
