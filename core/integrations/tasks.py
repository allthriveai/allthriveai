"""Celery tasks for integration imports.

This module contains background tasks for importing projects from external platforms
(GitHub, GitLab, etc.) without blocking HTTP request handlers.
"""

import logging

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from core.integrations.github.constants import (
    IMPORT_TASK_HARD_LIMIT,
    IMPORT_TASK_SOFT_LIMIT,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, soft_time_limit=IMPORT_TASK_SOFT_LIMIT, time_limit=IMPORT_TASK_HARD_LIMIT)
def import_github_repo_task(self, user_id: int, url: str, is_showcase: bool = True, is_private: bool = False):
    """
    Background task for importing GitHub repositories.

    This task handles the full import flow:
    1. Fetch repository data from GitHub API
    2. Parse README and analyze content
    3. Run AI analysis for metadata
    4. Create project in database
    5. Apply AI-suggested categories, topics, and tools

    Args:
        self: Celery task instance (injected by bind=True)
        user_id: ID of the user importing the repository
        url: GitHub repository URL
        is_showcase: Whether to display in showcase section (default: True)
        is_private: Whether to hide from public (default: False)

    Returns:
        dict: Success status and project data or error message

    Raises:
        Retry: On transient errors (network issues, rate limits)
    """
    from django.contrib.auth import get_user_model

    from core.integrations.github.ai_analyzer import analyze_github_repo
    from core.integrations.github.helpers import (
        apply_ai_metadata,
        get_import_lock_key,
        get_user_github_token,
        normalize_github_repo_data,
        parse_github_url,
    )
    from core.integrations.github.service import GitHubService
    from core.projects.models import Project

    User = get_user_model()
    lock_key = get_import_lock_key(user_id)

    try:
        # Get user
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f'User {user_id} not found for GitHub import task')
            return {
                'success': False,
                'error': 'User account not found',
                'error_code': 'USER_NOT_FOUND',
            }

        # Parse GitHub URL
        try:
            owner, repo = parse_github_url(url)
        except ValueError as e:
            logger.warning(f'Invalid GitHub URL in task: {url}')
            return {
                'success': False,
                'error': f'Invalid GitHub URL: {str(e)}',
                'error_code': 'INVALID_URL',
            }

        # Check for duplicate (should have been checked in view, but double-check here)
        existing_project = Project.objects.filter(user=user, external_url=url).first()
        if existing_project:
            logger.info(f'Duplicate project found in background task: {url}')
            project_url = f'/{user.username}/{existing_project.slug}'
            return {
                'success': False,
                'error': f'This repository is already in your portfolio as "{existing_project.title}"',
                'error_code': 'DUPLICATE_IMPORT',
                'project': {
                    'id': existing_project.id,
                    'title': existing_project.title,
                    'slug': existing_project.slug,
                    'url': project_url,
                },
            }

        logger.info(f'Starting background import of {owner}/{repo} for user {user.username} (task {self.request.id})')

        # Get GitHub token
        user_token = get_user_github_token(user)
        if not user_token:
            logger.warning(f'No GitHub token found for user {user.username}')
            return {
                'success': False,
                'error': 'GitHub account is not connected',
                'error_code': 'GITHUB_NOT_CONNECTED',
                'suggestion': 'Please connect your GitHub account in settings and try again.',
            }

        # Fetch repository data
        try:
            github_service = GitHubService(user_token)
            repo_files = github_service.get_repository_info_sync(owner, repo)
        except Exception as e:
            error_msg = str(e)
            if '404' in error_msg:
                logger.warning(f'Repository not found: {owner}/{repo}')
                return {
                    'success': False,
                    'error': f'Repository "{owner}/{repo}" not found',
                    'error_code': 'REPO_NOT_FOUND',
                    'suggestion': 'Make sure the repository exists and you have access to it.',
                }
            elif '401' in error_msg or '403' in error_msg:
                logger.warning(f'Authentication error for {owner}/{repo}')
                # Retry after 2 minutes (token might be refreshed)
                raise self.retry(exc=e, countdown=120, max_retries=1) from e
            elif 'rate limit' in error_msg.lower():
                logger.warning(f'Rate limit hit for {owner}/{repo}')
                # Retry after 15 minutes
                raise self.retry(exc=e, countdown=900, max_retries=2) from e
            else:
                logger.error(f'Error fetching GitHub data: {e}')
                raise self.retry(exc=e, countdown=60) from e

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
            banner_url='',  # Use gradient background
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

        # Apply AI metadata (categories, topics, tools)
        apply_ai_metadata(project, analysis)

        logger.info(f'Successfully imported {owner}/{repo} as project {project.id} (task {self.request.id})')

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
        logger.error(f'Failed to import GitHub repo in background task: {e}', exc_info=True)
        # Retry on unexpected errors
        raise self.retry(exc=e, countdown=60) from e

    finally:
        # Always release lock
        cache.delete(lock_key)
        logger.info(f'Released import lock for user {user_id} (task cleanup)')
