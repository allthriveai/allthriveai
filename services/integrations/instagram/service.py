"""Instagram Graph API service for fetching user data and media."""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class InstagramService:
    """Service for interacting with Instagram Graph API."""

    BASE_URL = 'https://graph.instagram.com'
    API_VERSION = 'v18.0'

    def __init__(self, access_token: str):
        """Initialize with access token."""
        self.access_token = access_token

    def _make_request(self, endpoint: str, params: dict | None = None) -> dict:
        """Make a GET request to Instagram Graph API."""
        url = f'{self.BASE_URL}/{endpoint}'
        params = params or {}
        params['access_token'] = self.access_token

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f'Instagram API request failed: {e}')
            raise

    def get_user_profile(self) -> dict:
        """Fetch user profile information.

        Returns:
            dict with id, username, account_type, media_count, etc.
        """
        fields = 'id,username,account_type,media_count,name,biography,profile_picture_url'
        return self._make_request('me', {'fields': fields})

    def get_user_media(self, limit: int = 25, after: str | None = None) -> dict:
        """Fetch user's media posts.

        Args:
            limit: Number of posts to fetch (max 100)
            after: Cursor for pagination

        Returns:
            dict with 'data' (list of media) and 'paging' (pagination info)
        """
        fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username'
        params = {
            'fields': fields,
            'limit': min(limit, 100),
        }
        if after:
            params['after'] = after

        return self._make_request('me/media', params)

    def get_media_details(self, media_id: str) -> dict:
        """Fetch details for a specific media item.

        Args:
            media_id: Instagram media ID

        Returns:
            dict with media details including children for carousels
        """
        fields = (
            'id,caption,media_type,media_url,permalink,thumbnail_url,'
            'timestamp,username,children{id,media_type,media_url}'
        )
        return self._make_request(media_id, {'fields': fields})

    @staticmethod
    def exchange_for_long_lived_token(short_token: str) -> dict:
        """Exchange short-lived token for long-lived token.

        Short-lived tokens are valid for ~1 hour.
        Long-lived tokens are valid for 60 days.

        Args:
            short_token: The short-lived access token

        Returns:
            dict with 'access_token', 'token_type', and 'expires_in'
        """
        url = 'https://graph.instagram.com/access_token'
        params = {
            'grant_type': 'ig_exchange_token',
            'client_secret': getattr(settings, 'INSTAGRAM_OAUTH_CLIENT_SECRET', ''),
            'access_token': short_token,
        }

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info('Successfully exchanged for long-lived Instagram token')
            return data
        except requests.RequestException as e:
            logger.error(f'Failed to exchange Instagram token: {e}')
            raise

    @staticmethod
    def refresh_long_lived_token(token: str) -> dict:
        """Refresh a long-lived token before it expires.

        Tokens can be refreshed if they are at least 24 hours old
        and not expired. Refreshed tokens are valid for 60 days from refresh.

        Args:
            token: The long-lived access token to refresh

        Returns:
            dict with 'access_token', 'token_type', and 'expires_in'
        """
        url = 'https://graph.instagram.com/refresh_access_token'
        params = {
            'grant_type': 'ig_refresh_token',
            'access_token': token,
        }

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info('Successfully refreshed Instagram long-lived token')
            return data
        except requests.RequestException as e:
            logger.error(f'Failed to refresh Instagram token: {e}')
            raise

    def get_all_media(self, max_pages: int = 10) -> list[dict]:
        """Fetch all user media with pagination.

        Args:
            max_pages: Maximum number of pages to fetch

        Returns:
            List of all media items
        """
        all_media = []
        after = None

        for _ in range(max_pages):
            result = self.get_user_media(limit=100, after=after)
            media = result.get('data', [])
            all_media.extend(media)

            # Check for next page
            paging = result.get('paging', {})
            cursors = paging.get('cursors', {})
            after = cursors.get('after')

            if not after or not paging.get('next'):
                break

        logger.info(f'Fetched {len(all_media)} Instagram media items')
        return all_media
