"""Games app configuration."""

from django.apps import AppConfig


class GamesConfig(AppConfig):
    """Configuration for the games app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.games'
    verbose_name = 'Games'
