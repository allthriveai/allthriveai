"""Integration module initialization.

This module registers all available integrations with the IntegrationRegistry.
"""

# Import integration modules to trigger registration
# Each module's __init__.py calls IntegrationRegistry.register()
from core.integrations import linkedin  # noqa: F401

# Note: Asana models (AsanaIntegration, TaskCache) should be imported
# directly from core.integrations.asana_models when needed to avoid
# circular import issues with Django's app registry.

__all__ = ['linkedin']
