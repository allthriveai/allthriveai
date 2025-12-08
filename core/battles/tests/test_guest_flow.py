"""
Unit tests for Guest User Battle Flow.

Tests cover:
- Guest user creation
- Battle invitation acceptance as guest
- Guest account conversion to full account
- Guest cleanup functionality
- Security validations (XSS, rate limiting)
"""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.battles.models import (
    BattleInvitation,
    BattlePhase,
    BattleStatus,
    ChallengeType,
    InvitationStatus,
    InvitationType,
    MatchSource,
    PromptBattle,
)
from core.users.models import User
from services.auth import GuestUserService


class GuestUserServiceTestCase(TestCase):
    """Test cases for GuestUserService."""

    def test_create_guest_user(self):
        """Test creating a guest user."""
        user, guest_token = GuestUserService.create_guest_user()

        self.assertTrue(user.is_guest)
        self.assertTrue(user.username.startswith('guest_'))
        self.assertTrue(user.email.endswith('@guest.allthrive.ai'))
        self.assertEqual(len(guest_token), 43)  # Base64 URL-safe 32 bytes
        self.assertEqual(user.guest_token, guest_token)

    def test_create_guest_user_with_display_name(self):
        """Test creating a guest user with a display name."""
        user, _ = GuestUserService.create_guest_user(display_name='TestPlayer')

        self.assertTrue(user.is_guest)
        self.assertEqual(user.first_name, 'TestPlayer')

    def test_get_guest_by_token(self):
        """Test retrieving a guest user by token."""
        user, guest_token = GuestUserService.create_guest_user()

        retrieved_user = GuestUserService.get_guest_by_token(guest_token)

        self.assertEqual(retrieved_user, user)

    def test_get_guest_by_invalid_token(self):
        """Test retrieving with invalid token returns None."""
        result = GuestUserService.get_guest_by_token('invalid_token')

        self.assertIsNone(result)

    def test_convert_to_full_account(self):
        """Test converting a guest account to a full account."""
        guest_user, _ = GuestUserService.create_guest_user()
        original_id = guest_user.id

        converted_user = GuestUserService.convert_to_full_account(
            guest_user=guest_user,
            email='newuser@example.com',
            password='securepass123',
            username='newusername',
        )

        # Same user, just updated
        self.assertEqual(converted_user.id, original_id)
        self.assertFalse(converted_user.is_guest)
        self.assertEqual(converted_user.email, 'newuser@example.com')
        self.assertEqual(converted_user.username, 'newusername')
        self.assertEqual(converted_user.guest_token, '')
        self.assertTrue(converted_user.check_password('securepass123'))

    def test_convert_to_full_account_auto_username(self):
        """Test converting without providing username generates one from email."""
        guest_user, _ = GuestUserService.create_guest_user()

        converted_user = GuestUserService.convert_to_full_account(
            guest_user=guest_user,
            email='john.doe@example.com',
            password='securepass123',
        )

        self.assertEqual(converted_user.username, 'john.doe')

    def test_convert_to_full_account_duplicate_email(self):
        """Test conversion fails with duplicate email."""
        # Create existing user with email
        User.objects.create_user(
            username='existing',
            email='taken@example.com',
            password='testpass',
        )

        guest_user, _ = GuestUserService.create_guest_user()

        with self.assertRaises(ValueError) as context:
            GuestUserService.convert_to_full_account(
                guest_user=guest_user,
                email='taken@example.com',
                password='securepass123',
            )

        self.assertIn('already in use', str(context.exception))

    def test_convert_to_full_account_duplicate_username(self):
        """Test conversion fails with duplicate username."""
        User.objects.create_user(
            username='takenname',
            email='other@example.com',
            password='testpass',
        )

        guest_user, _ = GuestUserService.create_guest_user()

        with self.assertRaises(ValueError) as context:
            GuestUserService.convert_to_full_account(
                guest_user=guest_user,
                email='new@example.com',
                password='securepass123',
                username='takenname',
            )

        self.assertIn('already taken', str(context.exception))

    def test_convert_non_guest_fails(self):
        """Test converting a non-guest account fails."""
        regular_user = User.objects.create_user(
            username='regular',
            email='regular@example.com',
            password='testpass',
        )

        with self.assertRaises(ValueError) as context:
            GuestUserService.convert_to_full_account(
                guest_user=regular_user,
                email='new@example.com',
                password='securepass123',
            )

        self.assertIn('not a guest', str(context.exception))

    def test_cleanup_expired_guests(self):
        """Test cleaning up old guest accounts."""
        # Clean up any existing old guests first
        GuestUserService.cleanup_expired_guests(days_old=7)

        # Create old guest (8 days ago)
        old_guest, _ = GuestUserService.create_guest_user()
        old_guest.date_joined = timezone.now() - timedelta(days=8)
        old_guest.save(update_fields=['date_joined'])

        # Create recent guest (1 day ago)
        recent_guest, _ = GuestUserService.create_guest_user()
        recent_guest.date_joined = timezone.now() - timedelta(days=1)
        recent_guest.save(update_fields=['date_joined'])

        deleted_count = GuestUserService.cleanup_expired_guests(days_old=7)

        self.assertGreaterEqual(deleted_count, 1)
        self.assertFalse(User.objects.filter(id=old_guest.id).exists())
        self.assertTrue(User.objects.filter(id=recent_guest.id).exists())


class GuestBattleInvitationAcceptanceTestCase(TestCase):
    """Test cases for accepting battle invitations as a guest."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()

        # Create sender (inviter)
        self.sender = User.objects.create_user(
            username='sender',
            email='sender@example.com',
            password='testpass123',
        )

        # Create challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Test challenge prompt'],
            variables={},
        )

        # Create battle
        self.battle = PromptBattle.objects.create(
            challenger=self.sender,
            challenge_type=self.challenge_type,
            challenge_text='Test challenge',
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            match_source=MatchSource.INVITATION,
        )

        # Create invitation
        self.invitation = BattleInvitation.objects.create(
            sender=self.sender,
            battle=self.battle,
            recipient_phone='+15551234567',
            invitation_type=InvitationType.SMS,
            status=InvitationStatus.PENDING,
        )

    def test_accept_invitation_as_guest(self):
        """Test accepting an invitation without authentication creates guest user."""
        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('is_guest'))
        self.assertIn('auth', response.data)

        # Verify guest user was created
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, InvitationStatus.ACCEPTED)
        accepting_user = self.invitation.recipient
        self.assertTrue(accepting_user.is_guest)

    def test_accept_invitation_as_guest_with_display_name(self):
        """Test accepting as guest with display name."""
        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})

        response = self.client.post(url, {'display_name': 'Player123'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.invitation.refresh_from_db()
        accepting_user = self.invitation.recipient
        self.assertEqual(accepting_user.first_name, 'Player123')

    def test_accept_invitation_sanitizes_display_name(self):
        """Test that display_name is sanitized to prevent XSS."""
        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})

        # Try to inject script tag
        response = self.client.post(url, {'display_name': '<script>alert("xss")</script>Player'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.invitation.refresh_from_db()
        accepting_user = self.invitation.recipient
        # Should be stripped of HTML tags (bleach keeps text content which is safe)
        self.assertNotIn('<script>', accepting_user.first_name)
        self.assertNotIn('</script>', accepting_user.first_name)
        # Text content remains but is safe without script tags
        self.assertEqual(accepting_user.first_name, 'alert("xss")Player')

    def test_accept_invitation_truncates_long_display_name(self):
        """Test that long display names are truncated."""
        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})

        long_name = 'A' * 100  # 100 characters
        response = self.client.post(url, {'display_name': long_name})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.invitation.refresh_from_db()
        accepting_user = self.invitation.recipient
        self.assertEqual(len(accepting_user.first_name), 50)  # Truncated to 50

    def test_accept_invitation_as_authenticated_user(self):
        """Test accepting an invitation as authenticated user."""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=other_user)

        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('is_guest', response.data)

        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.recipient, other_user)
        self.assertFalse(other_user.is_guest)

    def test_cannot_accept_own_invitation(self):
        """Test that sender cannot accept their own invitation."""
        self.client.force_authenticate(user=self.sender)

        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot accept your own', response.data['error'])

    def test_accept_expired_invitation_fails(self):
        """Test accepting an expired invitation fails."""
        self.invitation.expires_at = timezone.now() - timedelta(hours=1)
        self.invitation.save(update_fields=['expires_at'])

        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data['error'])

    def test_accept_already_accepted_invitation_fails(self):
        """Test accepting an already accepted invitation fails."""
        self.invitation.status = InvitationStatus.ACCEPTED
        self.invitation.save(update_fields=['status'])

        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been responded', response.data['error'])

    def test_accept_invalid_token_fails(self):
        """Test accepting with invalid token returns 404."""
        url = reverse('accept_invitation_by_token', kwargs={'token': 'invalid_token_12345'})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class GuestAccountConversionAPITestCase(TestCase):
    """Test cases for the guest account conversion API endpoint."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()

        # Create guest user
        self.guest_user, self.guest_token = GuestUserService.create_guest_user()

    def test_convert_guest_account(self):
        """Test successful guest account conversion."""
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'newuser@example.com',
                'password': 'securepass123',
                'username': 'newusername',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        self.guest_user.refresh_from_db()
        self.assertFalse(self.guest_user.is_guest)
        self.assertEqual(self.guest_user.email, 'newuser@example.com')

    def test_convert_guest_requires_email(self):
        """Test conversion requires email."""
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'password': 'securepass123',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Email is required', response.data['error'])

    def test_convert_guest_requires_password(self):
        """Test conversion requires password."""
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'newuser@example.com',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Password must be at least 8 characters', response.data['error'])

    def test_convert_guest_password_min_length(self):
        """Test password must be at least 8 characters."""
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'newuser@example.com',
                'password': 'short',  # Too short
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Password must be at least 8 characters', response.data['error'])

    def test_convert_guest_validates_email_format(self):
        """Test email format is validated."""
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'not-an-email',
                'password': 'securepass123',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('valid email', response.data['error'])

    def test_convert_non_guest_fails(self):
        """Test converting a non-guest account fails."""
        regular_user = User.objects.create_user(
            username='regular',
            email='regular@example.com',
            password='testpass',
        )
        self.client.force_authenticate(user=regular_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'new@example.com',
                'password': 'securepass123',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already a full account', response.data['error'])

    def test_convert_guest_duplicate_email_conflict(self):
        """Test conversion with duplicate email returns 409."""
        User.objects.create_user(
            username='existing',
            email='taken@example.com',
            password='testpass',
        )
        self.client.force_authenticate(user=self.guest_user)

        url = reverse('convert_guest_account')
        response = self.client.post(
            url,
            {
                'email': 'taken@example.com',
                'password': 'securepass123',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)


class GuestCleanupTaskTestCase(TestCase):
    """Test cases for guest cleanup Celery task."""

    def test_cleanup_task_deletes_old_guests(self):
        """Test cleanup task deletes guests older than threshold."""
        from core.battles.tasks import cleanup_expired_guest_accounts

        # Clean up any existing old guests first
        GuestUserService.cleanup_expired_guests(days_old=7)

        # Create old guest
        old_guest, _ = GuestUserService.create_guest_user()
        old_guest.date_joined = timezone.now() - timedelta(days=10)
        old_guest.save(update_fields=['date_joined'])
        old_guest_id = old_guest.id

        # Create recent guest
        recent_guest, _ = GuestUserService.create_guest_user()
        recent_guest_id = recent_guest.id

        result = cleanup_expired_guest_accounts(days_old=7)

        self.assertEqual(result['status'], 'success')
        self.assertGreaterEqual(result['deleted_count'], 1)
        self.assertFalse(User.objects.filter(id=old_guest_id).exists())
        self.assertTrue(User.objects.filter(id=recent_guest_id).exists())
