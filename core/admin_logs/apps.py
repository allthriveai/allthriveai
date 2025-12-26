from django.apps import AppConfig


class AdminLogsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.admin_logs'
    verbose_name = 'Admin Log Streaming'
