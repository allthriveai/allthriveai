"""Service layer for handling OAuth flows for social connections."""

from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from core.social.models import SocialConnection, SocialProvider


class OAuthProviderConfig:
    """Configuration for OAuth providers."""

    PROVIDERS = {
        SocialProvider.GITHUB: {
            'authorize_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'user_info_url': 'https://api.github.com/user',
            'scopes': ['read:user', 'user:email'],
            'client_id_setting': 'GITHUB_OAUTH_CLIENT_ID',
            'client_secret_setting': 'GITHUB_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.GITLAB: {
            'authorize_url': 'https://gitlab.com/oauth/authorize',
            'token_url': 'https://gitlab.com/oauth/token',
            'user_info_url': 'https://gitlab.com/api/v4/user',
            'scopes': ['read_user', 'api'],
            'client_id_setting': 'GITLAB_OAUTH_CLIENT_ID',
            'client_secret_setting': 'GITLAB_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.LINKEDIN: {
            'authorize_url': 'https://www.linkedin.com/oauth/v2/authorization',
            'token_url': 'https://www.linkedin.com/oauth/v2/accessToken',
            'user_info_url': 'https://api.linkedin.com/v2/me',
            'scopes': ['r_liteprofile', 'r_emailaddress'],
            'client_id_setting': 'LINKEDIN_OAUTH_CLIENT_ID',
            'client_secret_setting': 'LINKEDIN_OAUTH_CLIENT_SECRET',
        },
        SocialProvider.FIGMA: {
            'authorize_url': 'https://www.figma.com/oauth',
            'token_url': 'https://www.figma.com/api/oauth/token',
            'user_info_url': 'https://api.figma.com/v1/me',
            'scopes': ['file_read'],
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
            raise ValueError(f'Unsupported provider: {provider}')

        self.client_id, self.client_secret = OAuthProviderConfig.get_client_credentials(provider)
        if not self.client_id or not self.client_secret:
            raise ValueError(f'OAuth credentials not configured for {provider}')

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth authorization URL."""
        params = {
            'client_id': self.client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(self.config['scopes']),
            'state': state,
        }

        return f'{self.config["authorize_url"]}?{urlencode(params)}'

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> dict:
        """Exchange authorization code for access token."""
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

        response = requests.post(self.config['token_url'], data=data, headers=headers, timeout=10)
        response.raise_for_status()

        return response.json()

    def get_user_info(self, access_token: str) -> dict:
        """Fetch user information from provider."""
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }

        response = requests.get(self.config['user_info_url'], headers=headers, timeout=10)
        response.raise_for_status()

        return response.json()

    def parse_user_data(self, user_info: dict) -> dict:
        """Parse user data from provider-specific format to common format."""
        if self.provider == SocialProvider.GITHUB:
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
            return {
                'provider_user_id': user_info.get('id', ''),
                'provider_username': user_info.get('localizedFirstName', '')
                + ' '
                + user_info.get('localizedLastName', ''),
                'provider_email': None,  # Requires separate API call
                'profile_url': '',
                'avatar_url': '',
                'extra_data': user_info,
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
        # Get user info from provider
        user_info = self.get_user_info(access_token)
        parsed_data = self.parse_user_data(user_info)

        # Calculate token expiration
        token_expires_at = None
        if expires_in:
            token_expires_at = timezone.now() + timedelta(seconds=expires_in)

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

        return connection
