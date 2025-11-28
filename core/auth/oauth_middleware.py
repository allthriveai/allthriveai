"""Middleware to set JWT tokens in cookies after OAuth authentication.

This middleware intercepts the OAuth callback redirect and sets JWT tokens
in HTTP-only cookies before redirecting to the frontend.
"""

import logging

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(user_logged_in)
def set_jwt_cookies_on_login(sender, request, user, **kwargs):
    """Set JWT tokens in cookies when user logs in via OAuth.

    This signal handler is triggered after successful OAuth authentication.
    It marks the request for token generation by the middleware.
    """
    # Only process if this is an OAuth login (not API login)
    # Check if the request path is an OAuth callback
    if '/accounts/' in request.path and '/callback/' in request.path:
        try:
            # Mark request for JWT cookie generation
            # The middleware will use the centralized token service
            request._set_jwt_cookies_for_user = user
            logger.info(f'JWT tokens will be set for OAuth login: user={user.username}')
        except Exception as e:
            logger.error(f'Failed to mark request for JWT tokens: {e}', exc_info=True)


class OAuthJWTMiddleware:
    """Middleware to set JWT tokens in cookies after OAuth login."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Check if JWT tokens should be set for this user
        if hasattr(request, '_set_jwt_cookies_for_user'):
            try:
                from services.auth import set_auth_cookies

                user = request._set_jwt_cookies_for_user
                response = set_auth_cookies(response, user)
                logger.info(f'JWT cookies set via middleware for user: {user.username}')
            except Exception as e:
                logger.error(f'Failed to set JWT cookies in middleware: {e}', exc_info=True)

        return response
