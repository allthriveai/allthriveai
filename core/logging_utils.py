"""
Secure logging utilities with user isolation and PII protection.
"""

import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class SecureLogger:
    """
    Logger wrapper that automatically sanitizes sensitive information
    and ensures user isolation in logs.
    """

    SENSITIVE_FIELDS = {
        'password',
        'token',
        'secret',
        'api_key',
        'access_token',
        'refresh_token',
        'csrf_token',
        'session_id',
        'credit_card',
        'ssn',
        'social_security',
    }

    @staticmethod
    def _sanitize_data(data: Any) -> Any:
        """
        Recursively sanitize sensitive data from logs.
        """
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                key_lower = key.lower()
                # Check if key contains sensitive field name
                if any(sensitive in key_lower for sensitive in SecureLogger.SENSITIVE_FIELDS):
                    sanitized[key] = '***REDACTED***'
                else:
                    sanitized[key] = SecureLogger._sanitize_data(value)
            return sanitized
        elif isinstance(data, (list, tuple)):
            return [SecureLogger._sanitize_data(item) for item in data]
        elif isinstance(data, str):
            # Redact email addresses except domain
            if '@' in data and '.' in data:
                parts = data.split('@')
                if len(parts) == 2:
                    username = parts[0]
                    # Show first 2 chars of username
                    masked = username[:2] + '***' if len(username) > 2 else '***'
                    return f'{masked}@{parts[1]}'
            return data
        else:
            return data

    @staticmethod
    def log_action(
        action: str,
        user_id: int | None = None,
        username: str | None = None,
        details: dict | None = None,
        level: str = 'info',
        error: Exception | None = None,
    ):
        """
        Log a user action with automatic sanitization.

        Args:
            action: Description of the action
            user_id: User ID (for isolation tracking)
            username: Username (masked in logs)
            details: Additional context (will be sanitized)
            level: Log level (debug, info, warning, error, critical)
            error: Exception object if logging an error
        """
        # Sanitize details
        safe_details = SecureLogger._sanitize_data(details) if details else {}

        # Create log message with user context
        user_context = []
        if user_id:
            user_context.append(f'user_id={user_id}')
        if username:
            # Mask username in logs (show first 3 chars)
            masked_username = username[:3] + '***' if len(username) > 3 else '***'
            user_context.append(f'username={masked_username}')

        user_str = f'[{", ".join(user_context)}]' if user_context else '[anonymous]'

        # Build message
        message = f'{user_str} {action}'
        if safe_details:
            message += f' | details: {safe_details}'
        if error:
            message += f' | error: {type(error).__name__}: {str(error)}'

        # Log at appropriate level
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(message)

        # If error, log full stack trace in debug mode
        if error and settings.DEBUG:
            logger.exception(f'Full stack trace for {action}', exc_info=error)

    @staticmethod
    def log_api_request(
        endpoint: str,
        method: str,
        user_id: int | None = None,
        status_code: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ):
        """
        Log API request with relevant metadata.
        """
        details = {
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'ip_address': ip_address[:10] + '***' if ip_address else None,  # Mask IP
            'user_agent': user_agent[:50] if user_agent else None,  # Truncate UA
        }

        SecureLogger.log_action(
            f'API {method} {endpoint}',
            user_id=user_id,
            details={k: v for k, v in details.items() if v is not None},
            level='debug',
        )

    @staticmethod
    def log_file_upload(
        user_id: int,
        filename: str,
        file_size: int,
        content_type: str,
        success: bool = True,
        error: Exception | None = None,
    ):
        """
        Log file upload with sanitized filename.
        """
        # Only log file extension, not full name
        extension = filename.rsplit('.', 1)[-1] if '.' in filename else 'unknown'

        SecureLogger.log_action(
            'File upload',
            user_id=user_id,
            details={
                'extension': extension,
                'size_bytes': file_size,
                'content_type': content_type,
                'success': success,
            },
            level='info' if success else 'error',
            error=error,
        )

    @staticmethod
    def log_profile_update(
        user_id: int, username: str, fields_updated: list, success: bool = True, error: Exception | None = None
    ):
        """
        Log profile update with field names only (no values).
        """
        SecureLogger.log_action(
            'Profile update',
            user_id=user_id,
            username=username,
            details={
                'fields': fields_updated,
                'success': success,
            },
            level='info' if success else 'error',
            error=error,
        )

    @staticmethod
    def log_auth_event(
        event_type: str,
        user_id: int | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        success: bool = True,
        error: Exception | None = None,
    ):
        """
        Log authentication events (login, logout, token refresh).
        """
        SecureLogger.log_action(
            f'Auth: {event_type}',
            user_id=user_id,
            username=username,
            details={
                'ip': ip_address[:10] + '***' if ip_address else None,
                'success': success,
            },
            level='info' if success else 'warning',
            error=error,
        )


class StructuredLogger:
    """
    Enhanced logger with structured logging support for consistent error handling.

    This class provides standardized logging methods for common patterns:
    - Error logging with context
    - Database operation logging
    - External API call logging
    - Service operation logging

    All methods automatically sanitize sensitive data and provide consistent formatting.
    """

    @staticmethod
    def log_error(
        message: str,
        error: Exception,
        user=None,
        extra: dict | None = None,
        level: str = 'error',
        logger_instance: logging.Logger | None = None,
    ) -> None:
        """
        Standard error logging with full context and stack trace.

        Args:
            message: Description of what operation failed
            error: The exception that was raised
            user: User instance (optional, for user context)
            extra: Additional context dictionary (will be sanitized)
            level: Log level (error, warning, critical)
            logger_instance: Specific logger to use (defaults to module logger)

        Example:
            try:
                risky_operation()
            except Exception as e:
                StructuredLogger.log_error(
                    message='Failed to process user data',
                    error=e,
                    user=request.user,
                    extra={'operation': 'data_import', 'record_count': 100}
                )
        """
        log = logger_instance or logger
        safe_extra = SecureLogger._sanitize_data(extra) if extra else {}

        # Build context
        context = {'error_type': type(error).__name__, 'error_message': str(error)}

        if user and hasattr(user, 'id'):
            context['user_id'] = user.id
            if hasattr(user, 'username'):
                # Mask username
                username = user.username
                context['username'] = username[:3] + '***' if len(username) > 3 else '***'

        context.update(safe_extra)

        # Log with stack trace
        log_func = getattr(log, level.lower(), log.error)
        log_func(f'{message}: {type(error).__name__}: {str(error)}', exc_info=error, extra=context)

    @staticmethod
    def log_db_operation(
        operation: str,
        model: str,
        success: bool,
        duration_ms: float | None = None,
        record_count: int | None = None,
        error: Exception | None = None,
        logger_instance: logging.Logger | None = None,
    ) -> None:
        """
        Log database operations with performance tracking.

        Args:
            operation: Type of operation (create, update, delete, query)
            model: Model name being operated on
            success: Whether the operation succeeded
            duration_ms: Operation duration in milliseconds
            record_count: Number of records affected
            error: Exception if operation failed
            logger_instance: Specific logger to use

        Example:
            StructuredLogger.log_db_operation(
                operation='bulk_create',
                model='Project',
                success=True,
                duration_ms=125.5,
                record_count=50
            )
        """
        log = logger_instance or logger
        context = {'operation': operation, 'model': model, 'success': success}

        if duration_ms is not None:
            context['duration_ms'] = round(duration_ms, 2)
        if record_count is not None:
            context['record_count'] = record_count

        message = f'DB {operation} on {model}'

        if success:
            details = []
            if record_count:
                details.append(f'{record_count} records')
            if duration_ms:
                details.append(f'{duration_ms:.2f}ms')
            if details:
                message += f' ({", ".join(details)})'
            log.info(message, extra=context)
        else:
            error_msg = f': {type(error).__name__}: {str(error)}' if error else ' failed'
            log.error(message + error_msg, exc_info=error, extra=context)

    @staticmethod
    def log_api_call(
        service: str,
        endpoint: str,
        method: str,
        status_code: int | None = None,
        duration_ms: float | None = None,
        success: bool = True,
        error: Exception | None = None,
        logger_instance: logging.Logger | None = None,
    ) -> None:
        """
        Log external API calls with performance and status tracking.

        Args:
            service: Service name (e.g., 'OpenAI', 'GitHub', 'Stripe')
            endpoint: API endpoint path
            method: HTTP method (GET, POST, etc.)
            status_code: HTTP response status code
            duration_ms: Request duration in milliseconds
            success: Whether the call succeeded
            error: Exception if call failed
            logger_instance: Specific logger to use

        Example:
            StructuredLogger.log_api_call(
                service='OpenAI',
                endpoint='/v1/chat/completions',
                method='POST',
                status_code=200,
                duration_ms=1534.2,
                success=True
            )
        """
        log = logger_instance or logger
        context = {
            'service': service,
            'endpoint': endpoint,
            'method': method,
            'success': success,
        }

        if status_code is not None:
            context['status_code'] = status_code
        if duration_ms is not None:
            context['duration_ms'] = round(duration_ms, 2)

        message = f'API {method} {service}{endpoint}'

        if success:
            details = []
            if status_code:
                details.append(f'status={status_code}')
            if duration_ms:
                details.append(f'{duration_ms:.2f}ms')
            if details:
                message += f' ({", ".join(details)})'
            log.info(message, extra=context)
        else:
            level = 'warning' if status_code and 400 <= status_code < 500 else 'error'
            error_msg = f': {type(error).__name__}: {str(error)}' if error else ' failed'
            log_func = getattr(log, level)
            log_func(message + error_msg, exc_info=error, extra=context)

    @staticmethod
    def log_service_operation(
        service_name: str,
        operation: str,
        user=None,
        success: bool = True,
        duration_ms: float | None = None,
        metadata: dict | None = None,
        error: Exception | None = None,
        logger_instance: logging.Logger | None = None,
    ) -> None:
        """
        Log service layer operations with consistent formatting.

        Args:
            service_name: Name of the service (e.g., 'PointsService', 'ModerationService')
            operation: Operation being performed
            user: User instance (optional)
            success: Whether the operation succeeded
            duration_ms: Operation duration in milliseconds
            metadata: Additional context data (will be sanitized)
            error: Exception if operation failed
            logger_instance: Specific logger to use

        Example:
            StructuredLogger.log_service_operation(
                service_name='PointsService',
                operation='award_points',
                user=user,
                success=True,
                metadata={'points': 50, 'activity': 'quiz_completed'}
            )
        """
        log = logger_instance or logger
        safe_metadata = SecureLogger._sanitize_data(metadata) if metadata else {}

        context = {
            'service': service_name,
            'operation': operation,
            'success': success,
        }

        if user and hasattr(user, 'id'):
            context['user_id'] = user.id

        if duration_ms is not None:
            context['duration_ms'] = round(duration_ms, 2)

        context.update(safe_metadata)

        message = f'{service_name}.{operation}'

        if success:
            details = []
            if duration_ms:
                details.append(f'{duration_ms:.2f}ms')
            if safe_metadata:
                details.append(str(safe_metadata))
            if details:
                message += f' - {" ".join(details)}'
            log.info(message, extra=context)
        else:
            error_msg = f': {type(error).__name__}: {str(error)}' if error else ' failed'
            log.error(message + error_msg, exc_info=error, extra=context)

    @staticmethod
    def log_validation_error(
        message: str,
        user=None,
        errors: dict | None = None,
        logger_instance: logging.Logger | None = None,
    ) -> None:
        """
        Log validation errors (expected errors, not system failures).

        Args:
            message: Description of what failed validation
            user: User instance (optional)
            errors: Validation error details
            logger_instance: Specific logger to use

        Example:
            StructuredLogger.log_validation_error(
                message='Project creation validation failed',
                user=request.user,
                errors={'title': ['Title is required'], 'description': ['Too short']}
            )
        """
        log = logger_instance or logger
        context = {}

        if user and hasattr(user, 'id'):
            context['user_id'] = user.id

        if errors:
            context['validation_errors'] = SecureLogger._sanitize_data(errors)

        log.warning(message, extra=context)


def get_client_ip(request) -> str | None:
    """
    Get client IP address from request, checking proxies.
    """
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
