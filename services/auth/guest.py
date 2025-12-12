"""Guest user service for battle invitations.

Allows users to participate in battles without creating a full account first.
Guest users can later convert their account to a full account.
"""

import logging
import secrets
import uuid
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from core.users.models import User

from .tokens import generate_tokens_for_user

if TYPE_CHECKING:
    from core.battles.models import BattleInvitation

logger = logging.getLogger(__name__)


class GuestUserService:
    """Service for managing temporary guest users."""

    GUEST_EMAIL_DOMAIN = 'guest.allthrive.ai'
    GUEST_TOKEN_LENGTH = 32

    @classmethod
    def create_guest_user(cls, display_name: str | None = None) -> tuple[User, str]:
        """Create a temporary guest user for battle participation.

        Args:
            display_name: Optional display name for the guest user.

        Returns:
            Tuple of (User instance, guest_token for authentication)
        """
        # Generate unique identifiers
        unique_id = uuid.uuid4().hex[:12]
        guest_token = secrets.token_urlsafe(cls.GUEST_TOKEN_LENGTH)

        # Create guest credentials
        username = f'guest_{unique_id}'
        email = f'{username}@{cls.GUEST_EMAIL_DOMAIN}'
        # Generate a random password (user won't use it, but Django requires one)
        temp_password = secrets.token_urlsafe(32)

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=temp_password,
                is_guest=True,
                guest_token=guest_token,
            )

            # Set display name if provided
            if display_name:
                user.first_name = display_name
                user.save(update_fields=['first_name'])

            logger.info(
                f'Created guest user: {username}',
                extra={'user_id': user.id, 'is_guest': True},
            )

        return user, guest_token

    @classmethod
    def get_guest_by_token(cls, guest_token: str) -> User | None:
        """Retrieve a guest user by their guest token.

        Args:
            guest_token: The unique guest token.

        Returns:
            User instance if found, None otherwise.
        """
        try:
            return User.objects.get(guest_token=guest_token, is_guest=True)
        except User.DoesNotExist:
            return None

    @classmethod
    def generate_guest_auth_tokens(cls, user: User) -> dict:
        """Generate JWT tokens for a guest user.

        Args:
            user: Guest user instance.

        Returns:
            Dictionary with 'access', 'refresh', and 'guest_token'.
        """
        tokens = generate_tokens_for_user(user)
        return {
            **tokens,
            'guest_token': user.guest_token,
            'is_guest': True,
        }

    @classmethod
    @transaction.atomic
    def convert_via_oauth(
        cls,
        guest_user: User,
        email: str,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> User:
        """Convert a guest user to a full account via OAuth (no password needed).

        Args:
            guest_user: The guest user to convert.
            email: Email address from OAuth provider.
            first_name: First name from OAuth provider.
            last_name: Last name from OAuth provider.

        Returns:
            Updated User instance.

        Raises:
            ValueError: If user is not a guest or email already exists.
        """
        if not guest_user.is_guest:
            raise ValueError('User is not a guest account.')

        # Check if email is already taken by a different user
        if User.objects.filter(email=email).exclude(pk=guest_user.pk).exists():
            raise ValueError('Email address is already in use.')

        # Generate username from email
        base_username = email.split('@')[0].lower()
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exclude(pk=guest_user.pk).exists():
            username = f'{base_username}{counter}'
            counter += 1

        # Update user
        guest_user.email = email
        guest_user.username = username
        guest_user.is_guest = False
        guest_user.guest_token = ''  # Clear guest token
        guest_user.set_unusable_password()  # OAuth handles auth, no password needed

        # Update name if provided
        if first_name:
            guest_user.first_name = first_name
        if last_name:
            guest_user.last_name = last_name

        guest_user.save(
            update_fields=['email', 'username', 'password', 'is_guest', 'guest_token', 'first_name', 'last_name']
        )

        logger.info(
            f'Converted guest user to full account via OAuth: {username}',
            extra={'user_id': guest_user.id, 'new_username': username},
        )

        return guest_user

    @classmethod
    @transaction.atomic
    def convert_to_full_account(
        cls,
        guest_user: User,
        email: str,
        password: str,
        username: str | None = None,
    ) -> User:
        """Convert a guest user to a full account.

        Args:
            guest_user: The guest user to convert.
            email: New email address for the account.
            password: Password for the account.
            username: Optional new username. If not provided, a new one will be generated.

        Returns:
            Updated User instance.

        Raises:
            ValueError: If user is not a guest or email/username already exists.
        """
        if not guest_user.is_guest:
            raise ValueError('User is not a guest account.')

        # Check if email is already taken
        if User.objects.filter(email=email).exclude(pk=guest_user.pk).exists():
            raise ValueError('Email address is already in use.')

        # Generate or validate username
        if username:
            username = username.lower()
            if User.objects.filter(username=username).exclude(pk=guest_user.pk).exists():
                raise ValueError('Username is already taken.')
        else:
            # Generate a username from email
            base_username = email.split('@')[0].lower()
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exclude(pk=guest_user.pk).exists():
                username = f'{base_username}{counter}'
                counter += 1

        # Update user
        guest_user.email = email
        guest_user.username = username
        guest_user.set_password(password)
        guest_user.is_guest = False
        guest_user.guest_token = ''  # Clear guest token
        guest_user.save(update_fields=['email', 'username', 'password', 'is_guest', 'guest_token'])

        logger.info(
            f'Converted guest user to full account: {username}',
            extra={'user_id': guest_user.id, 'new_username': username},
        )

        return guest_user

    @classmethod
    def accept_battle_invitation_as_guest(
        cls,
        invitation: 'BattleInvitation',
        display_name: str | None = None,
    ) -> tuple[User, dict]:
        """Create a guest user and accept a battle invitation.

        Args:
            invitation: The battle invitation to accept.
            display_name: Optional display name for the guest.

        Returns:
            Tuple of (User instance, auth tokens dict).
        """

        # Create guest user
        guest_user, guest_token = cls.create_guest_user(display_name=display_name)

        # Accept the invitation
        invitation.accept(accepting_user=guest_user)

        # Generate auth tokens
        tokens = cls.generate_guest_auth_tokens(guest_user)

        logger.info(
            'Guest user accepted battle invitation',
            extra={
                'user_id': guest_user.id,
                'invitation_id': invitation.id,
                'battle_id': invitation.battle.id,
            },
        )

        return guest_user, tokens

    @classmethod
    def cleanup_expired_guests(cls, days_old: int = 7) -> int:
        """Delete guest accounts older than specified days that weren't converted.

        Args:
            days_old: Number of days after which to delete guest accounts.

        Returns:
            Number of guest accounts deleted.
        """
        cutoff_date = timezone.now() - timezone.timedelta(days=days_old)
        deleted_count, _ = User.objects.filter(
            is_guest=True,
            date_joined__lt=cutoff_date,
        ).delete()

        if deleted_count > 0:
            logger.info(f'Cleaned up {deleted_count} expired guest accounts')

        return deleted_count
