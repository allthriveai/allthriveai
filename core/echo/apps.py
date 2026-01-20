"""Django app configuration for echo."""

from django.apps import AppConfig


class EchoConfig(AppConfig):
    """Configuration for the echo app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.echo'
    label = 'echo'
    verbose_name = 'Echo Personal Assistant'
