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

    def import_project(self, user_id: int, url: str, **kwargs) -> dict[str, Any]:
        """Import a GitHub repository as a portfolio project.

        This is the main entry point for the generic import task.
        It wraps the existing GitHub import logic.

        Args:
            user_id: ID of the user importing the project
            url: GitHub repository URL
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

        is_showcase = kwargs.get('is_showcase', True)
        is_private = kwargs.get('is_private', False)

        try:
            # Get user
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.error(f'User {user_id} not found for GitHub import')
                return {
                    'success': False,
                    'error': 'User account not found',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                }

            # Note: Lock is already acquired in the view before queueing this task
            # We should NOT acquire it again here to avoid double-locking

            # Parse GitHub URL
            try:
                owner, repo = parse_github_url(url)
            except ValueError as e:
                return {
                    'success': False,
                    'error': f'Invalid GitHub URL: {str(e)}',
                    'error_code': IntegrationErrorCode.INVALID_URL,
                    'suggestion': 'Make sure the URL follows this format: https://github.com/username/repository',
                }

            # Check for duplicate
            existing_project = check_duplicate_project(user, url)
            if existing_project:
                project_url = f'/{user.username}/{existing_project.slug}'
                return {
                    'success': False,
                    'error': f'This repository is already in your portfolio as "{existing_project.title}"',
                    'error_code': IntegrationErrorCode.DUPLICATE_IMPORT,
                    'suggestion': 'View your existing project or delete it before re-importing.',
                    'project': {
                        'id': existing_project.id,
                        'title': existing_project.title,
                        'slug': existing_project.slug,
                        'url': project_url,
                    },
                }

            # Get GitHub token
            user_token = get_integration_token(user, 'github')
            if not user_token:
                return {
                    'success': False,
                    'error': 'GitHub account is not connected',
                    'error_code': IntegrationErrorCode.AUTH_REQUIRED,
                    'suggestion': 'Please connect your GitHub account in settings and try again.',
                }

            # Fetch repository data
            try:
                github_service = GitHubService(user_token)
                repo_files = github_service.get_repository_info_sync(owner, repo)
            except Exception as e:
                error_msg = str(e)
                if '404' in error_msg:
                    return {
                        'success': False,
                        'error': f'Repository "{owner}/{repo}" not found',
                        'error_code': IntegrationErrorCode.NOT_FOUND,
                        'suggestion': 'Make sure the repository exists and you have access to it.',
                    }
                elif 'rate limit' in error_msg.lower():
                    return {
                        'success': False,
                        'error': 'GitHub API rate limit exceeded',
                        'error_code': IntegrationErrorCode.RATE_LIMIT_EXCEEDED,
                        'suggestion': 'Please try again in a few minutes.',
                    }
                else:
                    logger.error(f'Error fetching GitHub data: {e}')
                    raise

            # Normalize GitHub data
            repo_summary = normalize_github_repo_data(owner, repo, url, repo_files)

            # Run AI analysis
            logger.info(f'Running AI analysis for {owner}/{repo}')
            analysis = analyze_github_repo(repo_data=repo_summary, readme_content=repo_files.get('readme', ''))

            # Create project
            logger.info(f'Creating project for {owner}/{repo}')
            hero_image = analysis.get('hero_image')

            project = Project.objects.create(
                user=user,
                title=repo_summary.get('name', repo),
                description=analysis.get('description', repo_summary.get('description', '')),
                type=Project.ProjectType.GITHUB_REPO,
                external_url=url,
                is_showcase=is_showcase,
                is_published=not is_private,
                banner_url='',
                featured_image_url=hero_image if hero_image else '',
                content={
                    'github': {
                        'owner': owner,
                        'repo': repo,
                        'stars': repo_summary.get('stargazers_count', 0),
                        'forks': repo_summary.get('forks_count', 0),
                        'language': repo_summary.get('language', ''),
                        'readme': repo_files.get('readme', ''),
                        'tree': repo_files.get('tree', []),
                        'dependencies': repo_files.get('dependencies', {}),
                        'tech_stack': repo_files.get('tech_stack', {}),
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
            apply_ai_metadata(project, analysis)

            logger.info(f'Successfully imported {owner}/{repo} as project {project.id}')

            project_url = f'/{user.username}/{project.slug}'
            return {
                'success': True,
                'message': f'Successfully imported {owner}/{repo}!',
                'project': {
                    'id': project.id,
                    'title': project.title,
                    'slug': project.slug,
                    'url': project_url,
                },
            }

        except Exception as e:
            logger.error(f'Failed to import GitHub repo: {e}', exc_info=True)
            raise  # Re-raise for Celery retry
