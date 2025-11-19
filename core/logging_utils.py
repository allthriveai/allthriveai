"""
Secure logging utilities with user isolation and PII protection.
"""
import logging
from typing import Any, Optional

from django.conf import settings

logger = logging.getLogger(__name__)


class SecureLogger:
    """
    Logger wrapper that automatically sanitizes sensitive information
    and ensures user isolation in logs.
    """

    SENSITIVE_FIELDS = {
        "password",
        "token",
        "secret",
        "api_key",
        "access_token",
        "refresh_token",
        "csrf_token",
        "session_id",
        "credit_card",
        "ssn",
        "social_security",
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
                    sanitized[key] = "***REDACTED***"
                else:
                    sanitized[key] = SecureLogger._sanitize_data(value)
            return sanitized
        elif isinstance(data, (list, tuple)):
            return [SecureLogger._sanitize_data(item) for item in data]
        elif isinstance(data, str):
            # Redact email addresses except domain
            if "@" in data and "." in data:
                parts = data.split("@")
                if len(parts) == 2:
                    username = parts[0]
                    # Show first 2 chars of username
                    masked = username[:2] + "***" if len(username) > 2 else "***"
                    return f"{masked}@{parts[1]}"
            return data
        else:
            return data

    @staticmethod
    def log_action(
        action: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        details: Optional[dict] = None,
        level: str = "info",
        error: Optional[Exception] = None,
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
            user_context.append(f"user_id={user_id}")
        if username:
            # Mask username in logs (show first 3 chars)
            masked_username = username[:3] + "***" if len(username) > 3 else "***"
            user_context.append(f"username={masked_username}")

        user_str = f"[{', '.join(user_context)}]" if user_context else "[anonymous]"

        # Build message
        message = f"{user_str} {action}"
        if safe_details:
            message += f" | details: {safe_details}"
        if error:
            message += f" | error: {type(error).__name__}: {str(error)}"

        # Log at appropriate level
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(message)

        # If error, log full stack trace in debug mode
        if error and settings.DEBUG:
            logger.exception(f"Full stack trace for {action}", exc_info=error)

    @staticmethod
    def log_api_request(
        endpoint: str,
        method: str,
        user_id: Optional[int] = None,
        status_code: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Log API request with relevant metadata.
        """
        details = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "ip_address": ip_address[:10] + "***" if ip_address else None,  # Mask IP
            "user_agent": user_agent[:50] if user_agent else None,  # Truncate UA
        }

        SecureLogger.log_action(
            f"API {method} {endpoint}",
            user_id=user_id,
            details={k: v for k, v in details.items() if v is not None},
            level="debug",
        )

    @staticmethod
    def log_file_upload(
        user_id: int,
        filename: str,
        file_size: int,
        content_type: str,
        success: bool = True,
        error: Optional[Exception] = None,
    ):
        """
        Log file upload with sanitized filename.
        """
        # Only log file extension, not full name
        extension = filename.rsplit(".", 1)[-1] if "." in filename else "unknown"

        SecureLogger.log_action(
            "File upload",
            user_id=user_id,
            details={
                "extension": extension,
                "size_bytes": file_size,
                "content_type": content_type,
                "success": success,
            },
            level="info" if success else "error",
            error=error,
        )

    @staticmethod
    def log_profile_update(
        user_id: int, username: str, fields_updated: list, success: bool = True, error: Optional[Exception] = None
    ):
        """
        Log profile update with field names only (no values).
        """
        SecureLogger.log_action(
            "Profile update",
            user_id=user_id,
            username=username,
            details={
                "fields": fields_updated,
                "success": success,
            },
            level="info" if success else "error",
            error=error,
        )

    @staticmethod
    def log_auth_event(
        event_type: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        ip_address: Optional[str] = None,
        success: bool = True,
        error: Optional[Exception] = None,
    ):
        """
        Log authentication events (login, logout, token refresh).
        """
        SecureLogger.log_action(
            f"Auth: {event_type}",
            user_id=user_id,
            username=username,
            details={
                "ip": ip_address[:10] + "***" if ip_address else None,
                "success": success,
            },
            level="info" if success else "warning",
            error=error,
        )


def get_client_ip(request) -> Optional[str]:
    """
    Get client IP address from request, checking proxies.
    """
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip
