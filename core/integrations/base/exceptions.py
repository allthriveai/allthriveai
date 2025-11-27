"""Integration-specific exceptions."""


class IntegrationError(Exception):
    """Base exception for all integration errors.

    Raised when an integration operation fails (e.g., API error, network issue, invalid data).
    """

    def __init__(self, message: str, integration_name: str | None = None, original_error: Exception | None = None):
        """Initialize IntegrationError.

        Args:
            message: Human-readable error description
            integration_name: Name of the integration (e.g., 'github', 'gitlab')
            original_error: Original exception that caused this error
        """
        self.integration_name = integration_name
        self.original_error = original_error

        # Build full message
        full_message = message
        if integration_name:
            full_message = f'[{integration_name}] {message}'
        if original_error:
            full_message += f' (caused by: {type(original_error).__name__}: {str(original_error)})'

        super().__init__(full_message)


class IntegrationAuthError(IntegrationError):
    """Raised when authentication fails or is required but not provided."""

    pass


class IntegrationNotFoundError(IntegrationError):
    """Raised when a requested resource is not found (e.g., repository doesn't exist)."""

    pass


class IntegrationRateLimitError(IntegrationError):
    """Raised when API rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        integration_name: str | None = None,
        reset_time: int | None = None,
        original_error: Exception | None = None,
    ):
        """Initialize IntegrationRateLimitError.

        Args:
            message: Human-readable error description
            integration_name: Name of the integration
            reset_time: Unix timestamp when rate limit resets
            original_error: Original exception
        """
        self.reset_time = reset_time
        super().__init__(message, integration_name, original_error)


class IntegrationNetworkError(IntegrationError):
    """Raised when network/connection issues occur."""

    pass


class IntegrationValidationError(IntegrationError):
    """Raised when input validation fails (e.g., invalid URL format)."""

    pass
