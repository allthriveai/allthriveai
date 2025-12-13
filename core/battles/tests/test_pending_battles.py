"""
Unit tests for pending_battles endpoint.

Tests the /api/battles/pending/ endpoint which returns
user's active async battles grouped by status.
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
    BattleSubmission,
    ChallengeType,
    InvitationStatus,
    InvitationType,
    PromptBattle,
)
from core.users.models import User


class PendingBattlesEndpointTestCase(TestCase):
    """Test cases for the pending_battles view."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()

        # Create users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='testuser1@example.com',
            password='testpass123',
        )
        self.user2 = User.objects.create_user(
            username='testuser2',
            email='testuser2@example.com',
            password='testpass123',
        )
        self.user3 = User.objects.create_user(
            username='testuser3',
            email='testuser3@example.com',
            password='testpass123',
        )

        # Create challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge for unit tests',
            templates=['Test challenge: {style}'],
            variables={'style': ['simple', 'complex']},
        )

        self.url = reverse('pending_battles')

    def test_unauthenticated_request_returns_401(self):
        """Test that unauthenticated users cannot access the endpoint."""
        response = self.client.get(self.url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_empty_response_when_no_battles(self):
        """Test that endpoint returns empty lists when user has no battles."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['your_turn'], [])
        self.assertEqual(response.data['their_turn'], [])
        self.assertEqual(response.data['judging'], [])
        self.assertEqual(response.data['pending_invitations'], [])
        self.assertEqual(response.data['recently_completed'], [])
        self.assertEqual(response.data['counts']['total_active'], 0)

    def test_pending_invitation_appears_in_pending_invitations(self):
        """Test that battles without opponents appear in pending_invitations."""
        self.client.force_authenticate(user=self.user1)

        # Create battle with no opponent (pending invitation)
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=None,  # No opponent yet
            challenge_text='Pending invitation battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
        )

        # Create invitation
        BattleInvitation.objects.create(
            battle=battle,
            sender=self.user1,
            invitation_type=InvitationType.LINK,
            invite_token='test_token_123',
            status=InvitationStatus.PENDING,
            expires_at=timezone.now() + timedelta(days=1),
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['pending_invitations']), 1)
        self.assertEqual(response.data['pending_invitations'][0]['id'], battle.id)
        self.assertEqual(response.data['pending_invitations'][0]['status'], 'pending_invitation')
        self.assertEqual(response.data['counts']['pending_invitations'], 1)

    def test_your_turn_battle_appears_correctly(self):
        """Test that battles where it's the user's turn appear in your_turn."""
        self.client.force_authenticate(user=self.user1)

        # Create active battle where user1 hasn't submitted
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Your turn battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            current_turn_user=self.user1,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['your_turn']), 1)
        self.assertEqual(response.data['your_turn'][0]['id'], battle.id)
        self.assertEqual(response.data['your_turn'][0]['status'], 'your_turn')
        self.assertEqual(response.data['counts']['your_turn'], 1)

    def test_their_turn_battle_appears_correctly(self):
        """Test that battles where user is waiting appear in their_turn."""
        self.client.force_authenticate(user=self.user1)

        # Create active battle where user1 has submitted but user2 hasn't
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Their turn battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            current_turn_user=self.user2,
        )

        # User1 has submitted
        BattleSubmission.objects.create(
            battle=battle,
            user=self.user1,
            prompt_text='My submission',
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['their_turn']), 1)
        self.assertEqual(response.data['their_turn'][0]['id'], battle.id)
        self.assertEqual(response.data['their_turn'][0]['status'], 'their_turn')
        self.assertEqual(response.data['counts']['their_turn'], 1)

    def test_judging_battle_appears_in_judging(self):
        """Test that battles being judged appear in judging list."""
        self.client.force_authenticate(user=self.user1)

        # Create battle in judging phase
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Judging battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.JUDGING,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['judging']), 1)
        self.assertEqual(response.data['judging'][0]['id'], battle.id)
        self.assertEqual(response.data['counts']['judging'], 1)

    def test_recently_completed_battles_included(self):
        """Test that battles completed within 7 days appear in recently_completed."""
        self.client.force_authenticate(user=self.user1)

        # Create recently completed battle
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Completed battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.COMPLETED,
            phase=BattlePhase.REVEAL,
            winner=self.user1,
            completed_at=timezone.now() - timedelta(days=2),
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['recently_completed']), 1)
        self.assertEqual(response.data['recently_completed'][0]['id'], battle.id)

    def test_old_completed_battles_not_included(self):
        """Test that battles completed more than 7 days ago are excluded."""
        self.client.force_authenticate(user=self.user1)

        # Create old completed battle
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Old completed battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.COMPLETED,
            phase=BattlePhase.REVEAL,
            winner=self.user1,
            completed_at=timezone.now() - timedelta(days=10),
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['recently_completed']), 0)

    def test_battles_from_other_users_not_included(self):
        """Test that battles from other users are not included."""
        self.client.force_authenticate(user=self.user1)

        # Create battle between user2 and user3 (not involving user1)
        PromptBattle.objects.create(
            challenger=self.user2,
            opponent=self.user3,
            challenge_text='Other users battle',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['counts']['total_active'], 0)

    def test_counts_are_accurate(self):
        """Test that counts match the actual number of battles in each category."""
        self.client.force_authenticate(user=self.user1)

        # Create multiple battles in different states
        # 2 pending invitations
        for i in range(2):
            PromptBattle.objects.create(
                challenger=self.user1,
                opponent=None,
                challenge_text=f'Pending invitation {i}',
                challenge_type=self.challenge_type,
                status=BattleStatus.PENDING,
                phase=BattlePhase.WAITING,
            )

        # 3 your_turn battles
        for i in range(3):
            PromptBattle.objects.create(
                challenger=self.user1,
                opponent=self.user2,
                challenge_text=f'Your turn {i}',
                challenge_type=self.challenge_type,
                status=BattleStatus.ACTIVE,
                phase=BattlePhase.ACTIVE,
                current_turn_user=self.user1,
            )

        # 1 their_turn battle
        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Their turn',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            current_turn_user=self.user2,
        )
        BattleSubmission.objects.create(
            battle=battle,
            user=self.user1,
            prompt_text='Submitted',
        )

        # 1 judging battle
        PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Judging',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.JUDGING,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['counts']['pending_invitations'], 2)
        self.assertEqual(response.data['counts']['your_turn'], 3)
        self.assertEqual(response.data['counts']['their_turn'], 1)
        self.assertEqual(response.data['counts']['judging'], 1)
        self.assertEqual(response.data['counts']['total_active'], 7)

    def test_response_includes_opponent_info(self):
        """Test that battle response includes opponent information."""
        self.client.force_authenticate(user=self.user1)

        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Battle with opponent info',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            current_turn_user=self.user1,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['your_turn']), 1)

        battle_data = response.data['your_turn'][0]
        self.assertIn('opponent', battle_data)
        self.assertEqual(battle_data['opponent']['username'], 'testuser2')

    def test_response_includes_challenge_type_info(self):
        """Test that battle response includes challenge type information."""
        self.client.force_authenticate(user=self.user1)

        battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Battle with challenge type',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            current_turn_user=self.user1,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        battle_data = response.data['your_turn'][0]
        self.assertIn('challenge_type', battle_data)
        self.assertEqual(battle_data['challenge_type']['key'], 'test_challenge')
        self.assertEqual(battle_data['challenge_type']['name'], 'Test Challenge')
