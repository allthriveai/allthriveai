"""Utility functions for notifications module."""


def mask_email(email: str) -> str:
    """Mask email address for safe logging (PII protection).

    Args:
        email: The email address to mask

    Returns:
        Masked email showing only first 2 chars of username
        e.g., 'john.doe@example.com' -> 'jo***@example.com'

    Examples:
        >>> mask_email('john.doe@example.com')
        'jo***@example.com'
        >>> mask_email('ab@test.com')
        '***@test.com'
        >>> mask_email('')
        '[invalid-email]'
    """
    if not email or '@' not in email:
        return '[invalid-email]'
    parts = email.split('@')
    username = parts[0]
    masked = username[:2] + '***' if len(username) > 2 else '***'
    return f'{masked}@{parts[1]}'


def mask_user_id(user_id: int) -> str:
    """Format user ID for logging.

    Args:
        user_id: The user's database ID

    Returns:
        Formatted string for logging
    """
    return f'user_id={user_id}'
