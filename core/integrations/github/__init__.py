"""GitHub integration module."""

from core.integrations.github.ai_analyzer import analyze_github_repo
from core.integrations.github.helpers import (
    apply_ai_metadata,
    get_import_lock_key,
    get_user_github_token,
    normalize_github_repo_data,
    parse_github_url,
)
from core.integrations.github.integration import GitHubIntegration
from core.integrations.github.rate_limiter import (
    GitHubRateLimiter,
    github_api_call_with_retry,
    github_rate_limit,
)
from core.integrations.github.service import GitHubAPIError, GitHubService
from core.integrations.registry import IntegrationRegistry

# Register GitHub integration
IntegrationRegistry.register(GitHubIntegration)

__all__ = [
    # Core integration
    'GitHubIntegration',
    # Service
    'GitHubService',
    'GitHubAPIError',
    # Helpers
    'parse_github_url',
    'get_user_github_token',
    'get_import_lock_key',
    'normalize_github_repo_data',
    'apply_ai_metadata',
    # AI Analysis
    'analyze_github_repo',
    # Rate Limiting
    'GitHubRateLimiter',
    'github_rate_limit',
    'github_api_call_with_retry',
]
