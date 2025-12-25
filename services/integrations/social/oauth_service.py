"""Service layer for handling OAuth flows for social connections."""

import logging
from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from core.social.models import SocialConnection, SocialProvider

logger = logging.getLogger(__name__)


class OAuthProviderConfig:
    """Configuration for OAuth providers."""

    PROVIDERS = {
        SocialProvider.GOOGLE: {
            'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'user_info_url': 'https://www.googleapis.com/oauth2/v2/userinfo',
            'scopes': [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/youtube.readonly',
            ],
            'client_id_setting': 'GOOGLE_CLIENT_ID',
            'client_secret_setting': 'GOOGLE_CLIENT_SECRET',
        },
        SocialProvider.GITHUB: {
            'authorize_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'user_info_url': 'https://api.github.com/user',
            'scopes': ['read:user', 'user:email'],
            'client_id_setting': 'GITHUB_CLIENT_ID',
            'client_secret_setting': 'GITHUB_CLIENT_SECRET',
        },
        SocialProvider.GITLAB: {
            'authorize_url': 'https://gitlab.com/oauth/authorize',
            'token_url': 'https://gitlab.com/oauth/token',
            'user_info_url': 'https://gitlab.com/api/v4/user',
            'scopes': ['read_user', 'read_api'],  # read_api needed to list projects
            'client_id_setting': 'GITLAB_OAUTH_CLIENT_ID',
            'client_secret_setting': 'GITLAB_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.LINKEDIN: {
            'authorize_url': 'https://www.linkedin.com/oauth/v2/authorization',
            'token_url': 'https://www.linkedin.com/oauth/v2/accessToken',
            'user_info_url': 'https://api.linkedin.com/v2/userinfo',
            'scopes': ['openid', 'profile'],  # email scope requires LinkedIn approval
            'client_id_setting': 'LINKEDIN_OAUTH_CLIENT_ID',
            'client_secret_setting': 'LINKEDIN_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.FIGMA: {
            'authorize_url': 'https://www.figma.com/oauth',
            'token_url': 'https://api.figma.com/v1/oauth/token',
            'user_info_url': 'https://api.figma.com/v1/me',
            'scopes': [
                'current_user:read',
                'file_content:read',
                'file_metadata:read',
                'library_content:read',
                'file_dev_resources:read',
                'projects:read',
            ],
            'client_id_setting': 'FIGMA_OAUTH_CLIENT_ID',
            'client_secret_setting': 'FIGMA_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.HUGGINGFACE: {
            'authorize_url': 'https://huggingface.co/oauth/authorize',
            'token_url': 'https://huggingface.co/oauth/token',
            'user_info_url': 'https://huggingface.co/api/whoami-v2',
            'scopes': ['profile', 'read-repos'],
            'client_id_setting': 'HUGGINGFACE_OAUTH_CLIENT_ID',
            'client_secret_setting': 'HUGGINGFACE_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.MIDJOURNEY: {
            # Note: Midjourney doesn't have a public OAuth API yet
            # This is a placeholder for future implementation
            'authorize_url': 'https://www.midjourney.com/oauth/authorize',
            'token_url': 'https://www.midjourney.com/oauth/token',
            'user_info_url': 'https://api.midjourney.com/v1/me',
            'scopes': ['profile'],
            'client_id_setting': 'MIDJOURNEY_OAUTH_CLIENT_ID',
            'client_secret_setting': 'MIDJOURNEY_OAUTH_CLIENT_SECRET',
        },
    }

    @classmethod
    def get_config(cls, provider: str) -> dict | None:
        """Get configuration for a provider."""
        return cls.PROVIDERS.get(provider)

    @classmethod
    def get_client_credentials(cls, provider: str) -> tuple[str | None, str | None]:
        """Get client ID and secret from settings."""
        config = cls.get_config(provider)
        if not config:
            return None, None

        client_id = getattr(settings, config['client_id_setting'], None)
        client_secret = getattr(settings, config['client_secret_setting'], None)

        return client_id, client_secret


class SocialOAuthService:
    """Service for handling OAuth flows for social connections."""

    def __init__(self, provider: str):
        self.provider = provider
        self.config = OAuthProviderConfig.get_config(provider)
        if not self.config:
            logger.error(f'Unsupported OAuth provider requested: {provider}')
            raise ValueError(f'Unsupported provider: {provider}')

        self.client_id, self.client_secret = OAuthProviderConfig.get_client_credentials(provider)
        if not self.client_id or not self.client_secret:
            logger.error(f'OAuth credentials not configured for provider: {provider}')
            raise ValueError(f'OAuth credentials not configured for {provider}')

        logger.info(f'SocialOAuthService initialized for provider: {provider}')

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth authorization URL."""
        params = {
            'client_id': self.client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'state': state,
        }

        # Only add scope if scopes are configured
        if self.config['scopes']:
            params['scope'] = ' '.join(self.config['scopes'])

        auth_url = f'{self.config["authorize_url"]}?{urlencode(params)}'
        logger.info(f'Generated OAuth authorization URL for {self.provider} with redirect_uri: {redirect_uri}')
        return auth_url

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> dict:
        """Exchange authorization code for access token."""
        logger.info(f'Exchanging authorization code for {self.provider} access token')

        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }

        headers = {
            'Accept': 'application/json',
        }

        try:
            response = requests.post(self.config['token_url'], data=data, headers=headers, timeout=10)
            response.raise_for_status()
            logger.info(f'Successfully obtained access token for {self.provider}')
            return response.json()
        except requests.RequestException as e:
            logger.error(f'Failed to exchange code for token ({self.provider}): {e}')
            raise

    def get_user_info(self, access_token: str) -> dict:
        """Fetch user information from provider."""
        logger.info(f'Fetching user info from {self.provider}')

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }

        try:
            response = requests.get(self.config['user_info_url'], headers=headers, timeout=10)
            response.raise_for_status()
            user_data = response.json()
            logger.info(f'Successfully fetched user info from {self.provider}')
            return user_data
        except requests.RequestException as e:
            logger.error(f'Failed to fetch user info from {self.provider}: {e}')
            raise

    def parse_user_data(self, user_info: dict) -> dict:
        """Parse user data from provider-specific format to common format."""
        if self.provider == SocialProvider.GOOGLE:
            return {
                'provider_user_id': str(user_info['id']),
                'provider_username': user_info.get('email', '').split('@')[0],
                'provider_email': user_info.get('email'),
                'profile_url': '',
                'avatar_url': user_info.get('picture', ''),
                'extra_data': {
                    'name': user_info.get('name'),
                    'given_name': user_info.get('given_name'),
                    'family_name': user_info.get('family_name'),
                    'verified_email': user_info.get('verified_email'),
                    'locale': user_info.get('locale'),
                },
            }

        elif self.provider == SocialProvider.GITHUB:
            return {
                'provider_user_id': str(user_info['id']),
                'provider_username': user_info.get('login', ''),
                'provider_email': user_info.get('email'),
                'profile_url': user_info.get('html_url', ''),
                'avatar_url': user_info.get('avatar_url', ''),
                'extra_data': {
                    'name': user_info.get('name'),
                    'bio': user_info.get('bio'),
                    'company': user_info.get('company'),
                    'location': user_info.get('location'),
                },
            }

        elif self.provider == SocialProvider.GITLAB:
            return {
                'provider_user_id': str(user_info['id']),
                'provider_username': user_info.get('username', ''),
                'provider_email': user_info.get('email'),
                'profile_url': user_info.get('web_url', ''),
                'avatar_url': user_info.get('avatar_url', ''),
                'extra_data': {
                    'name': user_info.get('name'),
                    'bio': user_info.get('bio'),
                    'location': user_info.get('location'),
                },
            }

        elif self.provider == SocialProvider.LINKEDIN:
            # OpenID Connect userinfo endpoint format
            return {
                'provider_user_id': user_info.get('sub', ''),
                'provider_username': user_info.get('name', ''),
                'provider_email': user_info.get('email'),  # Only if email scope approved
                'profile_url': '',
                'avatar_url': user_info.get('picture', ''),
                'extra_data': {
                    'given_name': user_info.get('given_name'),
                    'family_name': user_info.get('family_name'),
                    'locale': user_info.get('locale'),
                    'email_verified': user_info.get('email_verified'),
                },
            }

        elif self.provider == SocialProvider.FIGMA:
            return {
                'provider_user_id': user_info.get('id', ''),
                'provider_username': user_info.get('handle', ''),
                'provider_email': user_info.get('email'),
                'profile_url': '',
                'avatar_url': user_info.get('img_url', ''),
                'extra_data': user_info,
            }

        elif self.provider == SocialProvider.HUGGINGFACE:
            return {
                'provider_user_id': user_info.get('id', ''),
                'provider_username': user_info.get('name', ''),
                'provider_email': user_info.get('email'),
                'profile_url': f'https://huggingface.co/{user_info.get("name", "")}',
                'avatar_url': user_info.get('avatarUrl', ''),
                'extra_data': user_info,
            }

        elif self.provider == SocialProvider.MIDJOURNEY:
            # Placeholder for when Midjourney API becomes available
            return {
                'provider_user_id': str(user_info.get('id', '')),
                'provider_username': user_info.get('username', ''),
                'provider_email': user_info.get('email'),
                'profile_url': '',
                'avatar_url': '',
                'extra_data': user_info,
            }

        return {}

    def create_or_update_connection(
        self,
        user,
        access_token: str,
        refresh_token: str | None = None,
        expires_in: int | None = None,
        scope: str | None = None,
    ) -> SocialConnection:
        """Create or update a social connection for a user."""
        logger.info(f'Creating/updating {self.provider} connection for user {user.username} (id={user.id})')

        # Get user info from provider
        user_info = self.get_user_info(access_token)
        parsed_data = self.parse_user_data(user_info)

        # Calculate token expiration
        token_expires_at = None
        if expires_in:
            token_expires_at = timezone.now() + timedelta(seconds=expires_in)
            logger.info(f'Token expires at: {token_expires_at}')

        # Create or update connection
        connection, created = SocialConnection.objects.update_or_create(
            user=user,
            provider=self.provider,
            defaults={
                'provider_user_id': parsed_data['provider_user_id'],
                'provider_username': parsed_data['provider_username'],
                'provider_email': parsed_data['provider_email'],
                'profile_url': parsed_data['profile_url'],
                'avatar_url': parsed_data['avatar_url'],
                'extra_data': parsed_data['extra_data'],
                'token_expires_at': token_expires_at,
                'scopes': scope or ','.join(self.config['scopes']),
                'is_active': True,
            },
        )

        # Set encrypted tokens using property setters
        connection.access_token = access_token
        if refresh_token:
            connection.refresh_token = refresh_token

        connection.save()

        action = 'Created' if created else 'Updated'
        logger.info(
            f'{action} {self.provider} connection for user {user.username} '
            f'(provider_user={parsed_data["provider_username"]})'
        )

        return connection
