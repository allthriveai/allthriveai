"""
Unified error handling utilities for Ava agent tools.

Provides consistent error response formatting and logging across all tools.
"""

import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class ToolErrorResponse(TypedDict):
    """Standard error response format for tool failures."""

    success: bool
    error: str
    error_code: str | None


class ToolSuccessResponse(TypedDict):
    """Standard success response format for tools."""

    success: bool


# Error codes for categorization and monitoring
ERROR_CODES = {
    'AUTH_REQUIRED': 'User authentication required',
    'AUTH_FAILED': 'Authentication failed',
    'USER_NOT_FOUND': 'User not found',
    'PROJECT_NOT_FOUND': 'Project not found',
    'CONTENT_NOT_FOUND': 'Content not found',
    'INVALID_INPUT': 'Invalid input provided',
    'RATE_LIMITED': 'Rate limit exceeded',
    'TIMEOUT': 'Operation timed out',
    'EXTERNAL_API_ERROR': 'External API error',
    'DATABASE_ERROR': 'Database error',
    'INTERNAL_ERROR': 'Internal error',
}


def tool_error(
    error_message: str,
    error_code: str | None = None,
    log_level: str = 'warning',
    exc_info: bool = False,
    context: dict | None = None,
) -> ToolErrorResponse:
    """
    Create a standardized error response for tool failures.

    Args:
        error_message: User-friendly error message
        error_code: Error code from ERROR_CODES for categorization
        log_level: Logging level ('debug', 'info', 'warning', 'error', 'critical')
        exc_info: Include exception traceback in logs
        context: Additional context for logging

    Returns:
        Standardized error response dict
    """
    # Build log message with context
    log_message = f'Tool error: {error_message}'
    if error_code:
        log_message = f'[{error_code}] {log_message}'
    if context:
        log_message = f'{log_message} | context: {context}'

    # Log at appropriate level
    log_func = getattr(logger, log_level, logger.warning)
    log_func(log_message, exc_info=exc_info)

    return {
        'success': False,
        'error': error_message,
        'error_code': error_code,
    }


def auth_error(user_id: int | None = None) -> ToolErrorResponse:
    """Return standard authentication required error."""
    context = {'user_id': user_id} if user_id is not None else None
    return tool_error(
        'You need to be logged in to do that.',
        error_code='AUTH_REQUIRED',
        log_level='warning',
        context=context,
    )


def not_found_error(resource_type: str, resource_id: str | int | None = None) -> ToolErrorResponse:
    """Return standard not found error."""
    message = f'{resource_type.title()} not found'
    if resource_id:
        message = f'{resource_type.title()} ({resource_id}) not found'
    return tool_error(
        message,
        error_code=f'{resource_type.upper()}_NOT_FOUND',
        log_level='info',
        context={'resource_type': resource_type, 'resource_id': resource_id},
    )


def validation_error(message: str, field: str | None = None) -> ToolErrorResponse:
    """Return standard validation error."""
    context = {'field': field} if field else None
    return tool_error(
        message,
        error_code='INVALID_INPUT',
        log_level='info',
        context=context,
    )


def rate_limit_error(retry_after: int | None = None) -> ToolErrorResponse:
    """Return standard rate limit error."""
    message = 'Please wait a moment before trying again.'
    if retry_after:
        message = f'Please wait {retry_after} seconds before trying again.'
    return tool_error(
        message,
        error_code='RATE_LIMITED',
        log_level='warning',
    )


def timeout_error(operation: str = 'operation', timeout_seconds: int | None = None) -> ToolErrorResponse:
    """Return standard timeout error."""
    message = f'The {operation} is taking longer than expected. Please try again.'
    if timeout_seconds:
        message = f'The {operation} timed out after {timeout_seconds}s. Please try again.'
    return tool_error(
        message,
        error_code='TIMEOUT',
        log_level='warning',
        context={'operation': operation, 'timeout_seconds': timeout_seconds},
    )


def internal_error(exception: Exception | None = None, context: dict | None = None) -> ToolErrorResponse:
    """
    Return standard internal error with safe message.

    Never exposes exception details to users.
    """
    return tool_error(
        'Something went wrong. Please try again.',
        error_code='INTERNAL_ERROR',
        log_level='error',
        exc_info=exception is not None,
        context=context,
    )


def tool_success(**kwargs) -> dict:
    """
    Create a standardized success response for tools.

    Args:
        **kwargs: Additional fields to include in response

    Returns:
        Success response dict with success=True and any additional fields
    """
    return {'success': True, **kwargs}
