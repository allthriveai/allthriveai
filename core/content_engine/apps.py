"""Django app configuration for content_engine."""

from django.apps import AppConfig


class ContentEngineConfig(AppConfig):
    """Configuration for the content_engine app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.content_engine'
    label = 'content_engine'
    verbose_name = 'Content Engine'
