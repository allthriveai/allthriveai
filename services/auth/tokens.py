"""Centralized JWT token management for authentication.

This module provides a single source of truth for JWT token generation
and cookie management across all authentication flows (OAuth, chat, traditional).
"""

import logging

from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


def generate_tokens_for_user(user):
    """Generate JWT access and refresh tokens for a user.

    Args:
        user: Django User instance

    Returns:
        dict: Dictionary with 'access' and 'refresh' token strings
    """
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def set_auth_cookies(response, user):
    """Set JWT authentication cookies on a response.

    This is the SINGLE function used across all authentication flows
    to set JWT tokens as HTTP-only cookies.

    Args:
        response: Django/DRF Response object
        user: Django User instance

    Returns:
        Response object with cookies set
    """
    try:
        tokens = generate_tokens_for_user(user)

        cookie_domain = settings.COOKIE_DOMAIN
        cookie_samesite = settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE']
        secure_flag = settings.SIMPLE_JWT['AUTH_COOKIE_SECURE']
        http_only = settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY']

        # Set access token cookie
        response.set_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=tokens['access'],
            domain=cookie_domain,
            httponly=http_only,
            secure=secure_flag,
            samesite=cookie_samesite,
            max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
            path='/',
        )

        # Set refresh token cookie
        response.set_cookie(
            key='refresh_token',
            value=tokens['refresh'],
            domain=cookie_domain,
            httponly=True,
            secure=secure_flag,
            samesite=cookie_samesite,
            max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
            path='/',
        )

        logger.info(f'JWT cookies set for user: {user.username}')
        return response

    except Exception as e:
        logger.error(f'Failed to set JWT cookies for user {user.username}: {e}', exc_info=True)
        raise


def clear_auth_cookies(response):
    """Clear JWT authentication cookies from a response.

    Args:
        response: Django/DRF Response object

    Returns:
        Response object with cookies cleared
    """
    cookie_domain = settings.COOKIE_DOMAIN
    cookie_samesite = settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE']

    # Delete cookies with domain (how they were set)
    response.delete_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'], domain=cookie_domain, path='/', samesite=cookie_samesite
    )
    response.delete_cookie(key='refresh_token', domain=cookie_domain, path='/', samesite=cookie_samesite)
    response.delete_cookie(key='csrftoken', domain=cookie_domain, path='/', samesite=cookie_samesite)

    # Also delete without domain as fallback
    response.delete_cookie(key=settings.SIMPLE_JWT['AUTH_COOKIE'], path='/', samesite=cookie_samesite)
    response.delete_cookie(key='refresh_token', path='/', samesite=cookie_samesite)
    response.delete_cookie(key='csrftoken', path='/', samesite=cookie_samesite)

    return response
