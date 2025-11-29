"""Models for social account connections and OAuth integrations."""

import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class SocialProvider(models.TextChoices):
    """Supported social OAuth providers."""

    GOOGLE = 'google', 'Google'
    GITHUB = 'github', 'GitHub'
    GITLAB = 'gitlab', 'GitLab'
    LINKEDIN = 'linkedin', 'LinkedIn'
    FIGMA = 'figma', 'Figma'
    HUGGINGFACE = 'huggingface', 'Hugging Face'
    MIDJOURNEY = 'midjourney', 'Midjourney'


class SocialConnection(models.Model):
    """Store OAuth tokens and metadata for connected social accounts."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='social_connections')

    provider = models.CharField(max_length=20, choices=SocialProvider.choices, help_text='OAuth provider name')

    provider_user_id = models.CharField(max_length=255, help_text='Unique user ID from the provider')

    provider_username = models.CharField(max_length=255, blank=True, help_text='Username on the provider platform')

    provider_email = models.EmailField(blank=True, null=True, help_text='Email from provider (if available)')

    # Encrypted token storage
    access_token_encrypted = models.BinaryField(help_text='Encrypted OAuth access token')

    refresh_token_encrypted = models.BinaryField(blank=True, null=True, help_text='Encrypted OAuth refresh token')

    token_expires_at = models.DateTimeField(null=True, blank=True, help_text='When the access token expires')

    scopes = models.TextField(blank=True, help_text='Comma-separated list of granted OAuth scopes')

    profile_url = models.URLField(blank=True, help_text='Link to user profile on provider')

    avatar_url = models.URLField(blank=True, help_text='Profile picture from provider')

    extra_data = models.JSONField(default=dict, blank=True, help_text='Additional provider-specific data')

    is_active = models.BooleanField(default=True, help_text='Whether this connection is currently active')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['user', 'provider']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'provider']),
            models.Index(fields=['provider', 'provider_user_id']),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.get_provider_display()}'

    @staticmethod
    def _get_encryption_key():
        """Generate encryption key from Django SECRET_KEY."""
        # Use SECRET_KEY to derive a consistent encryption key
        key_material = settings.SECRET_KEY.encode()
        key = hashlib.sha256(key_material).digest()
        # Fernet requires base64-encoded 32-byte key
        return base64.urlsafe_b64encode(key)

    def encrypt_token(self, token: str) -> bytes:
        """Encrypt an OAuth token."""
        if not token:
            return b''
        f = Fernet(self._get_encryption_key())
        return f.encrypt(token.encode())

    def decrypt_token(self, encrypted_token: bytes) -> str:
        """Decrypt an OAuth token."""
        if not encrypted_token:
            return ''
        # Convert memoryview to bytes if needed (Django BinaryField can return memoryview)
        if isinstance(encrypted_token, memoryview):
            encrypted_token = bytes(encrypted_token)
        f = Fernet(self._get_encryption_key())
        return f.decrypt(encrypted_token).decode()

    @property
    def access_token(self) -> str:
        """Get decrypted access token."""
        return self.decrypt_token(self.access_token_encrypted)

    @access_token.setter
    def access_token(self, value: str):
        """Set and encrypt access token."""
        self.access_token_encrypted = self.encrypt_token(value)

    @property
    def refresh_token(self) -> str:
        """Get decrypted refresh token."""
        if self.refresh_token_encrypted:
            return self.decrypt_token(self.refresh_token_encrypted)
        return ''

    @refresh_token.setter
    def refresh_token(self, value: str):
        """Set and encrypt refresh token."""
        if value:
            self.refresh_token_encrypted = self.encrypt_token(value)

    def is_token_expired(self) -> bool:
        """Check if the access token is expired."""
        if not self.token_expires_at:
            return False
        from django.utils import timezone

        return timezone.now() >= self.token_expires_at

    def get_scopes_list(self) -> list:
        """Get scopes as a list."""
        if not self.scopes:
            return []
        return [s.strip() for s in self.scopes.split(',')]

    def set_scopes_list(self, scopes: list):
        """Set scopes from a list."""
        self.scopes = ','.join(scopes)

    def clean(self):
        """Validate the model."""
        super().clean()

        # Ensure we have at least an access token
        if not self.access_token_encrypted:
            raise ValidationError('Access token is required')

        # Validate provider-specific requirements
        if self.provider == SocialProvider.GITHUB and not self.provider_username:
            raise ValidationError('GitHub connections require a username')
