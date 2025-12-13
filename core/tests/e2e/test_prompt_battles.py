"""
End-to-End Tests for Prompt Battles.

MISSION CRITICAL: Prompt battles must work correctly for user engagement.

These tests are SKIPPED by default in regular test runs and CI.
Run explicitly with: RUN_E2E_TESTS=1 pytest core/tests/e2e/test_prompt_battles.py -v
"""

import os

import pytest
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.battles.models import (
    BattleInvitation,
    BattlePhase,
    BattleStatus,
    ChallengeType,
    InvitationType,
    PromptBattle,
)
from core.users.models import User

# Skip these tests unless explicitly enabled
SKIP_E2E = os.environ.get('RUN_E2E_TESTS', '').lower() not in ('1', 'true', 'yes')
SKIP_REASON = 'E2E tests skipped by default. Set RUN_E2E_TESTS=1 to run.'


def setUpModule():
    """Print section header when this module runs."""
    if SKIP_E2E:
        return
    print('\n')
    print('=' * 70)
    print('  PROMPT BATTLES - Mission Critical Tests')
    print('=' * 70)
    print()


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class BattleShareLinkTest(TestCase):
    """
    Test battle share link generation flow.

    SCENARIO: when a logged in user goes to /battles and clicks battle a human,
              then clicks share a link, a validated link appears for the user
    EXPECTED: a validated clickable link appears for the user
    FAILURE: no link is generated
    """

    def setUp(self):
        """Create test user and challenge type."""
        self.client = APIClient()

        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        # Create a challenge type for battles
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge for battles',
            templates=['Create an image of {subject}'],
            variables={'subject': ['a cat', 'a dog', 'a bird']},
            is_active=True,
        )

    def test_share_link_generates_valid_url(self):
        """
        CRITICAL: Share link MUST generate a valid invite URL.

        SCENARIO: User is logged in and clicks "Share a Link" to battle
        EXPECTED: API returns a valid invite_url that can be shared
        FAILURE: No invite_url returned or URL is invalid
        """
        # Authenticate user
        self.client.force_authenticate(user=self.user)

        # Generate battle link
        response = self.client.post(
            '/api/v1/battles/invitations/generate-link/',
            {},
            format='json',
        )

        # Must return 201 Created
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: Generate link failed with {response.status_code}. ' f'Response: {response.data}',
        )

        # Must have invite_url in response
        self.assertIn(
            'invite_url',
            response.data,
            'CRITICAL: Response must contain invite_url field. ' f'Got: {response.data.keys()}',
        )

        # invite_url must be a non-empty string
        invite_url = response.data['invite_url']
        self.assertIsInstance(
            invite_url,
            str,
            f'CRITICAL: invite_url must be a string, got {type(invite_url)}',
        )
        self.assertTrue(
            len(invite_url) > 0,
            'CRITICAL: invite_url must not be empty',
        )

        # URL must contain the invite token path
        self.assertIn(
            '/battle/invite/',
            invite_url,
            f'CRITICAL: invite_url must contain /battle/invite/ path. Got: {invite_url}',
        )

        # Must also return invite_token
        self.assertIn(
            'invite_token',
            response.data,
            'CRITICAL: Response must contain invite_token for verification',
        )

        # Verify the invitation was created in database
        token = response.data['invite_token']
        invitation = BattleInvitation.objects.filter(invite_token=token).first()
        self.assertIsNotNone(
            invitation,
            'CRITICAL: Invitation must be saved to database',
        )

        # Invitation must be a LINK type
        self.assertEqual(
            invitation.invitation_type,
            InvitationType.LINK,
            f'CRITICAL: Invitation must be LINK type, got {invitation.invitation_type}',
        )

    def test_share_link_creates_battle_with_challenge(self):
        """
        CRITICAL: Generated battle link must have an associated battle with challenge.

        SCENARIO: Share link is generated
        EXPECTED: Battle is created with a valid challenge_text
        FAILURE: No battle created or no challenge text
        """
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/battles/invitations/generate-link/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify battle was created
        token = response.data['invite_token']
        invitation = BattleInvitation.objects.get(invite_token=token)
        battle = invitation.battle

        self.assertIsNotNone(
            battle,
            'CRITICAL: Battle must be created with invitation',
        )
        self.assertTrue(
            len(battle.challenge_text) > 0,
            'CRITICAL: Battle must have a challenge_text',
        )
        self.assertEqual(
            battle.status,
            BattleStatus.PENDING,
            'CRITICAL: Battle must start in PENDING status',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class BattleEntryTest(TestCase):
    """
    Test battle entry flow when clicking a share link.

    SCENARIO: when a logged in user clicks the validated share link
    EXPECTED: they are entered into a battle with countdown clock, prompt,
              and does not require a guest user to start
    FAILURE: no prompt battle displays
    """

    def setUp(self):
        """Create test users and battle invitation."""
        self.client = APIClient()

        # Create challenger (person who shared the link)
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        # Create opponent (person clicking the link)
        self.opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        # Create a challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image of {subject}'],
            variables={'subject': ['a sunset']},
            is_active=True,
        )

        # Create battle and invitation
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,  # Will be set when opponent accepts
            challenge_text='Create an image of a sunset',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        self.invitation = BattleInvitation.objects.create(
            battle=self.battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

    def test_accepting_link_starts_battle_with_prompt(self):
        """
        CRITICAL: Accepting share link MUST start battle with countdown and prompt.

        SCENARIO: Logged-in user clicks share link and accepts
        EXPECTED: Battle starts with challenge_text visible, has countdown
        FAILURE: Battle doesn't start or no prompt displayed
        """
        # Authenticate as opponent
        self.client.force_authenticate(user=self.opponent)

        # Accept the invitation
        response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        # Must return success
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Accept invitation failed. Response: {response.data}',
        )

        # Response must contain battle data
        self.assertIn(
            'id',
            response.data,
            'CRITICAL: Response must contain battle id',
        )

        # Battle must have challenge_text (the prompt)
        self.assertIn(
            'challenge_text',
            response.data,
            'CRITICAL: Battle response must contain challenge_text (prompt)',
        )
        self.assertTrue(
            len(response.data['challenge_text']) > 0,
            'CRITICAL: challenge_text must not be empty',
        )

        # Battle must be ACTIVE status
        self.assertEqual(
            response.data['status'],
            BattleStatus.ACTIVE,
            f'CRITICAL: Battle must be ACTIVE after accepting. Got: {response.data.get("status")}',
        )

        # Battle must have time_remaining (countdown)
        self.assertIn(
            'time_remaining',
            response.data,
            'CRITICAL: Battle must have time_remaining for countdown',
        )

        # Verify in database
        self.battle.refresh_from_db()
        self.assertEqual(
            self.battle.status,
            BattleStatus.ACTIVE,
            'CRITICAL: Battle status must be ACTIVE in database',
        )
        self.assertEqual(
            self.battle.opponent,
            self.opponent,
            'CRITICAL: Opponent must be set on battle',
        )
        self.assertIsNotNone(
            self.battle.started_at,
            'CRITICAL: Battle must have started_at timestamp',
        )
        self.assertIsNotNone(
            self.battle.expires_at,
            'CRITICAL: Battle must have expires_at for countdown',
        )

    def test_authenticated_user_does_not_need_guest_flow(self):
        """
        CRITICAL: Authenticated users should NOT go through guest flow.

        SCENARIO: Logged-in user accepts battle invitation
        EXPECTED: No guest account created, user joins directly
        FAILURE: User incorrectly goes through guest registration
        """
        self.client.force_authenticate(user=self.opponent)

        response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Response should NOT have auth tokens (that's for guests)
        self.assertNotIn(
            'auth',
            response.data,
            'CRITICAL: Authenticated users should not receive auth tokens',
        )
        self.assertNotIn(
            'is_guest',
            response.data,
            'CRITICAL: Authenticated users should not have is_guest flag',
        )

        # Verify opponent was set directly (not a new guest user)
        self.battle.refresh_from_db()
        self.assertEqual(
            self.battle.opponent.id,
            self.opponent.id,
            'CRITICAL: Opponent should be the authenticated user, not a guest',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class BattleSubmitTest(TestCase):
    """
    Test battle submission flow.

    SCENARIO: when a user enters into the battle they can click submit
              and their battle submits
    EXPECTED: battle submission is saved successfully
    FAILURE: submit fails
    """

    def setUp(self):
        """Create test users and active battle."""
        self.client = APIClient()

        # Create users
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        self.opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        # Create challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image'],
            is_active=True,
        )

        # Create an ACTIVE battle (already started)
        from django.utils import timezone

        now = timezone.now()
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Create an amazing AI-generated image',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            duration_minutes=3,
            started_at=now,
            expires_at=now + timezone.timedelta(minutes=3),
        )

    def test_user_can_submit_prompt(self):
        """
        CRITICAL: User MUST be able to submit their prompt in active battle.

        SCENARIO: User is in active battle and submits their prompt
        EXPECTED: Submission is saved and returned
        FAILURE: Submit fails or submission not saved
        """
        self.client.force_authenticate(user=self.challenger)

        prompt_text = 'A beautiful sunset over mountains with vibrant orange and purple colors'

        response = self.client.post(
            f'/api/v1/me/battles/{self.battle.id}/submit/',
            {'prompt_text': prompt_text},
            format='json',
        )

        # Must return 201 Created
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: Submit failed with {response.status_code}. ' f'Response: {response.data}',
        )

        # Response must contain submission data
        self.assertIn(
            'id',
            response.data,
            'CRITICAL: Response must contain submission id',
        )
        self.assertIn(
            'prompt_text',
            response.data,
            'CRITICAL: Response must contain prompt_text',
        )

        # Prompt text must match what was submitted
        self.assertEqual(
            response.data['prompt_text'],
            prompt_text,
            'CRITICAL: Saved prompt_text must match submitted text',
        )

        # Verify submission saved to database
        from core.battles.models import BattleSubmission

        submission = BattleSubmission.objects.filter(
            battle=self.battle,
            user=self.challenger,
        ).first()

        self.assertIsNotNone(
            submission,
            'CRITICAL: Submission must be saved to database',
        )
        self.assertEqual(
            submission.prompt_text,
            prompt_text,
            'CRITICAL: Database submission must have correct prompt_text',
        )

    def test_both_users_can_submit(self):
        """
        CRITICAL: Both challenger and opponent MUST be able to submit.

        SCENARIO: Both users submit their prompts
        EXPECTED: Both submissions are saved
        FAILURE: One or both submissions fail
        """
        challenger_prompt = 'A mystical forest with glowing mushrooms'
        opponent_prompt = 'A futuristic city with flying cars'

        # Challenger submits
        self.client.force_authenticate(user=self.challenger)
        response1 = self.client.post(
            f'/api/v1/me/battles/{self.battle.id}/submit/',
            {'prompt_text': challenger_prompt},
            format='json',
        )
        self.assertEqual(
            response1.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: Challenger submit failed: {response1.data}',
        )

        # Opponent submits
        self.client.force_authenticate(user=self.opponent)
        response2 = self.client.post(
            f'/api/v1/me/battles/{self.battle.id}/submit/',
            {'prompt_text': opponent_prompt},
            format='json',
        )
        self.assertEqual(
            response2.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: Opponent submit failed: {response2.data}',
        )

        # Verify both submissions exist
        from core.battles.models import BattleSubmission

        submissions = BattleSubmission.objects.filter(battle=self.battle)
        self.assertEqual(
            submissions.count(),
            2,
            'CRITICAL: Both users must have submissions saved',
        )

    def test_non_participant_cannot_submit(self):
        """
        CRITICAL: Non-participants MUST NOT be able to submit.

        SCENARIO: Random user tries to submit to a battle they're not in
        EXPECTED: Request is rejected with 403
        FAILURE: Submission is allowed for non-participant
        """
        # Create a random user
        random_user = User.objects.create_user(
            username='random',
            email='random@example.com',
            password='testpass123',
        )

        self.client.force_authenticate(user=random_user)

        response = self.client.post(
            f'/api/v1/me/battles/{self.battle.id}/submit/',
            {'prompt_text': 'Trying to cheat'},
            format='json',
        )

        # Must be rejected
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
            f'CRITICAL: Non-participant submission must be rejected. ' f'Got: {response.status_code}',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class GuestUserBattleTest(TestCase):
    """
    Test guest user battle flow.

    SCENARIO: As a guest user who receives a prompt battle link, when I enter the battle
    EXPECTED: I should see a countdown timer and successfully submit my prompt
    FAILURE: I can't submit my prompt
    """

    def setUp(self):
        """Create test challenger and battle invitation."""
        self.client = APIClient()

        # Create challenger (person who shared the link)
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        # Create a challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image of {subject}'],
            variables={'subject': ['a sunset']},
            is_active=True,
        )

        # Create battle and invitation for guest flow
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,  # Will be set when guest accepts
            challenge_text='Create an amazing sunset image',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        self.invitation = BattleInvitation.objects.create(
            battle=self.battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

    def test_guest_can_accept_invitation_and_see_countdown(self):
        """
        CRITICAL: Guest user MUST be able to accept invitation via link.

        SCENARIO: Guest (unauthenticated) clicks battle invite link
        EXPECTED: Guest account created, battle starts with countdown and prompt
        FAILURE: Guest cannot enter battle or no countdown shown
        """
        # Make unauthenticated request (guest flow)
        response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {'display_name': 'Guest Player'},
            format='json',
        )

        # Must return success
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest accept invitation failed. Response: {response.data}',
        )

        # Must include auth tokens for guest
        self.assertIn(
            'auth',
            response.data,
            'CRITICAL: Guest must receive auth tokens',
        )

        # Must mark as guest
        self.assertTrue(
            response.data.get('is_guest', False),
            'CRITICAL: Response must indicate is_guest=True',
        )

        # Battle must have challenge_text (prompt)
        self.assertIn(
            'challenge_text',
            response.data,
            'CRITICAL: Battle response must contain challenge_text (prompt)',
        )
        self.assertTrue(
            len(response.data['challenge_text']) > 0,
            'CRITICAL: challenge_text must not be empty',
        )

        # Battle must have time_remaining (countdown)
        self.assertIn(
            'time_remaining',
            response.data,
            'CRITICAL: Battle must have time_remaining for countdown timer',
        )

        # Battle must be ACTIVE
        self.assertEqual(
            response.data['status'],
            BattleStatus.ACTIVE,
            f'CRITICAL: Battle must be ACTIVE. Got: {response.data.get("status")}',
        )

    def test_guest_can_submit_prompt_after_accepting(self):
        """
        CRITICAL: Guest user MUST be able to submit their prompt.

        SCENARIO: Guest accepts invitation and then submits prompt
        EXPECTED: Submission is saved successfully
        FAILURE: Guest cannot submit prompt
        """
        # Step 1: Accept invitation as guest
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {'display_name': 'Guest Player'},
            format='json',
        )

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)

        # Extract auth token from response
        auth_data = accept_response.data.get('auth', {})
        access_token = auth_data.get('access')

        self.assertIsNotNone(
            access_token,
            'CRITICAL: Guest must receive access token',
        )

        # Step 2: Battle starts in COUNTDOWN, transition to ACTIVE for submission
        # (In real app, this happens after countdown timer completes)
        battle_id = accept_response.data['id']
        battle = PromptBattle.objects.get(id=battle_id)
        battle.phase = BattlePhase.ACTIVE
        battle.save(update_fields=['phase'])

        # Step 3: Submit prompt using guest's auth token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        prompt_text = 'A vibrant sunset with purple and orange sky over the ocean'

        submit_response = self.client.post(
            f'/api/v1/me/battles/{battle_id}/submit/',
            {'prompt_text': prompt_text},
            format='json',
        )

        # Must return 201 Created
        self.assertEqual(
            submit_response.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: Guest submit failed with {submit_response.status_code}. ' f'Response: {submit_response.data}',
        )

        # Verify submission saved
        self.assertIn(
            'prompt_text',
            submit_response.data,
            'CRITICAL: Response must contain prompt_text',
        )
        self.assertEqual(
            submit_response.data['prompt_text'],
            prompt_text,
            'CRITICAL: Saved prompt must match submitted text',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class BattleShareResultsTest(TestCase):
    """
    Test battle share results functionality.

    SCENARIO: After finishing a battle, user clicks share results
    EXPECTED: Share data contains battle-specific info, not generic AllThrive text
    FAILURE: Share shows generic AllThrive text and logo instead of battle info
    """

    def setUp(self):
        """Create completed battle with submissions."""
        self.client = APIClient()

        # Create users
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        self.opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        # Create challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image'],
            is_active=True,
        )

        # Create a COMPLETED battle
        from django.utils import timezone

        now = timezone.now()
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Create a stunning mountain landscape at sunset',
            challenge_type=self.challenge_type,
            status=BattleStatus.COMPLETED,
            phase=BattlePhase.COMPLETE,
            duration_minutes=3,
            started_at=now - timezone.timedelta(minutes=5),
            completed_at=now,
            winner=self.challenger,
        )

        # Create submissions for both users
        from core.battles.models import BattleSubmission

        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='Majestic snow-capped mountains with golden sunset light',
            score=85.0,
        )

        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.opponent,
            prompt_text='Mountain range with purple sky at dusk',
            score=78.0,
        )

    def test_share_data_contains_battle_specific_info(self):
        """
        CRITICAL: Share data MUST contain battle-specific information.

        SCENARIO: User requests share data for completed battle
        EXPECTED: Response includes challenge text, winner info, share URLs
        FAILURE: Only generic AllThrive info returned
        """
        # Share endpoint is public (no auth needed)
        response = self.client.get(
            f'/api/v1/battles/{self.battle.id}/share/',
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Share data request failed. Response: {response.data}',
        )

        # Must have share_url
        self.assertIn(
            'share_url',
            response.data,
            'CRITICAL: Response must contain share_url',
        )

        # Must have battle-specific share text
        self.assertIn(
            'share_text',
            response.data,
            'CRITICAL: Response must contain share_text',
        )

        share_text = response.data['share_text']

        # Share text must contain winner info (not generic)
        headline = share_text.get('headline', '')
        self.assertIn(
            self.challenger.username,
            headline,
            f'CRITICAL: Share headline must mention winner username. Got: {headline}',
        )

        # Must have platform-specific share URLs
        self.assertIn(
            'platform_urls',
            response.data,
            'CRITICAL: Response must contain platform_urls for social sharing',
        )

        platform_urls = response.data['platform_urls']
        self.assertIn('twitter', platform_urls, 'CRITICAL: Must have Twitter share URL')
        self.assertIn('facebook', platform_urls, 'CRITICAL: Must have Facebook share URL')

    def test_share_text_includes_challenge_info(self):
        """
        CRITICAL: Share text MUST include the battle challenge, not generic text.

        SCENARIO: User shares battle results
        EXPECTED: Share text mentions the specific challenge/prompt
        FAILURE: Share text is generic "Check out AllThrive AI"
        """
        response = self.client.get(
            f'/api/v1/battles/{self.battle.id}/share/',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        share_text = response.data.get('share_text', {})

        # Twitter text must contain part of the challenge
        twitter_text = share_text.get('twitter', '')
        self.assertTrue(
            'mountain' in twitter_text.lower() or 'sunset' in twitter_text.lower(),
            f'CRITICAL: Twitter share text must reference the challenge. Got: {twitter_text}',
        )

        # Facebook text must have challenge info
        facebook_text = share_text.get('facebook', '')
        self.assertIn(
            self.battle.challenge_text,
            facebook_text,
            f'CRITICAL: Facebook share must include full challenge text. Got: {facebook_text}',
        )

    def test_share_meta_includes_battle_title(self):
        """
        CRITICAL: OG meta tags MUST include battle-specific title and description.

        SCENARIO: Social media fetches OG meta for share preview
        EXPECTED: Meta title/description mention the battle challenge
        FAILURE: Generic AllThrive meta shown in link preview
        """
        response = self.client.get(
            f'/api/v1/battles/{self.battle.id}/share/',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Must have meta info for OG tags
        self.assertIn(
            'meta',
            response.data,
            'CRITICAL: Response must contain meta for OG tags',
        )

        meta = response.data['meta']

        # Title must mention "Battle" or the challenge
        title = meta.get('title', '')
        self.assertTrue(
            'Battle' in title or 'Prompt' in title,
            f'CRITICAL: Meta title must be battle-specific. Got: {title}',
        )

        # Description must have challenge info
        description = meta.get('description', '')
        self.assertTrue(
            len(description) > 20,
            f'CRITICAL: Meta description must be meaningful. Got: {description}',
        )
        self.assertTrue(
            'mountain' in description.lower() or 'sunset' in description.lower() or 'won' in description.lower(),
            f'CRITICAL: Meta description must reference battle. Got: {description}',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class GuestReturnToBattleTest(TestCase):
    """
    Test guest user returning to battle via same invite link.

    SCENARIO: As a guest user who receives a prompt battle link, when I finish the battle
              I should be able to use the same link that I have in my messages and see the battle results
    EXPECTED: I should be able to use the same link and see the battle results
    FAILURE: I can't see the battle results again
    """

    def setUp(self):
        """Create test challenger and completed battle with guest."""
        self.client = APIClient()

        # Create challenger
        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        # Create a challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image of {subject}'],
            variables={'subject': ['a sunset']},
            is_active=True,
        )

        # Create battle and invitation
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create an amazing sunset image',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        self.invitation = BattleInvitation.objects.create(
            battle=self.battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

    def test_guest_can_view_battle_results_via_same_link(self):
        """
        CRITICAL: Guest MUST be able to return to completed battle via invite link.

        SCENARIO: Guest finishes battle, later clicks same link from messages
        EXPECTED: See battle results without error
        FAILURE: Error shown or cannot access results
        """
        from django.utils import timezone

        from core.battles.models import BattleSubmission

        # Step 1: Guest accepts invitation
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {'display_name': 'Guest Player'},
            format='json',
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)

        battle_id = accept_response.data['id']
        auth_data = accept_response.data.get('auth', {})
        access_token = auth_data.get('access')

        # Step 2: Complete the battle (simulate both users submitting and judging)
        self.battle.refresh_from_db()
        guest_user = self.battle.opponent

        # Create submissions
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='Challenger prompt',
            score=80.0,
        )
        BattleSubmission.objects.create(
            battle=self.battle,
            user=guest_user,
            prompt_text='Guest prompt',
            score=75.0,
        )

        # Mark battle as completed
        self.battle.status = BattleStatus.COMPLETED
        self.battle.phase = BattlePhase.COMPLETE
        self.battle.winner = self.challenger
        self.battle.completed_at = timezone.now()
        self.battle.save()

        # Step 3: Guest returns to the same invite link
        # This should redirect to the battle or show the battle already accepted
        view_response = self.client.get(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/',
        )

        # The invite endpoint should indicate the invitation was already accepted
        # and provide the battle_id for redirect
        self.assertEqual(
            view_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Viewing accepted invite should succeed. Got: {view_response.data}',
        )

        self.assertTrue(
            view_response.data.get('already_accepted', False),
            'CRITICAL: Response must indicate invitation was already accepted',
        )

        self.assertEqual(
            view_response.data.get('battle_id'),
            battle_id,
            'CRITICAL: Response must include battle_id for redirect',
        )

        # Step 4: Guest can view the battle results via public endpoint
        public_response = self.client.get(
            f'/api/v1/battles/{battle_id}/public/',
        )

        self.assertEqual(
            public_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest must be able to view completed battle. Got: {public_response.data}',
        )

        # Battle should show as completed with winner
        self.assertEqual(
            public_response.data.get('status'),
            BattleStatus.COMPLETED,
            'CRITICAL: Battle status must be COMPLETED',
        )

        self.assertIn(
            'winner',
            public_response.data,
            'CRITICAL: Completed battle must show winner',
        )

    def test_guest_clicking_link_again_returns_to_battle(self):
        """
        CRITICAL: Clicking invite link after accepting should redirect to battle.

        SCENARIO: Guest accepts invite, then clicks link again from messages
        EXPECTED: Redirected to battle page, not error
        FAILURE: Error message shown
        """
        # Step 1: Accept as guest
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        battle_id = accept_response.data['id']

        # Step 2: Try to accept again (simulates clicking link again)
        # This should be idempotent - return battle info, not error
        second_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        # Should return the battle (idempotency)
        self.assertEqual(
            second_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Second click on invite link should succeed. Got: {second_response.data}',
        )

        self.assertEqual(
            second_response.data.get('id'),
            battle_id,
            'CRITICAL: Should return same battle on second click',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class AsyncBattleAcceptanceTest(TestCase):
    """
    Test async battle flow where challenger starts before opponent joins.

    SCENARIO: As a challenged user who receives a link to a battle who does not accept right away
    EXPECTED: I should be able to accept the battle and play on my own time
    FAILURE: Unable to join the battle
    """

    def setUp(self):
        """Create test challenger with battle."""
        self.client = APIClient()

        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image'],
            is_active=True,
        )

        # Create pending battle with invitation
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create something amazing',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        self.invitation = BattleInvitation.objects.create(
            battle=self.battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

    def test_guest_can_accept_after_challenger_starts_turn(self):
        """
        CRITICAL: Guest MUST be able to join battle after challenger starts their turn.

        SCENARIO: Challenger creates battle, starts their turn, guest clicks link later
        EXPECTED: Guest can accept and join the active battle
        FAILURE: Error "Battle is no longer pending" or similar
        """
        # Step 1: Challenger starts their turn (changes status to ACTIVE)
        self.battle.start_turn(self.challenger)
        self.battle.refresh_from_db()

        # Verify battle is now active with challenger's turn
        self.assertEqual(self.battle.status, BattleStatus.ACTIVE)
        self.assertEqual(self.battle.phase, BattlePhase.CHALLENGER_TURN)

        # Step 2: Guest tries to accept the invitation
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {'display_name': 'Late Guest'},
            format='json',
        )

        # MUST succeed - this is the bug fix scenario
        self.assertEqual(
            accept_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest must be able to join active battle. Got: {accept_response.data}',
        )

        # Verify guest is set as opponent
        self.battle.refresh_from_db()
        self.assertIsNotNone(
            self.battle.opponent,
            'CRITICAL: Guest must be set as opponent',
        )

        # Battle should still be active
        self.assertEqual(
            self.battle.status,
            BattleStatus.ACTIVE,
            'CRITICAL: Battle must remain active after guest joins',
        )

    def test_guest_can_accept_after_challenger_submits(self):
        """
        CRITICAL: Guest MUST be able to join even after challenger has submitted.

        SCENARIO: Challenger creates battle, submits their prompt, guest clicks link hours later
        EXPECTED: Guest can accept and take their turn
        FAILURE: Cannot join battle
        """
        from core.battles.models import BattleSubmission

        # Step 1: Challenger starts turn and submits
        self.battle.start_turn(self.challenger)

        # Transition to allow submission
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.save()

        # Create challenger's submission
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='My amazing prompt',
        )

        # After submission, phase transitions to waiting for opponent
        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.current_turn_user = None
        self.battle.save()

        # Step 2: Guest accepts invitation later
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        self.assertEqual(
            accept_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest must join after challenger submits. Got: {accept_response.data}',
        )

        # Verify guest is opponent
        self.battle.refresh_from_db()
        self.assertIsNotNone(self.battle.opponent)

    def test_guest_can_view_invite_details_before_accepting(self):
        """
        CRITICAL: Guest MUST see invite details even if challenger already started.

        SCENARIO: Challenger starts their turn, guest views the invite link
        EXPECTED: Guest sees challenger info and can decide to join
        FAILURE: Error or empty response
        """
        # Challenger starts turn
        self.battle.start_turn(self.challenger)

        # Guest views invitation (GET request)
        view_response = self.client.get(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/',
        )

        self.assertEqual(
            view_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest must see invite details. Got: {view_response.data}',
        )

        # Should show sender info
        self.assertIn(
            'sender',
            view_response.data,
            'CRITICAL: Invite must show sender info',
        )

        # Should show battle exists
        self.assertIn(
            'battle',
            view_response.data,
            'CRITICAL: Invite must reference battle',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class JoinActiveBattleTest(TestCase):
    """
    Test joining a battle while challenger is actively playing.

    SCENARIO: As a challenged user who receives a link to a battle who does not accept right away
              and I try to join an active battle
    EXPECTED: I should be able to join an active battle if the challenger is already in the battle
    FAILURE: Unable to join the battle
    """

    def setUp(self):
        """Create challenger with active battle."""
        self.client = APIClient()

        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image'],
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create something amazing',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        self.invitation = BattleInvitation.objects.create(
            battle=self.battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

    def test_guest_joins_while_challenger_timer_active(self):
        """
        CRITICAL: Guest MUST be able to join while challenger's turn timer is running.

        SCENARIO: Challenger clicks "Start Turn", timer starts. Guest clicks link during timer.
        EXPECTED: Guest joins, sees battle is active, can wait for their turn
        FAILURE: Error joining battle
        """
        from django.utils import timezone

        # Challenger starts their turn - timer is now running
        self.battle.start_turn(self.challenger)
        self.battle.refresh_from_db()

        # Verify challenger's turn is active with timer
        self.assertIsNotNone(
            self.battle.current_turn_expires_at,
            'CRITICAL: Turn timer must be set',
        )
        self.assertTrue(
            self.battle.current_turn_expires_at > timezone.now(),
            'CRITICAL: Turn timer must be in the future',
        )

        # Guest accepts while timer is running
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {'display_name': 'Joining Guest'},
            format='json',
        )

        self.assertEqual(
            accept_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Guest must join during active timer. Got: {accept_response.data}',
        )

        # Response should indicate battle is active
        self.assertEqual(
            accept_response.data.get('status'),
            BattleStatus.ACTIVE,
            'CRITICAL: Response must show battle is ACTIVE',
        )

        # Guest should be set as opponent
        self.battle.refresh_from_db()
        self.assertIsNotNone(self.battle.opponent)
        self.assertTrue(self.battle.opponent.is_guest)

        # Challenger's turn should still be active
        self.assertEqual(
            self.battle.phase,
            BattlePhase.CHALLENGER_TURN,
            'CRITICAL: Should still be challenger turn after guest joins',
        )

    def test_authenticated_user_joins_active_battle(self):
        """
        CRITICAL: Authenticated user MUST be able to join active battle.

        SCENARIO: Challenger starts battle, sends link to friend who has account
        EXPECTED: Friend logs in, clicks link, joins active battle
        FAILURE: Error because battle is not PENDING
        """
        # Create opponent user
        opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        # Challenger starts their turn
        self.battle.start_turn(self.challenger)

        # Opponent (authenticated) accepts invitation
        self.client.force_authenticate(user=opponent)
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        self.assertEqual(
            accept_response.status_code,
            status.HTTP_200_OK,
            f'CRITICAL: Authenticated user must join active battle. Got: {accept_response.data}',
        )

        # Verify opponent is set
        self.battle.refresh_from_db()
        self.assertEqual(
            self.battle.opponent,
            opponent,
            'CRITICAL: Opponent must be the authenticated user',
        )

    def test_battle_state_correct_after_guest_joins_active(self):
        """
        CRITICAL: Battle state MUST be correct after guest joins active battle.

        SCENARIO: Guest joins during challenger's active turn
        EXPECTED: Battle has correct phase, both participants set, timer preserved
        FAILURE: Battle state corrupted
        """

        # Start challenger's turn
        original_expires_at = None
        self.battle.start_turn(self.challenger)
        self.battle.refresh_from_db()
        original_expires_at = self.battle.current_turn_expires_at
        original_phase = self.battle.phase

        # Guest joins
        self.client.post(
            f'/api/v1/battles/invite/{self.invitation.invite_token}/accept/',
            {},
            format='json',
        )

        self.battle.refresh_from_db()

        # Phase should be unchanged (still challenger's turn)
        self.assertEqual(
            self.battle.phase,
            original_phase,
            f'CRITICAL: Phase must remain {original_phase}',
        )

        # Turn timer should be unchanged
        self.assertEqual(
            self.battle.current_turn_expires_at,
            original_expires_at,
            'CRITICAL: Turn timer must not reset when guest joins',
        )

        # Both participants should be set
        self.assertIsNotNone(self.battle.challenger)
        self.assertIsNotNone(self.battle.opponent)

        # Status should be ACTIVE
        self.assertEqual(
            self.battle.status,
            BattleStatus.ACTIVE,
            'CRITICAL: Battle must be ACTIVE',
        )


@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class ChallengerNotificationTest(TestCase):
    """
    Test challenger receives notification when async battle completes.

    SCENARIO: As a challenger who sends a link to a guest who does not accept right away
    EXPECTED: I should receive a notification when the user completes the battle
    FAILURE: I don't know the battle has been complete
    """

    def setUp(self):
        """Create challenger and guest with active battle."""
        self.client = APIClient()

        self.challenger = User.objects.create_user(
            username='challenger',
            email='challenger@example.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Create an image'],
            is_active=True,
        )

    def test_battle_completion_visible_to_challenger(self):
        """
        CRITICAL: Challenger MUST be able to see when async battle completes.

        SCENARIO: Guest completes battle, challenger checks their battles
        EXPECTED: Completed battle shows in challenger's battle list
        FAILURE: Challenger can't see battle completed
        """
        from core.battles.models import BattleSubmission
        from core.battles.services import BattleService

        # Create battle with invitation
        battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create something amazing',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        invitation = BattleInvitation.objects.create(
            battle=battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

        # Guest accepts
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{invitation.invite_token}/accept/',
            {},
            format='json',
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)

        battle.refresh_from_db()
        guest = battle.opponent

        # Both submit prompts
        BattleSubmission.objects.create(
            battle=battle,
            user=self.challenger,
            prompt_text='Challenger amazing prompt',
            score=85.0,
        )
        BattleSubmission.objects.create(
            battle=battle,
            user=guest,
            prompt_text='Guest creative prompt',
            score=80.0,
        )

        # Complete the battle
        service = BattleService()
        service.complete_battle(battle)

        battle.refresh_from_db()
        self.assertEqual(battle.status, BattleStatus.COMPLETED)

        # Challenger should be able to see the completed battle
        self.client.force_authenticate(user=self.challenger)
        response = self.client.get('/api/v1/me/battles/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Find the battle in results
        battles = response.data.get('results', response.data)
        completed_battle = next((b for b in battles if b['id'] == battle.id), None)

        self.assertIsNotNone(
            completed_battle,
            'CRITICAL: Challenger must see their completed battle',
        )
        self.assertEqual(
            completed_battle['status'],
            BattleStatus.COMPLETED,
            'CRITICAL: Battle must show as COMPLETED',
        )
        # Note: List endpoint may not include winner, but detail endpoint does
        # The important thing is challenger can see the battle is completed

    def test_battle_has_notification_endpoint_for_challenger(self):
        """
        CRITICAL: There MUST be a way for challenger to check battle status.

        SCENARIO: Challenger polls for battle updates
        EXPECTED: Can check if their sent invitation battle has completed
        FAILURE: No way to know battle status without WebSocket
        """
        from django.utils import timezone

        from core.battles.models import BattleSubmission

        # Create and complete a battle
        battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create something amazing',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        invitation = BattleInvitation.objects.create(
            battle=battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

        # Guest accepts
        accept_response = self.client.post(
            f'/api/v1/battles/invite/{invitation.invite_token}/accept/',
            {},
            format='json',
        )
        battle.refresh_from_db()
        guest = battle.opponent

        # Complete battle
        BattleSubmission.objects.create(battle=battle, user=self.challenger, prompt_text='Test', score=80)
        BattleSubmission.objects.create(battle=battle, user=guest, prompt_text='Test', score=75)
        battle.status = BattleStatus.COMPLETED
        battle.phase = BattlePhase.COMPLETE
        battle.winner = self.challenger
        battle.completed_at = timezone.now()
        battle.save()

        # Challenger can check their battles
        self.client.force_authenticate(user=self.challenger)
        response = self.client.get('/api/v1/me/battles/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should include the completed battle
        battle_ids = [b['id'] for b in response.data.get('results', response.data)]
        self.assertIn(
            battle.id,
            battle_ids,
            'CRITICAL: Challenger must be able to see their completed battle',
        )

    def test_invitation_acceptance_updates_battle_for_challenger(self):
        """
        CRITICAL: Battle state MUST update for challenger when invitation is accepted.

        SCENARIO: Guest clicks link and accepts invitation
        EXPECTED: Challenger can see opponent joined their battle
        FAILURE: Challenger can't see opponent info
        """
        # Create battle with invitation
        battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=None,
            challenge_text='Create something amazing',
            challenge_type=self.challenge_type,
            status=BattleStatus.PENDING,
            duration_minutes=3,
        )

        invitation = BattleInvitation.objects.create(
            battle=battle,
            sender=self.challenger,
            recipient=None,
            invitation_type=InvitationType.LINK,
        )

        # Guest accepts
        response = self.client.post(
            f'/api/v1/battles/invite/{invitation.invite_token}/accept/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Challenger checks their battle
        self.client.force_authenticate(user=self.challenger)
        battle_response = self.client.get(f'/api/v1/me/battles/{battle.id}/')

        self.assertEqual(battle_response.status_code, status.HTTP_200_OK)

        # Battle should show opponent joined
        self.assertIn(
            'opponent',
            battle_response.data,
            'CRITICAL: Battle must show opponent info',
        )

        # Opponent should be set (not null)
        self.assertIsNotNone(
            battle_response.data.get('opponent'),
            'CRITICAL: Opponent must be set after acceptance',
        )

        # Battle should be active
        self.assertEqual(
            battle_response.data.get('status'),
            BattleStatus.ACTIVE,
            'CRITICAL: Battle must be ACTIVE after acceptance',
        )
