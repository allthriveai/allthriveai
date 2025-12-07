"""Django app configuration for Events."""

from django.apps import AppConfig


class EventsConfig(AppConfig):
    """Configuration for the events app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.events'
    verbose_name = 'Events'
