"""Django app configuration for core.projects."""

from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    """Configuration for the projects app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.projects'
    # Use 'core' label to match existing table names (core_project, etc.)
    label = 'core_projects'
    verbose_name = 'Projects'
