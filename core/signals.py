"""Signal handlers for user authentication and OAuth."""

import logging

from allauth.account.signals import user_signed_up
from allauth.socialaccount.signals import pre_social_login, social_account_added
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .projects.models import Project
from .users.models import User

logger = logging.getLogger(__name__)


@receiver(pre_social_login)
def populate_user_from_social(sender, request, sociallogin, **kwargs):
    """
    Pre-populate user data from social account before login.
    Sets username to email for OAuth signups.
    """
    # Get the user instance (may not be saved yet)
    user = sociallogin.user

    # If user already exists, skip
    if user.pk:
        return

    # Set username to email (before @ symbol, or full email if needed)
    if user.email and not user.username:
        # Use email as username
        username = user.email.split('@')[0].lower()

        # Ensure username is unique by appending number if needed
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}{counter}'
            counter += 1

        user.username = username


@receiver(user_signed_up)
def set_username_to_email_on_signup(sender, request, user, sociallogin=None, **kwargs):
    """
    After user signs up via OAuth, ensure username is set to their email.
    This handles the case where the user is created through social login.
    """
    if sociallogin:
        # This is a social login signup
        if user.email and (not user.username or '@' in user.username):
            # Set username to email (full email or part before @)
            # For simplicity and uniqueness, we'll use the full email
            desired_username = user.email.lower()

            # Check if we need to make it unique
            if User.objects.filter(username=desired_username).exclude(pk=user.pk).exists():
                # Username already taken, try email prefix with numbers
                base_username = user.email.split('@')[0].lower()
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exclude(pk=user.pk).exists():
                    username = f'{base_username}{counter}'
                    counter += 1
                desired_username = username

            user.username = desired_username
            user.save(update_fields=['username'])


@receiver([post_save, post_delete], sender=Project)
def invalidate_project_cache(sender, instance, **kwargs):
    """Invalidate cached project data when a project is created, updated, or deleted.

    This ensures users see up-to-date project information.
    """
    if instance.user:
        username = instance.user.username.lower()
        # Invalidate both public and own profile caches
        cache.delete(f'projects:{username}:public')
        cache.delete(f'projects:{username}:own')


@receiver([post_save, post_delete], sender=User)
def invalidate_user_cache(sender, instance, **kwargs):
    """Invalidate cached user profile when user is updated or deleted."""
    if instance.username:
        username = instance.username.lower()
        cache.delete(f'profile:{username}')
        # Also invalidate project caches since user data is included
        cache.delete(f'projects:{username}:public')
        cache.delete(f'projects:{username}:own')


@receiver(social_account_added)
def sync_github_to_integrations(sender, request, sociallogin, **kwargs):
    """
    Automatically make GitHub OAuth login available in integrations.

    When a user signs up or connects via GitHub OAuth, this ensures
    they can immediately use GitHub features (like repo import) without
    needing a separate connection flow.
    """
    # Only handle GitHub provider
    if sociallogin.account.provider != 'github':
        return

    user = sociallogin.user

    # Check if user already has this logged elsewhere
    logger.info(
        f'GitHub OAuth connected for user {user.username} (id={user.id}). ' f'User can now access GitHub integrations.'
    )

    # Note: We don't create a SocialConnection because:
    # 1. GitHubSyncService now checks both SocialAccount and SocialConnection
    # 2. Tokens are stored in django-allauth's SocialToken table
    # 3. This avoids duplicate storage and potential sync issues

    # Invalidate any cached connection status
    cache.delete(f'github_connection_status:{user.id}')
