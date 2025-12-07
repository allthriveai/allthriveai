"""Django app configuration for core.integrations."""

from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    """Configuration for the integrations app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.integrations'
    verbose_name = 'Content Source Integrations'

    def ready(self):
        """Register integrations when app is ready."""
        from core.integrations.figma.integration import FigmaIntegration
        from core.integrations.github.integration import GitHubIntegration
        from core.integrations.gitlab.integration import GitLabIntegration
        from core.integrations.registry import IntegrationRegistry

        # Register all integrations
        IntegrationRegistry.register(GitHubIntegration)
        IntegrationRegistry.register(GitLabIntegration)
        IntegrationRegistry.register(FigmaIntegration)
