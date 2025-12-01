"""
WebSocket JWT Authentication Middleware

Provides JWT token authentication for WebSocket connections.
Supports token extraction from:
1. Connection tokens (preferred - short-lived, single-use)
2. Cookies (fallback for direct connections)
3. Query parameters (fallback for API clients)
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from core.agents.ws_connection_tokens import get_ws_token_service

logger = logging.getLogger(__name__)
User = get_user_model()


@database_sync_to_async
def get_user_from_connection_token(connection_token: str):
    """
    Validate connection token and return associated user.

    Connection tokens are short-lived (60s), single-use tokens
    generated specifically for WebSocket connections.

    Args:
        connection_token: WebSocket connection token

    Returns:
        User object if valid, AnonymousUser if invalid
    """
    try:
        # Validate and consume connection token (single-use)
        token_service = get_ws_token_service()
        user_id = token_service.validate_and_consume_token(connection_token)

        if not user_id:
            logger.warning(f'Invalid or expired connection token: {connection_token[:8]}...')
            return AnonymousUser()

        # Retrieve user from database
        user = User.objects.get(id=user_id)

        if not user.is_active:
            logger.warning(f'Inactive user attempted WebSocket connection: user_id={user_id}')
            return AnonymousUser()

        return user

    except User.DoesNotExist:
        logger.warning(f'User not found for connection token: user_id={user_id}')
        return AnonymousUser()
    except Exception as e:
        logger.error(f'Unexpected error validating connection token: {e}', exc_info=True)
        return AnonymousUser()


@database_sync_to_async
def get_user_from_token(token_string: str):
    """
    Validate JWT token and return associated user.

    Args:
        token_string: JWT access token

    Returns:
        User object if valid, AnonymousUser if invalid
    """
    try:
        # Validate and decode token
        access_token = AccessToken(token_string)
        user_id = access_token.get('user_id')

        # Retrieve user from database
        user = User.objects.get(id=user_id)

        if not user.is_active:
            logger.warning(f'Inactive user attempted WebSocket connection: user_id={user_id}')
            return AnonymousUser()

        return user

    except TokenError as e:
        logger.debug(f'Invalid JWT token for WebSocket: {e}')
        return AnonymousUser()
    except User.DoesNotExist:
        logger.warning(f'User not found for token: user_id={user_id}')
        return AnonymousUser()
    except Exception as e:
        logger.error(f'Unexpected error validating WebSocket token: {e}', exc_info=True)
        return AnonymousUser()


class JWTAuthMiddleware:
    """
    Middleware to authenticate WebSocket connections using JWT tokens.

    Authentication priority:
    1. Connection token (preferred - short-lived, single-use)
    2. HTTP cookies (fallback for direct connections)
    3. Query parameter 'token' (fallback for API clients)

    Sets scope['user'] to authenticated User or AnonymousUser.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Only process WebSocket connections
        if scope['type'] != 'websocket':
            return await self.app(scope, receive, send)

        # Parse query string for connection token
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string) if query_string else {}

        # Priority 1: Check for connection token (preferred method)
        connection_token_list = params.get('connection_token', [])
        if connection_token_list:
            connection_token = connection_token_list[0]
            scope['user'] = await get_user_from_connection_token(connection_token)
            if scope['user'].is_authenticated:
                logger.info(
                    f'[WS_AUTH] Authenticated via connection token: user={scope["user"].username}, '
                    f'path={scope.get("path", "unknown")}'
                )
                return await self.app(scope, receive, send)
            else:
                logger.warning(f'[WS_AUTH] Invalid connection token for path={scope.get("path", "unknown")}')
                # Don't fall back to other methods for invalid connection token
                scope['user'] = AnonymousUser()
                return await self.app(scope, receive, send)

        # Priority 2: Extract token from cookies (fallback)
        token = None
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')

        # Parse cookies from headers
        headers = dict(scope.get('headers', []))
        cookie_header = headers.get(b'cookie', b'').decode()

        if cookie_header:
            cookies = {}
            for cookie in cookie_header.split('; '):
                if '=' in cookie:
                    key, value = cookie.split('=', 1)
                    cookies[key] = value
            token = cookies.get(cookie_name)

        # Priority 3: Fallback to query parameter 'token'
        if not token:
            token_list = params.get('token', [])
            if token_list:
                token = token_list[0]

        # Authenticate user with JWT token
        if token:
            scope['user'] = await get_user_from_token(token)
            if scope['user'].is_authenticated:
                logger.info(
                    f'[WS_AUTH] Authenticated via JWT: user={scope["user"].username}, '
                    f'path={scope.get("path", "unknown")}'
                )
        else:
            scope['user'] = AnonymousUser()
            logger.debug(f'[WS_AUTH] No auth found for WebSocket connection: path={scope.get("path", "unknown")}')

        return await self.app(scope, receive, send)


def JWTAuthMiddlewareStack(app):
    """
    Convenience function to wrap WebSocket app with JWT authentication.

    Usage in asgi.py:
        from core.agents.middleware import JWTAuthMiddlewareStack

        application = ProtocolTypeRouter({
            "websocket": JWTAuthMiddlewareStack(
                URLRouter(websocket_urlpatterns)
            ),
        })
    """
    return JWTAuthMiddleware(app)
