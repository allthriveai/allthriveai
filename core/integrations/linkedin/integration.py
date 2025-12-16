"""LinkedIn integration implementation."""

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.users.models import User

from core.integrations.base.exceptions import (
    IntegrationAuthError,
    IntegrationError,
    IntegrationNotFoundError,
    IntegrationRateLimitError,
    IntegrationValidationError,
)
from core.integrations.base.integration import BaseIntegration
from core.integrations.linkedin.helpers import (
    get_user_linkedin_token,
    is_linkedin_url,
    parse_linkedin_url,
)
from core.integrations.linkedin.service import LinkedInAPIError, LinkedInService

logger = logging.getLogger(__name__)


class LinkedInIntegration(BaseIntegration):
    """LinkedIn integration for importing profile and posts.

    Provides LinkedIn-specific implementation for:
    - Fetching user profile data
    - Fetching user posts (requires Marketing Developer Platform)
    - Creating projects from LinkedIn content

    Note: Full post access requires LinkedIn Marketing Developer Platform approval.
    Basic integration provides profile data and limited post access.
    """

    @property
    def name(self) -> str:
        """Return integration name."""
        return 'linkedin'

    @property
    def display_name(self) -> str:
        """Return human-readable integration name."""
        return 'LinkedIn'

    async def fetch_project_data(self, url: str, user: 'User | None' = None) -> dict[str, Any]:
        """Fetch LinkedIn data from a URL.

        Args:
            url: LinkedIn URL (profile, post, or article)
            user: Optional User instance for authentication

        Returns:
            dict containing profile/post data

        Raises:
            IntegrationValidationError: If URL is invalid
            IntegrationAuthError: If authentication is required but not provided
            IntegrationNotFoundError: If content is not found
            IntegrationRateLimitError: If API rate limit exceeded
            IntegrationNetworkError: If network/connection issues occur
            IntegrationError: If other errors occur
        """
        # Parse and validate URL
        try:
            url_info = parse_linkedin_url(url)
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid LinkedIn URL: {url}',
                integration_name=self.name,
                original_error=e,
            ) from e

        # Get user's LinkedIn token
        if not user:
            raise IntegrationAuthError(
                'LinkedIn authentication required',
                integration_name=self.name,
            )

        token = get_user_linkedin_token(user)
        if not token:
            raise IntegrationAuthError(
                'LinkedIn account is not connected',
                integration_name=self.name,
            )

        # Fetch data based on URL type
        try:
            service = LinkedInService(token)

            if url_info['type'] == 'profile':
                profile_data = service.fetch_profile_with_email()
                return {
                    'type': 'profile',
                    'name': profile_data.get('full_name', ''),
                    'description': f"LinkedIn profile for {profile_data.get('full_name', '')}",
                    'profile': profile_data,
                    'url': url,
                }

            elif url_info['type'] == 'post':
                # For posts, we need to fetch the user's posts and find the specific one
                # Note: This may not work without Marketing Developer Platform access
                posts = service.fetch_posts()
                return {
                    'type': 'posts',
                    'name': 'LinkedIn Posts',
                    'description': 'Posts from LinkedIn profile',
                    'posts': posts,
                    'url': url,
                }

            else:
                # Articles or other content
                profile_data = service.fetch_profile_with_email()
                return {
                    'type': 'content',
                    'name': profile_data.get('full_name', 'LinkedIn Content'),
                    'description': 'LinkedIn content',
                    'profile': profile_data,
                    'url': url,
                }

        except LinkedInAPIError as e:
            if e.status_code == 401:
                raise IntegrationAuthError(
                    'LinkedIn authentication failed. Please reconnect your account.',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.status_code == 403:
                raise IntegrationAuthError(
                    'Access denied. You may not have permission for this action.',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.status_code == 404:
                raise IntegrationNotFoundError(
                    'LinkedIn content not found.',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            elif e.status_code == 429:
                raise IntegrationRateLimitError(
                    'LinkedIn API rate limit exceeded.',
                    integration_name=self.name,
                    original_error=e,
                ) from e
            else:
                raise IntegrationError(
                    f'LinkedIn API error: {e.message}',
                    integration_name=self.name,
                    original_error=e,
                ) from e

        except Exception as e:
            logger.error(f'Unexpected error fetching LinkedIn data: {e}', exc_info=True)
            raise IntegrationError(
                f'Failed to fetch LinkedIn data: {str(e)}',
                integration_name=self.name,
                original_error=e,
            ) from e

    def normalize_project_url(self, url: str) -> str:
        """Normalize LinkedIn URL to standard format.

        Args:
            url: Raw LinkedIn URL input

        Returns:
            Normalized URL

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            url_info = parse_linkedin_url(url)

            if url_info['type'] == 'profile':
                return f"https://www.linkedin.com/in/{url_info['identifier']}"
            else:
                # For posts and articles, keep the original URL structure
                return url.strip().rstrip('/')

        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid LinkedIn URL: {url}',
                integration_name=self.name,
                original_error=e,
            ) from e

    def extract_project_identifier(self, url: str) -> dict[str, str]:
        """Extract identifiers from LinkedIn URL.

        Args:
            url: LinkedIn URL

        Returns:
            dict with 'type' and 'identifier' keys

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            return parse_linkedin_url(url)
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid LinkedIn URL: {url}',
                integration_name=self.name,
                original_error=e,
            ) from e

    def supports_url(self, url: str) -> bool:
        """Check if URL is a LinkedIn URL.

        Args:
            url: URL to check

        Returns:
            True if URL is a valid LinkedIn URL
        """
        return is_linkedin_url(url)

    def import_project(self, user_id: int, url: str, **kwargs) -> dict[str, Any]:
        """Import LinkedIn content as a portfolio project.

        Args:
            user_id: ID of the user importing the content
            url: LinkedIn URL
            **kwargs: Additional options (is_showcase, is_private)

        Returns:
            dict with import result
        """
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        from core.integrations.utils import (
            IntegrationErrorCode,
            check_duplicate_project,
        )
        from core.projects.models import Project

        User = get_user_model()

        is_showcased = kwargs.get('is_showcased', kwargs.get('is_showcase', True))
        is_private = kwargs.get('is_private', False)

        try:
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.error(f'User {user_id} not found for LinkedIn import')
                return {
                    'success': False,
                    'error': 'User account not found',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                }

            # Parse LinkedIn URL to validate it
            try:
                parse_linkedin_url(url)
            except ValueError as e:
                return {
                    'success': False,
                    'error': f'Invalid LinkedIn URL: {str(e)}',
                    'error_code': IntegrationErrorCode.INVALID_URL,
                    'suggestion': 'Make sure the URL is a valid LinkedIn profile or post URL.',
                }

            # Check for duplicate
            existing_project = check_duplicate_project(user, url)
            if existing_project:
                project_url = f'/{user.username}/{existing_project.slug}'
                return {
                    'success': False,
                    'error': f'This LinkedIn content is already in your portfolio as "{existing_project.title}"',
                    'error_code': IntegrationErrorCode.DUPLICATE_IMPORT,
                    'suggestion': 'View your existing project or delete it before re-importing.',
                    'project': {
                        'id': existing_project.id,
                        'title': existing_project.title,
                        'slug': existing_project.slug,
                        'url': project_url,
                    },
                }

            # Get LinkedIn token
            token = get_user_linkedin_token(user)
            if not token:
                return {
                    'success': False,
                    'error': 'LinkedIn account is not connected',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                    'suggestion': 'Please connect your LinkedIn account in settings and try again.',
                }

            # Fetch LinkedIn data
            try:
                service = LinkedInService(token)
                profile_data = service.fetch_profile_with_email()

                # Also try to fetch posts
                posts = []
                try:
                    posts = service.fetch_posts(count=10)
                except LinkedInAPIError as e:
                    logger.warning(f'Could not fetch LinkedIn posts: {e}')

            except LinkedInAPIError as e:
                if e.status_code == 401:
                    return {
                        'success': False,
                        'error': 'LinkedIn authentication failed. Please reconnect your account.',
                        'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                        'suggestion': 'Your LinkedIn connection may have expired. Please reconnect.',
                    }
                elif e.status_code == 429:
                    return {
                        'success': False,
                        'error': 'LinkedIn API rate limit exceeded',
                        'error_code': IntegrationErrorCode.RATE_LIMIT_EXCEEDED,
                        'suggestion': 'Please try again in a few minutes.',
                    }
                else:
                    logger.error(f'Error fetching LinkedIn data: {e}')
                    raise

            # Create project
            logger.info(f"Creating project from LinkedIn for {profile_data.get('full_name', 'Unknown')}")

            title = f"LinkedIn: {profile_data.get('full_name', 'Profile')}"
            description = 'Professional profile and content from LinkedIn'

            if posts:
                description += f' - {len(posts)} recent posts'

            project = Project.objects.create(
                user=user,
                title=title,
                description=description,
                type=Project.ProjectType.LINKEDIN if hasattr(Project.ProjectType, 'LINKEDIN') else 'linkedin',
                external_url=url,
                is_showcased=is_showcased,
                is_private=is_private,
                banner_url='',
                featured_image_url=profile_data.get('avatar_url', ''),
                content={
                    'linkedin': {
                        'profile': {
                            'id': profile_data.get('id', ''),
                            'name': profile_data.get('full_name', ''),
                            'first_name': profile_data.get('first_name', ''),
                            'last_name': profile_data.get('last_name', ''),
                            'vanity_name': profile_data.get('vanity_name', ''),
                            'email': profile_data.get('email'),
                            'avatar_url': profile_data.get('avatar_url', ''),
                            'profile_url': profile_data.get('profile_url', ''),
                        },
                        'posts': [
                            {
                                'id': post.get('id', ''),
                                'text': post.get('text', ''),
                                'created_time': post.get('created_time', 0),
                                'is_public': post.get('is_public', False),
                            }
                            for post in posts
                        ],
                        'imported_at': timezone.now().isoformat(),
                    },
                },
            )

            logger.info(f'Successfully imported LinkedIn profile as project {project.id}')

            project_url = f'/{user.username}/{project.slug}'
            return {
                'success': True,
                'message': f"Successfully imported LinkedIn profile for {profile_data.get('full_name', 'Unknown')}!",
                'project': {
                    'id': project.id,
                    'title': project.title,
                    'slug': project.slug,
                    'url': project_url,
                },
            }

        except Exception as e:
            logger.error(f'Failed to import LinkedIn content: {e}', exc_info=True)
            raise  # Re-raise for Celery retry

    def is_connected(self, user: 'User') -> bool:
        """Check if user has connected their LinkedIn account.

        Args:
            user: User instance

        Returns:
            bool: True if connected
        """
        token = get_user_linkedin_token(user)
        return token is not None

    def get_oauth_url(self) -> str:
        """Get OAuth connection URL for LinkedIn.

        Returns:
            str: OAuth URL
        """
        # Use 'li' alias to avoid ad-blocker issues
        return '/api/v1/social/connect/li/'

    # Additional LinkedIn-specific methods

    def fetch_profile(self, user: 'User') -> dict[str, Any]:
        """Fetch the user's LinkedIn profile.

        Args:
            user: User instance

        Returns:
            Profile data dict

        Raises:
            IntegrationAuthError: If not connected
            IntegrationError: If fetch fails
        """
        token = get_user_linkedin_token(user)
        if not token:
            raise IntegrationAuthError(
                'LinkedIn account is not connected',
                integration_name=self.name,
            )

        try:
            service = LinkedInService(token)
            return service.fetch_profile_with_email()
        except LinkedInAPIError as e:
            raise IntegrationError(
                f'Failed to fetch LinkedIn profile: {e.message}',
                integration_name=self.name,
                original_error=e,
            ) from e

    def fetch_posts(self, user: 'User', count: int = 50) -> list[dict[str, Any]]:
        """Fetch the user's LinkedIn posts.

        Args:
            user: User instance
            count: Maximum number of posts to fetch

        Returns:
            List of post data dicts

        Raises:
            IntegrationAuthError: If not connected
            IntegrationError: If fetch fails
        """
        token = get_user_linkedin_token(user)
        if not token:
            raise IntegrationAuthError(
                'LinkedIn account is not connected',
                integration_name=self.name,
            )

        try:
            service = LinkedInService(token)
            return service.fetch_posts(count=count)
        except LinkedInAPIError as e:
            raise IntegrationError(
                f'Failed to fetch LinkedIn posts: {e.message}',
                integration_name=self.name,
                original_error=e,
            ) from e

    def import_content(self, user: 'User', **kwargs) -> dict[str, Any]:
        """Import LinkedIn content for a user.

        This is a convenience method that wraps import_project.

        Args:
            user: User instance
            **kwargs: Additional options

        Returns:
            Import result dict
        """
        profile_url = f'https://www.linkedin.com/in/{user.username}'
        return self.import_project(user.id, profile_url, **kwargs)
