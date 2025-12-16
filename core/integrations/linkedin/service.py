"""LinkedIn API service for making API calls."""

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)


class LinkedInAPIError(Exception):
    """Exception for LinkedIn API errors."""

    def __init__(self, message: str, status_code: int | None = None, response: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(message)


class LinkedInService:
    """Service for interacting with the LinkedIn API.

    LinkedIn API v2 endpoints:
    - Profile: https://api.linkedin.com/v2/me
    - Email: https://api.linkedin.com/v2/emailAddress
    - Posts: https://api.linkedin.com/v2/ugcPosts (requires Marketing Developer Platform)

    Note: Reading user posts requires LinkedIn Marketing Developer Platform access,
    which has a lengthy approval process. Basic API access only provides profile info.
    """

    BASE_URL = 'https://api.linkedin.com/v2'
    TIMEOUT = 30

    def __init__(self, access_token: str):
        """Initialize the LinkedIn service.

        Args:
            access_token: LinkedIn OAuth access token
        """
        self.access_token = access_token
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: dict | None = None,
        data: dict | None = None,
    ) -> dict:
        """Make a request to the LinkedIn API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            params: Query parameters
            data: Request body data

        Returns:
            Response JSON data

        Raises:
            LinkedInAPIError: If the request fails
        """
        url = f'{self.BASE_URL}/{endpoint.lstrip("/")}'

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=data,
                timeout=self.TIMEOUT,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else None
            try:
                error_data = e.response.json() if e.response else {}
            except Exception:
                error_data = {}

            error_message = error_data.get('message', str(e))

            if status_code == 401:
                raise LinkedInAPIError(
                    'LinkedIn authentication failed. Token may be expired.',
                    status_code=status_code,
                    response=error_data,
                ) from e
            elif status_code == 403:
                raise LinkedInAPIError(
                    'Access denied. You may not have permission for this action.',
                    status_code=status_code,
                    response=error_data,
                ) from e
            elif status_code == 404:
                raise LinkedInAPIError(
                    'Resource not found.',
                    status_code=status_code,
                    response=error_data,
                ) from e
            elif status_code == 429:
                raise LinkedInAPIError(
                    'LinkedIn API rate limit exceeded. Please try again later.',
                    status_code=status_code,
                    response=error_data,
                ) from e
            else:
                raise LinkedInAPIError(
                    f'LinkedIn API error: {error_message}',
                    status_code=status_code,
                    response=error_data,
                ) from e

        except requests.exceptions.Timeout as e:
            raise LinkedInAPIError('LinkedIn API request timed out.') from e

        except requests.exceptions.ConnectionError as e:
            raise LinkedInAPIError('Failed to connect to LinkedIn API.') from e

        except Exception as e:
            logger.error(f'Unexpected LinkedIn API error: {e}', exc_info=True)
            raise LinkedInAPIError(f'Unexpected error: {str(e)}') from e

    def fetch_profile(self) -> dict[str, Any]:
        """Fetch the authenticated user's profile.

        Note: This uses the deprecated /v2/me endpoint which requires r_liteprofile scope.
        For OpenID Connect scopes (openid, profile), use fetch_userinfo() instead.

        Returns:
            Profile data dict

        Raises:
            LinkedInAPIError: If the request fails
        """
        logger.info('Fetching LinkedIn profile')

        # Fetch basic profile
        profile = self._make_request('GET', 'me')

        return profile

    def fetch_userinfo(self) -> dict[str, Any]:
        """Fetch the authenticated user's profile using OpenID Connect userinfo endpoint.

        This endpoint is compatible with 'openid' and 'profile' scopes, unlike /v2/me
        which requires the deprecated r_liteprofile scope.

        Returns:
            Profile data dict with fields:
            - sub: LinkedIn user ID
            - name: Full name
            - given_name: First name
            - family_name: Last name
            - picture: Profile picture URL
            - email: Email address (if email scope was granted)
            - email_verified: Whether email is verified

        Raises:
            LinkedInAPIError: If the request fails
        """
        logger.info('Fetching LinkedIn userinfo')

        try:
            response = requests.get(
                'https://api.linkedin.com/v2/userinfo',
                headers={'Authorization': f'Bearer {self.access_token}'},
                timeout=self.TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()

            # Normalize the response to match our expected format
            return {
                'id': data.get('sub'),
                'first_name': data.get('given_name'),
                'last_name': data.get('family_name'),
                'full_name': data.get('name'),
                'given_name': data.get('given_name'),
                'family_name': data.get('family_name'),
                'avatar_url': data.get('picture'),
                'picture': data.get('picture'),
                'email': data.get('email'),
                'email_verified': data.get('email_verified'),
            }

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else None
            raise LinkedInAPIError(
                f'LinkedIn userinfo error: {e}',
                status_code=status_code,
            ) from e
        except Exception as e:
            raise LinkedInAPIError(f'Failed to fetch userinfo: {e}') from e

    def fetch_email(self) -> dict[str, Any]:
        """Fetch the authenticated user's email address.

        Returns:
            Email data dict

        Raises:
            LinkedInAPIError: If the request fails
        """
        logger.info('Fetching LinkedIn email')

        # LinkedIn email endpoint requires specific parameters
        params = {
            'q': 'members',
            'projection': '(elements*(handle~))',
        }

        email_data = self._make_request('GET', 'emailAddress', params=params)

        return email_data

    def fetch_profile_with_email(self) -> dict[str, Any]:
        """Fetch profile and email data together.

        Returns:
            Combined profile and email data

        Raises:
            LinkedInAPIError: If the request fails
        """
        from core.integrations.linkedin.helpers import normalize_linkedin_profile_data

        profile = self.fetch_profile()

        # Try to fetch email, but it may fail if scope not granted
        email_data = None
        try:
            email_data = self.fetch_email()
        except LinkedInAPIError as e:
            logger.warning(f'Could not fetch LinkedIn email: {e}')

        return normalize_linkedin_profile_data(profile, email_data)

    def fetch_posts(self, count: int = 50) -> list[dict[str, Any]]:
        """Fetch the authenticated user's posts.

        NOTE: This requires LinkedIn Marketing Developer Platform access.
        Without it, this will return an empty list or raise an error.

        Args:
            count: Maximum number of posts to fetch

        Returns:
            List of post data dicts

        Raises:
            LinkedInAPIError: If the request fails or access is denied
        """
        from core.integrations.linkedin.helpers import normalize_linkedin_post

        logger.info(f'Fetching LinkedIn posts (count={count})')

        # First, get the user's profile to get their URN
        profile = self.fetch_profile()
        user_id = profile.get('id', '')

        if not user_id:
            raise LinkedInAPIError('Could not get user ID from profile')

        # Construct author URN
        author_urn = f'urn:li:person:{user_id}'

        # Fetch posts using UGC API
        # Note: This requires w_member_social scope and Marketing Developer Platform access
        params = {
            'q': 'authors',
            'authors': f'List({author_urn})',
            'count': count,
        }

        try:
            response = self._make_request('GET', 'ugcPosts', params=params)
            elements = response.get('elements', [])

            posts = [normalize_linkedin_post(post) for post in elements]
            logger.info(f'Fetched {len(posts)} LinkedIn posts')

            return posts

        except LinkedInAPIError as e:
            if e.status_code == 403:
                logger.warning(
                    'Cannot fetch LinkedIn posts - requires Marketing Developer Platform access. '
                    'See: https://docs.microsoft.com/en-us/linkedin/marketing/'
                )
                # Return empty list instead of failing
                return []
            raise

    def verify_token(self) -> bool:
        """Verify that the access token is valid.

        Returns:
            True if token is valid

        Raises:
            LinkedInAPIError: If token is invalid
        """
        try:
            self.fetch_profile()
            return True
        except LinkedInAPIError as e:
            if e.status_code == 401:
                return False
            raise
