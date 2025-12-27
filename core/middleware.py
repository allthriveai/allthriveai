"""
Middleware for AllThrive AI.

Includes:
- HealthCheckMiddleware: Bypass ALLOWED_HOSTS for health check paths (AWS ECS/ALB)
- CookieJWTAuthenticationMiddleware: Read JWT from first-party cookie
"""

import logging
import re

from django.conf import settings
from django.http import JsonResponse
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)

# AWS infrastructure IP patterns that should bypass ALLOWED_HOSTS
# These are internal AWS IPs used by ALB, CloudFront, NAT Gateway, etc.
AWS_IP_PATTERNS = [
    r'^10\.\d+\.\d+\.\d+',  # VPC private IPs
    r'^100\.\d+\.\d+\.\d+',  # AWS carrier-grade NAT / internal services
    r'^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+',  # VPC private IPs
    r'^192\.168\.\d+\.\d+',  # Private network
]
_AWS_IP_REGEX = re.compile('|'.join(f'({p})' for p in AWS_IP_PATTERNS))


def _is_aws_infrastructure_ip(host: str) -> bool:
    """Check if the host header looks like an AWS infrastructure IP."""
    # Strip port if present
    host_without_port = host.split(':')[0] if ':' in host else host
    return bool(_AWS_IP_REGEX.match(host_without_port))


class HealthCheckMiddleware:
    """
    Middleware to handle health check requests before ALLOWED_HOSTS validation.

    AWS ECS/ALB health checks use container private IPs (e.g., 10.0.11.221:8000)
    as the Host header. Since these IPs are dynamic and change with each deployment,
    we can't add them to ALLOWED_HOSTS statically.

    This middleware intercepts:
    1. Requests to health check paths - returns immediate health response
    2. Requests from AWS infrastructure IPs - bypasses ALLOWED_HOSTS but continues processing

    This is safe because AWS infrastructure IPs cannot be spoofed by external clients
    when requests come through CloudFront/ALB.
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

        # Check if request is from AWS infrastructure (IP as Host header)
        # If so, temporarily add the IP to allowed hosts to bypass validation
        # NOTE: We use META directly instead of get_host() because get_host()
        # triggers ALLOWED_HOSTS validation and would raise DisallowedHost
        # before we can add the IP dynamically.
        host = request.headers.get('host', '')
        if _is_aws_infrastructure_ip(host):
            # Dynamically add AWS IP to allowed hosts for this request
            # This is safe because these IPs can't be spoofed through CloudFront/ALB
            if host not in settings.ALLOWED_HOSTS:
                settings.ALLOWED_HOSTS.append(host)
                logger.debug(f'Added AWS infrastructure IP to ALLOWED_HOSTS: {host}')

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
