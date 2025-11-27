"""Base classes for external integrations (GitHub, GitLab, npm, etc.)."""

from .ai_analyzer import BaseAIAnalyzer
from .exceptions import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationNetworkError,
    IntegrationNotFoundError,
    IntegrationRateLimitError,
    IntegrationValidationError,
)
from .integration import BaseIntegration
from .parser import BaseParser

__all__ = [
    'BaseIntegration',
    'BaseParser',
    'BaseAIAnalyzer',
    'IntegrationError',
    'IntegrationAuthError',
    'IntegrationNotFoundError',
    'IntegrationRateLimitError',
    'IntegrationNetworkError',
    'IntegrationValidationError',
]
