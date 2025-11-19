"""Views for managing social OAuth connections."""
import secrets
from django.conf import settings
from django.shortcuts import redirect
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.social_models import SocialConnection, SocialProvider
from services.social_oauth_service import SocialOAuthService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_connections(request):
    """List all social connections for the current user."""
    connections = SocialConnection.objects.filter(user=request.user, is_active=True)
    
    data = []
    for conn in connections:
        data.append({
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
        })
    
    return Response({
        'success': True,
        'data': data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_providers(request):
    """List all available OAuth providers."""
    providers = []
    for provider_key, provider_label in SocialProvider.choices:
        # Check if provider is configured
        from services.social_oauth_service import OAuthProviderConfig
        client_id, client_secret = OAuthProviderConfig.get_client_credentials(provider_key)
        
        is_configured = bool(client_id and client_secret)
        is_connected = SocialConnection.objects.filter(
            user=request.user,
            provider=provider_key,
            is_active=True
        ).exists()
        
        # For Midjourney, mark as not available since there's no public API yet
        is_available = is_configured and provider_key != SocialProvider.MIDJOURNEY
        
        providers.append({
            'key': provider_key,
            'label': provider_label,
            'isConfigured': is_configured,
            'isConnected': is_connected,
            'isAvailable': is_available,
        })
    
    return Response({
        'success': True,
        'data': providers
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connect_provider(request, provider):
    """Initiate OAuth flow to connect a provider."""
    # Validate provider
    if provider not in dict(SocialProvider.choices):
        return Response(
            {'success': False, 'error': 'Invalid provider'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if Midjourney (not yet available)
    if provider == SocialProvider.MIDJOURNEY:
        return Response(
            {'success': False, 'error': 'Midjourney OAuth is not yet available'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        oauth_service = SocialOAuthService(provider)
    except ValueError as e:
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state in cache with user ID (expires in 10 minutes)
    cache_key = f'oauth_state:{state}'
    cache.set(cache_key, {
        'user_id': request.user.id,
        'provider': provider,
    }, timeout=600)
    
    # Build redirect URI
    redirect_uri = request.build_absolute_uri(f'/api/v1/social/callback/{provider}/')
    
    # Get authorization URL
    auth_url = oauth_service.get_authorization_url(redirect_uri, state)
    
    return Response({
        'success': True,
        'data': {
            'authUrl': auth_url,
            'provider': provider,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def oauth_callback(request, provider):
    """Handle OAuth callback from provider."""
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    # Handle OAuth errors
    if error:
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error={error}"
        )
    
    if not code or not state:
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error=missing_params"
        )
    
    # Verify state token
    cache_key = f'oauth_state:{state}'
    cached_data = cache.get(cache_key)
    
    if not cached_data:
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error=invalid_state"
        )
    
    if cached_data['user_id'] != request.user.id:
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error=user_mismatch"
        )
    
    if cached_data['provider'] != provider:
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error=provider_mismatch"
        )
    
    # Clear state from cache
    cache.delete(cache_key)
    
    try:
        oauth_service = SocialOAuthService(provider)
        
        # Exchange code for token
        redirect_uri = request.build_absolute_uri(f'/api/v1/social/callback/{provider}/')
        token_data = oauth_service.exchange_code_for_token(code, redirect_uri)
        
        # Create or update connection
        connection = oauth_service.create_or_update_connection(
            user=request.user,
            access_token=token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token'),
            expires_in=token_data.get('expires_in'),
            scope=token_data.get('scope'),
        )
        
        # Redirect back to settings page with success
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?connected={provider}"
        )
        
    except Exception as e:
        # Log error and redirect with error message
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"OAuth callback error for {provider}: {str(e)}")
        
        return redirect(
            f"{settings.FRONTEND_URL}/account/settings/social?error=connection_failed"
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_provider(request, provider):
    """Disconnect a social provider."""
    try:
        connection = SocialConnection.objects.get(
            user=request.user,
            provider=provider,
            is_active=True
        )
        
        # Soft delete - mark as inactive instead of deleting
        connection.is_active = False
        connection.save()
        
        return Response({
            'success': True,
            'message': f'{connection.get_provider_display()} disconnected successfully'
        })
        
    except SocialConnection.DoesNotExist:
        return Response(
            {
                'success': False,
                'error': 'Connection not found'
            },
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connection_status(request, provider):
    """Get connection status for a specific provider."""
    try:
        connection = SocialConnection.objects.get(
            user=request.user,
            provider=provider,
            is_active=True
        )
        
        return Response({
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
            }
        })
        
    except SocialConnection.DoesNotExist:
        return Response({
            'success': True,
            'data': {
                'connected': False,
                'provider': provider,
            }
        })
