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
