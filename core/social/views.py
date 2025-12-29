"""Views for managing social OAuth connections."""

import logging
import secrets

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.integrations.social import SocialOAuthService

from .models import SocialConnection, SocialProvider

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_connections(request):
    """List all social connections for the current user."""
    connections = SocialConnection.objects.filter(user=request.user, is_active=True)

    data = []
    for conn in connections:
        data.append(
            {
                'id': conn.id,
                'provider': conn.provider,
                'providerDisplay': conn.get_provider_display(),
                'providerUsername': conn.provider_username,
                'providerEmail': conn.provider_email,
                'profileUrl': conn.profile_url,
                'avatarUrl': conn.avatar_url,
                'isExpired': conn.is_token_expired(),
                'connectedAt': conn.created_at.isoformat(),
                'scopes': conn.get_scopes_list(),
            }
        )

    return Response({'success': True, 'data': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_providers(request):
    """List all available OAuth providers."""
    providers = []
    for provider_key, provider_label in SocialProvider.choices:
        # Check if provider is configured
        from services.integrations.social.oauth_service import OAuthProviderConfig

        client_id, client_secret = OAuthProviderConfig.get_client_credentials(provider_key)

        is_configured = bool(client_id and client_secret)
        is_connected = SocialConnection.objects.filter(
            user=request.user, provider=provider_key, is_active=True
        ).exists()

        # For Midjourney, mark as not available since there's no public API yet
        is_available = is_configured and provider_key != SocialProvider.MIDJOURNEY

        providers.append(
            {
                'key': provider_key,
                'label': provider_label,
                'isConfigured': is_configured,
                'isConnected': is_connected,
                'isAvailable': is_available,
            }
        )

    return Response({'success': True, 'data': providers})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connect_li(request):
    """LinkedIn connect alias (to avoid ad-blocker blocking 'linkedin' URLs)."""
    return _connect_provider_internal(request, 'linkedin')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_li(request):
    """LinkedIn disconnect alias (to avoid ad-blocker blocking 'linkedin' URLs)."""
    return _disconnect_provider_internal(request, 'linkedin')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def status_li(request):
    """LinkedIn status alias (to avoid ad-blocker blocking 'linkedin' URLs)."""
    return _connection_status_internal(request, 'linkedin')


def _connect_provider_internal(request, provider):
    """Internal: Initiate OAuth flow without decorators (for alias endpoints)."""
    return _do_connect_provider(request, provider)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connect_provider(request, provider):
    """Initiate OAuth flow to connect a provider."""
    return _do_connect_provider(request, provider)


def _do_connect_provider(request, provider):
    """Core logic for initiating OAuth flow."""
    logger.info(f'OAuth connection initiated for {provider} by user {request.user.username} (id={request.user.id})')

    # Validate provider
    if provider not in dict(SocialProvider.choices):
        logger.warning(f'Invalid provider requested: {provider} by user {request.user.username}')
        return Response({'success': False, 'error': 'Invalid provider'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if Midjourney (not yet available)
    if provider == SocialProvider.MIDJOURNEY:
        logger.warning(f'Midjourney OAuth requested (not available) by user {request.user.username}')
        return Response(
            {'success': False, 'error': 'Midjourney OAuth is not yet available'}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        oauth_service = SocialOAuthService(provider)
    except ValueError as e:
        logger.error(f'Failed to create OAuth service for {provider}: {str(e)}', extra={'user_id': request.user.id})
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)

    # Get the 'next' parameter for redirect after OAuth completion
    next_url = request.GET.get('next', f'{settings.FRONTEND_URL}/account/settings/integrations')

    # Store state in cache with user ID (expires in 10 minutes)
    cache_key = f'oauth_state:{state}'
    cache.set(
        cache_key,
        {
            'user_id': request.user.id,
            'provider': provider,
            'next_url': next_url,
        },
        timeout=600,
    )

    # Build redirect URI using configured backend URL
    redirect_uri = f'{settings.BACKEND_URL}/api/v1/social/callback/{provider}/'

    # Get authorization URL
    auth_url = oauth_service.get_authorization_url(redirect_uri, state)

    # Check if client wants JSON response (AJAX request) or redirect
    # AJAX requests can't follow cross-origin redirects, so return JSON
    accept_header = request.headers.get('Accept', '')
    x_requested_with = request.headers.get('X-Requested-With', '')

    if 'application/json' in accept_header or x_requested_with == 'XMLHttpRequest':
        # Return JSON for AJAX requests - frontend will redirect
        logger.info(f'Returning auth URL as JSON for {provider}')
        return Response(
            {
                'success': True,
                'data': {
                    'authUrl': auth_url,
                    'provider': provider,
                },
            }
        )
    else:
        # Redirect directly for non-AJAX requests
        return redirect(auth_url)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def oauth_callback(request, provider):
    """Handle OAuth callback from provider."""
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')

    # GitHub App installation params (when "Request user authorization during installation" is enabled)
    installation_id = request.GET.get('installation_id')
    setup_action = request.GET.get('setup_action')

    # Default redirect URL
    default_redirect = f'{settings.FRONTEND_URL}/account/settings/integrations'

    # Handle OAuth errors
    if error:
        return redirect(f'{default_redirect}?error={error}')

    # Special case: GitHub App installation with OAuth
    # When user installs from GitHub directly (not from our app), there's no state
    # but there is an installation_id. Handle this case for authenticated users.
    if provider == 'github' and installation_id and not state:
        if not request.user.is_authenticated:
            return redirect(f'{default_redirect}?error=not_authenticated')

        # This is a GitHub-initiated installation+OAuth flow
        # The user is already authenticated, so we just need to store the installation
        try:
            from core.integrations.models import GitHubAppInstallation

            installation_id_int = int(installation_id)
            GitHubAppInstallation.objects.update_or_create(
                installation_id=installation_id_int,
                defaults={
                    'user': request.user,
                    'account_login': '',
                    'account_type': '',
                    'repository_selection': 'selected',
                },
            )
            logger.info(
                f'Saved GitHub App installation {installation_id} for user {request.user.username} '
                f'(GitHub-initiated, setup_action={setup_action})'
            )

            # Also exchange the code for a token if we have one
            if code:
                try:
                    oauth_service = SocialOAuthService(provider)
                    redirect_uri = f'{settings.BACKEND_URL}/api/v1/social/callback/{provider}/'
                    token_data = oauth_service.exchange_code_for_token(code, redirect_uri)

                    oauth_service.create_or_update_connection(
                        user=request.user,
                        access_token=token_data.get('access_token'),
                        refresh_token=token_data.get('refresh_token'),
                        expires_in=token_data.get('expires_in'),
                        scope=token_data.get('scope'),
                    )
                    logger.info(f'Updated GitHub OAuth token for user {request.user.username}')
                except Exception as e:
                    logger.warning(f'Failed to exchange GitHub code during installation: {e}')

            return redirect(f'{default_redirect}?connected=github&github_installed=true')

        except (ValueError, TypeError) as e:
            logger.warning(f'Invalid installation_id {installation_id}: {e}')
            return redirect(f'{default_redirect}?error=invalid_installation')

    if not code or not state:
        return redirect(f'{default_redirect}?error=missing_params')

    # Verify state token
    cache_key = f'oauth_state:{state}'
    cached_data = cache.get(cache_key)

    if not cached_data:
        return redirect(f'{default_redirect}?error=invalid_state')

    if cached_data['user_id'] != request.user.id:
        return redirect(f'{default_redirect}?error=user_mismatch')

    if cached_data['provider'] != provider:
        return redirect(f'{default_redirect}?error=provider_mismatch')

    # Get the next URL from cached state (or use default)
    next_url = cached_data.get('next_url', default_redirect)

    # Clear state from cache
    cache.delete(cache_key)

    try:
        oauth_service = SocialOAuthService(provider)

        # Exchange code for token
        redirect_uri = f'{settings.BACKEND_URL}/api/v1/social/callback/{provider}/'
        token_data = oauth_service.exchange_code_for_token(code, redirect_uri)

        # Create or update connection
        oauth_service.create_or_update_connection(
            user=request.user,
            access_token=token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token'),
            expires_in=token_data.get('expires_in'),
            scope=token_data.get('scope'),
        )

        # If this is a GitHub App installation callback, also store the installation
        if provider == 'github' and installation_id:
            try:
                from core.integrations.models import GitHubAppInstallation

                installation_id_int = int(installation_id)
                GitHubAppInstallation.objects.update_or_create(
                    installation_id=installation_id_int,
                    defaults={
                        'user': request.user,
                        'account_login': '',  # Will be populated on first repo fetch
                        'account_type': '',
                        'repository_selection': 'selected',
                    },
                )
                logger.info(
                    f'Saved GitHub App installation {installation_id} for user {request.user.username} '
                    f'(setup_action={setup_action})'
                )
            except (ValueError, TypeError) as e:
                logger.warning(f'Invalid installation_id {installation_id}: {e}')

        # Redirect back to the original page with success
        separator = '&' if '?' in next_url else '?'
        success_params = f'connected={provider}'
        if installation_id:
            success_params += '&github_installed=true'
        return redirect(f'{next_url}{separator}{success_params}')

    except Exception as e:
        # Log error and redirect with error message
        logger.error(
            f'OAuth callback error for {provider} for user {request.user.username}: {str(e)}',
            exc_info=True,
            extra={'user_id': request.user.id, 'provider': provider},
        )

        separator = '&' if '?' in next_url else '?'
        return redirect(f'{next_url}{separator}error=connection_failed')


def _disconnect_provider_internal(request, provider):
    """Internal: Disconnect provider without decorators (for alias endpoints)."""
    return _do_disconnect_provider(request, provider)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_provider(request, provider):
    """Disconnect a social provider."""
    return _do_disconnect_provider(request, provider)


def _do_disconnect_provider(request, provider):
    """Core logic for disconnecting a provider."""
    from allauth.socialaccount.models import SocialAccount, SocialToken

    logger.info(f'Disconnect {provider} requested by user {request.user.username} (id={request.user.id})')

    disconnected = False
    provider_display = provider.capitalize()

    # Try to disconnect from django-allauth SocialAccount first
    try:
        social_account = SocialAccount.objects.get(user=request.user, provider=provider)
        # Delete associated tokens
        SocialToken.objects.filter(account=social_account).delete()
        # Delete the social account
        social_account.delete()
        logger.info(f'Disconnected {provider} SocialAccount for user {request.user.username}')
        disconnected = True
    except SocialAccount.DoesNotExist:
        pass

    # Also try to disconnect from SocialConnection
    try:
        connection = SocialConnection.objects.get(user=request.user, provider=provider, is_active=True)
        provider_display = connection.get_provider_display()

        # Soft delete - mark as inactive instead of deleting
        connection.is_active = False
        connection.save()

        logger.info(
            f'Disconnected {provider} SocialConnection for user {request.user.username}: '
            f'provider_username={connection.provider_username}'
        )
        disconnected = True
    except SocialConnection.DoesNotExist:
        pass

    if disconnected:
        return Response({'success': True, 'message': f'{provider_display} disconnected successfully'})
    else:
        logger.warning(f'Disconnect failed for {provider}: connection not found for user {request.user.username}')
        return Response({'success': False, 'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)


def _connection_status_internal(request, provider):
    """Internal: Get connection status without decorators (for alias endpoints)."""
    return _do_connection_status(request, provider)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connection_status(request, provider):
    """Get connection status for a specific provider."""
    return _do_connection_status(request, provider)


def _do_connection_status(request, provider):
    """Core logic for getting connection status."""
    from allauth.socialaccount.models import SocialAccount

    # Check django-allauth first
    try:
        social_account = SocialAccount.objects.get(user=request.user, provider=provider)
        return Response(
            {
                'success': True,
                'data': {
                    'connected': True,
                    'provider': provider,
                    'providerDisplay': provider.capitalize(),
                    'providerUsername': social_account.extra_data.get('login') or social_account.uid,
                    'profileUrl': social_account.extra_data.get('html_url', ''),
                    'avatarUrl': social_account.extra_data.get('avatar_url', ''),
                    'isExpired': False,  # allauth handles token refresh
                    'connectedAt': social_account.date_joined.isoformat(),
                },
            }
        )
    except SocialAccount.DoesNotExist:
        pass

    # Fall back to SocialConnection
    try:
        connection = SocialConnection.objects.get(user=request.user, provider=provider, is_active=True)

        return Response(
            {
                'success': True,
                'data': {
                    'connected': True,
                    'provider': connection.provider,
                    'providerDisplay': connection.get_provider_display(),
                    'providerUsername': connection.provider_username,
                    'profileUrl': connection.profile_url,
                    'avatarUrl': connection.avatar_url,
                    'isExpired': connection.is_token_expired(),
                    'connectedAt': connection.created_at.isoformat(),
                },
            }
        )

    except SocialConnection.DoesNotExist:
        return Response(
            {
                'success': True,
                'data': {
                    'connected': False,
                    'provider': provider,
                },
            }
        )
