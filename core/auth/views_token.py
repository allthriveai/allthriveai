"""
WebSocket Connection Token API

Provides secure, short-lived connection tokens for WebSocket authentication.
This implements the industry-standard pattern for cross-origin WebSocket auth.

Security Features:
- Tokens are single-use and expire in 60 seconds
- Tokens are separate from access tokens (scoped to WebSocket only)
- All token generation and usage is logged for security auditing
- Rate-limited to prevent abuse

Architecture:
1. Frontend calls this endpoint (authenticated via HTTP-only cookie)
2. Backend generates ephemeral connection token
3. Frontend uses token in WebSocket query parameter
4. Middleware validates and consumes token (single-use)
"""

import logging
import uuid

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.agents.ws_connection_tokens import get_ws_token_service

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_ws_connection_token(request):
    """
    Generate a secure WebSocket connection token for the authenticated user.

    This endpoint is called before establishing a WebSocket connection.
    The returned token is:
    - Valid for 60 seconds only
    - Single-use (consumed on first WebSocket connection)
    - Scoped to WebSocket connections only (cannot be used for API access)

    Request:
        POST /api/v1/auth/ws-connection-token/
        Headers: Cookie with access_token (HTTP-only)
        Body: {
            "connection_id": "optional-client-generated-id"  // For client-side tracking
        }

    Response:
        200 OK
        {
            "connection_token": "secure-random-token",
            "expires_in": 60,
            "connection_id": "client-provided-or-server-generated-id"
        }

    Security:
        - Rate-limited (10 requests/minute per user)
        - Requires authentication via HTTP-only cookie
        - All generations logged for security audit
        - Tokens stored in Redis with TTL

    Example Usage (Frontend):
        // 1. Get connection token
        const response = await fetch('/api/v1/auth/ws-connection-token/', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({ connection_id: uuid() })
        });
        const { connection_token } = await response.json();

        // 2. Connect to WebSocket
        const ws = new WebSocket(`ws://backend/ws/chat/id/?connection_token=${connection_token}`);
    """
    # Get connection_id from request (optional, for client-side tracking)
    connection_id = request.data.get('connection_id') or str(uuid.uuid4())

    # Check Redis connectivity first
    from django.core.cache import cache

    try:
        cache.set('_ws_token_health_check', '1', timeout=5)
        if not cache.get('_ws_token_health_check'):
            logger.error('[WS_TOKEN_API] Redis health check failed - cache not responding')
            return Response(
                {'error': 'Cache service unavailable', 'code': 'CACHE_UNAVAILABLE'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except Exception as cache_error:
        logger.error(f'[WS_TOKEN_API] Redis connection error: {cache_error}', exc_info=True)
        return Response(
            {'error': 'Cache service error', 'code': 'CACHE_ERROR', 'details': str(cache_error)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Generate secure connection token
    try:
        token_service = get_ws_token_service()
        connection_token = token_service.generate_token(
            user_id=request.user.id, username=request.user.username, connection_id=connection_id
        )
    except Exception as token_error:
        logger.error(
            f'[WS_TOKEN_API] Token generation failed for user={request.user.username} '
            f'(id={request.user.id}): {token_error}',
            exc_info=True,
        )
        return Response(
            {'error': 'Token generation failed', 'code': 'TOKEN_GENERATION_ERROR', 'details': str(token_error)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    logger.info(
        f'[WS_TOKEN_API] Generated connection token for user={request.user.username} '
        f'(id={request.user.id}), connection_id={connection_id}'
    )

    return Response(
        {
            'connection_token': connection_token,
            'expires_in': 60,  # TTL in seconds
            'connection_id': connection_id,
        },
        status=status.HTTP_200_OK,
    )
