"""Token refresh endpoint with session validation.

Provides a POST endpoint for refreshing JWT tokens while validating:
1. Refresh token is valid and not expired
2. Session version matches (not globally logged out)
3. Session activity within 24 hours
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.users.models import User
from services.auth.tokens import (
    clear_auth_cookies,
    is_session_active,
    set_auth_cookies,
    validate_session_version,
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token_view(request):
    """
    Refresh JWT tokens with session validation.

    Validates:
    1. Refresh token is valid and not expired
    2. Session version matches (not globally logged out)
    3. Session activity within 24 hours

    Returns:
    - 200: New tokens set in cookies
    - 401: SESSION_INVALIDATED | SESSION_INACTIVE | TOKEN_EXPIRED | TOKEN_MISSING
    """
    # Cookie name is hardcoded as 'refresh_token' in set_auth_cookies
    refresh_token = request.COOKIES.get('refresh_token')

    if not refresh_token:
        return Response(
            {'error': 'TOKEN_MISSING', 'message': 'No refresh token provided'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        token = RefreshToken(refresh_token)
        user_id = token.get('user_id')
        token_version = token.get('session_version')

        # Check 1: Session version (global logout)
        if token_version is not None:
            if not validate_session_version(user_id, token_version):
                logger.info(f'Token refresh denied - session invalidated for user {user_id}')
                response = Response(
                    {'error': 'SESSION_INVALIDATED', 'message': 'Session has been invalidated'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
                return clear_auth_cookies(response)

        # Check 2: Session activity (24h window)
        if not is_session_active(user_id):
            logger.info(f'Token refresh denied - session inactive for user {user_id}')
            response = Response(
                {'error': 'SESSION_INACTIVE', 'message': 'Session expired due to inactivity'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            return clear_auth_cookies(response)

        # All checks passed - issue new tokens
        user = User.objects.get(id=user_id)

        # set_auth_cookies takes (response, user) and internally calls generate_tokens_for_user
        response = Response({'message': 'Token refreshed successfully'})
        logger.debug(f'Token refreshed for user {user.username}')
        return set_auth_cookies(response, user)

    except TokenError as e:
        logger.debug(f'Token refresh failed - invalid token: {e}')
        response = Response(
            {'error': 'TOKEN_EXPIRED', 'message': str(e)},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return clear_auth_cookies(response)
    except User.DoesNotExist:
        logger.warning(f'Token refresh failed - user not found: {user_id}')
        response = Response(
            {'error': 'USER_NOT_FOUND', 'message': 'User no longer exists'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return clear_auth_cookies(response)
