"""Custom django-allauth adapter for JWT token handling.

This adapter sets JWT tokens in HTTP-only cookies after successful OAuth authentication.
"""

import logging

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings
from django.http import HttpResponseRedirect

logger = logging.getLogger(__name__)


class CustomAccountAdapter(DefaultAccountAdapter):
    """Custom account adapter for handling traditional signup/login."""

    def get_login_redirect_url(self, request):
        """Redirect to frontend after login."""
        if request.user.is_authenticated:
            return f'{settings.FRONTEND_URL}/{request.user.username}'
        return settings.FRONTEND_URL


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom social account adapter for OAuth authentication.

    This adapter sets JWT tokens in cookies after successful OAuth login.
    """

    def pre_social_login(self, request, sociallogin):
        """Called after successful OAuth authentication, before user is logged in."""
        pass

    def get_connect_redirect_url(self, request, socialaccount):
        """Redirect after connecting a social account."""
        return f'{settings.FRONTEND_URL}/{request.user.username}'

    def authentication_error(
        self,
        request,
        provider_id,
        error=None,
        exception=None,
        extra_context=None,
    ):
        """Handle OAuth authentication errors."""
        # Redirect to frontend with error
        return HttpResponseRedirect(f'{settings.FRONTEND_URL}/login?error=oauth_failed')

    def populate_user(self, request, sociallogin, data):
        """Populate user instance from social provider data."""
        from services.auth import UserCreationError, UsernameService

        user = super().populate_user(request, sociallogin, data)

        # Set username from email if not set
        if not user.username and user.email:
            # Use centralized username generation service
            try:
                user.username = UsernameService.generate_unique_from_email(user.email)
            except UserCreationError as e:
                # Log failure and re-raise - don't silently swallow
                logger.error(
                    f'Failed to generate unique username for OAuth user {user.email}: {e}',
                    exc_info=True,
                    extra={'provider': sociallogin.account.provider, 'email': user.email},
                )
                # Re-raise to prevent account creation with invalid username
                raise

        return user
