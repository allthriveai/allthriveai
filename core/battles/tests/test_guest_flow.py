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
    InvitationStatus,
    InvitationType,
    MatchSource,
    PromptBattle,
    PromptChallengePrompt,
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

        # Create curated prompt
        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        # Create battle
        self.battle = PromptBattle.objects.create(
            challenger=self.sender,
            prompt=self.prompt,
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
        """Test accepting an already accepted invitation fails for different user."""
        self.invitation.status = InvitationStatus.ACCEPTED
        self.invitation.save(update_fields=['status'])

        url = reverse('accept_invitation_by_token', kwargs={'token': self.invitation.invite_token})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been accepted', response.data['error'])

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


class LinkInvitationE2ETestCase(TestCase):
    """End-to-end tests for shareable link invitation flow.

    Tests the complete flow:
    1. Authenticated user generates a shareable battle link
    2. Anyone can view invitation details via the link
    3. Guest user accepts the invitation and joins the battle
    4. Battle starts with both players
    5. Guest can convert to full account after battle
    """

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()

        # Create the challenger (link creator)
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        # Create curated prompt
        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create something amazing for link invitations',
            difficulty='medium',
            is_active=True,
        )

    def test_full_link_invitation_flow_guest_user(self):
        """Test complete flow: generate link -> guest accepts -> battle starts."""
        # Step 1: Challenger generates a shareable link
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('invite_url', response.data)
        self.assertIn('invite_token', response.data)
        self.assertIn('invitation', response.data)

        invite_token = response.data['invite_token']
        invitation_id = response.data['invitation']['id']

        # Verify invitation was created with LINK type
        invitation = BattleInvitation.objects.get(id=invitation_id)
        self.assertEqual(invitation.invitation_type, InvitationType.LINK)
        self.assertEqual(invitation.sender, self.challenger)
        self.assertIsNone(invitation.recipient)  # No recipient yet
        self.assertEqual(invitation.status, InvitationStatus.PENDING)

        # Step 2: View invitation details (unauthenticated)
        self.client.logout()
        view_url = reverse('invitation_by_token', kwargs={'token': invite_token})

        response = self.client.get(view_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sender']['username'], 'challenger')
        self.assertIn('challenge_text', response.data['battle'])
        self.assertIn('expires_at', response.data)

        # Step 3: Guest accepts the invitation
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})

        response = self.client.post(
            accept_url,
            {
                'display_name': 'GuestChallenger',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('is_guest'))
        self.assertIn('auth', response.data)
        self.assertIn('id', response.data)  # Battle ID is returned as 'id'

        # Verify guest user was created
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, InvitationStatus.ACCEPTED)
        guest_user = invitation.recipient
        self.assertIsNotNone(guest_user)
        self.assertTrue(guest_user.is_guest)
        self.assertEqual(guest_user.first_name, 'GuestChallenger')

        # Step 4: Verify battle started with both players
        battle = invitation.battle
        battle.refresh_from_db()
        self.assertEqual(battle.challenger, self.challenger)
        self.assertEqual(battle.opponent, guest_user)
        self.assertEqual(battle.status, BattleStatus.ACTIVE)
        # Battle is now active with both players - phase may vary based on config

        # Step 5: Guest converts to full account
        self.client.force_authenticate(user=guest_user)
        convert_url = reverse('convert_guest_account')

        response = self.client.post(
            convert_url,
            {
                'email': 'newplayer@example.com',
                'password': 'securepass123',
                'username': 'newplayer',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        guest_user.refresh_from_db()
        self.assertFalse(guest_user.is_guest)
        self.assertEqual(guest_user.email, 'newplayer@example.com')
        self.assertEqual(guest_user.username, 'newplayer')

    def test_full_link_invitation_flow_authenticated_user(self):
        """Test flow when an authenticated user accepts the link."""
        # Create another user who will accept the invitation
        opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        # Step 1: Challenger generates link
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invite_token = response.data['invite_token']

        # Step 2: Authenticated opponent accepts
        self.client.force_authenticate(user=opponent)
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})

        response = self.client.post(accept_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('is_guest', response.data)  # Not a guest flow
        self.assertIn('id', response.data)  # Battle ID is returned as 'id'

        # Verify battle has both players
        invitation = BattleInvitation.objects.get(invite_token=invite_token)
        battle = invitation.battle
        battle.refresh_from_db()

        self.assertEqual(battle.challenger, self.challenger)
        self.assertEqual(battle.opponent, opponent)
        self.assertEqual(battle.status, BattleStatus.ACTIVE)

    def test_generate_link_requires_authentication(self):
        """Test that generating a link requires authentication."""
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_accept_own_link_invitation(self):
        """Test that challenger cannot accept their own link."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        invite_token = response.data['invite_token']

        # Try to accept own invitation
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(accept_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot accept your own', response.data['error'])

    def test_link_invitation_expires(self):
        """Test that expired link invitations cannot be accepted."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        invite_token = response.data['invite_token']

        # Expire the invitation
        invitation = BattleInvitation.objects.get(invite_token=invite_token)
        invitation.expires_at = timezone.now() - timedelta(hours=1)
        invitation.save(update_fields=['expires_at'])

        # Try to accept expired invitation
        self.client.logout()
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(accept_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data['error'])

    def test_link_invitation_idempotent_for_same_user(self):
        """Test that accepting invitation again returns battle for same user (idempotency)."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        invite_token = response.data['invite_token']

        # First acceptance (as guest)
        self.client.logout()
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(accept_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first_battle_id = response.data['id']

        # Second acceptance attempt by same user (authenticated via cookies from first request)
        # Should return the same battle (idempotency feature)
        response = self.client.post(accept_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], first_battle_id)

    def test_link_invitation_rejected_for_different_user(self):
        """Test that a different user cannot accept an already-accepted invitation."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        invite_token = response.data['invite_token']

        # First acceptance (as guest)
        self.client.logout()
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(accept_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Create and authenticate a different user
        other_user = User.objects.create_user(
            username='other_user',
            email='other@example.com',
            password='testpassword123',
        )
        self.client.force_authenticate(user=other_user)

        # Second acceptance attempt by different user should fail
        response = self.client.post(accept_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been accepted', response.data['error'])

    def test_invalid_link_token_returns_404(self):
        """Test that invalid token returns 404."""
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': 'invalid_token_xyz'})
        response = self.client.post(accept_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_view_invalid_link_token_returns_404(self):
        """Test that viewing invalid token returns 404."""
        view_url = reverse('invitation_by_token', kwargs={'token': 'invalid_token_xyz'})
        response = self.client.get(view_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_link_with_specific_category(self):
        """Test generating link with a specific category filters prompts."""
        from core.taxonomy.models import Taxonomy

        # Create a category taxonomy and a prompt with that category
        category = Taxonomy.objects.create(
            name='Test Category',
            slug='test-category',
            taxonomy_type='category',
        )
        categorized_prompt = PromptChallengePrompt.objects.create(
            prompt_text='Categorized challenge prompt',
            difficulty='medium',
            is_active=True,
            category=category,
        )

        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(
            generate_url,
            {
                'category_id': category.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        invitation = BattleInvitation.objects.get(invite_token=response.data['invite_token'])
        # The battle should have a prompt from that category
        self.assertEqual(invitation.battle.prompt.category, category)

    def test_generate_link_with_invalid_category(self):
        """Test generating link with invalid category ID fails with no prompts."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(
            generate_url,
            {
                'category_id': 99999,  # Non-existent category
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # When category doesn't exist, no prompts will match and we get this error
        self.assertIn('No prompts available', response.data['error'])

    def test_guest_display_name_sanitized_in_link_flow(self):
        """Test that XSS in display name is sanitized during link acceptance."""
        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        response = self.client.post(generate_url)
        invite_token = response.data['invite_token']

        # Accept with malicious display name
        self.client.logout()
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(
            accept_url,
            {
                'display_name': '<img src=x onerror=alert(1)>Hacker',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invitation = BattleInvitation.objects.get(invite_token=invite_token)
        guest_user = invitation.recipient
        # HTML tags should be stripped
        self.assertNotIn('<img', guest_user.first_name)
        self.assertNotIn('onerror', guest_user.first_name)

    def test_guest_can_accept_after_challenger_starts_turn(self):
        """Test that guest can accept invitation after challenger starts their turn (async battle).

        This tests the scenario where:
        1. Challenger creates battle with invite link
        2. Challenger starts their turn (changes status to ACTIVE, phase to CHALLENGER_TURN)
        3. Guest clicks invite link and should still be able to join
        """
        from core.battles.models import BattlePhase, BattleStatus

        self.client.force_authenticate(user=self.challenger)
        generate_url = reverse('generate_battle_link')

        # Create battle with invite link
        response = self.client.post(generate_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invite_token = response.data['invite_token']

        # Get the battle and simulate challenger starting their turn
        invitation = BattleInvitation.objects.get(invite_token=invite_token)
        battle = invitation.battle

        # Challenger starts their turn (this happens when they click "Start Your Turn")
        battle.start_turn(self.challenger)
        battle.refresh_from_db()

        # Verify battle is now ACTIVE with CHALLENGER_TURN phase
        self.assertEqual(battle.status, BattleStatus.ACTIVE)
        self.assertEqual(battle.phase, BattlePhase.CHALLENGER_TURN)

        # Guest accepts the invitation (unauthenticated)
        self.client.logout()
        accept_url = reverse('accept_invitation_by_token', kwargs={'token': invite_token})
        response = self.client.post(accept_url)

        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('id', response.data)

        # Verify battle has opponent set
        battle.refresh_from_db()
        self.assertIsNotNone(battle.opponent)
        self.assertTrue(battle.opponent.is_guest)

        # Battle should still be active with challenger's turn
        self.assertEqual(battle.status, BattleStatus.ACTIVE)
        self.assertEqual(battle.phase, BattlePhase.CHALLENGER_TURN)
