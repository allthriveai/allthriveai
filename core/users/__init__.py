"""Users domain - User accounts, roles, and permissions.

This domain handles user model, role management, and role-based permissions.
"""

from .models import User, UserRole
from .role_models import RolePermission, RoleUpgradeRequest

__all__ = [
    # Models
    'User',
    'UserRole',
    'RoleUpgradeRequest',
    'RolePermission',
]
