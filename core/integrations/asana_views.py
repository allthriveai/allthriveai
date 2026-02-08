"""Views for Asana OAuth integration.

Endpoints:
- GET /api/v1/integrations/asana/authorize/ - Start OAuth flow
- GET /api/v1/integrations/asana/callback/ - Handle OAuth callback
- GET /api/v1/integrations/asana/status/ - Check connection status
- DELETE /api/v1/integrations/asana/disconnect/ - Remove connection
"""

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .asana_models import AsanaIntegration
from .asana_service import (
    AsanaError,
    exchange_code_for_tokens,
    get_authorization_url,
)

logger = logging.getLogger(__name__)

# Cache key prefix for OAuth state
OAUTH_STATE_PREFIX = 'asana_oauth_state:'
OAUTH_STATE_TIMEOUT = 600  # 10 minutes


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def asana_authorize(request):
    """
    Start the Asana OAuth authorization flow.

    Returns a JSON response with the authorization URL and state.
    Frontend should redirect the user to the authUrl.

    Response:
        {
            "authUrl": "https://app.asana.com/-/oauth_authorize?...",
            "state": "random-state-token"
        }
    """
    # Generate CSRF state token
    state = secrets.token_urlsafe(32)

    # Get the 'next' URL for post-OAuth redirect
    next_url = request.GET.get(
        'next', f'{settings.FRONTEND_URL}/account/settings/integrations'
    )

    # Store state in cache with user info
    cache_key = f'{OAUTH_STATE_PREFIX}{state}'
    cache.set(
        cache_key,
        {
            'user_id': request.user.id,
            'next_url': next_url,
        },
        timeout=OAUTH_STATE_TIMEOUT,
    )

    # Build authorization URL
    auth_url = get_authorization_url(state)

    logger.info(
        f'Asana OAuth initiated for user {request.user.id}',
        extra={'user_id': request.user.id},
    )

    return Response({
        'authUrl': auth_url,
        'state': state,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def asana_callback(request):
    """
    Handle OAuth callback from Asana.

    Query params:
        code: Authorization code from Asana
        state: CSRF state token

    On success, redirects to frontend with ?connected=asana
    On error, redirects to frontend with ?error=<message>
    """
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')

    # Default redirect URL
    default_redirect = f'{settings.FRONTEND_URL}/account/settings/integrations'

    # Handle OAuth errors from Asana
    if error:
        error_description = request.GET.get('error_description', error)
        logger.warning(f'Asana OAuth error: {error_description}')
        return redirect(f'{default_redirect}?error=asana_denied')

    # Validate required parameters
    if not code:
        logger.warning('Asana callback missing code parameter')
        return redirect(f'{default_redirect}?error=missing_code')

    if not state:
        logger.warning('Asana callback missing state parameter')
        return redirect(f'{default_redirect}?error=missing_state')

    # Verify state token
    cache_key = f'{OAUTH_STATE_PREFIX}{state}'
    cached_data = cache.get(cache_key)

    if not cached_data:
        logger.warning(f'Asana OAuth invalid/expired state: {state[:10]}...')
        return redirect(f'{default_redirect}?error=invalid_state')

    user_id = cached_data['user_id']
    next_url = cached_data.get('next_url', default_redirect)

    # Clear state from cache (one-time use)
    cache.delete(cache_key)

    # Get the user
    from core.users.models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f'Asana OAuth callback for non-existent user: {user_id}')
        return redirect(f'{default_redirect}?error=user_not_found')

    # Exchange code for tokens
    try:
        token_data = exchange_code_for_tokens(code)
    except AsanaError as e:
        logger.error(f'Asana token exchange failed for user {user_id}: {e}')
        return redirect(f'{next_url}?error=token_exchange_failed')

    # Extract token info
    access_token = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token')
    expires_in = token_data.get('expires_in', 3600)

    if not access_token:
        logger.error(f'Asana OAuth missing access_token for user {user_id}')
        return redirect(f'{next_url}?error=invalid_token_response')

    # Get user info from Asana to set default workspace
    try:
        import requests

        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(
            'https://app.asana.com/api/1.0/users/me',
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        user_data = response.json().get('data', {})

        # Get workspaces
        workspaces = user_data.get('workspaces', [])
        if not workspaces:
            logger.error(f'Asana user {user_id} has no workspaces')
            return redirect(f'{next_url}?error=no_workspaces')

        # Use first workspace as default
        default_workspace = workspaces[0]
        workspace_gid = default_workspace.get('gid', '')
        workspace_name = default_workspace.get('name', '')

    except requests.RequestException as e:
        logger.error(f'Failed to fetch Asana user info for user {user_id}: {e}')
        return redirect(f'{next_url}?error=asana_api_error')

    # Create or update integration
    token_expires_at = timezone.now() + timedelta(seconds=expires_in)

    AsanaIntegration.objects.update_or_create(
        user=user,
        defaults={
            'access_token': access_token,
            'refresh_token': refresh_token or '',
            'token_expires_at': token_expires_at,
            'workspace_gid': workspace_gid,
            'workspace_name': workspace_name,
            'sync_enabled': True,
            'last_sync_error': '',
        },
    )

    logger.info(
        f'Asana connected for user {user_id}, workspace: {workspace_name}',
        extra={'user_id': user_id, 'workspace_gid': workspace_gid},
    )

    # Redirect with success
    separator = '&' if '?' in next_url else '?'
    return redirect(f'{next_url}{separator}connected=asana')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def asana_status(request):
    """
    Get Asana connection status for the current user.

    Response when connected:
        {
            "connected": true,
            "workspaceName": "My Workspace",
            "projectName": "Content Tasks",
            "syncEnabled": true,
            "lastSyncedAt": "2024-01-15T10:30:00Z",
            "lastSyncError": "",
            "connectedAt": "2024-01-10T08:00:00Z"
        }

    Response when not connected:
        {
            "connected": false
        }

    IMPORTANT: This endpoint NEVER returns access_token or refresh_token.
    """
    try:
        integration = request.user.asana_integration

        return Response({
            'connected': True,
            'workspaceName': integration.workspace_name,
            'projectName': integration.project_name,
            'syncEnabled': integration.sync_enabled,
            'lastSyncedAt': (
                integration.last_synced_at.isoformat()
                if integration.last_synced_at else None
            ),
            'lastSyncError': integration.last_sync_error,
            'connectedAt': integration.created_at.isoformat(),
        })

    except AsanaIntegration.DoesNotExist:
        return Response({'connected': False})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def asana_disconnect(request):
    """
    Disconnect Asana integration for the current user.

    This deletes the integration record including encrypted tokens.
    Cached tasks are preserved for reference but won't sync.

    Response:
        {
            "success": true,
            "message": "Asana disconnected successfully"
        }
    """
    try:
        integration = request.user.asana_integration
        workspace_name = integration.workspace_name

        # Delete the integration (hard delete to remove tokens)
        integration.delete()

        logger.info(
            f'Asana disconnected for user {request.user.id}',
            extra={
                'user_id': request.user.id,
                'workspace_name': workspace_name,
            },
        )

        return Response({
            'success': True,
            'message': 'Asana disconnected successfully',
        })

    except AsanaIntegration.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Asana not connected',
            },
            status=status.HTTP_404_NOT_FOUND,
        )
