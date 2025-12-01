"""
Centralized configuration management for AllThrive AI.

This module provides type-safe, domain-organized access to application settings.
It consolidates scattered settings access patterns into a single, well-documented API.

Usage:
    from core.config import settings

    # Access Weaviate settings
    url = settings.weaviate.url
    timeout = settings.weaviate.timeout

    # Access AI provider settings
    provider = settings.ai.default_provider
    openai_key = settings.ai.openai_api_key

    # Check feature flags
    if settings.features.weaviate_enabled:
        ...
"""

from core.config.manager import AppSettings, get_settings

# Singleton settings instance
settings = get_settings()

__all__ = [
    'settings',
    'get_settings',
    'AppSettings',
]
