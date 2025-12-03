"""
Logging utilities for billing system.

Provides secure logging that sanitizes sensitive data like
Stripe client secrets, API keys, and payment information.
"""

import logging
import re
from typing import Any


def sanitize_stripe_data(data: Any) -> Any:
    """
    Recursively sanitize Stripe-related sensitive data from dictionaries.

    Redacts:
    - client_secret (Stripe payment secrets)
    - publishable_key (partial redaction)
    - secret_key (full redaction)
    - card numbers
    - CVV codes

    Args:
        data: Dictionary, list, or primitive value to sanitize

    Returns:
        Sanitized copy of the data
    """
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()

            # Full redaction for secrets
            if 'client_secret' in key_lower or 'secret_key' in key_lower or 'api_key' in key_lower:
                sanitized[key] = '[REDACTED]'

            # Partial redaction for publishable keys
            elif 'publishable_key' in key_lower:
                if isinstance(value, str) and len(value) > 8:
                    sanitized[key] = f'{value[:8]}...[REDACTED]'
                else:
                    sanitized[key] = '[REDACTED]'

            # Card number redaction
            elif 'card' in key_lower and 'number' in key_lower:
                sanitized[key] = '[REDACTED CARD]'

            # CVV redaction
            elif 'cvv' in key_lower or 'cvc' in key_lower:
                sanitized[key] = '[REDACTED]'

            # Recursively sanitize nested structures
            else:
                sanitized[key] = sanitize_stripe_data(value)

        return sanitized

    elif isinstance(data, list):
        return [sanitize_stripe_data(item) for item in data]

    elif isinstance(data, str):
        # Redact client secrets in strings (pattern: pi_xxx_secret_xxx or seti_xxx_secret_xxx)
        data = re.sub(r'(pi|seti|cs)_[a-zA-Z0-9]+_secret_[a-zA-Z0-9]+', '[REDACTED_SECRET]', data)

        # Redact API keys (pattern: sk_live_xxx or pk_live_xxx)
        data = re.sub(r'sk_(live|test)_[a-zA-Z0-9]+', '[REDACTED_SECRET_KEY]', data)
        data = re.sub(r'pk_(live|test)_[a-zA-Z0-9]{8,}', lambda m: f'{m.group(0)[:16]}...[REDACTED]', data)

        return data

    else:
        # Return primitives as-is
        return data


def safe_log_dict(data: dict, max_length: int = 500) -> str:
    """
    Safely convert a dictionary to a log-friendly string with sanitization.

    Args:
        data: Dictionary to log
        max_length: Maximum length of the output string

    Returns:
        Sanitized string representation, truncated if needed
    """
    sanitized = sanitize_stripe_data(data)
    result = str(sanitized)

    if len(result) > max_length:
        result = result[:max_length] + '...[TRUNCATED]'

    return result


def safe_log_error(error: Exception, context: dict | None = None) -> str:
    """
    Safely log an error with optional context, sanitizing sensitive data.

    Args:
        error: Exception to log
        context: Optional context dictionary

    Returns:
        Sanitized error message with context
    """
    error_msg = f'Error: {type(error).__name__}: {str(error)}'

    if context:
        sanitized_context = sanitize_stripe_data(context)
        error_msg += f' | Context: {sanitized_context}'

    return error_msg


class SensitiveDataFilter(logging.Filter):
    """
    Django logging filter that automatically sanitizes sensitive data.

    Add this to your LOGGING configuration:

    'filters': {
        'sanitize_sensitive_data': {
            '()': 'core.billing.logging_utils.SensitiveDataFilter',
        },
    },
    'handlers': {
        'console': {
            'filters': ['sanitize_sensitive_data'],
            ...
        },
    },
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Sanitize the log record's message before it's logged.

        Args:
            record: LogRecord to sanitize

        Returns:
            True (always allow the record through, just sanitize it)
        """
        # Sanitize the message
        if isinstance(record.msg, str):
            record.msg = sanitize_stripe_data(record.msg)

        # Sanitize any args
        if record.args:
            if isinstance(record.args, dict):
                record.args = sanitize_stripe_data(record.args)
            elif isinstance(record.args, list | tuple):
                record.args = tuple(sanitize_stripe_data(arg) for arg in record.args)

        return True
