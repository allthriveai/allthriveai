"""Custom django-allauth adapter for JWT token handling.

This adapter sets JWT tokens in HTTP-only cookies after successful OAuth authentication.
"""

import logging

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponseRedirect

logger = logging.getLogger(__name__)
User = get_user_model()


class CustomAccountAdapter(DefaultAccountAdapter):
    """Custom account adapter for handling traditional signup/login."""

    def get_login_redirect_url(self, request):
        """Redirect to frontend after login."""
        if request.user.is_authenticated:
            return f'{settings.FRONTEND_URL}/{request.user.username}'
        return settings.FRONTEND_URL

    def get_signup_redirect_url(self, request):
        """Redirect to frontend after signup (including OAuth)."""
        if request.user.is_authenticated:
            return f'{settings.FRONTEND_URL}/{request.user.username}'
        return settings.FRONTEND_URL


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom social account adapter for OAuth authentication.

    This adapter sets JWT tokens in cookies after successful OAuth login and
    ensures social logins are linked to existing users by email when possible.
    """

    def pre_social_login(self, request, sociallogin):
        """Link social login to existing user by email instead of creating duplicates.

        This runs after the provider has authenticated the user but before the
        user is actually logged in. If a user with the same email already
        exists, we attach this social account to that user so that one person
        can log in via email/password, Google, or GitHub and still end up with
        a single `User` record.
        """
        # If this social account is already linked to a user, nothing to do.
        if sociallogin.is_existing:
            return

        # allauth should have populated sociallogin.user with data from the
        # provider. We rely on email as the canonical identity anchor.
        email = (sociallogin.user.email or '').strip().lower()
        if not email:
            # Some providers may not return email; in that case fall back to
            # default behaviour and let allauth handle it.
            return

        try:
            existing_user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # No existing user with this email -> this will become a new user.
            return

        # Attach this social login to the existing user instead of creating a
        # brand new user with the same email.
        logger.info(
            "Linking social login for provider '%s' to existing user '%s' (by email)",
            getattr(sociallogin.account, 'provider', 'unknown'),
            existing_user.username,
        )
        sociallogin.connect(request, existing_user)

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
