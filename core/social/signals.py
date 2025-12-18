"""Signal handlers to sync django-allauth SocialAccount with custom SocialConnection model."""

import logging

from allauth.socialaccount.signals import social_account_added, social_account_updated
from django.dispatch import receiver

from .models import SocialConnection

logger = logging.getLogger(__name__)


@receiver(social_account_added)
@receiver(social_account_updated)
def sync_social_account_to_connection(sender, request, sociallogin, **kwargs):
    """
    Automatically sync django-allauth SocialAccount to our custom SocialConnection model.

    This allows us to use django-allauth's robust OAuth handling while maintaining
    our own SocialConnection records for additional features like encrypted token storage.

    Triggered when:
    - A new social account is connected (social_account_added)
    - An existing social account is updated (social_account_updated)
    """
    social_account = sociallogin.account
    user = sociallogin.user

    if not user or not user.pk:
        # User not saved yet, skip sync
        logger.debug('Skipping sync for unsaved user')
        return

    provider = social_account.provider
    provider_user_id = social_account.uid

    # Get token from sociallogin
    token = sociallogin.token
    if not token or not token.token:
        logger.warning(f'No access token available for {provider} social account sync for user {user.username}')
        return

    # Extract user info from extra_data
    # Different providers use different field names for the same data
    extra_data = social_account.extra_data or {}

    # Username: GitHub uses 'login', others use 'username'
    provider_username = extra_data.get('login') or extra_data.get('username', '')

    # Email
    provider_email = extra_data.get('email')

    # Profile URL: GitHub uses 'html_url'
    profile_url = extra_data.get('html_url') or extra_data.get('profile_url', '')

    # Avatar: GitHub uses 'avatar_url', Google uses 'picture'
    avatar_url = extra_data.get('avatar_url') or extra_data.get('picture', '')

    # Get or create SocialConnection
    connection, created = SocialConnection.objects.get_or_create(
        user=user,
        provider=provider,
        defaults={
            'provider_user_id': provider_user_id,
            'provider_username': provider_username,
            'provider_email': provider_email,
            'profile_url': profile_url,
            'avatar_url': avatar_url,
            'scopes': ','.join((token.token_secret or '').split() if hasattr(token, 'token_secret') else []),
            'extra_data': extra_data,
        },
    )

    # Update access token (always, even if connection existed)
    connection.access_token = token.token

    # Update other fields if this is an existing connection
    if not created:
        connection.provider_user_id = provider_user_id
        connection.provider_username = provider_username
        connection.provider_email = provider_email
        connection.profile_url = profile_url
        connection.avatar_url = avatar_url
        connection.extra_data = extra_data

    # Update expiration if available
    if token.expires_at:
        connection.token_expires_at = token.expires_at

    connection.save()

    # Pre-fill user's social links from OAuth data (only if not already set)
    # This reduces friction for new users - they don't have to re-enter their social URLs
    fields_to_update = []

    if provider == 'github' and profile_url and not user.github_url:
        user.github_url = profile_url
        fields_to_update.append('github_url')
        logger.info(f'Pre-filled github_url for user {user.username} from OAuth data')
    elif provider in ('linkedin', 'linkedin_oauth2', 'openid_connect') and profile_url and not user.linkedin_url:
        user.linkedin_url = profile_url
        fields_to_update.append('linkedin_url')
        logger.info(f'Pre-filled linkedin_url for user {user.username} from OAuth data')

    # Also pre-fill avatar if user doesn't have one
    if avatar_url and not user.avatar_url:
        user.avatar_url = avatar_url
        fields_to_update.append('avatar_url')
        logger.info(f'Pre-filled avatar_url for user {user.username} from OAuth data')

    # Pre-fill first_name and last_name from OAuth data if not already set
    # Different providers use different field names:
    # - Google: 'given_name', 'family_name'
    # - LinkedIn: 'localizedFirstName', 'localizedLastName'
    # - GitHub/GitLab: 'name' (full name, needs parsing)
    first_name = (
        extra_data.get('given_name') or extra_data.get('localizedFirstName') or extra_data.get('first_name', '')
    )
    last_name = extra_data.get('family_name') or extra_data.get('localizedLastName') or extra_data.get('last_name', '')

    # If we have a 'name' field but no first/last, try to parse it
    # This handles GitHub which only provides a full 'name' field
    if not first_name and not last_name and extra_data.get('name'):
        name_parts = extra_data['name'].split()
        if name_parts:
            first_name = name_parts[0]
            if len(name_parts) > 1:
                last_name = ' '.join(name_parts[1:])

    if first_name and not user.first_name:
        user.first_name = first_name
        fields_to_update.append('first_name')
        logger.info(f'Pre-filled first_name for user {user.username} from {provider} OAuth data')

    if last_name and not user.last_name:
        user.last_name = last_name
        fields_to_update.append('last_name')
        logger.info(f'Pre-filled last_name for user {user.username} from {provider} OAuth data')

    # Pre-fill bio from GitHub if not already set
    github_bio = extra_data.get('bio')
    if provider == 'github' and github_bio and not user.bio:
        user.bio = github_bio
        fields_to_update.append('bio')
        logger.info(f'Pre-filled bio for user {user.username} from GitHub OAuth data')

    # Pre-fill location from GitHub/GitLab if not already set
    oauth_location = extra_data.get('location')
    if oauth_location and not user.location:
        user.location = oauth_location
        fields_to_update.append('location')
        logger.info(f'Pre-filled location for user {user.username} from {provider} OAuth data')

    if fields_to_update:
        user.save(update_fields=fields_to_update)

    action = 'Created' if created else 'Updated'
    logger.info(
        f'{action} SocialConnection for user {user.username} (id={user.id}) with provider {provider}',
        extra={
            'user_id': user.id,
            'provider': provider,
            'provider_user_id': provider_user_id,
            'was_created': created,
        },
    )
