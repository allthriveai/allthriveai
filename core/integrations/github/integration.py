"""GitHub integration implementation."""

import logging
from typing import TYPE_CHECKING, Any

import httpx

if TYPE_CHECKING:
    from core.users.models import User

from core.integrations.base.exceptions import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationNetworkError,
    IntegrationNotFoundError,
    IntegrationRateLimitError,
    IntegrationValidationError,
)
from core.integrations.base.integration import BaseIntegration
from core.integrations.github.helpers import get_user_github_token, normalize_github_repo_data, parse_github_url
from core.integrations.github.service import GitHubService

logger = logging.getLogger(__name__)


class GitHubIntegration(BaseIntegration):
    """GitHub repository integration.

    Provides GitHub-specific implementation for fetching repository data,
    parsing URLs, and extracting project metadata.
    """

    @property
    def name(self) -> str:
        """Return integration name."""
        return 'github'

    @property
    def display_name(self) -> str:
        """Return human-readable integration name."""
        return 'GitHub'

    async def fetch_project_data(self, url: str, user: 'User | None' = None) -> dict[str, Any]:
        """Fetch GitHub repository data.

        Args:
            url: GitHub repository URL
            user: Optional Django User instance for authentication

        Returns:
            dict containing:
                - name: Repository name
                - description: Repository description
                - readme_content: README markdown content
                - owner: Repository owner
                - repo: Repository name
                - language: Primary language
                - topics: List of topics
                - stargazers_count: Star count
                - forks_count: Fork count
                - tree: File tree
                - dependencies: Dependency files
                - tech_stack: Detected tech stack

        Raises:
            IntegrationValidationError: If URL is invalid
            IntegrationAuthError: If authentication is required but not provided
            IntegrationNotFoundError: If repository is not found
            IntegrationRateLimitError: If API rate limit exceeded
            IntegrationNetworkError: If network/connection issues occur
            IntegrationError: If other errors occur
        """
        # Parse and validate URL
        try:
            owner, repo = parse_github_url(url)
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitHub URL: {url}', integration_name=self.name, original_error=e
            ) from e

        # Get user's GitHub token if available
        token = None
        if user:
            token = get_user_github_token(user)

        # Fetch repository data via GitHubService
        try:
            github_service = GitHubService(token)
            repo_data = github_service.get_repository_info_sync(owner, repo)
        except httpx.HTTPStatusError as e:
            # Handle specific HTTP errors
            if e.response.status_code == 404:
                raise IntegrationNotFoundError(
                    f'Repository not found: {owner}/{repo}', integration_name=self.name, original_error=e
                ) from e
            elif e.response.status_code == 401:
                raise IntegrationAuthError(
                    'GitHub authentication required or invalid', integration_name=self.name, original_error=e
                ) from e
            elif e.response.status_code == 403:
                # Check if it's a rate limit error
                if 'rate limit' in str(e).lower():
                    raise IntegrationRateLimitError(
                        'GitHub API rate limit exceeded', integration_name=self.name, original_error=e
                    ) from e
                else:
                    raise IntegrationAuthError(
                        'Access forbidden - check authentication or repository permissions',
                        integration_name=self.name,
                        original_error=e,
                    ) from e
            else:
                raise IntegrationError(
                    f'GitHub API error: HTTP {e.response.status_code}', integration_name=self.name, original_error=e
                ) from e
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
            raise IntegrationNetworkError(
                'Failed to connect to GitHub API', integration_name=self.name, original_error=e
            ) from e
        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f'Unexpected error fetching GitHub data for {owner}/{repo}: {e}', exc_info=True)
            raise IntegrationError(
                f'Failed to fetch repository data: {str(e)}', integration_name=self.name, original_error=e
            ) from e

        # Normalize and return
        try:
            normalized_data = normalize_github_repo_data(owner, repo, url, repo_data)

            return {
                **normalized_data,
                'readme_content': repo_data.get('readme', ''),
                'tree': repo_data.get('tree', []),
                'dependencies': repo_data.get('dependencies', {}),
                'tech_stack': repo_data.get('tech_stack', {}),
            }
        except Exception as e:
            logger.error(f'Error normalizing GitHub data for {owner}/{repo}: {e}', exc_info=True)
            raise IntegrationError(
                'Failed to process repository data', integration_name=self.name, original_error=e
            ) from e

    def normalize_project_url(self, url: str) -> str:
        """Normalize GitHub URL to standard format.

        Args:
            url: Raw GitHub URL input

        Returns:
            Normalized URL (https://github.com/owner/repo)

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            owner, repo = parse_github_url(url)
            return f'https://github.com/{owner}/{repo}'
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitHub URL: {url}', integration_name=self.name, original_error=e
            ) from e

    def extract_project_identifier(self, url: str) -> dict[str, str]:
        """Extract owner and repository name from GitHub URL.

        Args:
            url: GitHub repository URL

        Returns:
            dict with 'owner' and 'repo' keys

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            owner, repo = parse_github_url(url)
            return {
                'owner': owner,
                'repo': repo,
            }
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitHub URL: {url}', integration_name=self.name, original_error=e
            ) from e

    def supports_url(self, url: str) -> bool:
        """Check if URL is a GitHub repository URL.

        Args:
            url: URL to check

        Returns:
            True if URL is a valid GitHub repository URL
        """
        try:
            parse_github_url(url)
            return True
        except ValueError:
            return False
