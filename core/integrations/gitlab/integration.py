"""GitLab integration implementation."""

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
from core.integrations.gitlab.helpers import (
    get_user_gitlab_token,
    normalize_gitlab_project_data,
    parse_gitlab_url,
)
from core.integrations.gitlab.service import GitLabService

logger = logging.getLogger(__name__)


class GitLabIntegration(BaseIntegration):
    """GitLab project integration.

    Provides GitLab-specific implementation for fetching project data,
    parsing URLs, and extracting project metadata.
    """

    @property
    def name(self) -> str:
        """Return integration name."""
        return 'gitlab'

    @property
    def display_name(self) -> str:
        """Return human-readable integration name."""
        return 'GitLab'

    async def fetch_project_data(self, url: str, user: 'User | None' = None) -> dict[str, Any]:
        """Fetch GitLab project data.

        Args:
            url: GitLab project URL
            user: Optional Django User instance for authentication

        Returns:
            dict containing:
                - name: Project name
                - description: Project description
                - readme_content: README markdown content
                - owner: Project namespace
                - repo: Project name
                - language: Primary language (from languages breakdown)
                - topics: List of topics
                - stargazers_count: Star count
                - forks_count: Fork count
                - tree: File tree
                - dependencies: Dependency files
                - tech_stack: Detected tech stack

        Raises:
            IntegrationValidationError: If URL is invalid
            IntegrationAuthError: If authentication is required but not provided
            IntegrationNotFoundError: If project is not found
            IntegrationRateLimitError: If API rate limit exceeded
            IntegrationNetworkError: If network/connection issues occur
            IntegrationError: If other errors occur
        """
        # Parse and validate URL
        try:
            base_url, namespace, project = parse_gitlab_url(url)
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitLab URL: {url}', integration_name=self.name, original_error=e
            ) from e

        # Get user's GitLab token if available
        token = None
        if user:
            token = get_user_gitlab_token(user)

        if not token:
            raise IntegrationAuthError(
                'GitLab authentication required. Please connect your GitLab account.',
                integration_name=self.name,
            )

        # Fetch project data via GitLabService
        try:
            gitlab_service = GitLabService(token, base_url)
            repo_data = gitlab_service.get_repository_info_sync(namespace, project)
        except httpx.HTTPStatusError as e:
            # Handle specific HTTP errors
            if e.response.status_code == 404:
                raise IntegrationNotFoundError(
                    f'Project not found: {namespace}/{project}', integration_name=self.name, original_error=e
                ) from e
            elif e.response.status_code == 401:
                raise IntegrationAuthError(
                    'GitLab authentication required or invalid', integration_name=self.name, original_error=e
                ) from e
            elif e.response.status_code == 403:
                # Check if it's a rate limit error
                if 'rate limit' in str(e).lower():
                    raise IntegrationRateLimitError(
                        'GitLab API rate limit exceeded', integration_name=self.name, original_error=e
                    ) from e
                else:
                    raise IntegrationAuthError(
                        'Access forbidden - check authentication or project permissions',
                        integration_name=self.name,
                        original_error=e,
                    ) from e
            else:
                raise IntegrationError(
                    f'GitLab API error: HTTP {e.response.status_code}', integration_name=self.name, original_error=e
                ) from e
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
            raise IntegrationNetworkError(
                'Failed to connect to GitLab API', integration_name=self.name, original_error=e
            ) from e
        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f'Unexpected error fetching GitLab data for {namespace}/{project}: {e}', exc_info=True)
            raise IntegrationError(
                f'Failed to fetch project data: {str(e)}', integration_name=self.name, original_error=e
            ) from e

        # Normalize and return
        try:
            project_data = repo_data.get('project_data', {})
            normalized_data = normalize_gitlab_project_data(base_url, namespace, project, url, project_data, repo_data)

            # Get primary language from languages breakdown
            languages = repo_data.get('languages', {})
            primary_language = ''
            if languages:
                # Get the language with highest percentage
                primary_language = max(languages.items(), key=lambda x: x[1])[0]

            return {
                **normalized_data,
                'language': primary_language,
                'readme_content': repo_data.get('readme', ''),
                'tree': repo_data.get('tree', []),
                'dependencies': repo_data.get('dependencies', {}),
                'tech_stack': repo_data.get('tech_stack', {}),
            }
        except Exception as e:
            logger.error(f'Error normalizing GitLab data for {namespace}/{project}: {e}', exc_info=True)
            raise IntegrationError(
                'Failed to process project data', integration_name=self.name, original_error=e
            ) from e

    def normalize_project_url(self, url: str) -> str:
        """Normalize GitLab URL to standard format.

        Args:
            url: Raw GitLab URL input

        Returns:
            Normalized URL (https://gitlab.com/namespace/project)

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            base_url, namespace, project = parse_gitlab_url(url)
            return f'{base_url}/{namespace}/{project}'
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitLab URL: {url}', integration_name=self.name, original_error=e
            ) from e

    def extract_project_identifier(self, url: str) -> dict[str, str]:
        """Extract namespace and project name from GitLab URL.

        Args:
            url: GitLab project URL

        Returns:
            dict with 'base_url', 'namespace', and 'project' keys

        Raises:
            IntegrationValidationError: If URL is invalid
        """
        try:
            base_url, namespace, project = parse_gitlab_url(url)
            return {
                'base_url': base_url,
                'namespace': namespace,
                'project': project,
                # For compatibility with GitHub integration
                'owner': namespace,
                'repo': project,
            }
        except ValueError as e:
            raise IntegrationValidationError(
                f'Invalid GitLab URL: {url}', integration_name=self.name, original_error=e
            ) from e

    def supports_url(self, url: str) -> bool:
        """Check if URL is a GitLab project URL.

        Args:
            url: URL to check

        Returns:
            True if URL is a valid GitLab project URL
        """
        try:
            base_url, _, _ = parse_gitlab_url(url)
            # Check if it's a GitLab URL
            return 'gitlab' in base_url.lower()
        except ValueError:
            return False

    def import_project(self, user_id: int, url: str, **kwargs) -> dict[str, Any]:
        """Import a GitLab project as a portfolio project.

        This is the main entry point for the generic import task.
        It wraps the existing GitLab import logic.

        Args:
            user_id: ID of the user importing the project
            url: GitLab project URL
            **kwargs: Additional options (is_showcase, is_private)

        Returns:
            dict with import result
        """
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        from core.integrations.github.ai_analyzer import analyze_github_repo
        from core.integrations.github.helpers import apply_ai_metadata
        from core.integrations.utils import (
            IntegrationErrorCode,
            check_duplicate_project,
            get_integration_token,
        )
        from core.projects.models import Project

        User = get_user_model()

        is_showcased = kwargs.get('is_showcased', kwargs.get('is_showcase', True))
        is_private = kwargs.get('is_private', True)

        try:
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.error(f'User {user_id} not found for GitLab import')
                return {
                    'success': False,
                    'error': 'User account not found',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                }

            # Parse GitLab URL
            try:
                base_url, namespace, project = parse_gitlab_url(url)
            except ValueError as e:
                return {
                    'success': False,
                    'error': f'Invalid GitLab URL: {str(e)}',
                    'error_code': IntegrationErrorCode.INVALID_URL,
                    'suggestion': 'Make sure the URL follows this format: https://gitlab.com/namespace/project',
                }

            # Check for duplicate
            existing_project = check_duplicate_project(user, url)
            if existing_project:
                project_url = f'/{user.username}/{existing_project.slug}'
                return {
                    'success': False,
                    'error': f'This project is already in your portfolio as "{existing_project.title}"',
                    'error_code': IntegrationErrorCode.DUPLICATE_IMPORT,
                    'suggestion': 'View your existing project or delete it before re-importing.',
                    'project': {
                        'id': existing_project.id,
                        'title': existing_project.title,
                        'slug': existing_project.slug,
                        'url': project_url,
                    },
                }

            # Get GitLab token
            user_token = get_integration_token(user, 'gitlab')
            if not user_token:
                return {
                    'success': False,
                    'error': 'GitLab account is not connected',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                    'suggestion': 'Please connect your GitLab account in settings and try again.',
                }

            # Fetch project data
            try:
                gitlab_service = GitLabService(user_token, base_url)
                repo_files = gitlab_service.get_repository_info_sync(namespace, project)
            except Exception as e:
                error_msg = str(e)
                if '404' in error_msg:
                    return {
                        'success': False,
                        'error': f'Project "{namespace}/{project}" not found',
                        'error_code': IntegrationErrorCode.NOT_FOUND,
                        'suggestion': 'Make sure the project exists and you have access to it.',
                    }
                elif 'rate limit' in error_msg.lower():
                    return {
                        'success': False,
                        'error': 'GitLab API rate limit exceeded',
                        'error_code': IntegrationErrorCode.RATE_LIMIT_EXCEEDED,
                        'suggestion': 'Please try again in a few minutes.',
                    }
                else:
                    logger.error(f'Error fetching GitLab data: {e}')
                    raise

            # Normalize GitLab data
            project_data = repo_files.get('project_data', {})
            repo_summary = normalize_gitlab_project_data(base_url, namespace, project, url, project_data, repo_files)

            # Get primary language
            languages = repo_files.get('languages', {})
            if languages:
                primary_language = max(languages.items(), key=lambda x: x[1])[0]
                repo_summary['language'] = primary_language

            # Run AI analysis (reuse GitHub analyzer - it's format-agnostic)
            logger.info(f'Running AI analysis for {namespace}/{project}')
            analysis = analyze_github_repo(repo_data=repo_summary, readme_content=repo_files.get('readme', ''))

            # Create project
            logger.info(f'Creating project for {namespace}/{project}')
            hero_image = analysis.get('hero_image')

            new_project = Project.objects.create(
                user=user,
                title=repo_summary.get('name', project),
                description=analysis.get('description', repo_summary.get('description', '')),
                type=Project.ProjectType.GITLAB_PROJECT,
                external_url=url,
                is_showcased=is_showcased,
                is_private=is_private,
                banner_url='',
                featured_image_url=hero_image if hero_image else '',
                content={
                    'gitlab': {
                        'namespace': namespace,
                        'project': project,
                        'stars': repo_summary.get('stargazers_count', 0),
                        'forks': repo_summary.get('forks_count', 0),
                        'language': repo_summary.get('language', ''),
                        'readme': repo_files.get('readme', ''),
                        'tree': repo_files.get('tree', []),
                        'dependencies': repo_files.get('dependencies', {}),
                        'tech_stack': repo_files.get('tech_stack', {}),
                        'languages': languages,
                        'analyzed_at': timezone.now().isoformat(),
                    },
                    'blocks': analysis.get('readme_blocks', []),
                    'mermaid_diagrams': analysis.get('mermaid_diagrams', []),
                    'demo_urls': analysis.get('demo_urls', []),
                    'hero_quote': analysis.get('hero_quote', ''),
                    'generated_diagram': analysis.get('generated_diagram', ''),
                },
            )

            # Apply AI metadata
            apply_ai_metadata(new_project, analysis)

            logger.info(f'Successfully imported {namespace}/{project} as project {new_project.id}')

            project_url = f'/{user.username}/{new_project.slug}'
            return {
                'success': True,
                'message': f'Successfully imported {namespace}/{project}!',
                'project': {
                    'id': new_project.id,
                    'title': new_project.title,
                    'slug': new_project.slug,
                    'url': project_url,
                },
            }

        except Exception as e:
            logger.error(f'Failed to import GitLab project: {e}', exc_info=True)
            raise  # Re-raise for Celery retry
