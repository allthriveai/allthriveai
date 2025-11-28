"""Authentication services.

Centralized authentication logic for credential-based auth, OAuth, and chat-based auth.
"""

from .credentials import CredentialAuthService, UsernameService, ValidationService
from .exceptions import AuthenticationFailed, AuthError, AuthValidationError, SessionError, UserCreationError
from .tokens import clear_auth_cookies, generate_tokens_for_user, set_auth_cookies

__all__ = [
    # Token management
    'generate_tokens_for_user',
    'set_auth_cookies',
    'clear_auth_cookies',
    # Services
    'CredentialAuthService',
    'UsernameService',
    'ValidationService',
    # Exceptions
    'AuthError',
    'AuthValidationError',
    'AuthenticationFailed',
    'UserCreationError',
    'SessionError',
]
