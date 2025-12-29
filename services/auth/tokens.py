"""Centralized JWT token management for authentication.

This module provides a single source of truth for JWT token generation
and cookie management across all authentication flows (OAuth, chat, traditional).

Also includes Redis-based session management for:
- Sliding 24-hour session window (expires after 24h of inactivity)
- Global logout (invalidates ALL sessions across all devices)
"""

import logging

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

# Session management constants
SESSION_VERSION_KEY_PREFIX = 'session:version:'
SESSION_ACTIVITY_KEY_PREFIX = 'session:activity:'
SESSION_DEBOUNCE_KEY_PREFIX = 'session:debounce:'
SESSION_TTL = 24 * 60 * 60  # 24 hours
SESSION_VERSION_TTL = 90 * 24 * 60 * 60  # 90 days
ACTIVITY_DEBOUNCE_TTL = 5 * 60  # 5 minutes


def get_or_create_session_version(user_id: int) -> int:
    """Get or initialize session version to 1 (atomic).

    Uses cache.add() which is atomic - only sets if key doesn't exist.
    Fails open on Redis errors to avoid blocking authentication.
    """
    key = f'{SESSION_VERSION_KEY_PREFIX}{user_id}'
    try:
        cache.add(key, 1, timeout=SESSION_VERSION_TTL)
        return cache.get(key, 1)
    except Exception as e:
        logger.warning(f'Redis error in get_or_create_session_version: {e}')
        return 1  # Fail open - allow login


def increment_session_version(user_id: int) -> int:
    """Atomic increment for global logout.

    Increments the session version, invalidating all existing tokens
    for this user across all devices.
    """
    key = f'{SESSION_VERSION_KEY_PREFIX}{user_id}'
    try:
        new_version = cache.incr(key)
        # Reset TTL on increment
        cache.touch(key, SESSION_VERSION_TTL)
        return new_version
    except ValueError:
        # Key doesn't exist - set to 2 (user was at version 1)
        cache.set(key, 2, timeout=SESSION_VERSION_TTL)
        return 2
    except Exception as e:
        logger.error(f'Redis error in increment_session_version: {e}')
        return 2  # Assume increment worked


def refresh_session_activity(user_id: int) -> None:
    """Refresh 24h sliding window TTL with 5-min debounce.

    Only updates Redis if 5 minutes have passed since last update
    to reduce Redis writes on high-traffic endpoints.
    """
    debounce_key = f'{SESSION_DEBOUNCE_KEY_PREFIX}{user_id}'
    activity_key = f'{SESSION_ACTIVITY_KEY_PREFIX}{user_id}'

    try:
        # Only refresh if debounce key doesn't exist (5 min cooldown)
        if cache.add(debounce_key, '1', timeout=ACTIVITY_DEBOUNCE_TTL):
            cache.set(activity_key, timezone.now().isoformat(), timeout=SESSION_TTL)
    except Exception as e:
        logger.warning(f'Redis error in refresh_session_activity: {e}')
        # Fail open - don't block the request


def is_session_active(user_id: int) -> bool:
    """Check if session has activity within 24h.

    Returns True if the activity key exists (hasn't expired).
    Fails open on Redis errors.
    """
    key = f'{SESSION_ACTIVITY_KEY_PREFIX}{user_id}'
    try:
        return cache.get(key) is not None
    except Exception as e:
        logger.warning(f'Redis error in is_session_active: {e}')
        return True  # Fail open


def validate_session_version(user_id: int, token_version: int) -> bool:
    """Compare token version against Redis. Returns True if valid.

    Used to check if a token has been invalidated by a global logout.
    Legacy tokens without session_version claim are always valid.
    """
    key = f'{SESSION_VERSION_KEY_PREFIX}{user_id}'
    try:
        current_version = cache.get(key)
        if current_version is None:
            # No version in Redis - legacy token or first request
            return True
        return int(current_version) == int(token_version)
    except Exception as e:
        logger.warning(f'Redis error in validate_session_version: {e}')
        return True  # Fail open - don't lock out users on Redis failure


def generate_tokens_for_user(user):
    """Generate JWT access and refresh tokens for a user.

    Includes session version claim for global logout support
    and initializes/refreshes the 24h session activity window.

    Args:
        user: Django User instance

    Returns:
        dict: Dictionary with 'access' and 'refresh' token strings
    """
    refresh = RefreshToken.for_user(user)

    # Add session version to both tokens for global logout support
    session_version = get_or_create_session_version(user.id)
    refresh['session_version'] = session_version
    refresh.access_token['session_version'] = session_version

    # Force-set session activity on login (bypass debounce)
    # This ensures the activity key exists immediately after login,
    # preventing is_session_active() from returning False if called
    # before the debounce window expires.
    activity_key = f'{SESSION_ACTIVITY_KEY_PREFIX}{user.id}'
    try:
        cache.set(activity_key, timezone.now().isoformat(), timeout=SESSION_TTL)
    except Exception as e:
        logger.warning(f'Redis error setting initial session activity: {e}')
        # Fail open - allow login even if Redis is unavailable

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
