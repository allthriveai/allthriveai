"""Instagram Graph API publisher for posting content."""

import logging
import time

import requests

logger = logging.getLogger(__name__)


class InstagramPublisher:
    """Service for publishing content to Instagram via Graph API.

    Instagram Content Publishing API flow:
    1. Create media container with image URL
    2. Wait for container to be ready (for carousels)
    3. Publish the container

    Note: Images must be hosted on publicly accessible HTTPS URLs.
    """

    BASE_URL = 'https://graph.instagram.com'

    def __init__(self, access_token: str, user_id: str):
        """Initialize publisher.

        Args:
            access_token: Instagram Graph API access token
            user_id: Instagram user ID (not username)
        """
        self.access_token = access_token
        self.user_id = user_id

    def _post_request(self, endpoint: str, data: dict) -> dict:
        """Make a POST request to Instagram Graph API."""
        url = f'{self.BASE_URL}/{endpoint}'
        data['access_token'] = self.access_token

        try:
            response = requests.post(url, data=data, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f'Instagram API POST failed: {e}')
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f'Response: {e.response.text}')
            raise

    def _get_request(self, endpoint: str, params: dict | None = None) -> dict:
        """Make a GET request to Instagram Graph API."""
        url = f'{self.BASE_URL}/{endpoint}'
        params = params or {}
        params['access_token'] = self.access_token

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f'Instagram API GET failed: {e}')
            raise

    def _create_image_container(
        self, image_url: str, caption: str | None = None, is_carousel_item: bool = False
    ) -> str:
        """Create a media container for a single image.

        Args:
            image_url: Public HTTPS URL of the image
            caption: Post caption (only for single images, not carousel items)
            is_carousel_item: True if this is a child of a carousel

        Returns:
            Container/creation ID
        """
        data = {
            'image_url': image_url,
        }

        if is_carousel_item:
            data['is_carousel_item'] = 'true'
        elif caption:
            data['caption'] = caption

        result = self._post_request(f'{self.user_id}/media', data)
        container_id = result.get('id')
        logger.info(f'Created Instagram image container: {container_id}')
        return container_id

    def _create_carousel_container(self, children_ids: list[str], caption: str) -> str:
        """Create a carousel container from child containers.

        Args:
            children_ids: List of child container IDs
            caption: Post caption

        Returns:
            Carousel container ID
        """
        data = {
            'media_type': 'CAROUSEL',
            'children': ','.join(children_ids),
            'caption': caption,
        }

        result = self._post_request(f'{self.user_id}/media', data)
        container_id = result.get('id')
        logger.info(f'Created Instagram carousel container: {container_id}')
        return container_id

    def _check_container_status(self, container_id: str) -> str:
        """Check if a media container is ready for publishing.

        Args:
            container_id: The container ID to check

        Returns:
            Status: 'FINISHED', 'IN_PROGRESS', or 'ERROR'
        """
        result = self._get_request(container_id, {'fields': 'status_code'})
        return result.get('status_code', 'UNKNOWN')

    def _wait_for_container(self, container_id: str, max_wait: int = 60, poll_interval: int = 5) -> bool:
        """Wait for a container to be ready for publishing.

        Args:
            container_id: Container ID to wait for
            max_wait: Maximum seconds to wait
            poll_interval: Seconds between status checks

        Returns:
            True if ready, False if timeout or error
        """
        start_time = time.time()
        while time.time() - start_time < max_wait:
            status = self._check_container_status(container_id)
            if status == 'FINISHED':
                return True
            if status == 'ERROR':
                logger.error(f'Container {container_id} failed with ERROR status')
                return False
            logger.debug(f'Container {container_id} status: {status}, waiting...')
            time.sleep(poll_interval)

        logger.error(f'Timeout waiting for container {container_id}')
        return False

    def _publish_container(self, container_id: str) -> dict:
        """Publish a media container.

        Args:
            container_id: The container ID to publish

        Returns:
            dict with 'id' of the published post
        """
        result = self._post_request(f'{self.user_id}/media_publish', {'creation_id': container_id})
        post_id = result.get('id')
        logger.info(f'Published Instagram post: {post_id}')
        return result

    def publish_image(self, image_url: str, caption: str) -> dict:
        """Publish a single image to Instagram.

        Args:
            image_url: Public HTTPS URL of the image (JPEG, max 8MB)
            caption: Post caption (max 2200 chars)

        Returns:
            dict with 'id' of published post
        """
        logger.info(f'Publishing single image to Instagram: {image_url[:50]}...')

        # Create container
        container_id = self._create_image_container(image_url, caption)

        # Wait for processing
        if not self._wait_for_container(container_id):
            raise RuntimeError(f'Image container {container_id} not ready')

        # Publish
        return self._publish_container(container_id)

    def publish_carousel(self, image_urls: list[str], caption: str) -> dict:
        """Publish multiple images as a carousel post.

        Args:
            image_urls: List of public HTTPS image URLs (2-10 images)
            caption: Post caption (max 2200 chars)

        Returns:
            dict with 'id' of published post

        Raises:
            ValueError: If less than 2 or more than 10 images
        """
        if len(image_urls) < 2:
            raise ValueError('Carousel requires at least 2 images')
        if len(image_urls) > 10:
            raise ValueError('Carousel cannot have more than 10 images')

        logger.info(f'Publishing carousel with {len(image_urls)} images to Instagram')

        # Step 1: Create child containers for each image
        children_ids = []
        for i, url in enumerate(image_urls):
            container_id = self._create_image_container(url, is_carousel_item=True)
            children_ids.append(container_id)
            logger.info(f'Created child container {i + 1}/{len(image_urls)}: {container_id}')

        # Step 2: Wait for all children to be ready
        for container_id in children_ids:
            if not self._wait_for_container(container_id):
                raise RuntimeError(f'Child container {container_id} not ready')

        # Step 3: Create carousel container
        carousel_id = self._create_carousel_container(children_ids, caption)

        # Step 4: Wait for carousel to be ready
        if not self._wait_for_container(carousel_id):
            raise RuntimeError(f'Carousel container {carousel_id} not ready')

        # Step 5: Publish
        return self._publish_container(carousel_id)

    def get_post_permalink(self, post_id: str) -> str | None:
        """Get the permalink URL for a published post.

        Args:
            post_id: The Instagram post ID

        Returns:
            Permalink URL or None if not found
        """
        try:
            result = self._get_request(post_id, {'fields': 'permalink'})
            return result.get('permalink')
        except Exception as e:
            logger.error(f'Failed to get permalink for post {post_id}: {e}')
            return None
