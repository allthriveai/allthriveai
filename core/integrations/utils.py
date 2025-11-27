"""Shared utilities for all integrations.

This module contains common patterns used across all platform integrations
(GitHub, GitLab, npm, etc.) to reduce code duplication and ensure consistency.
"""

import logging
from typing import Any

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

logger = logging.getLogger(__name__)


# =============================================================================
# Error Codes - Standardized across all integrations
# =============================================================================


class IntegrationErrorCode:
    """Standardized error codes for all integrations."""

    DUPLICATE_IMPORT = 'DUPLICATE_IMPORT'
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
    AUTH_REQUIRED = 'AUTH_REQUIRED'
    AUTH_INVALID = 'AUTH_INVALID'
    NOT_FOUND = 'NOT_FOUND'
    INVALID_URL = 'INVALID_URL'
    IMPORT_IN_PROGRESS = 'IMPORT_IN_PROGRESS'
    IMPORT_FAILED = 'IMPORT_FAILED'
    IMPORT_TIMEOUT = 'IMPORT_TIMEOUT'
    UNKNOWN_PLATFORM = 'UNKNOWN_PLATFORM'
    NETWORK_ERROR = 'NETWORK_ERROR'


# =============================================================================
# Response Builders - Consistent response format
# =============================================================================


def success_response(data: dict[str, Any], status_code: int = status.HTTP_200_OK) -> Response:
    """Build a successful response with consistent format.

    Args:
        data: Response data
        status_code: HTTP status code (default: 200)

    Returns:
        Response with {'success': True, ...data}
    """
    return Response({'success': True, **data}, status=status_code)


def error_response(
    error: str,
    error_code: str,
    suggestion: str | None = None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    **extra_data,
) -> Response:
    """Build an error response with consistent format.

    Args:
        error: Error message
        error_code: Standardized error code
        suggestion: Optional user-friendly suggestion
        status_code: HTTP status code
        **extra_data: Additional data (e.g., project info for duplicates)

    Returns:
        Response with error details
    """
    response_data = {
        'success': False,
        'error': error,
        'error_code': error_code,
    }

    if suggestion:
        response_data['suggestion'] = suggestion

    response_data.update(extra_data)

    return Response(response_data, status=status_code)


def import_started_response(task_id: str, platform: str, identifier: str) -> Response:
    """Build a standardized import started response.

    Args:
        task_id: Celery task ID
        platform: Platform name (e.g., 'github', 'gitlab')
        identifier: Project identifier for display

    Returns:
        Response with task information
    """
    return Response(
        {
            'success': True,
            'task_id': task_id,
            'platform': platform,
            'message': f'Importing {identifier}...',
            'detail': 'Your project is being analyzed and will appear in your portfolio in a few moments.',
            'status_url': f'/api/integrations/tasks/{task_id}/',
        },
        status=status.HTTP_202_ACCEPTED,
    )


# =============================================================================
# Import Lock Management
# =============================================================================


def get_import_lock_key(user_id: int) -> str:
    """Get cache key for user's import lock.

    Args:
        user_id: User ID

    Returns:
        Cache key string
    """
    return f'user_import_lock:{user_id}'


def acquire_import_lock(user_id: int, timeout: int = 300) -> bool:
    """Acquire import lock for user.

    Args:
        user_id: User ID
        timeout: Lock timeout in seconds (default: 5 minutes)

    Returns:
        True if lock acquired, False if already locked
    """
    lock_key = get_import_lock_key(user_id)

    if cache.get(lock_key):
        return False

    cache.set(lock_key, True, timeout=timeout)
    logger.info(f'Acquired import lock for user {user_id}')
    return True


def release_import_lock(user_id: int) -> None:
    """Release import lock for user.

    Args:
        user_id: User ID
    """
    lock_key = get_import_lock_key(user_id)
    cache.delete(lock_key)
    logger.info(f'Released import lock for user {user_id}')


# =============================================================================
# Duplicate Detection
# =============================================================================


def check_duplicate_project(user, url: str):
    """Check if project already exists for user.

    Args:
        user: User instance
        url: Project URL

    Returns:
        Existing project or None
    """
    from core.projects.models import Project

    return Project.objects.filter(user=user, external_url=url).first()


def duplicate_error_response(project, username: str) -> Response:
    """Build response for duplicate project.

    Args:
        project: Existing project instance
        username: User's username

    Returns:
        Error response with project details
    """
    project_url = f'/{username}/{project.slug}'

    return error_response(
        error=f'This repository is already in your portfolio as "{project.title}"',
        error_code=IntegrationErrorCode.DUPLICATE_IMPORT,
        suggestion='View your existing project or delete it before re-importing.',
        status_code=status.HTTP_409_CONFLICT,
        project={
            'id': project.id,
            'title': project.title,
            'slug': project.slug,
            'url': project_url,
        },
    )


# =============================================================================
# Connection Checking
# =============================================================================


def check_integration_connection(user, platform: str) -> bool:
    """Check if user has connected a specific integration.

    Args:
        user: User instance
        platform: Platform name ('github', 'gitlab', etc.)

    Returns:
        True if connected, False otherwise
    """
    try:
        social_account = user.socialaccount_set.filter(provider=platform).first()
        return social_account is not None
    except Exception as e:
        logger.warning(f'Error checking {platform} connection for user {user.id}: {e}')
        return False


def get_integration_token(user, platform: str) -> str | None:
    """Get OAuth token for integration.

    Args:
        user: User instance
        platform: Platform name

    Returns:
        Access token or None
    """
    try:
        social_account = user.socialaccount_set.filter(provider=platform).first()
        if social_account:
            return social_account.socialtoken_set.first().token
    except Exception as e:
        logger.warning(f'Error getting {platform} token for user {user.id}: {e}')

    return None
