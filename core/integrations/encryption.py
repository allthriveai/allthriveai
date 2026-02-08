"""
Encryption utilities for storing sensitive data like OAuth tokens.

This module provides a SecretField that automatically encrypts/decrypts
values when storing/retrieving from the database using Fernet symmetric encryption.
"""

import logging

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)


def get_fernet() -> Fernet:
    """Get Fernet instance with the encryption key from settings."""
    key = getattr(settings, 'ENCRYPTION_KEY', None)
    if not key:
        raise ValueError(
            "ENCRYPTION_KEY not configured in settings. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    """Encrypt a string value using Fernet encryption."""
    if not value:
        return value
    f = get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    """Decrypt a Fernet-encrypted string value."""
    if not value:
        return value
    f = get_fernet()
    try:
        return f.decrypt(value.encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt value - invalid token or key mismatch")
        raise ValueError("Failed to decrypt value - encryption key may have changed")


class SecretField(models.TextField):
    """
    A Django model field that encrypts values before storing in the database
    and decrypts them when retrieving.

    Uses Fernet symmetric encryption (AES-128-CBC with HMAC).

    Example:
        class MyModel(models.Model):
            api_token = SecretField()

        # Value is encrypted when saved
        obj.api_token = "secret-token-123"
        obj.save()

        # Value is decrypted when read
        print(obj.api_token)  # "secret-token-123"
    """

    description = "An encrypted text field"

    def __init__(self, *args, **kwargs):
        # Default to blank=True since encrypted fields often start empty
        kwargs.setdefault('blank', True)
        kwargs.setdefault('default', '')
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        """Return enough information to recreate the field."""
        name, path, args, kwargs = super().deconstruct()
        # Remove defaults we added
        if kwargs.get('blank') is True:
            del kwargs['blank']
        if kwargs.get('default') == '':
            del kwargs['default']
        return name, path, args, kwargs

    def get_prep_value(self, value):
        """Encrypt value before storing in database."""
        value = super().get_prep_value(value)
        if value is None or value == '':
            return value
        return encrypt_value(value)

    def from_db_value(self, value, expression, connection):
        """Decrypt value when reading from database."""
        if value is None or value == '':
            return value
        try:
            return decrypt_value(value)
        except ValueError:
            # Log but don't crash - return empty string for corrupted data
            logger.warning("Could not decrypt field value - returning empty string")
            return ''

    def to_python(self, value):
        """Convert value to Python string (no decryption needed here, done in from_db_value)."""
        if value is None:
            return value
        return str(value)
