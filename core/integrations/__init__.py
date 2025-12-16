"""Integration module initialization.

This module registers all available integrations with the IntegrationRegistry.
"""

# Import integration modules to trigger registration
# Each module's __init__.py calls IntegrationRegistry.register()
from core.integrations import linkedin  # noqa: F401

__all__ = ['linkedin']
