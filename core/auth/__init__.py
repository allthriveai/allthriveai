"""Auth domain - Authentication and OAuth flows.

This domain handles user authentication, OAuth (Google/GitHub),
user signup, login, and profile management.
"""

from .serializers import UserSerializer
from .views import (
    UserProfileView,
    csrf_token,
    current_user,
    logout_view,
    oauth_callback,
    oauth_urls,
    signup,
    user_activity,
    username_profile_view,
)

__all__ = [
    # Views
    'UserProfileView',
    'csrf_token',
    'current_user',
    'logout_view',
    'oauth_callback',
    'oauth_urls',
    'signup',
    'user_activity',
    'username_profile_view',
    # Serializers
    'UserSerializer',
]
