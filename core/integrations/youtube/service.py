"""YouTube Data API v3 service - Synchronous implementation for Celery compatibility."""

import logging
from typing import Any

import httpx
from django.conf import settings
from django.core.cache import cache

from core.integrations.base.exceptions import (
    IntegrationError,
    IntegrationNotFoundError,
)

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """Raised when YouTube API quota is exceeded."""

    pass


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open (service unavailable)."""

    pass


# Global HTTP client with connection pooling
# Reuses TCP connections and SSL sessions for better performance
_http_client = None


def get_http_client() -> httpx.Client:
    """Get or create singleton HTTP client with connection pooling."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.Client(
            timeout=10.0,
            limits=httpx.Limits(
                max_connections=100,  # Total connections across all hosts
                max_keepalive_connections=20,  # Keepalive pool size
            ),
            http2=True,  # Enable HTTP/2 for better performance
        )
    return _http_client


# Simple circuit breaker implementation
class CircuitBreaker:
    """
    Simple circuit breaker to fail fast when YouTube API is down.

    States:
    - CLOSED: Normal operation, requests allowed
    - OPEN: Too many failures, requests blocked for recovery_timeout
    - HALF_OPEN: Testing if service recovered (allows 1 request)
    """

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.cache_key = 'youtube_circuit_breaker'

    def _get_state(self) -> dict:
        """Get current circuit breaker state from cache."""
        return cache.get(self.cache_key, {'failures': 0, 'state': 'closed', 'opened_at': None})

    def _set_state(self, state: dict):
        """Save circuit breaker state to cache."""
        cache.set(self.cache_key, state, timeout=self.recovery_timeout)

    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        import time

        state = self._get_state()

        # Check if circuit is open
        if state['state'] == 'open':
            opened_at = state.get('opened_at', 0)
            if time.time() - opened_at < self.recovery_timeout:
                logger.warning('Circuit breaker OPEN - YouTube API requests blocked')
                raise CircuitBreakerError('YouTube API circuit breaker is open (service unavailable)')
            # Recovery timeout elapsed, transition to half-open
            state['state'] = 'half_open'
            logger.info('Circuit breaker transitioning to HALF_OPEN (testing recovery)')

        # Execute the function
        try:
            result = func(*args, **kwargs)
            # Success - reset failures
            if state['failures'] > 0:
                logger.info(f'Circuit breaker reset (was at {state["failures"]} failures)')
            self._set_state({'failures': 0, 'state': 'closed', 'opened_at': None})
            return result

        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            # Increment failure count
            state['failures'] = state.get('failures', 0) + 1
            logger.warning(f'Circuit breaker failure #{state["failures"]}: {e}')

            # Check if threshold exceeded
            if state['failures'] >= self.failure_threshold:
                state['state'] = 'open'
                state['opened_at'] = time.time()
                logger.error(
                    f'Circuit breaker OPENED after {state["failures"]} failures (recovery in {self.recovery_timeout}s)'
                )

            self._set_state(state)
            raise


# Global circuit breaker instance
_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)


class YouTubeService:
    """YouTube Data API v3 client - SYNCHRONOUS for Celery compatibility."""

    BASE_URL = 'https://www.googleapis.com/youtube/v3'

    def __init__(self, oauth_token: str = None, api_key: str = None):
        """
        Initialize YouTube service.

        Args:
            oauth_token: User's OAuth token (for higher quota)
            api_key: Shared API key (for curated content)
        """
        self.oauth_token = oauth_token
        # Fall back to GOOGLE_API_KEY if YOUTUBE_API_KEY not set
        # Handle api_key=True as a flag to use settings-based key
        if api_key is True or api_key is None:
            self.api_key = getattr(settings, 'YOUTUBE_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None)
        else:
            self.api_key = api_key

        if not self.oauth_token and not self.api_key:
            raise ValueError('Either oauth_token or api_key required')

    def _get_headers(self) -> dict[str, str]:
        """Get headers for API request."""
        if self.oauth_token:
            return {'Authorization': f'Bearer {self.oauth_token}'}
        return {}

    def _get_params(self, params: dict) -> dict:
        """Add API key if not using OAuth."""
        if not self.oauth_token:
            params['key'] = self.api_key
        return params

    def _check_quota(self) -> None:
        """Check if we're approaching quota limit.

        Uses atomic operations to prevent race conditions with multiple workers.
        """
        # OAuth quota is tracked per-user in helpers with atomic operations
        # This is a fallback check for API-key quota which is global
        if self.oauth_token:
            # OAuth quota is tracked per-user, skip service-level check
            return

        # API key quota is shared, use simpler check
        # Note: This is rough - consider migrating to per-user OAuth for scale
        quota_key = 'youtube_quota:shared_api_key'
        current_quota = cache.get(quota_key, 0)

        if current_quota > 9000:  # Approaching 10,000 limit
            logger.warning(f'YouTube API key quota near limit: {current_quota}/10000')
            raise QuotaExceededError('YouTube API quota exceeded')

    def get_video_info(self, video_id: str) -> dict[str, Any]:
        """
        Fetch video metadata.

        Args:
            video_id: YouTube video ID

        Returns:
            Dict with video metadata:
            {
                'video_id': 'abc123',
                'title': 'Video Title',
                'description': 'Video description...',
                'channel_id': 'UC...',
                'channel_name': 'Channel Name',
                'thumbnail_url': 'https://...',
                'duration': 'PT12M34S',  # ISO 8601
                'published_at': '2024-01-15T10:00:00Z',
                'view_count': 10000,
                'like_count': 500,
                'tags': ['AI', 'Tutorial'],
                'category_id': '28',  # Science & Technology
            }

        Raises:
            IntegrationNotFoundError: If video not found
            QuotaExceededError: If API quota exceeded
            CircuitBreakerError: If circuit breaker is open
        """
        self._check_quota()

        params = self._get_params({'part': 'snippet,contentDetails,statistics', 'id': video_id})

        logger.debug(f'Fetching video info for {video_id}')

        response = None  # Track response for quota tracking

        def _make_request():
            nonlocal response
            client = get_http_client()
            response = client.get(
                f'{self.BASE_URL}/videos',
                params=params,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.json()

        try:
            data = _circuit_breaker.call(_make_request)

            # Track actual quota usage from API response
            if response and self.oauth_token:
                self._track_quota_from_response(response)

        except CircuitBreakerError:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f'HTTP error fetching video {video_id}: {e}')
            raise IntegrationError(f'Failed to fetch video: {e}', integration_name='youtube', original_error=e) from e
        except httpx.RequestError as e:
            logger.error(f'Network error fetching video {video_id}: {e}')
            raise IntegrationError(f'Network error: {e}', integration_name='youtube', original_error=e) from e

        if not data.get('items'):
            raise IntegrationNotFoundError(f'Video {video_id} not found', integration_name='youtube')

        item = data['items'][0]
        snippet = item['snippet']
        content_details = item['contentDetails']
        statistics = item.get('statistics', {})

        return {
            'video_id': video_id,
            'title': snippet['title'],
            'description': snippet['description'],
            'channel_id': snippet['channelId'],
            'channel_name': snippet['channelTitle'],
            'thumbnail_url': self._get_best_thumbnail(snippet['thumbnails']),
            'is_vertical': self._is_vertical_video(snippet['thumbnails']),
            'duration': content_details['duration'],
            'published_at': snippet['publishedAt'],
            'view_count': int(statistics.get('viewCount', 0)),
            'like_count': int(statistics.get('likeCount', 0)),
            'tags': snippet.get('tags', []),
            'category_id': snippet.get('categoryId', ''),
        }

    def _make_request(self, endpoint: str, params: dict) -> dict:
        """
        Make a generic request to YouTube API with connection pooling and circuit breaker.

        Args:
            endpoint: API endpoint path (e.g., '/channels', '/videos')
            params: Query parameters

        Returns:
            API response data

        Raises:
            IntegrationError: If request fails
            CircuitBreakerError: If circuit breaker is open
        """
        self._check_quota()

        params = self._get_params(params)
        url = f'{self.BASE_URL}{endpoint}'

        logger.debug(f'Making YouTube API request to {endpoint}')

        def _request():
            client = get_http_client()
            response = client.get(
                url,
                params=params,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.json()

        try:
            return _circuit_breaker.call(_request)
        except CircuitBreakerError:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f'HTTP error on {endpoint}: {e}')
            raise IntegrationError(f'YouTube API error: {e}', integration_name='youtube', original_error=e) from e
        except httpx.RequestError as e:
            logger.error(f'Network error on {endpoint}: {e}')
            raise IntegrationError(f'Network error: {e}', integration_name='youtube', original_error=e) from e

    def _get_best_thumbnail(self, thumbnails: dict) -> str:
        """Get highest quality thumbnail available."""
        for size in ['maxres', 'high', 'medium', 'default']:
            if size in thumbnails:
                return thumbnails[size]['url']
        return '/static/images/default-video-thumbnail.jpg'

    def _is_vertical_video(self, thumbnails: dict) -> bool:
        """
        Detect if video is vertical (portrait) based on thumbnail dimensions.

        YouTube Shorts and vertical videos have portrait thumbnails with height > width.
        Standard videos have landscape thumbnails (16:9 aspect ratio).
        """
        # Check maxres first as it has actual video dimensions
        for size in ['maxres', 'high', 'medium', 'default']:
            if size in thumbnails:
                thumb = thumbnails[size]
                width = thumb.get('width', 0)
                height = thumb.get('height', 0)
                if width > 0 and height > 0:
                    # Vertical if height > width (portrait orientation)
                    return height > width
        return False

    def get_channel_videos(
        self, channel_id: str, max_results: int = 50, published_after: str | None = None, etag: str | None = None
    ) -> dict[str, Any]:
        """
        Fetch all videos from a channel with pagination.

        Args:
            channel_id: YouTube channel ID
            max_results: Max videos to fetch (default 50)
            published_after: ISO 8601 date (for incremental sync)
            etag: ETag for conditional request (save quota)

        Returns:
            Dict with:
            {
                'videos': ['video_id1', 'video_id2', ...],
                'etag': 'new_etag_value'
            }

        Raises:
            QuotaExceededError: If API quota exceeded
        """
        self._check_quota()

        video_ids = []
        next_page_token = None

        while len(video_ids) < max_results:
            params = self._get_params(
                {
                    'part': 'id',
                    'channelId': channel_id,
                    'type': 'video',
                    'order': 'date',
                    'maxResults': min(50, max_results - len(video_ids)),
                }
            )

            if published_after:
                params['publishedAfter'] = published_after

            if next_page_token:
                params['pageToken'] = next_page_token

            headers = self._get_headers()
            if etag:
                headers['If-None-Match'] = etag  # Conditional request

            logger.debug(f'Fetching videos for channel {channel_id} (page token: {next_page_token})')

            def _fetch_page(params=params, headers=headers):
                client = get_http_client()
                response = client.get(
                    f'{self.BASE_URL}/search',
                    params=params,
                    headers=headers,
                )

                # 304 Not Modified - no new videos
                if response.status_code == 304:
                    logger.info(f'Channel {channel_id} not modified (ETag match)')
                    return None  # Signal to return early

                response.raise_for_status()
                return response

            try:
                response = _circuit_breaker.call(_fetch_page)

                # Handle 304 Not Modified case
                if response is None:
                    return {'videos': [], 'etag': etag}

                data = response.json()

            except CircuitBreakerError:
                raise
            except httpx.HTTPStatusError as e:
                logger.error(f'HTTP error fetching channel videos: {e}')
                raise IntegrationError(
                    f'Failed to fetch channel videos: {e}',
                    integration_name='youtube',
                    original_error=e,
                ) from e
            except httpx.RequestError as e:
                logger.error(f'Network error fetching channel videos: {e}')
                raise IntegrationError(f'Network error: {e}', integration_name='youtube', original_error=e) from e

            for item in data.get('items', []):
                if 'videoId' in item['id']:
                    video_ids.append(item['id']['videoId'])

            next_page_token = data.get('nextPageToken')
            if not next_page_token:
                break

        new_etag = response.headers.get('ETag')

        logger.info(f'Found {len(video_ids)} videos for channel {channel_id}')
        return {'videos': video_ids[:max_results], 'etag': new_etag}

    def get_channel_info(self, channel_id: str) -> dict[str, Any]:
        """
        Fetch channel metadata.

        Args:
            channel_id: YouTube channel ID

        Returns:
            Dict with channel metadata:
            {
                'channel_id': 'UC...',
                'title': 'Channel Name',
                'description': 'Channel description',
                'thumbnail_url': 'https://...',
                'subscriber_count': 10000,
                'video_count': 500,
            }

        Raises:
            IntegrationNotFoundError: If channel not found
            QuotaExceededError: If API quota exceeded
        """
        self._check_quota()

        params = self._get_params({'part': 'snippet,statistics', 'id': channel_id})

        logger.debug(f'Fetching channel info for {channel_id}')

        def _fetch_channel():
            client = get_http_client()
            response = client.get(
                f'{self.BASE_URL}/channels',
                params=params,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.json()

        try:
            data = _circuit_breaker.call(_fetch_channel)
        except CircuitBreakerError:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f'HTTP error fetching channel {channel_id}: {e}')
            raise IntegrationError(f'Failed to fetch channel: {e}', integration_name='youtube', original_error=e) from e
        except httpx.RequestError as e:
            logger.error(f'Network error fetching channel {channel_id}: {e}')
            raise IntegrationError(f'Network error: {e}', integration_name='youtube', original_error=e) from e

        if not data.get('items'):
            raise IntegrationNotFoundError(f'Channel {channel_id} not found', integration_name='youtube')

        item = data['items'][0]
        snippet = item['snippet']
        statistics = item.get('statistics', {})

        return {
            'channel_id': channel_id,
            'title': snippet['title'],
            'description': snippet['description'],
            'thumbnail_url': self._get_best_thumbnail(snippet['thumbnails']),
            'subscriber_count': int(statistics.get('subscriberCount', 0)),
            'video_count': int(statistics.get('videoCount', 0)),
        }
