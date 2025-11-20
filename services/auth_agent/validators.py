"""
Validators for auth chat inputs
"""

import re


def validate_email(email: str) -> tuple[bool, str | None]:
    """
    Validate email format.

    Args:
        email: Email address to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not email:
        return False, 'Email is required'

    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, 'Please enter a valid email address'

    return True, None


def validate_name(first_name: str, last_name: str) -> tuple[bool, str | None]:
    """
    Validate first and last name.

    Args:
        first_name: First name
        last_name: Last name

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not first_name or not first_name.strip():
        return False, 'First name is required'

    if not last_name or not last_name.strip():
        return False, 'Last name is required'

    if len(first_name) > 50:
        return False, 'First name is too long (max 50 characters)'

    if len(last_name) > 50:
        return False, 'Last name is too long (max 50 characters)'

    return True, None


def validate_password(password: str) -> tuple[bool, str | None]:
    """
    Validate password strength.

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not password:
        return False, 'Password is required'

    if len(password) < 8:
        return False, 'Password must be at least 8 characters'

    # Check for at least one letter
    if not re.search(r'[a-zA-Z]', password):
        return False, 'Password must contain at least one letter'

    # Check for at least one number
    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number'

    return True, None


def validate_interests(interests: list) -> tuple[bool, str | None]:
    """
    Validate interests selection.

    Args:
        interests: List of selected interests

    Returns:
        Tuple of (is_valid, error_message)
    """
    valid_interests = ['explore', 'share_skills', 'invest', 'mentor']

    if not interests or len(interests) == 0:
        return False, 'Please select at least one interest'

    for interest in interests:
        if interest not in valid_interests:
            return False, f'Invalid interest: {interest}'

    return True, None


def validate_username(username: str) -> tuple[bool, str | None]:
    """
    Validate username format and availability.

    Args:
        username: Username to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    from core.users.models import User

    if not username:
        return False, 'Username is required'

    # Remove leading @ if present
    username = username.lstrip('@')

    if len(username) < 3:
        return False, 'Username must be at least 3 characters'

    if len(username) > 30:
        return False, 'Username must be less than 30 characters'

    # Only allow alphanumeric, underscores, and hyphens
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, 'Username can only contain letters, numbers, underscores, and hyphens'

    # Check if username is taken
    if User.objects.filter(username=username).exists():
        return False, f"Username '{username}' is already taken"

    return True, None


def generate_username_from_email(email: str) -> str:
    """
    Generate suggested username from email (part before @).

    Args:
        email: Email address

    Returns:
        Suggested username
    """
    username = email.split('@')[0]
    # Remove any special characters except underscore and hyphen
    username = re.sub(r'[^a-zA-Z0-9_-]', '', username)
    return username.lower()
