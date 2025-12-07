"""GitHub integration views - simple read-only endpoints.

NOTE: These views are GitHub-specific. For a generic integration-agnostic approach,
see the IntegrationRegistry pattern demonstrated in _import_project_generic().
Future multi-integration views should use IntegrationRegistry.get_for_url(url).
"""

import logging

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.integrations.authentication import CsrfEnforcedSessionAuthentication
from core.integrations.github.constants import IMPORT_LOCK_TIMEOUT, IMPORT_RATE_LIMIT
from core.integrations.github.helpers import (
    get_import_lock_key,
    get_user_github_token,
    parse_github_url,
)
from core.projects.models import Project

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_repos(request):
    """
    Fetch user's GitHub repositories using the GitHub MCP Server.

    This is a simple read-only endpoint that fetches the user's repos
    for display in the UI. The actual import happens via the agent's
    import_github_project tool.

    Returns:
        List of repositories with basic metadata
    """
    try:
        # Get user's GitHub token
        user_token = get_user_github_token(request.user)

        if not user_token:
            return Response(
                {
                    'success': False,
                    'error': 'GitHub not connected. Please connect your GitHub account first.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Fetch repos using GitHub REST API (simple approach)
        # We use REST here instead of MCP because we just need a simple list
        import requests

        headers = {
            'Authorization': f'token {user_token}',
            'Accept': 'application/vnd.github.v3+json',
        }

        # Fetch user's repos (sorted by updated, limited to 100)
        response = requests.get(
            'https://api.github.com/user/repos',
            headers=headers,
            params={
                'sort': 'updated',
                'per_page': 100,
                'affiliation': 'owner,collaborator',
            },
            timeout=10,
        )

        if response.status_code == 401:
            return Response(
                {
                    'success': False,
                    'error': 'GitHub token is invalid or expired. Please reconnect your GitHub account.',
                    'connected': False,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if response.status_code == 403:
            # Check for rate limiting
            if 'X-RateLimit-Remaining' in response.headers and response.headers['X-RateLimit-Remaining'] == '0':
                reset_time = response.headers.get('X-RateLimit-Reset', 'unknown')
                return Response(
                    {
                        'success': False,
                        'error': f'GitHub API rate limit exceeded. Resets at {reset_time}.',
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        response.raise_for_status()
        repos_data = response.json()

        # Transform to simpler format for frontend
        repos = []
        for repo in repos_data:
            repos.append(
                {
                    'name': repo['name'],
                    'fullName': repo['full_name'],
                    'description': repo['description'] or '',
                    'htmlUrl': repo['html_url'],
                    'language': repo['language'] or '',
                    'stars': repo['stargazers_count'],
                    'forks': repo['forks_count'],
                    'isPrivate': repo['private'],
                    'updatedAt': repo['updated_at'],
                }
            )

        return Response(
            {
                'success': True,
                'data': {
                    'repositories': repos,
                    'count': len(repos),
                },
            }
        )

    except requests.RequestException as e:
        logger.error(f'Failed to fetch GitHub repos: {e}')
        return Response(
            {
                'success': False,
                'error': 'Failed to fetch repositories from GitHub. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f'Unexpected error fetching GitHub repos: {e}', exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Temporarily disabled rate limiting for testing
# @ratelimit(key='user', rate=IMPORT_RATE_LIMIT, method='POST')
@api_view(['POST'])
@authentication_classes([CsrfEnforcedSessionAuthentication])
@permission_classes([IsAuthenticated])
def import_github_repo_async(request):
    """
    Import a GitHub repository as a portfolio project.

    This endpoint queues the import as a Celery background task and returns immediately,
    allowing the user to continue using the app while the import happens in the background.

    Benefits:
    - Returns in <500ms instead of 10-25 seconds
    - Doesn't block HTTP workers
    - Better scalability
    - Real-time progress updates via polling

    Request body:
        {
            "url": "https://github.com/owner/repo",
            "is_showcase": true (optional, default: true),
            "is_private": false (optional, default: false)
        }

    Returns:
        {
            "success": true,
            "task_id": "abc123...",
            "message": "Import started! Check status at /api/integrations/tasks/abc123",
            "status_url": "/api/integrations/tasks/abc123/"
        }

    To check task status:
        GET /api/integrations/tasks/{task_id}/
    """
    try:
        # Check rate limit
        if getattr(request, 'limited', False):
            return Response(
                {
                    'success': False,
                    'error': f'Too many imports. You can import up to {IMPORT_RATE_LIMIT} repositories per hour.',
                    'error_code': 'RATE_LIMIT_EXCEEDED',
                    'suggestion': 'Please wait a few minutes before importing another repository.',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Get and validate URL
        url = request.data.get('url')
        is_showcase = request.data.get('is_showcase', True)
        is_private = request.data.get('is_private', False)

        if not url:
            return Response(
                {
                    'success': False,
                    'error': 'Please provide a GitHub repository URL',
                    'error_code': 'MISSING_URL',
                    'suggestion': 'Enter a URL like: https://github.com/username/repository',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse GitHub URL for early validation
        try:
            owner, repo = parse_github_url(url)
        except ValueError as e:
            return Response(
                {
                    'success': False,
                    'error': f'Invalid GitHub URL: {str(e)}',
                    'error_code': 'INVALID_URL',
                    'suggestion': 'Make sure the URL follows this format: https://github.com/username/repository',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =============================================================================
        # CRITICAL: Per-user import locking
        # =============================================================================
        lock_key = get_import_lock_key(request.user.id)

        if cache.get(lock_key):
            return Response(
                {
                    'success': False,
                    'error': 'You already have an import in progress',
                    'error_code': 'IMPORT_IN_PROGRESS',
                    'suggestion': (
                        'Please wait for your current import to finish before starting a new one. '
                        'This usually takes 10-30 seconds.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # =============================================================================
        # OPTIMIZATION: Check for duplicates BEFORE queueing task
        # =============================================================================
        existing_project = Project.objects.filter(user=request.user, external_url=url).first()
        if existing_project:
            project_url = f'/{request.user.username}/{existing_project.slug}'
            return Response(
                {
                    'success': False,
                    'error': f'This repository is already in your portfolio as "{existing_project.title}"',
                    'error_code': 'DUPLICATE_IMPORT',
                    'suggestion': 'View your existing project or delete it before re-importing.',
                    'project': {
                        'id': existing_project.id,
                        'title': existing_project.title,
                        'slug': existing_project.slug,
                        'url': project_url,
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Acquire lock (will be released by task when complete)
        cache.set(lock_key, True, timeout=IMPORT_LOCK_TIMEOUT)
        logger.info(f'Acquired import lock for user {request.user.id}')

        # Queue background task
        from core.integrations.tasks import import_github_repo_task

        task = import_github_repo_task.delay(
            user_id=request.user.id, url=url, is_showcased=is_showcase, is_private=is_private
        )

        logger.info(f'Queued GitHub import task {task.id} for {owner}/{repo} by user {request.user.username}')

        return Response(
            {
                'success': True,
                'task_id': task.id,
                'message': f'Importing {owner}/{repo}...',
                'detail': 'Your project is being analyzed and will appear in your portfolio in a few moments.',
                'status_url': f'/api/integrations/tasks/{task.id}',
            },
            status=status.HTTP_202_ACCEPTED,  # 202 = Accepted for processing
        )

    except Exception as e:
        logger.error(f'Failed to queue GitHub import task: {e}', exc_info=True)

        # Release lock on error
        lock_key = get_import_lock_key(request.user.id)
        cache.delete(lock_key)

        from django.conf import settings

        error_detail = str(e) if settings.DEBUG else 'Something went wrong while starting the import.'

        return Response(
            {
                'success': False,
                'error': error_detail,
                'error_code': 'IMPORT_FAILED',
                'error_type': type(e).__name__,
                'suggestion': 'Please try again in a moment. If the problem persists, contact support.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_status(request, task_id):
    """
    Get the status of a background import task.

    Returns:
        {
            "task_id": "abc123",
            "status": "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY",
            "result": {...} (if SUCCESS),
            "error": "..." (if FAILURE)
        }
    """
    from celery.result import AsyncResult

    task = AsyncResult(task_id)

    response_data = {
        'task_id': task_id,
        'status': task.status,
    }

    if task.successful():
        response_data['result'] = task.result
    elif task.failed():
        response_data['error'] = str(task.info)

    return Response(response_data)
