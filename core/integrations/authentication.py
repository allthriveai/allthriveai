"""Shared authentication classes for integrations.

This module provides reusable authentication classes to ensure
consistent security behavior across all integration endpoints.
"""

from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """Session authentication that enforces CSRF for state-changing operations.

    For API endpoints using JWT + session auth, we must enforce CSRF protection
    to prevent cross-site request forgery when cookies are used for authentication.

    DRF's SessionAuthentication already enforces CSRF by default - this class
    exists to make the security intent explicit and provide a single source
    of truth for session-based auth across integration endpoints.

    Usage:
        @authentication_classes([JWTAuthentication, CsrfEnforcedSessionAuthentication])
        def my_view(request):
            ...
    """

    pass
