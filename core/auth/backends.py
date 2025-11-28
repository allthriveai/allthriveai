"""Custom authentication backends for AllThrive AI."""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()


class EmailOrUsernameModelBackend(ModelBackend):
    """
    Authentication backend that allows users to log in with either username or email.

    This is useful for Django admin and other login forms where users may enter either.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate using either username or email.

        Args:
            request: The HTTP request object
            username: Can be either username or email
            password: User's password
            **kwargs: Additional keyword arguments

        Returns:
            User object if authentication successful, None otherwise
        """
        if username is None or password is None:
            return None

        try:
            # Try to fetch the user by searching for username or email
            user = User.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        except User.DoesNotExist:
            # Run the default password hasher to reduce timing difference
            # between existing and non-existing users (security measure)
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            # This shouldn't happen if username and email are unique, but handle it
            return None

        # Check the password and return the user if valid
        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
