"""
Unit tests for battle Celery tasks.

Tests cover:
- WebSocket message serialization (critical for channel layer)
- Task phase validation
- judge_battle_task result handling
"""

import json
from unittest.mock import MagicMock, patch

from django.test import TestCase

from core.battles.models import (
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    MatchSource,
    PromptBattle,
    PromptChallengePrompt,
)
from core.users.models import User, UserRole


class JudgeBattleTaskSerializationTestCase(TestCase):
    """
    Test that judge_battle_task properly serializes data for WebSocket.

    REGRESSION TEST: This test was added after a bug where BattleSubmission objects
    were being sent over the channel layer, causing TypeError:
    "can not serialize 'BattleSubmission' object"

    The bug caused battles to get stuck in 'reveal' phase and never complete.
    """

    def setUp(self):
        """Set up test fixtures."""
        self.pip_user = User.objects.create_user(
            username='pip',
            email='pip@example.com',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=self.pip_user,
            challenge_text='Test challenge',
            prompt=self.prompt,
            match_source=MatchSource.AI_OPPONENT,
            phase=BattlePhase.JUDGING,
            status=BattleStatus.ACTIVE,
        )

        self.user_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.user,
            prompt_text='User test prompt',
            submission_type='image',
            generated_output_url='https://example.com/image1.png',
        )

        self.pip_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip_user,
            prompt_text='Pip test prompt',
            submission_type='image',
            generated_output_url='https://example.com/image2.png',
        )

    def test_judge_results_are_json_serializable(self):
        """
        Test that the results from BattleService.judge_battle can be serialized to JSON.

        The service returns results with 'submission' key containing Django model objects.
        The task must strip these out before sending over WebSocket.
        """
        # Simulate results from BattleService.judge_battle()
        # This is the format that caused the original bug
        raw_results = [
            {
                'submission_id': self.user_submission.id,
                'submission': self.user_submission,  # Django model - NOT serializable!
                'user_id': self.user.id,
                'score': 75.5,
                'criteria_scores': {'Creativity': 80, 'Visual Impact': 70},
                'feedback': 'Good work!',
                'tokens_used': 500,
            },
            {
                'submission_id': self.pip_submission.id,
                'submission': self.pip_submission,  # Django model - NOT serializable!
                'user_id': self.pip_user.id,
                'score': 82.0,
                'criteria_scores': {'Creativity': 85, 'Visual Impact': 78},
                'feedback': 'Excellent prompt craft!',
                'tokens_used': 500,
            },
        ]

        # This is the serialization logic from judge_battle_task
        # It MUST strip out non-serializable 'submission' objects
        serializable_results = []
        for r in raw_results:
            serializable_results.append(
                {
                    'submission_id': r.get('submission_id'),
                    'user_id': r.get('user_id'),
                    'score': r.get('score'),
                    'criteria_scores': r.get('criteria_scores'),
                    'feedback': r.get('feedback', ''),
                }
            )

        # ASSERT: Results can be JSON-serialized (required for Redis channel layer)
        try:
            json_str = json.dumps(serializable_results)
            self.assertIsInstance(json_str, str)
            self.assertIn(str(self.user_submission.id), json_str)
        except TypeError as e:
            self.fail(f'Results should be JSON-serializable but got: {e}')

        # ASSERT: 'submission' key is NOT in serializable results
        for r in serializable_results:
            self.assertNotIn('submission', r, 'submission key should be stripped out')
            self.assertNotIn('tokens_used', r, 'tokens_used is not needed for frontend')

    def test_raw_results_are_not_serializable(self):
        """
        Verify that raw results with Django model objects cannot be JSON-serialized.

        This test documents the bug that was fixed.
        """
        raw_results = [
            {
                'submission_id': self.user_submission.id,
                'submission': self.user_submission,  # Django model
                'user_id': self.user.id,
                'score': 75.5,
            },
        ]

        # ASSERT: Raw results with Django models CANNOT be serialized
        with self.assertRaises(TypeError) as context:
            json.dumps(raw_results)

        self.assertIn('not JSON serializable', str(context.exception))

    @patch('core.battles.tasks.async_to_sync')
    @patch('core.battles.tasks.get_channel_layer')
    @patch('core.battles.services.BattleService.judge_battle')
    def test_judge_battle_task_sends_serializable_data(
        self, mock_judge_battle, mock_get_channel_layer, mock_async_to_sync
    ):
        """
        Integration test: judge_battle_task sends only serializable data to channel layer.
        """
        from core.battles.tasks import judge_battle_task

        # Mock the service to return results with Django model objects
        mock_judge_battle.return_value = {
            'winner_id': self.pip_user.id,
            'results': [
                {
                    'submission_id': self.user_submission.id,
                    'submission': self.user_submission,  # This should be stripped!
                    'user_id': self.user.id,
                    'score': 75.5,
                    'criteria_scores': {'Creativity': 80},
                    'feedback': 'Good work!',
                },
                {
                    'submission_id': self.pip_submission.id,
                    'submission': self.pip_submission,  # This should be stripped!
                    'user_id': self.pip_user.id,
                    'score': 82.0,
                    'criteria_scores': {'Creativity': 85},
                    'feedback': 'Excellent!',
                },
            ],
            'tokens_used': 1000,
        }

        # Mock channel layer
        mock_channel_layer = MagicMock()
        mock_get_channel_layer.return_value = mock_channel_layer

        # Run the task
        result = judge_battle_task(self.battle.id)

        # Verify task succeeded
        self.assertEqual(result['status'], 'success')

        # Get the data that was sent to channel layer
        # Find the 'judging_complete' event call
        calls = mock_async_to_sync.return_value.call_args_list
        judging_complete_call = None
        for call in calls:
            args = call[0] if call[0] else ()
            if len(args) >= 2 and isinstance(args[1], dict):
                if args[1].get('event') == 'judging_complete':
                    judging_complete_call = args[1]
                    break

        if judging_complete_call:
            # ASSERT: Results in channel message are JSON-serializable
            results = judging_complete_call.get('results', [])
            try:
                json.dumps(results)
            except TypeError as e:
                self.fail(f'Channel layer data should be serializable: {e}')

            # ASSERT: No 'submission' key in results
            for r in results:
                self.assertNotIn('submission', r)


class JudgeBattleTaskPhaseValidationTestCase(TestCase):
    """Test that judge_battle_task validates battle phase correctly."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
        )

        self.opponent = User.objects.create_user(
            username='opponent',
            email='opponent@example.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

    def test_judge_battle_task_skips_wrong_phase(self):
        """Test that judge_battle_task skips battles not in JUDGING phase."""
        from core.battles.tasks import judge_battle_task

        # Create battle in COMPLETE phase (not JUDGING)
        battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            phase=BattlePhase.COMPLETE,
            status=BattleStatus.COMPLETED,
        )

        result = judge_battle_task(battle.id)

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'invalid_phase')

    def test_judge_battle_task_handles_missing_battle(self):
        """Test that judge_battle_task handles non-existent battle gracefully."""
        from core.battles.tasks import judge_battle_task

        result = judge_battle_task(99999)  # Non-existent ID

        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['reason'], 'battle_not_found')
