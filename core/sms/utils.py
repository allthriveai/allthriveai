"""SMS utility functions."""

import re

from django.core.exceptions import ValidationError


def normalize_phone_number(phone: str, default_country: str = 'US') -> str:
    """
    Normalize a phone number to E.164 format.

    Args:
        phone: Phone number in any format
        default_country: Default country code if not provided (default: US)

    Returns:
        Phone number in E.164 format (e.g., +14155551234)

    Raises:
        ValidationError: If phone number is invalid
    """
    if not phone:
        raise ValidationError('Phone number is required')

    # Remove all non-digit characters except leading +
    cleaned = re.sub(r'[^\d+]', '', phone)

    # If starts with +, validate it's a proper international format
    if cleaned.startswith('+'):
        # Should have at least country code + number (minimum ~8 digits)
        if len(cleaned) < 9:
            raise ValidationError('Phone number is too short')
        if len(cleaned) > 16:
            raise ValidationError('Phone number is too long')
        return cleaned

    # Remove leading zeros
    cleaned = cleaned.lstrip('0')

    if not cleaned:
        raise ValidationError('Phone number is required')

    # Handle US numbers
    if default_country == 'US':
        # US number: 10 digits or 11 digits starting with 1
        if len(cleaned) == 10:
            return f'+1{cleaned}'
        elif len(cleaned) == 11 and cleaned.startswith('1'):
            return f'+{cleaned}'
        elif len(cleaned) < 10:
            raise ValidationError('US phone numbers must be 10 digits')
        elif len(cleaned) > 11:
            raise ValidationError('Phone number is too long for US format')
        else:
            raise ValidationError('Invalid US phone number format')

    # For other countries, require explicit + prefix
    raise ValidationError('International numbers must start with +')


def validate_phone_number(phone: str) -> bool:
    """
    Validate a phone number.

    Args:
        phone: Phone number to validate

    Returns:
        True if valid, False otherwise
    """
    try:
        normalize_phone_number(phone)
        return True
    except ValidationError:
        return False


def mask_phone_number(phone: str) -> str:
    """
    Mask a phone number for display (privacy).

    Args:
        phone: Phone number in E.164 format

    Returns:
        Masked phone number (e.g., +1415***1234)
    """
    if not phone:
        return ''

    if len(phone) <= 6:
        return '***'

    # Show first 4 chars and last 4 chars
    return f'{phone[:5]}***{phone[-4:]}'
