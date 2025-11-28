"""
Middleware to read JWT from first-party cookie and expose it as an Authorization header.
This allows DRF's built-in JWTAuthentication to work with cookie-based tokens.
"""

import logging

from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


class CookieJWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
            token = request.COOKIES.get(cookie_name)
            # Only inject if header not set and token is valid (e.g., not expired)
            if token and 'authorization' not in request.headers:
                try:
                    # Validate token; raises TokenError if invalid/expired
                    AccessToken(token)
                    request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
                except TokenError as e:
                    # Expected - token invalid/expired, don't log as error
                    # This is normal when tokens expire
                    logger.debug(
                        f'JWT token validation failed: {e}',
                        extra={'path': request.path, 'method': request.method},
                    )
        except Exception as e:
            # Unexpected error - log it but never block requests
            logger.error(
                f'Unexpected error in CookieJWTAuthenticationMiddleware: {e}',
                exc_info=True,
                extra={
                    'path': request.path,
                    'method': request.method,
                    'has_cookie': bool(request.COOKIES.get(cookie_name)) if 'cookie_name' in locals() else False,
                },
            )
        return self.get_response(request)
