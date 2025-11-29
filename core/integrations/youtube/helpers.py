"""YouTube integration helper functions."""

import logging
import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import httpx
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.utils.text import slugify

from core.users.models import User

logger = logging.getLogger(__name__)


def get_user_youtube_token(user: User) -> str:
    """
    Get user's YouTube OAuth token, refreshing if expired.

    Args:
        user: User instance

    Returns:
        OAuth access token

    Raises:
        IntegrationAuthError: If user hasn't connected YouTube or token invalid
    """
    from core.integrations.base.exceptions import IntegrationAuthError
    from core.social.models import SocialConnection

    try:
        connection = SocialConnection.objects.get(user=user, provider='google', is_active=True)
    except SocialConnection.DoesNotExist as e:
        raise IntegrationAuthError(
            'YouTube not connected. Please connect your Google account.',
            integration_name='youtube',
        ) from e

    # Check if token is expired or about to expire (within 5 minutes)
    now = timezone.now()
    expires_at = connection.token_expires_at

    if expires_at and expires_at < now + timedelta(minutes=5):
        logger.info(f'YouTube token expired for user {user.id}, refreshing...')

        # Refresh token
        refresh_token = connection.refresh_token
        if not refresh_token:
            raise IntegrationAuthError(
                'No refresh token available. Please reconnect YouTube.',
                integration_name='youtube',
            )

        # Call Google OAuth token endpoint
        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(
                    'https://oauth2.googleapis.com/token',
                    data={
                        'client_id': settings.SOCIAL_AUTH_GOOGLE_OAUTH2_KEY,
                        'client_secret': settings.SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET,
                        'refresh_token': refresh_token,
                        'grant_type': 'refresh_token',
                    },
                )

                if response.status_code != 200:
                    logger.error(f'Token refresh failed: {response.text}')
                    raise IntegrationAuthError(
                        'Failed to refresh YouTube token. Please reconnect.',
                        integration_name='youtube',
                    )

                data = response.json()

                # Update connection with new token
                connection.access_token = data['access_token']
                connection.token_expires_at = now + timedelta(seconds=data['expires_in'])
                connection.save()

                logger.info(f'YouTube token refreshed for user {user.id}')

        except httpx.RequestError as e:
            logger.error(f'Network error refreshing token: {e}')
            raise IntegrationAuthError(
                'Network error refreshing YouTube token.',
                integration_name='youtube',
                original_error=e,
            ) from e

    return connection.access_token


def generate_video_slug(title: str, video_id: str) -> str:
    """
    Generate URL-friendly slug for video project.

    Args:
        title: Video title
        video_id: YouTube video ID

    Returns:
        Slug like "my-awesome-video-abc123"
    """
    # Slugify title (max 50 chars)
    title_slug = slugify(title)[:50].rstrip('-')

    # Append short video ID for uniqueness (first 8 chars)
    short_id = video_id[:8]

    return f'{title_slug}-{short_id}'


def parse_duration(duration_iso: str) -> str:
    """
    Parse ISO 8601 duration to human-readable format.

    Args:
        duration_iso: ISO 8601 duration (e.g., "PT15M33S", "PT1H2M10S")

    Returns:
        Human-readable duration (e.g., "15:33", "1:02:10")
    """
    # Parse ISO 8601 duration format (PT#H#M#S)
    # Example: PT1H2M10S = 1 hour, 2 minutes, 10 seconds

    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_iso)

    if not match:
        return '0:00'

    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)

    if hours > 0:
        return f'{hours}:{minutes:02d}:{seconds:02d}'
    else:
        return f'{minutes}:{seconds:02d}'


def extract_video_id_from_url(url: str) -> str | None:
    """
    Extract YouTube video ID from URL.

    Supports:
    - https://youtube.com/watch?v=abc123
    - https://youtu.be/abc123
    - https://youtube.com/embed/abc123
    - https://youtube.com/v/abc123

    Args:
        url: YouTube video URL

    Returns:
        Video ID or None if invalid
    """
    parsed = urlparse(url)

    # youtube.com/watch?v=VIDEO_ID
    if 'youtube.com' in parsed.netloc:
        if parsed.path == '/watch':
            query_params = parse_qs(parsed.query)
            return query_params.get('v', [None])[0]
        # youtube.com/embed/VIDEO_ID or /v/VIDEO_ID
        elif parsed.path.startswith('/embed/') or parsed.path.startswith('/v/'):
            parts = parsed.path.split('/')
            if len(parts) >= 3:
                return parts[2]

    # youtu.be/VIDEO_ID
    elif 'youtu.be' in parsed.netloc:
        return parsed.path.lstrip('/')

    return None


def extract_channel_id_from_url(url: str) -> str | None:
    """
    Extract YouTube channel ID from URL.

    Supports:
    - https://youtube.com/channel/UC...
    - https://youtube.com/@username (returns @username, needs resolution via API)

    Args:
        url: YouTube channel URL

    Returns:
        Channel ID or @username
    """
    parsed = urlparse(url)

    if 'youtube.com' in parsed.netloc:
        # youtube.com/channel/CHANNEL_ID
        if parsed.path.startswith('/channel/'):
            parts = parsed.path.split('/')
            if len(parts) >= 3:
                return parts[2]
        # youtube.com/@username
        elif parsed.path.startswith('/@'):
            return parsed.path.lstrip('/')

    return None


def _check_user_quota(user_id: int) -> bool:
    """
    Check if user has YouTube API quota remaining today.

    Each user gets 10,000 units/day via OAuth
    Each video fetch = ~3 units
    Limit to 3000 fetches/day = 9000 units (buffer)

    Args:
        user_id: User ID

    Returns:
        True if quota available, False if exceeded
    """
    quota_key = f'youtube_quota:user:{user_id}'
    daily_quota = cache.get(quota_key, 0)

    if daily_quota > 9000:
        logger.warning(f'User {user_id} exceeded daily YouTube quota ({daily_quota}/10000)')
        return False

    return True


def _increment_quota(user_id: int, units: int = 3):
    """
    Increment user's YouTube API quota usage.

    Args:
        user_id: User ID
        units: Quota units consumed (default: 3 for video fetch)
    """
    quota_key = f'youtube_quota:user:{user_id}'
    current = cache.get(quota_key, 0)

    # Set TTL to midnight tomorrow
    tomorrow = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    ttl = int((tomorrow - timezone.now()).total_seconds())

    cache.set(quota_key, current + units, timeout=ttl)

    logger.debug(f'User {user_id} quota: {current + units}/10000 units')
