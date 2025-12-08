"""
Middleware for AllThrive AI.

Includes:
- HealthCheckMiddleware: Bypass ALLOWED_HOSTS for health check paths (AWS ECS/ALB)
- CookieJWTAuthenticationMiddleware: Read JWT from first-party cookie
"""

import logging

from django.conf import settings
from django.http import JsonResponse
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


class HealthCheckMiddleware:
    """
    Middleware to handle health check requests before ALLOWED_HOSTS validation.

    AWS ECS/ALB health checks use container private IPs (e.g., 10.0.11.221:8000)
    as the Host header. Since these IPs are dynamic and change with each deployment,
    we can't add them to ALLOWED_HOSTS statically.

    This middleware intercepts requests to health check paths and returns a response
    before Django's CommonMiddleware validates the Host header.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.health_check_paths = getattr(
            settings, 'HEALTH_CHECK_PATHS', ['/api/v1/health/', '/health/', '/healthz/', '/ready/']
        )

    def __call__(self, request):
        # Check if this is a health check request
        if request.path in self.health_check_paths:
            # Return immediate health response without going through full middleware stack
            # This bypasses ALLOWED_HOSTS validation in CommonMiddleware
            return JsonResponse({'status': 'healthy'}, status=200)

        return self.get_response(request)


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
