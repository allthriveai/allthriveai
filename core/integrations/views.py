"""Generic integration views - work for any platform.

These views use the IntegrationRegistry to automatically detect and handle
different platforms (GitHub, GitLab, npm, etc.) without platform-specific code.
"""

import logging
from urllib.parse import urlparse

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.integrations.registry import IntegrationRegistry
from core.integrations.tasks import import_project_generic_task
from core.integrations.utils import (
    IntegrationErrorCode,
    acquire_import_lock,
    check_duplicate_project,
    duplicate_error_response,
    error_response,
    release_import_lock,
)

logger = logging.getLogger(__name__)


class ImportThrottle(UserRateThrottle):
    """Throttle for import endpoints - prevents abuse.

    Limits users to 20 imports per hour to prevent:
    - Celery queue exhaustion
    - GitHub API rate limit abuse
    - Database spam

    Rate is generous enough for legitimate use while protecting
    against abuse and accidental spam.
    """

    rate = '20/hour'

    def wait(self):
        """Custom wait message with helpful information."""
        return super().wait()


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session authentication without CSRF check for API endpoints."""

    def enforce_csrf(self, request):
        return  # Skip CSRF check


@api_view(['POST'])
@authentication_classes([JWTAuthentication, CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
# @throttle_classes([ImportThrottle])  # Temporarily disabled for testing
def import_from_url(request):
    """
    Auto-detect integration from URL and import project.

    This is the main endpoint for the chatbot's "paste URL" feature.
    It automatically detects which integration to use based on the URL.

    Request body:
        {
            "url": "https://github.com/owner/repo",
            "is_showcase": true (optional),
            "is_private": false (optional)
        }

    Returns:
        {
            "success": true,
            "task_id": "abc123...",
            "platform": "github",
            "platform_display": "GitHub",
            "message": "Detected GitHub project! Importing...",
            "status_url": "/api/integrations/tasks/abc123/"
        }
    """
    try:
        # Get and validate URL
        url = request.data.get('url')
        if not url:
            return error_response(
                error='Please provide a project URL',
                error_code=IntegrationErrorCode.INVALID_URL,
                suggestion='Enter a URL like: https://github.com/username/repository',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Validate URL format before queueing task
        try:
            parsed = urlparse(url)
            if not parsed.scheme:
                return error_response(
                    error='Invalid URL: missing protocol (http:// or https://)',
                    error_code=IntegrationErrorCode.INVALID_URL,
                    suggestion='URL must start with http:// or https://',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if parsed.scheme not in ['http', 'https']:
                return error_response(
                    error=f'Invalid URL scheme: {parsed.scheme}',
                    error_code=IntegrationErrorCode.INVALID_URL,
                    suggestion='Only http:// and https:// URLs are supported',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            if not parsed.netloc:
                return error_response(
                    error='Invalid URL: missing domain name',
                    error_code=IntegrationErrorCode.INVALID_URL,
                    suggestion='URL must include a valid domain (e.g., github.com)',
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.warning(f'URL parsing error: {e}')
            return error_response(
                error='Malformed URL',
                error_code=IntegrationErrorCode.INVALID_URL,
                suggestion='Please enter a valid URL like: https://github.com/username/repository',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Auto-detect integration from URL
        integration_class = IntegrationRegistry.get_for_url(url)
        if not integration_class:
            available_platforms = ', '.join(IntegrationRegistry.list_all())
            return error_response(
                error=f'Could not detect platform from URL: {url}',
                error_code=IntegrationErrorCode.UNKNOWN_PLATFORM,
                suggestion=f'Supported platforms: {available_platforms}',
                status_code=status.HTTP_400_BAD_REQUEST,
                url=url,
                supported_platforms=IntegrationRegistry.list_all(),
            )

        integration = integration_class()

        logger.info(f'Auto-detected {integration.display_name} from URL: {url}')

        # Check if user has this integration connected
        if not integration.is_connected(request.user):
            return error_response(
                error=f'{integration.display_name} account not connected',
                error_code=IntegrationErrorCode.AUTH_REQUIRED,
                suggestion=f'Connect your {integration.display_name} account to import projects.',
                status_code=status.HTTP_401_UNAUTHORIZED,
                platform=integration.name,
                platform_display=integration.display_name,
                oauth_url=integration.get_oauth_url(),
            )

        # Check for import lock
        if not acquire_import_lock(request.user.id):
            return error_response(
                error='You already have an import in progress',
                error_code=IntegrationErrorCode.IMPORT_IN_PROGRESS,
                suggestion='Please wait for your current import to finish before starting a new one.',
                status_code=status.HTTP_409_CONFLICT,
            )

        # Lock acquired - ensure it's released on error
        try:
            # Check for duplicate project
            existing_project = check_duplicate_project(request.user, url)
            if existing_project:
                # Release lock before returning duplicate error
                release_import_lock(request.user.id)
                return duplicate_error_response(existing_project, request.user.username)

            # Queue generic import task
            task = import_project_generic_task.delay(
                platform=integration.name,
                user_id=request.user.id,
                url=url,
                is_showcased=request.data.get('is_showcase', True),
                is_private=request.data.get('is_private', False),
            )

            logger.info(f'Queued {integration.display_name} import task {task.id} for user {request.user.username}')

            # Extract identifier for display
            identifier_info = integration.extract_project_identifier(url)
            if integration.name == 'github':
                identifier = f'{identifier_info["owner"]}/{identifier_info["repo"]}'
            else:
                identifier = url

            # Lock will be released by the task upon completion
            return Response(
                {
                    'success': True,
                    'task_id': task.id,
                    'platform': integration.name,
                    'platform_display': integration.display_name,
                    'message': f'Detected {integration.display_name} project! Importing {identifier}...',
                    'detail': 'Your project is being analyzed and will appear in your portfolio in a few moments.',
                    'status_url': f'/api/integrations/tasks/{task.id}/',
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as task_error:
            # Release lock on any error during task queueing
            release_import_lock(request.user.id)
            logger.error(f'Error queueing import task: {task_error}', exc_info=True)
            raise  # Re-raise to be caught by outer exception handler

    except Exception as e:
        logger.error(f'Failed to import from URL: {e}', exc_info=True)

        return error_response(
            error='Something went wrong while starting the import.',
            error_code=IntegrationErrorCode.IMPORT_FAILED,
            suggestion='Please try again in a moment. If the problem persists, contact support.',
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_type=type(e).__name__,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_integrations(request):
    """
    List all available integrations and their connection status.

    Returns:
        {
            "integrations": [
                {
                    "id": "github",
                    "display_name": "GitHub",
                    "connected": true,
                    "oauth_url": "/accounts/github/login/?process=connect"
                },
                ...
            ]
        }
    """
    # Fetch all connected providers in a single query to avoid N+1 problem
    # This is crucial for performance with many integrations
    connected_providers = set(request.user.socialaccount_set.values_list('provider', flat=True))

    integrations = []

    for integration_name in IntegrationRegistry.list_all():
        integration_class = IntegrationRegistry.get(integration_name)
        if integration_class:
            integration = integration_class()
            integrations.append(
                {
                    'id': integration.name,
                    'display_name': integration.display_name,
                    'connected': integration.name in connected_providers,  # O(1) lookup instead of DB query
                    'oauth_url': integration.get_oauth_url(),
                }
            )

    return Response({'integrations': integrations})
