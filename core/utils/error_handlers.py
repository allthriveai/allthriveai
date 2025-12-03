"""
Centralized error handling utilities for consistent error management.

This module provides:
- ServiceErrorHandler: Decorator for service methods with logging and exception handling
- CeleryTaskErrorHandler: Error handling for Celery tasks with retry logic
- Base exception classes for domain-specific errors

Usage:
    from core.utils.error_handlers import ServiceErrorHandler, handle_service_error

    @ServiceErrorHandler(service_name='weaviate')
    def my_service_method():
        ...

    # Or use the context manager
    with handle_service_error('weaviate', 'search'):
        ...
"""

import functools
import logging
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

# Type variable for generic return types
T = TypeVar('T')


# =============================================================================
# BASE EXCEPTION CLASSES
# =============================================================================


class ServiceError(Exception):
    """Base exception for all service-related errors."""

    def __init__(self, message: str, service_name: str = '', operation: str = '', details: dict | None = None):
        self.service_name = service_name
        self.operation = operation
        self.details = details or {}
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert exception to dictionary for logging/serialization."""
        return {
            'error': str(self),
            'service': self.service_name,
            'operation': self.operation,
            'details': self.details,
        }


class ExternalServiceError(ServiceError):
    """Error when communicating with external services (APIs, databases, etc.)."""

    pass


class ValidationError(ServiceError):
    """Error for validation failures in service layer."""

    pass


class NotFoundError(ServiceError):
    """Error when a requested resource is not found."""

    pass


class ServicePermissionError(ServiceError):
    """Error when user lacks permission for an operation."""

    pass


# Alias for backwards compatibility, but prefer ServicePermissionError
# to avoid shadowing the builtin PermissionError
PermissionDeniedError = ServicePermissionError


class RateLimitError(ExternalServiceError):
    """Error when rate limit is exceeded."""

    def __init__(self, message: str, retry_after: int | None = None, **kwargs):
        self.retry_after = retry_after
        super().__init__(message, **kwargs)


class CircuitOpenError(ExternalServiceError):
    """Error when circuit breaker is open."""

    pass


# =============================================================================
# ERROR HANDLER DECORATOR
# =============================================================================


class ServiceErrorHandler:
    """
    Decorator for consistent error handling across service methods.

    Features:
    - Consistent logging with structured context
    - Exception translation to domain-specific errors
    - Optional fallback values on error
    - Configurable error suppression for non-critical operations

    Example:
        @ServiceErrorHandler(
            service_name='weaviate',
            log_level='warning',
            fallback_value=[],
            suppress_errors=False
        )
        def search_projects(self, query: str) -> list:
            ...
    """

    def __init__(
        self,
        service_name: str,
        operation: str | None = None,
        log_level: str = 'error',
        fallback_value: Any = None,
        suppress_errors: bool = False,
        reraise_as: type[ServiceError] | None = None,
        include_traceback: bool = True,
    ):
        """
        Initialize the error handler.

        Args:
            service_name: Name of the service (e.g., 'weaviate', 'openai')
            operation: Operation name (defaults to function name)
            log_level: Logging level for errors ('debug', 'info', 'warning', 'error', 'critical')
            fallback_value: Value to return on error if suppress_errors=True
            suppress_errors: If True, catch errors and return fallback_value
            reraise_as: Exception class to wrap caught exceptions
            include_traceback: Include traceback in error logs
        """
        self.service_name = service_name
        self.operation = operation
        self.log_level = log_level
        self.fallback_value = fallback_value
        self.suppress_errors = suppress_errors
        self.reraise_as = reraise_as
        self.include_traceback = include_traceback

    def __call__(self, func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            operation = self.operation or func.__name__
            log_func = getattr(logger, self.log_level, logger.error)

            try:
                return func(*args, **kwargs)

            except ServiceError:
                # Already a service error, just re-raise or handle
                if self.suppress_errors:
                    log_func(
                        f'{self.service_name}.{operation} failed (suppressed)',
                        exc_info=self.include_traceback,
                        extra={'service': self.service_name, 'operation': operation},
                    )
                    return self.fallback_value
                raise

            except Exception as e:
                # Log with structured context
                log_func(
                    f'{self.service_name}.{operation} failed: {e}',
                    exc_info=self.include_traceback,
                    extra={
                        'service': self.service_name,
                        'operation': operation,
                        'error_type': type(e).__name__,
                    },
                )

                if self.suppress_errors:
                    return self.fallback_value

                if self.reraise_as:
                    raise self.reraise_as(
                        str(e),
                        service_name=self.service_name,
                        operation=operation,
                    ) from e

                raise

        return wrapper


# =============================================================================
# CONTEXT MANAGER FOR ERROR HANDLING
# =============================================================================


@contextmanager
def handle_service_error(
    service_name: str,
    operation: str,
    log_level: str = 'error',
    suppress_errors: bool = False,
    fallback_value: Any = None,
    reraise_as: type[ServiceError] | None = None,
):
    """
    Context manager for error handling in service operations.

    Example:
        with handle_service_error('weaviate', 'search', suppress_errors=True, fallback_value=[]):
            results = client.search(query)
        # results will be [] if search fails

    Args:
        service_name: Name of the service
        operation: Operation being performed
        log_level: Logging level for errors
        suppress_errors: If True, catch errors and yield fallback_value
        fallback_value: Value to use on error
        reraise_as: Exception class to wrap caught exceptions
    """
    log_func = getattr(logger, log_level, logger.error)

    try:
        yield
    except ServiceError:
        if suppress_errors:
            log_func(
                f'{service_name}.{operation} failed (suppressed)',
                exc_info=True,
                extra={'service': service_name, 'operation': operation},
            )
        else:
            raise
    except Exception as e:
        log_func(
            f'{service_name}.{operation} failed: {e}',
            exc_info=True,
            extra={
                'service': service_name,
                'operation': operation,
                'error_type': type(e).__name__,
            },
        )

        if suppress_errors:
            pass  # Suppress and continue
        elif reraise_as:
            raise reraise_as(
                str(e),
                service_name=service_name,
                operation=operation,
            ) from e
        else:
            raise


# =============================================================================
# CELERY TASK ERROR HANDLER
# =============================================================================


class CeleryTaskErrorHandler:
    """
    Decorator for Celery task error handling with retry logic.

    Features:
    - Automatic retry on transient errors
    - Structured logging for task failures
    - Circuit breaker integration
    - Dead letter queue support

    Example:
        @shared_task(bind=True)
        @CeleryTaskErrorHandler(
            task_name='sync_project',
            max_retries=3,
            retry_backoff=True,
            retry_exceptions=(ConnectionError, TimeoutError)
        )
        def sync_project_to_weaviate(self, project_id: int):
            ...
    """

    # Exceptions that should trigger a retry
    TRANSIENT_EXCEPTIONS = (
        ConnectionError,
        TimeoutError,
        OSError,
    )

    def __init__(
        self,
        task_name: str,
        max_retries: int = 3,
        retry_backoff: bool = True,
        retry_backoff_max: int = 600,
        retry_exceptions: tuple | None = None,
        log_level: str = 'error',
        on_failure: Callable | None = None,
    ):
        """
        Initialize the task error handler.

        Args:
            task_name: Name of the task for logging
            max_retries: Maximum number of retries
            retry_backoff: Use exponential backoff for retries
            retry_backoff_max: Maximum backoff delay in seconds
            retry_exceptions: Exception types that should trigger retry
            log_level: Logging level for errors
            on_failure: Callback function on final failure
        """
        self.task_name = task_name
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.retry_backoff_max = retry_backoff_max
        self.retry_exceptions = retry_exceptions or self.TRANSIENT_EXCEPTIONS
        self.log_level = log_level
        self.on_failure = on_failure

    def __call__(self, func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(task_self, *args, **kwargs) -> T:
            log_func = getattr(logger, self.log_level, logger.error)

            try:
                return func(task_self, *args, **kwargs)

            except CircuitOpenError as e:
                # Circuit is open, retry with longer delay
                logger.warning(
                    f'Task {self.task_name} skipped: circuit breaker open',
                    extra={'task': self.task_name, 'args': args},
                )
                # Retry after circuit recovery timeout
                raise task_self.retry(exc=e, countdown=60, max_retries=self.max_retries) from e

            except self.retry_exceptions as e:
                # Transient error, retry with backoff
                retry_count = task_self.request.retries
                if retry_count < self.max_retries:
                    if self.retry_backoff:
                        countdown = min(2**retry_count * 10, self.retry_backoff_max)
                    else:
                        countdown = 10

                    logger.warning(
                        f'Task {self.task_name} failed (attempt {retry_count + 1}/{self.max_retries + 1}), '
                        f'retrying in {countdown}s: {e}',
                        extra={
                            'task': self.task_name,
                            'retry_count': retry_count,
                            'args': args,
                        },
                    )
                    raise task_self.retry(exc=e, countdown=countdown) from e
                else:
                    # Max retries exceeded
                    log_func(
                        f'Task {self.task_name} failed after {self.max_retries + 1} attempts: {e}',
                        exc_info=True,
                        extra={'task': self.task_name, 'args': args},
                    )
                    if self.on_failure:
                        self.on_failure(task_self, e, args, kwargs)
                    raise

            except Exception as e:
                # Non-transient error, log and fail
                log_func(
                    f'Task {self.task_name} failed with non-retryable error: {e}',
                    exc_info=True,
                    extra={
                        'task': self.task_name,
                        'error_type': type(e).__name__,
                        'args': args,
                    },
                )
                if self.on_failure:
                    self.on_failure(task_self, e, args, kwargs)
                raise

        return wrapper


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================


def log_error_context(
    service_name: str,
    operation: str,
    error: Exception,
    extra_context: dict | None = None,
    level: str = 'error',
) -> None:
    """
    Log an error with consistent structured context.

    Args:
        service_name: Name of the service
        operation: Operation that failed
        error: The exception that occurred
        extra_context: Additional context to include
        level: Log level
    """
    log_func = getattr(logger, level, logger.error)
    context = {
        'service': service_name,
        'operation': operation,
        'error_type': type(error).__name__,
    }
    if extra_context:
        context.update(extra_context)

    log_func(f'{service_name}.{operation} failed: {error}', exc_info=True, extra=context)


def safe_execute(
    func: Callable[..., T],
    *args,
    fallback: T | None = None,
    log_errors: bool = True,
    service_name: str = 'unknown',
    operation: str = 'unknown',
    **kwargs,
) -> T | None:
    """
    Execute a function safely, returning fallback on any error.

    Useful for non-critical operations where failure shouldn't break the flow.

    Example:
        result = safe_execute(
            client.get_metrics,
            user_id,
            fallback={},
            service_name='analytics',
            operation='get_metrics'
        )

    Args:
        func: Function to execute
        *args: Positional arguments for func
        fallback: Value to return on error
        log_errors: Whether to log errors
        service_name: Service name for logging
        operation: Operation name for logging
        **kwargs: Keyword arguments for func

    Returns:
        Function result or fallback value
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        if log_errors:
            logger.warning(
                f'{service_name}.{operation} failed (using fallback): {e}',
                extra={
                    'service': service_name,
                    'operation': operation,
                    'error_type': type(e).__name__,
                },
            )
        return fallback
