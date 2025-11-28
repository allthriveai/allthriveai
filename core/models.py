"""Core models - Re-export models from domain packages for Django compatibility.

Django's AUTH_USER_MODEL expects to find User at 'core.User', so we re-export it here.
"""

from .users.models import User, UserRole

__all__ = ['User', 'UserRole']
