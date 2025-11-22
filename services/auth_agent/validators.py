"""Validators for auth chat inputs.

DEPRECATED: These functions are maintained for backward compatibility.
New code should use services.auth.ValidationService and services.auth.UsernameService.
"""

from services.auth import AuthValidationError, UsernameService, ValidationService


def validate_email(email: str) -> tuple[bool, str | None]:
    """Validate email format.

    DEPRECATED: Use ValidationService.validate_email() which raises exceptions.
    """
    try:
        ValidationService.validate_email(email)
        return True, None
    except AuthValidationError as e:
        return False, str(e)


def validate_name(first_name: str, last_name: str) -> tuple[bool, str | None]:
    """Validate first and last name.

    DEPRECATED: Use ValidationService.validate_name() which raises exceptions.
    """
    try:
        ValidationService.validate_name(first_name, last_name)
        return True, None
    except AuthValidationError as e:
        return False, str(e)


def validate_password(password: str) -> tuple[bool, str | None]:
    """Validate password strength.

    DEPRECATED: Use ValidationService.validate_password() which raises exceptions.
    """
    try:
        ValidationService.validate_password(password)
        return True, None
    except AuthValidationError as e:
        return False, str(e)


def validate_interests(interests: list) -> tuple[bool, str | None]:
    """Validate interests selection.

    DEPRECATED: Use ValidationService.validate_interests() which raises exceptions.
    """
    try:
        ValidationService.validate_interests(interests)
        return True, None
    except AuthValidationError as e:
        return False, str(e)


def validate_username(username: str) -> tuple[bool, str | None]:
    """Validate username format and availability.

    DEPRECATED: Use UsernameService.validate_and_normalize() which raises exceptions.
    """
    try:
        UsernameService.validate_and_normalize(username)
        return True, None
    except AuthValidationError as e:
        return False, str(e)


def generate_username_from_email(email: str) -> str:
    """Generate suggested username from email.

    DEPRECATED: Use UsernameService.generate_from_email().
    """
    return UsernameService.generate_from_email(email)
