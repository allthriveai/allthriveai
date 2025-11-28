"""Integration module initialization.

This module registers all available integrations with the IntegrationRegistry.
"""

from core.integrations.github.integration import GitHubIntegration
from core.integrations.registry import IntegrationRegistry

# Register all integrations
IntegrationRegistry.register(GitHubIntegration)

__all__ = ['IntegrationRegistry', 'GitHubIntegration']
