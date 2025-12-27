"""
Production smoke test authentication endpoint.

This endpoint provides API key-based authentication for production E2E smoke tests.
It is NOT a general-purpose login endpoint - it only works for a designated test user.

Security measures:
- API key header validation with constant-time comparison
- Rate limited to 1 request per minute
- Only works for the designated smoke test user (support@allthrive.ai)
- All access is logged for security auditing
"""

import logging
import secrets

from celery import current_app
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from core.users.models import User
from services.auth import generate_tokens_for_user, set_auth_cookies

logger = logging.getLogger(__name__)

# The designated smoke test user email
SMOKE_TEST_USER_EMAIL = 'allie@allthrive.ai'


class SmokeTestThrottle(AnonRateThrottle):
    """Rate limit smoke test endpoint to 1 request per minute."""

    rate = '1/min'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SmokeTestThrottle])
def smoke_test_login(request):
    """
    Production smoke test login endpoint.

    Authenticates using an API key header and returns JWT tokens for the
    designated smoke test user. This endpoint is used by GitHub Actions
    to run E2E tests against production after deployments.

    Headers:
        X-Smoke-Test-Key: The API key (must match SMOKE_TEST_API_KEY setting)

    Returns:
        200: JWT tokens and sets authentication cookies
        401: Invalid or missing API key
        500: Smoke test user not configured
    """
    client_ip = request.headers.get('x-forwarded-for', request.META.get('REMOTE_ADDR', 'unknown'))
    if ',' in client_ip:
        client_ip = client_ip.split(',')[0].strip()

    # Get API key from header
    api_key = request.headers.get('X-Smoke-Test-Key', '')
    expected_key = getattr(settings, 'SMOKE_TEST_API_KEY', None)

    # Validate API key
    if not expected_key:
        logger.warning(f'Smoke test endpoint called but SMOKE_TEST_API_KEY not configured. IP: {client_ip}')
        return Response({'error': 'Smoke test not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not api_key or not secrets.compare_digest(api_key, expected_key):
        logger.warning(f'Smoke test auth failed - invalid API key. IP: {client_ip}')
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    # Get the smoke test user
    try:
        user = User.objects.get(email=SMOKE_TEST_USER_EMAIL)
    except User.DoesNotExist:
        logger.error(f'Smoke test user {SMOKE_TEST_USER_EMAIL} not found in database. IP: {client_ip}')
        return Response(
            {'error': f'Smoke test user ({SMOKE_TEST_USER_EMAIL}) not configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Generate tokens
    tokens = generate_tokens_for_user(user)

    logger.info(f'Smoke test login successful for {user.email}. IP: {client_ip}')

    # Return tokens as JSON and also set cookies
    response = Response(
        {
            'success': True,
            'message': 'Smoke test login successful',
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
            },
        },
        status=status.HTTP_200_OK,
    )

    # Also set cookies for browser-based tests
    return set_auth_cookies(response, user)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SmokeTestThrottle])
def smoke_test_cleanup(request):
    """
    Production smoke test cleanup endpoint.

    Purges any pending Celery tasks that may have been created during smoke tests.
    This prevents hanging tasks from affecting production after test failures.

    Headers:
        X-Smoke-Test-Key: The API key (must match SMOKE_TEST_API_KEY setting)

    Returns:
        200: Cleanup successful with details
        401: Invalid or missing API key
        500: Cleanup failed
    """
    client_ip = request.headers.get('x-forwarded-for', request.META.get('REMOTE_ADDR', 'unknown'))
    if ',' in client_ip:
        client_ip = client_ip.split(',')[0].strip()

    # Get API key from header
    api_key = request.headers.get('X-Smoke-Test-Key', '')
    expected_key = getattr(settings, 'SMOKE_TEST_API_KEY', None)

    # Validate API key
    if not expected_key:
        logger.warning(f'Smoke test cleanup called but SMOKE_TEST_API_KEY not configured. IP: {client_ip}')
        return Response({'error': 'Smoke test not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not api_key or not secrets.compare_digest(api_key, expected_key):
        logger.warning(f'Smoke test cleanup auth failed - invalid API key. IP: {client_ip}')
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    cleanup_results = {
        'purged_queues': [],
        'revoked_tasks': 0,
        'errors': [],
    }

    try:
        # Get Celery app
        celery_app = current_app

        # Get list of active tasks
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active() or {}
        reserved_tasks = inspect.reserved() or {}

        # Count tasks to revoke
        task_ids_to_revoke = []
        for worker, tasks in {**active_tasks, **reserved_tasks}.items():
            for task in tasks:
                task_id = task.get('id')
                if task_id:
                    task_ids_to_revoke.append(task_id)

        # Revoke active tasks (terminate=True to kill immediately)
        if task_ids_to_revoke:
            celery_app.control.revoke(task_ids_to_revoke, terminate=True, signal='SIGTERM')
            cleanup_results['revoked_tasks'] = len(task_ids_to_revoke)

        # Purge each queue
        queues_to_purge = ['celery', 'default', 'ai_tasks', 'high_priority', 'low_priority']
        for queue_name in queues_to_purge:
            try:
                purged = celery_app.control.purge()
                if purged:
                    cleanup_results['purged_queues'].append(queue_name)
            except Exception as e:
                cleanup_results['errors'].append(f'Failed to purge {queue_name}: {e!s}')

        logger.info(
            f'Smoke test cleanup completed. Revoked {cleanup_results["revoked_tasks"]} tasks, '
            f'purged queues: {cleanup_results["purged_queues"]}. IP: {client_ip}'
        )

        return Response(
            {
                'success': True,
                'message': 'Celery cleanup completed',
                'details': cleanup_results,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.error(f'Smoke test cleanup failed: {e!s}. IP: {client_ip}')
        return Response(
            {
                'success': False,
                'error': f'Cleanup failed: {e!s}',
                'details': cleanup_results,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
