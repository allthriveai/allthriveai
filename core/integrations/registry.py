"""Integration registry for managing multiple platform integrations."""

from core.integrations.base.integration import BaseIntegration


class IntegrationRegistry:
    """Registry for all available integrations.

    This allows easy addition of new integrations and automatic discovery.
    """

    _integrations: dict[str, type[BaseIntegration]] = {}

    @classmethod
    def register(cls, integration_class: type[BaseIntegration]) -> None:
        """Register a new integration.

        Args:
            integration_class: Integration class to register
        """
        # Instantiate to get the name
        instance = integration_class()
        cls._integrations[instance.name] = integration_class

    @classmethod
    def get(cls, name: str) -> type[BaseIntegration] | None:
        """Get integration by name.

        Args:
            name: Integration name (e.g., 'github', 'gitlab')

        Returns:
            Integration class or None if not found
        """
        return cls._integrations.get(name)

    @classmethod
    def get_for_url(cls, url: str) -> type[BaseIntegration] | None:
        """Get integration that can handle the given URL.

        Args:
            url: Project URL

        Returns:
            Integration class or None if no integration can handle the URL
        """
        for integration_class in cls._integrations.values():
            instance = integration_class()
            if instance.supports_url(url):
                return integration_class
        return None

    @classmethod
    def list_all(cls) -> list[str]:
        """List all registered integrations.

        Returns:
            List of integration names
        """
        return list(cls._integrations.keys())


# Example usage (to be implemented when creating actual GitHubIntegration class):
#
# from core.integrations.github.integration import GitHubIntegration
# IntegrationRegistry.register(GitHubIntegration)
#
# # Then in views:
# integration_class = IntegrationRegistry.get_for_url(url)
# if integration_class:
#     integration = integration_class()
#     data = await integration.fetch_project_data(url)
