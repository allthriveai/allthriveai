"""Auth domain - Authentication and OAuth flows.

This domain handles user authentication, OAuth (Google/GitHub),
user signup, login, and profile management.
"""

from .serializers import UserSerializer
from .views import (
    GitHubLogin,
    GoogleLogin,
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
    'GoogleLogin',
    'GitHubLogin',
    'current_user',
    'logout_view',
    'signup',
    'oauth_urls',
    'oauth_callback',
    'csrf_token',
    'UserProfileView',
    'user_activity',
    'username_profile_view',
    # Serializers
    'UserSerializer',
]
