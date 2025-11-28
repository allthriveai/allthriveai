"""Referral code validation and sanitization utilities."""

import logging
import re

from better_profanity import profanity
from django.utils.crypto import get_random_string

logger = logging.getLogger(__name__)

# Initialize profanity filter
profanity.load_censor_words()


class ReferralCodeValidator:
    """Validator for custom referral codes."""

    MIN_LENGTH = 3
    MAX_LENGTH = 20
    PATTERN = re.compile(r'^[A-Za-z0-9_-]+$')

    # Reserved codes that can't be used
    RESERVED_CODES = {
        'ADMIN',
        'API',
        'APP',
        'AUTH',
        'BILLING',
        'BLOG',
        'DASHBOARD',
        'DEV',
        'DOCS',
        'HELP',
        'LOGIN',
        'LOGOUT',
        'NULL',
        'ROOT',
        'SETTINGS',
        'SIGNUP',
        'SUPPORT',
        'SYSTEM',
        'TEST',
        'WWW',
    }

    @classmethod
    def validate(cls, code: str) -> tuple[bool, str]:
        """Validate a referral code.

        Args:
            code: The code to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not code:
            return False, 'Code cannot be empty'

        # Strip and uppercase
        code = code.strip().upper()

        # Length check
        if len(code) < cls.MIN_LENGTH:
            return False, f'Code must be at least {cls.MIN_LENGTH} characters'

        if len(code) > cls.MAX_LENGTH:
            return False, f'Code must be at most {cls.MAX_LENGTH} characters'

        # Pattern check (alphanumeric, hyphens, underscores only)
        if not cls.PATTERN.match(code):
            return False, 'Code can only contain letters, numbers, hyphens, and underscores'

        # Reserved words check
        if code in cls.RESERVED_CODES:
            return False, f"'{code}' is a reserved word and cannot be used"

        # Profanity check
        if profanity.contains_profanity(code):
            logger.warning(f'Profanity detected in referral code attempt: {code}')
            return False, 'Code contains inappropriate language'

        return True, ''

    @classmethod
    def sanitize(cls, code: str) -> str:
        """Sanitize a code by uppercasing and removing invalid characters.

        Args:
            code: The code to sanitize

        Returns:
            Sanitized code
        """
        if not code:
            return ''

        # Remove spaces and convert to uppercase
        code = code.strip().upper()

        # Keep only alphanumeric, hyphens, and underscores
        code = re.sub(r'[^A-Z0-9_-]', '', code)

        # Truncate to max length
        if len(code) > cls.MAX_LENGTH:
            code = code[: cls.MAX_LENGTH]

        return code


def generate_default_referral_code(username: str) -> str:
    """Generate a default referral code based on username.

    Creates a clean, memorable code from username with fallback to random.

    Args:
        username: The user's username

    Returns:
        A valid referral code
    """
    # Try to use sanitized username
    sanitized = ReferralCodeValidator.sanitize(username)

    if sanitized and len(sanitized) >= ReferralCodeValidator.MIN_LENGTH:
        is_valid, _ = ReferralCodeValidator.validate(sanitized)
        if is_valid:
            return sanitized

    # Fallback: username prefix + random suffix
    prefix = sanitized[:8] if sanitized else ''
    suffix = get_random_string(4, allowed_chars='23456789ABCDEFGHJKLMNPQRSTUVWXYZ')

    if prefix:
        return f'{prefix}{suffix}'

    # Ultimate fallback: fully random
    return get_random_string(8, allowed_chars='23456789ABCDEFGHJKLMNPQRSTUVWXYZ')


def check_code_availability(code: str, exclude_user_id: int = None) -> bool:
    """Check if a referral code is available.

    Args:
        code: The code to check
        exclude_user_id: Optional user ID to exclude from check (for updates)

    Returns:
        True if code is available, False if taken
    """
    from .models import ReferralCode

    queryset = ReferralCode.objects.filter(code__iexact=code)

    if exclude_user_id:
        queryset = queryset.exclude(user_id=exclude_user_id)

    return not queryset.exists()
