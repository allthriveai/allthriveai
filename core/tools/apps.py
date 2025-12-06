"""Tools app configuration."""

from django.apps import AppConfig


class ToolsConfig(AppConfig):
    """Configuration for the tools app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.tools'
    verbose_name = 'AI Tools & Technology Directory'
