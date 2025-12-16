"""Helper functions for LinkedIn integration."""

import logging
import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.users.models import User

logger = logging.getLogger(__name__)


def parse_linkedin_url(url: str) -> dict[str, str]:
    """Parse a LinkedIn URL to extract the type and identifier.

    Supports:
    - Profile URLs: linkedin.com/in/username
    - Post URLs: linkedin.com/posts/username_activity-123
    - Article URLs: linkedin.com/pulse/article-title-username

    Args:
        url: LinkedIn URL

    Returns:
        dict with 'type' and 'identifier' keys

    Raises:
        ValueError: If URL is not a valid LinkedIn URL
    """
    url = url.strip().rstrip('/')

    # Profile URL patterns
    profile_patterns = [
        r'(?:https?://)?(?:www\.)?linkedin\.com/in/([a-zA-Z0-9\-_]+)/?',
    ]

    for pattern in profile_patterns:
        match = re.match(pattern, url, re.IGNORECASE)
        if match:
            return {
                'type': 'profile',
                'identifier': match.group(1),
            }

    # Post URL patterns
    post_patterns = [
        r'(?:https?://)?(?:www\.)?linkedin\.com/posts/([a-zA-Z0-9\-_]+)_([a-zA-Z0-9\-_]+)',
        r'(?:https?://)?(?:www\.)?linkedin\.com/feed/update/urn:li:activity:(\d+)',
    ]

    for pattern in post_patterns:
        match = re.match(pattern, url, re.IGNORECASE)
        if match:
            return {
                'type': 'post',
                'identifier': match.group(1) if len(match.groups()) == 2 else match.group(1),
                'activity_id': match.group(2) if len(match.groups()) == 2 else match.group(1),
            }

    # Article URL patterns
    article_patterns = [
        r'(?:https?://)?(?:www\.)?linkedin\.com/pulse/([a-zA-Z0-9\-_]+)',
    ]

    for pattern in article_patterns:
        match = re.match(pattern, url, re.IGNORECASE)
        if match:
            return {
                'type': 'article',
                'identifier': match.group(1),
            }

    # Generic LinkedIn URL check
    if 'linkedin.com' in url.lower():
        raise ValueError(f'Unsupported LinkedIn URL format: {url}')

    raise ValueError(f'Not a LinkedIn URL: {url}')


def is_linkedin_url(url: str) -> bool:
    """Check if a URL is a LinkedIn URL.

    Args:
        url: URL to check

    Returns:
        True if URL is a LinkedIn URL
    """
    try:
        parse_linkedin_url(url)
        return True
    except ValueError:
        return 'linkedin.com' in url.lower()


def get_user_linkedin_token(user: 'User') -> str | None:
    """Get the user's LinkedIn access token.

    Checks both SocialConnection and django-allauth SocialAccount.

    Args:
        user: User instance

    Returns:
        Access token string or None if not connected
    """
    # Try SocialConnection first
    try:
        from core.social.models import SocialConnection, SocialProvider

        connection = SocialConnection.objects.get(user=user, provider=SocialProvider.LINKEDIN, is_active=True)
        token = connection.access_token
        if token:
            logger.debug(f'Found LinkedIn token in SocialConnection for user {user.id}')
            return token
    except Exception as e:
        logger.debug(f'No LinkedIn SocialConnection for user {user.id}: {e}')

    # Try django-allauth SocialAccount/SocialToken
    try:
        from allauth.socialaccount.models import SocialAccount, SocialToken

        social_account = SocialAccount.objects.get(user=user, provider='linkedin')
        social_token = SocialToken.objects.filter(account=social_account).first()
        if social_token:
            logger.debug(f'Found LinkedIn token in allauth for user {user.id}')
            return social_token.token
    except Exception as e:
        logger.debug(f'No LinkedIn allauth token for user {user.id}: {e}')

    return None


def normalize_linkedin_profile_data(profile_data: dict, email_data: dict | None = None) -> dict[str, Any]:
    """Normalize LinkedIn profile data to a common format.

    Args:
        profile_data: Raw profile data from LinkedIn API
        email_data: Optional email data from LinkedIn API

    Returns:
        Normalized profile data dict
    """
    # Extract name
    first_name = profile_data.get('localizedFirstName', '')
    last_name = profile_data.get('localizedLastName', '')
    full_name = f'{first_name} {last_name}'.strip()

    # Extract profile picture
    avatar_url = ''
    profile_picture = profile_data.get('profilePicture', {})
    display_image = profile_picture.get('displayImage~', {})
    elements = display_image.get('elements', [])
    if elements:
        # Get the largest image
        for element in reversed(elements):
            identifiers = element.get('identifiers', [])
            if identifiers:
                avatar_url = identifiers[0].get('identifier', '')
                break

    # Extract email if available
    email = None
    if email_data:
        elements = email_data.get('elements', [])
        if elements:
            handle = elements[0].get('handle~', {})
            email = handle.get('emailAddress')

    # Extract vanity name (public profile identifier)
    vanity_name = profile_data.get('vanityName', '')

    return {
        'id': profile_data.get('id', ''),
        'first_name': first_name,
        'last_name': last_name,
        'full_name': full_name,
        'vanity_name': vanity_name,
        'email': email,
        'avatar_url': avatar_url,
        'profile_url': f'https://www.linkedin.com/in/{vanity_name}' if vanity_name else '',
        'raw_data': profile_data,
    }


def normalize_linkedin_post(post_data: dict) -> dict[str, Any]:
    """Normalize a LinkedIn post to a common format.

    Args:
        post_data: Raw post data from LinkedIn API

    Returns:
        Normalized post data dict
    """
    # Extract post ID
    post_id = post_data.get('id', '')

    # Extract timestamp
    created = post_data.get('created', {})
    created_time = created.get('time', 0)

    # Extract content
    specific_content = post_data.get('specificContent', {})
    share_content = specific_content.get('com.linkedin.ugc.ShareContent', {})
    commentary = share_content.get('shareCommentary', {})
    text = commentary.get('text', '')

    # Extract media type
    media_category = share_content.get('shareMediaCategory', 'NONE')

    # Extract visibility
    visibility = post_data.get('visibility', {})
    visibility_type = visibility.get('com.linkedin.ugc.MemberNetworkVisibility', 'CONNECTIONS')

    return {
        'id': post_id,
        'text': text,
        'created_time': created_time,
        'media_type': media_category,
        'visibility': visibility_type,
        'is_public': visibility_type == 'PUBLIC',
        'raw_data': post_data,
    }


def get_import_lock_key(user_id: int, url: str) -> str:
    """Generate a cache key for import locking.

    Args:
        user_id: User ID
        url: LinkedIn URL being imported

    Returns:
        Cache key string
    """
    import hashlib

    url_hash = hashlib.md5(url.encode(), usedforsecurity=False).hexdigest()[:8]  # noqa: S324
    return f'linkedin_import_lock:{user_id}:{url_hash}'
