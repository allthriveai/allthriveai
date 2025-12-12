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

    def _get_next_redirect_url(self, request):
        """Get the 'next' redirect URL if provided, with security validation.

        Validates that the next URL is a relative path (starts with /)
        to prevent open redirect vulnerabilities.
        """
        # Check session first (allauth stores it there)
        next_url = request.session.get('next')
        # Also check GET params as fallback
        if not next_url:
            next_url = request.GET.get('next')

        if next_url:
            # Security: Only allow relative paths to prevent open redirect
            if next_url.startswith('/') and not next_url.startswith('//'):
                return f'{settings.FRONTEND_URL}{next_url}'

        return None

    def get_login_redirect_url(self, request):
        """Redirect to frontend after login."""
        # Check for custom next URL first
        next_url = self._get_next_redirect_url(request)
        if next_url:
            return next_url

        if request.user.is_authenticated:
            return f'{settings.FRONTEND_URL}/{request.user.username}'
        return settings.FRONTEND_URL

    def get_signup_redirect_url(self, request):
        """Redirect to frontend after signup (including OAuth)."""
        # Check for custom next URL first
        next_url = self._get_next_redirect_url(request)
        if next_url:
            return next_url

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

        Also handles guest-to-full-account conversion when session contains
        guest_conversion_token from prepare_guest_oauth_conversion endpoint.
        """
        from services.auth import GuestUserService

        # If this social account is already linked to a user, nothing to do.
        if sociallogin.is_existing:
            return

        # allauth should have populated sociallogin.user with data from the
        # provider. We rely on email as the canonical identity anchor.
        email = (sociallogin.user.email or '').strip().lower()
        if not email:
            # No providers may not return email - store error for redirect
            request.session['guest_oauth_error'] = 'no_email'
            return

        # Check if this is a guest conversion attempt
        guest_token = request.session.get('guest_conversion_token')
        if guest_token:
            try:
                guest_user = GuestUserService.get_guest_by_token(guest_token)
                if guest_user and guest_user.is_guest:
                    # Check if email is already taken by another non-guest user
                    existing_user_with_email = (
                        User.objects.filter(email__iexact=email).exclude(pk=guest_user.pk).first()
                    )

                    if existing_user_with_email:
                        # Email already exists - store error for redirect
                        logger.warning(
                            "Guest conversion failed: email '%s' already exists for user '%s'",
                            email,
                            existing_user_with_email.username,
                        )
                        request.session['guest_oauth_error'] = 'email_exists'
                        # Clear conversion session data
                        request.session.pop('guest_conversion_token', None)
                        request.session.pop('guest_conversion_user_id', None)
                        return

                    # Convert the guest account
                    first_name = sociallogin.user.first_name or ''
                    last_name = sociallogin.user.last_name or ''

                    converted_user = GuestUserService.convert_via_oauth(
                        guest_user=guest_user,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                    )

                    logger.info(
                        "Converting guest user '%s' to full account via OAuth provider '%s'",
                        converted_user.username,
                        getattr(sociallogin.account, 'provider', 'unknown'),
                    )

                    # Mark session for successful conversion
                    request.session['guest_conversion_success'] = True

                    # Link the social account to the converted guest user
                    sociallogin.connect(request, converted_user)
                    return

            except Exception as e:
                logger.error(
                    'Error during guest OAuth conversion: %s',
                    str(e),
                    exc_info=True,
                )
                request.session['guest_oauth_error'] = 'conversion_failed'
                # Clear conversion session data
                request.session.pop('guest_conversion_token', None)
                request.session.pop('guest_conversion_user_id', None)
                return

        # Standard flow: check if email already exists
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
