"""Base integration interface for external platforms."""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.users.models import User


class BaseIntegration(ABC):
    """Abstract base class for all external integrations.

    Each integration (GitHub, GitLab, npm, etc.) implements this interface
    to provide platform-specific logic while sharing common functionality.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Integration name (e.g., 'github', 'gitlab', 'npm').

        Returns:
            str: Lowercase integration identifier
        """
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable integration name (e.g., 'GitHub', 'GitLab', 'npm').

        Returns:
            str: Display name for UI
        """
        pass

    @abstractmethod
    async def fetch_project_data(self, url: str, user: 'User | None' = None) -> dict[str, Any]:
        """Fetch project data from the external platform.

        This is platform-specific - each integration implements its own API calls.

        Args:
            url: Project URL (e.g., GitHub repo URL, npm package URL)
            user: Optional user for authentication

        Returns:
            dict containing:
                - name: Project name
                - description: Project description
                - readme_content: README markdown content
                - metadata: Platform-specific metadata

        Raises:
            IntegrationError: If fetching fails
            IntegrationAuthError: If authentication is required but not provided
            IntegrationNotFoundError: If project is not found
            IntegrationRateLimitError: If API rate limit exceeded
            IntegrationNetworkError: If network/connection issues occur
        """
        pass

    @abstractmethod
    def normalize_project_url(self, url: str) -> str:
        """Normalize and validate project URL for this platform.

        Args:
            url: Raw URL input from user

        Returns:
            str: Normalized URL

        Raises:
            ValueError: If URL is invalid for this platform
        """
        pass

    @abstractmethod
    def extract_project_identifier(self, url: str) -> dict[str, str]:
        """Extract platform-specific identifiers from URL.

        Args:
            url: Project URL

        Returns:
            dict with platform-specific keys (e.g., owner/repo for GitHub)

        Example:
            GitHub: {'owner': 'octocat', 'repo': 'hello-world'}
            npm: {'package': '@scope/package-name'}
        """
        pass

    def supports_url(self, url: str) -> bool:
        """Check if this integration can handle the given URL.

        Default implementation checks for platform domain in URL.
        Override for custom logic.

        Args:
            url: URL to check

        Returns:
            bool: True if this integration can handle the URL
        """
        return self.name in url.lower()

    @abstractmethod
    def import_project(self, user_id: int, url: str, **kwargs) -> dict[str, Any]:
        """Import a project from this integration.

        This is the main entry point called by the generic import task.
        Each integration implements platform-specific import logic here.

        Args:
            user_id: ID of the user importing the project
            url: Project URL
            **kwargs: Platform-specific options (e.g., is_showcase, is_private)

        Returns:
            dict with:
                - success: bool
                - message: str
                - project: dict with id, title, slug, url
                OR
                - success: False
                - error: str
                - error_code: str
                - suggestion: str (optional)

        Raises:
            Exception: On unexpected errors (will be retried by Celery)
        """
        pass

    def is_connected(self, user: 'User') -> bool:
        """Check if user has connected this integration.

        Default implementation checks for social account.
        Override for custom logic.

        Args:
            user: User instance

        Returns:
            bool: True if connected
        """
        from core.integrations.utils import check_integration_connection

        return check_integration_connection(user, self.name)

    def get_oauth_url(self) -> str:
        """Get OAuth connection URL for this integration.

        Args:
            None

        Returns:
            str: OAuth URL
        """
        return f'/accounts/{self.name}/login/?process=connect'
