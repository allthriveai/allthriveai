"""Audits domain - User activity audit logging.

This domain handles audit trail logging for user actions
and system events.
"""

from .models import UserAuditLog

__all__ = [
    # Models
    'UserAuditLog',
]
