"""Credential-based authentication service.

Handles username/password authentication, user creation, and username generation.
All validation logic consolidated here.
"""

import html
import logging
import re

from django.contrib.auth import authenticate
from django.db import transaction
from django.utils.html import strip_tags

from core.users.models import User

from .exceptions import AuthenticationFailed, AuthValidationError, UserCreationError

logger = logging.getLogger(__name__)


class UsernameService:
    """Service for username generation and validation."""

    @staticmethod
    def generate_from_email(email: str) -> str:
        """Generate username suggestion from email.

        Args:
            email: Email address

        Returns:
            Suggested username (not guaranteed to be available)
        """
        username = email.split('@')[0]
        # Remove any special characters except underscore and hyphen
        username = re.sub(r'[^a-zA-Z0-9_-]', '', username)
        return username.lower()

    @staticmethod
    def validate_and_normalize(username: str) -> str:
        """Validate username format and availability.

        Args:
            username: Username to validate

        Returns:
            Normalized username (lowercase, stripped)

        Raises:
            AuthValidationError: If username is invalid or taken
        """
        if not username:
            raise AuthValidationError('Username is required')

        # Remove leading @ if present
        username = username.lstrip('@').lower().strip()

        # Length validation
        if len(username) < 3:
            raise AuthValidationError('Username must be at least 3 characters')

        if len(username) > 30:
            raise AuthValidationError('Username must be less than 30 characters')

        # Format validation - only allow alphanumeric, underscores, and hyphens
        if not re.match(r'^[a-z0-9_-]+$', username):
            raise AuthValidationError('Username can only contain lowercase letters, numbers, underscores, and hyphens')

        # Check availability
        if User.objects.filter(username=username).exists():
            raise AuthValidationError(f"Username '{username}' is already taken")

        return username

    @staticmethod
    def generate_unique_from_email(email: str, max_attempts: int = 10) -> str:
        """Generate a unique username from email with fallback numbering.

        Args:
            email: Email address
            max_attempts: Maximum number of attempts to generate unique username

        Returns:
            Available username

        Raises:
            UserCreationError: If cannot generate unique username
        """
        base_username = UsernameService.generate_from_email(email)

        # Try base username first
        try:
            return UsernameService.validate_and_normalize(base_username)
        except AuthValidationError:
            pass

        # Try with numbers
        for i in range(1, max_attempts):
            candidate = f'{base_username}{i}'
            try:
                return UsernameService.validate_and_normalize(candidate)
            except AuthValidationError:
                continue

        raise UserCreationError(f'Could not generate unique username from email: {email}')


class ValidationService:
    """Service for validating and sanitizing user input."""

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input to prevent XSS attacks.

        Args:
            value: Raw input string

        Returns:
            Sanitized string with HTML tags stripped and entities unescaped
        """
        if not value:
            return value
        # Strip HTML tags
        value = strip_tags(value)
        # Unescape HTML entities (e.g., &lt; back to <)
        value = html.unescape(value)
        # Strip again in case unescaping revealed tags
        value = strip_tags(value)
        return value

    @staticmethod
    def validate_email(email: str) -> str:
        """Validate, sanitize, and normalize email format.

        Args:
            email: Email address to validate

        Returns:
            Normalized email (lowercase, stripped, sanitized)

        Raises:
            AuthValidationError: If email is invalid
        """
        if not email:
            raise AuthValidationError('Email is required')

        # Sanitize and normalize
        email = ValidationService.sanitize_input(email)
        email = email.strip().lower()

        # Basic email regex
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            raise AuthValidationError('Please enter a valid email address')

        return email

    @staticmethod
    def validate_name(first_name: str, last_name: str) -> tuple[str, str]:
        """Validate, sanitize, and normalize first and last name.

        Args:
            first_name: First name
            last_name: Last name

        Returns:
            Tuple of (normalized_first_name, normalized_last_name)

        Raises:
            AuthValidationError: If names are invalid
        """
        # Sanitize and normalize
        first_name = ValidationService.sanitize_input(first_name) if first_name else ''
        last_name = ValidationService.sanitize_input(last_name) if last_name else ''
        first_name = first_name.strip()
        last_name = last_name.strip()

        if not first_name:
            raise AuthValidationError('First name is required')

        if not last_name:
            raise AuthValidationError('Last name is required')

        if len(first_name) > 50:
            raise AuthValidationError('First name is too long (max 50 characters)')

        if len(last_name) > 50:
            raise AuthValidationError('Last name is too long (max 50 characters)')

        return first_name, last_name

    @staticmethod
    def validate_password(password: str) -> None:
        """Validate password strength.

        Args:
            password: Password to validate

        Raises:
            AuthValidationError: If password doesn't meet requirements
        """
        if not password:
            raise AuthValidationError('Password is required')

        if len(password) < 8:
            raise AuthValidationError('Password must be at least 8 characters')

        # Check for at least one letter
        if not re.search(r'[a-zA-Z]', password):
            raise AuthValidationError('Password must contain at least one letter')

        # Check for at least one number
        if not re.search(r'\d', password):
            raise AuthValidationError('Password must contain at least one number')

    @staticmethod
    def validate_interests(interests: list) -> list:
        """Validate interests selection.

        Args:
            interests: List of selected interests

        Returns:
            Validated interests list

        Raises:
            AuthValidationError: If interests are invalid
        """
        valid_interests = ['explore', 'share_skills', 'invest', 'mentor']

        if not interests or len(interests) == 0:
            raise AuthValidationError('Please select at least one interest')

        for interest in interests:
            if interest not in valid_interests:
                raise AuthValidationError(f'Invalid interest: {interest}')

        return interests


class CredentialAuthService:
    """Service for credential-based authentication and user management."""

    @staticmethod
    @transaction.atomic
    def create_user(email: str, password: str, first_name: str, last_name: str, username: str = None, **kwargs) -> User:
        """Create a new user account with validation.

        Args:
            email: User's email address
            password: User's password (plaintext, will be hashed)
            first_name: User's first name
            last_name: User's last name
            username: Optional custom username (will be generated if not provided)
            **kwargs: Additional user fields (role, etc.)

        Returns:
            Created User instance

        Raises:
            AuthValidationError: If validation fails
            UserCreationError: If user creation fails
        """
        try:
            # Validate all inputs
            email = ValidationService.validate_email(email)
            first_name, last_name = ValidationService.validate_name(first_name, last_name)
            ValidationService.validate_password(password)

            # IMPORTANT: All database checks must be inside transaction.atomic
            # to prevent race conditions with concurrent requests

            # Check if email already exists (inside transaction)
            if User.objects.filter(email=email).exists():
                raise AuthValidationError('A user with this email already exists')

            # Generate or validate username (inside transaction)
            if username:
                # Validate format
                username = username.lstrip('@').lower().strip()
                if len(username) < 3:
                    raise AuthValidationError('Username must be at least 3 characters')
                if len(username) > 30:
                    raise AuthValidationError('Username must be less than 30 characters')
                if not re.match(r'^[a-z0-9_-]+$', username):
                    raise AuthValidationError(
                        'Username can only contain lowercase letters, numbers, ' 'underscores, and hyphens'
                    )
                # Check availability (inside transaction prevents race condition)
                if User.objects.filter(username=username).exists():
                    raise AuthValidationError(f"Username '{username}' is already taken")
            else:
                # Generate unique username (inside transaction)
                base_username = UsernameService.generate_from_email(email)
                username = base_username
                counter = 1
                # Keep trying until we find an available username
                while User.objects.filter(username=username).exists() and counter < 100:
                    username = f'{base_username}{counter}'
                    counter += 1
                if counter >= 100:
                    raise UserCreationError(f'Could not generate unique username from email: {email}')

            # Create user (still inside transaction)
            user = User.objects.create_user(
                username=username, email=email, password=password, first_name=first_name, last_name=last_name, **kwargs
            )

            logger.info(f'User created successfully: {user.username}')
            return user

        except AuthValidationError:
            raise
        except Exception as e:
            logger.error(f'Failed to create user: {e}', exc_info=True)
            raise UserCreationError(f'Failed to create user: {str(e)}') from e

    @staticmethod
    def authenticate_user(email: str, password: str) -> User:
        """Authenticate user with email and password.

        Args:
            email: User's email address
            password: User's password

        Returns:
            Authenticated User instance

        Raises:
            AuthValidationError: If inputs are invalid
            AuthenticationFailed: If credentials are invalid
        """
        try:
            # Validate inputs
            email = ValidationService.validate_email(email)

            if not password:
                raise AuthValidationError('Password is required')

            # Authenticate (Django's authenticate uses username field, which is email for us)
            user = authenticate(username=email, password=password)

            if user is None:
                raise AuthenticationFailed('Invalid email or password')

            if not user.is_active:
                raise AuthenticationFailed('Account is disabled')

            logger.info(f'User authenticated: {user.username}')
            return user

        except (AuthValidationError, AuthenticationFailed):
            raise
        except Exception as e:
            logger.error(f'Authentication error: {e}', exc_info=True)
            raise AuthenticationFailed('Authentication failed') from e
