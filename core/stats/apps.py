"""Stats app configuration"""

from django.apps import AppConfig


class StatsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.stats'
    verbose_name = 'Platform Statistics'
