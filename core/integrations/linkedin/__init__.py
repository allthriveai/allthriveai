"""LinkedIn integration module."""

from core.integrations.linkedin.helpers import (
    get_import_lock_key,
    get_user_linkedin_token,
    is_linkedin_url,
    normalize_linkedin_post,
    normalize_linkedin_profile_data,
    parse_linkedin_url,
)
from core.integrations.linkedin.integration import LinkedInIntegration
from core.integrations.linkedin.service import LinkedInAPIError, LinkedInService
from core.integrations.registry import IntegrationRegistry

# Register LinkedIn integration
IntegrationRegistry.register(LinkedInIntegration)

__all__ = [
    # Core integration
    'LinkedInIntegration',
    # Service
    'LinkedInService',
    'LinkedInAPIError',
    # Helpers
    'parse_linkedin_url',
    'is_linkedin_url',
    'get_user_linkedin_token',
    'get_import_lock_key',
    'normalize_linkedin_profile_data',
    'normalize_linkedin_post',
]
