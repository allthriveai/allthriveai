"""Custom exceptions for authentication services."""


class AuthError(Exception):
    """Base exception for authentication errors."""

    pass


class AuthValidationError(AuthError):
    """Raised when validation fails during authentication."""

    pass


class AuthenticationFailed(AuthError):
    """Raised when authentication fails (invalid credentials)."""

    pass


class UserCreationError(AuthError):
    """Raised when user creation fails."""

    pass


class SessionError(AuthError):
    """Raised when session operations fail."""

    pass
