"""
Unit tests for BattleService.

Tests cover:
- Challenge refresh for Pip battles
- Judging response parsing
- Tiebreaker logic
- Points awarding and achievement tracking
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase

from core.battles.models import (
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    ChallengeType,
    MatchSource,
    PromptBattle,
)
from core.battles.services import BattleService
from core.users.models import User, UserRole


class BattleServiceRefreshChallengeTestCase(TestCase):
    """Test cases for BattleService.refresh_challenge method."""

    def setUp(self):
        """Set up test fixtures."""
        # Create Pip user (AI agent)
        self.pip_user = User.objects.create_user(
            username='pip',
            email='pip@example.com',
            password='testpass123',
            role=UserRole.AGENT,
        )

        # Create human users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123',
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123',
        )

        # Create challenge type
        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            templates=['Test challenge: {style}'],
            variables={'style': ['simple', 'complex']},
        )

        # Create Pip battle (user vs Pip)
        self.pip_battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.pip_user,
            challenge_text='Original challenge text',
            challenge_type=self.challenge_type,
            match_source=MatchSource.AI_OPPONENT,
            phase=BattlePhase.WAITING,
            status=BattleStatus.PENDING,
        )

        # Create human vs human battle
        self.human_battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Human battle challenge',
            challenge_type=self.challenge_type,
            phase=BattlePhase.WAITING,
            status=BattleStatus.PENDING,
        )

        self.service = BattleService()

    def test_refresh_challenge_success_for_pip_battle(self):
        """Test that refresh_challenge successfully refreshes prompt for Pip battles."""
        # Test when user hasn't submitted yet
        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNotNone(new_challenge)
        self.assertNotEqual(new_challenge, 'Original challenge text')
        self.assertTrue(new_challenge.startswith('Test challenge:'))

        # Verify battle was updated
        self.pip_battle.refresh_from_db()
        self.assertEqual(self.pip_battle.challenge_text, new_challenge)

    def test_refresh_challenge_returns_none_for_non_pip_battle(self):
        """Test that refresh_challenge returns None for non-Pip battles."""
        new_challenge = self.service.refresh_challenge(self.human_battle, self.user1)

        self.assertIsNone(new_challenge)

        # Verify battle was not updated
        self.human_battle.refresh_from_db()
        self.assertEqual(self.human_battle.challenge_text, 'Human battle challenge')

    def test_refresh_challenge_returns_none_after_user_submission(self):
        """Test that refresh_challenge returns None after user has submitted."""
        # Create a submission for user1
        BattleSubmission.objects.create(
            battle=self.pip_battle,
            user=self.user1,
            prompt_text='My test prompt',
            submission_type='image',
        )

        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNone(new_challenge)

        # Verify battle was not updated
        self.pip_battle.refresh_from_db()
        self.assertEqual(self.pip_battle.challenge_text, 'Original challenge text')

    def test_refresh_challenge_returns_none_for_non_participant(self):
        """Test that refresh_challenge returns None for non-participants."""
        # user2 is not in pip_battle
        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user2)

        self.assertIsNone(new_challenge)

        # Verify battle was not updated
        self.pip_battle.refresh_from_db()
        self.assertEqual(self.pip_battle.challenge_text, 'Original challenge text')

    def test_refresh_challenge_returns_none_for_invalid_phase(self):
        """Test that refresh_challenge returns None for battles not in waiting/prompting phase."""
        # Move battle to active phase
        self.pip_battle.phase = BattlePhase.ACTIVE
        self.pip_battle.save()

        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNone(new_challenge)

        # Verify battle was not updated
        self.pip_battle.refresh_from_db()
        self.assertEqual(self.pip_battle.challenge_text, 'Original challenge text')

    def test_refresh_challenge_works_in_prompting_phase(self):
        """Test that refresh_challenge works in PROMPTING phase."""
        self.pip_battle.phase = BattlePhase.PROMPTING
        self.pip_battle.save()

        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNotNone(new_challenge)
        self.pip_battle.refresh_from_db()
        self.assertEqual(self.pip_battle.challenge_text, new_challenge)

    def test_refresh_challenge_no_pip_user_exists(self):
        """Test that refresh_challenge returns None if Pip user doesn't exist."""
        # Delete Pip user
        self.pip_user.delete()

        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNone(new_challenge)

    def test_refresh_challenge_no_challenge_type(self):
        """Test that refresh_challenge returns None if battle has no challenge_type."""
        self.pip_battle.challenge_type = None
        self.pip_battle.save()

        new_challenge = self.service.refresh_challenge(self.pip_battle, self.user1)

        self.assertIsNone(new_challenge)


class BattleServiceParseJudgingResponseTestCase(TestCase):
    """Test cases for BattleService._parse_judging_response method."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = BattleService()

    def test_parse_valid_json_response(self):
        """Test parsing valid JSON response."""
        response = """
        {
            "scores": {
                "Creativity": 85,
                "Visual Impact": 90,
                "Relevance": 80,
                "Cohesion": 75
            },
            "feedback": "Great work on this submission!"
        }
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNotNone(result)
        self.assertIn('scores', result)
        self.assertIn('feedback', result)
        self.assertEqual(result['scores']['Creativity'], 85)
        self.assertEqual(result['scores']['Visual Impact'], 90)
        self.assertEqual(result['feedback'], 'Great work on this submission!')

    def test_parse_json_with_markdown_code_blocks(self):
        """Test parsing JSON wrapped in markdown code blocks."""
        response = """
        Here's the evaluation:
        ```json
        {
            "scores": {
                "Creativity": 70,
                "Visual Impact": 75,
                "Relevance": 65,
                "Cohesion": 68
            },
            "feedback": "Solid effort."
        }
        ```
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNotNone(result)
        self.assertEqual(result['scores']['Creativity'], 70)
        self.assertEqual(result['feedback'], 'Solid effort.')

    def test_parse_json_with_generic_code_blocks(self):
        """Test parsing JSON wrapped in generic code blocks."""
        response = """
        ```
        {
            "scores": {
                "Creativity": 60,
                "Visual Impact": 65,
                "Relevance": 70,
                "Cohesion": 62
            },
            "feedback": "Needs improvement."
        }
        ```
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNotNone(result)
        self.assertEqual(result['scores']['Creativity'], 60)

    def test_parse_json_with_text_before_json(self):
        """Test parsing JSON when there's text before the JSON object."""
        response = """
        Here is my evaluation of the submission:
        {
            "scores": {
                "Creativity": 88,
                "Visual Impact": 82,
                "Relevance": 90,
                "Cohesion": 85
            },
            "feedback": "Excellent work!"
        }
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNotNone(result)
        self.assertEqual(result['scores']['Creativity'], 88)
        self.assertEqual(result['feedback'], 'Excellent work!')

    def test_parse_json_with_nested_objects(self):
        """Test parsing JSON with nested braces."""
        response = """
        {
            "scores": {
                "Creativity": 75,
                "Visual Impact": 80,
                "Relevance": 78,
                "Cohesion": 72
            },
            "feedback": "Nice use of { braces } in description.",
            "metadata": {"extra": "data"}
        }
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNotNone(result)
        self.assertEqual(result['scores']['Creativity'], 75)

    def test_parse_invalid_json_returns_none(self):
        """Test that invalid JSON returns None."""
        response = 'This is not valid JSON at all'

        result = self.service._parse_judging_response(response)

        self.assertIsNone(result)

    def test_parse_json_missing_scores_key_returns_none(self):
        """Test that JSON missing 'scores' key returns None."""
        response = """
        {
            "feedback": "Great work!",
            "rating": 85
        }
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNone(result)

    def test_parse_json_with_missing_criteria(self):
        """Test parsing JSON with missing criteria (should still parse but log warning)."""
        response = """
        {
            "scores": {
                "Creativity": 85,
                "Visual Impact": 90
            },
            "feedback": "Missing some criteria"
        }
        """

        result = self.service._parse_judging_response(response)

        # Should still parse successfully
        self.assertIsNotNone(result)
        self.assertEqual(result['scores']['Creativity'], 85)
        self.assertEqual(result['scores']['Visual Impact'], 90)

    def test_parse_empty_response_returns_none(self):
        """Test that empty response returns None."""
        result = self.service._parse_judging_response('')

        self.assertIsNone(result)

    def test_parse_json_with_unbalanced_braces_returns_none(self):
        """Test that JSON with unbalanced braces returns None."""
        response = """
        {
            "scores": {
                "Creativity": 85,
                "Visual Impact": 90
            },
            "feedback": "Missing closing brace"
        """

        result = self.service._parse_judging_response(response)

        self.assertIsNone(result)


class BattleServiceJudgeBattleTiebreakerTestCase(TestCase):
    """Test cases for BattleService.judge_battle tiebreaker logic."""

    def setUp(self):
        """Set up test fixtures."""
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123',
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            phase=BattlePhase.JUDGING,
            status=BattleStatus.ACTIVE,
        )

        # Create submissions
        self.submission1 = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.user1,
            prompt_text='User 1 prompt',
            submission_type='image',
            generated_output_url='https://example.com/image1.png',
        )

        self.submission2 = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.user2,
            prompt_text='User 2 prompt',
            submission_type='image',
            generated_output_url='https://example.com/image2.png',
        )

        self.service = BattleService()

    @patch('core.battles.services.AIProvider')
    def test_judge_battle_no_tie(self, mock_ai_provider):
        """Test that judge_battle correctly selects winner when scores are not tied."""
        # Mock AI responses with clear winner (user1)
        mock_ai = MagicMock()
        mock_ai_provider.return_value = mock_ai

        # Mock responses for each submission
        def mock_complete_with_image(prompt, image_url, model):
            if 'user1' in prompt.lower() or 'image1' in image_url:
                return """
                {
                    "scores": {
                        "Creativity": 90,
                        "Visual Impact": 85,
                        "Relevance": 88,
                        "Cohesion": 87
                    },
                    "feedback": "Excellent work!"
                }
                """
            else:
                return """
                {
                    "scores": {
                        "Creativity": 70,
                        "Visual Impact": 65,
                        "Relevance": 68,
                        "Cohesion": 67
                    },
                    "feedback": "Good effort."
                }
                """

        mock_ai.complete_with_image.side_effect = mock_complete_with_image
        mock_ai.last_usage = {'total_tokens': 500}

        result = self.service.judge_battle(self.battle)

        self.assertIn('winner_id', result)
        self.assertEqual(result['winner_id'], self.user1.id)
        self.battle.refresh_from_db()
        self.assertEqual(self.battle.winner_id, self.user1.id)
        self.assertEqual(self.battle.phase, BattlePhase.REVEAL)

    @patch('core.battles.services.AIProvider')
    def test_judge_battle_tie_creativity_tiebreaker(self, mock_ai_provider):
        """Test that tiebreaker uses Creativity when total scores are tied."""
        mock_ai = MagicMock()
        mock_ai_provider.return_value = mock_ai

        # Mock responses with tied total scores but different Creativity
        def mock_complete_with_image(prompt, image_url, model):
            if 'image1' in image_url:
                return """
                {
                    "scores": {
                        "Creativity": 85,
                        "Visual Impact": 75,
                        "Relevance": 70,
                        "Cohesion": 70
                    },
                    "feedback": "Good creativity!"
                }
                """
            else:
                return """
                {
                    "scores": {
                        "Creativity": 75,
                        "Visual Impact": 80,
                        "Relevance": 75,
                        "Cohesion": 70
                    },
                    "feedback": "Good visual impact!"
                }
                """

        mock_ai.complete_with_image.side_effect = mock_complete_with_image
        mock_ai.last_usage = {'total_tokens': 500}

        result = self.service.judge_battle(self.battle)

        # User1 should win due to higher Creativity score
        self.assertEqual(result['winner_id'], self.user1.id)

    @patch('core.battles.services.AIProvider')
    def test_judge_battle_tie_visual_impact_tiebreaker(self, mock_ai_provider):
        """Test that tiebreaker uses Visual Impact when Creativity is also tied."""
        mock_ai = MagicMock()
        mock_ai_provider.return_value = mock_ai

        # Mock responses with tied total and Creativity, but different Visual Impact
        def mock_complete_with_image(prompt, image_url, model):
            if 'image1' in image_url:
                return """
                {
                    "scores": {
                        "Creativity": 80,
                        "Visual Impact": 85,
                        "Relevance": 70,
                        "Cohesion": 65
                    },
                    "feedback": "Great visual impact!"
                }
                """
            else:
                return """
                {
                    "scores": {
                        "Creativity": 80,
                        "Visual Impact": 75,
                        "Relevance": 75,
                        "Cohesion": 70
                    },
                    "feedback": "Good balance!"
                }
                """

        mock_ai.complete_with_image.side_effect = mock_complete_with_image
        mock_ai.last_usage = {'total_tokens': 500}

        result = self.service.judge_battle(self.battle)

        # User1 should win due to higher Visual Impact score
        self.assertEqual(result['winner_id'], self.user1.id)

    @patch('core.battles.services.AIProvider')
    @patch('core.battles.services.random.shuffle')
    def test_judge_battle_tie_random_tiebreaker(self, mock_shuffle, mock_ai_provider):
        """Test that random selection is used when all tiebreakers are equal."""
        mock_ai = MagicMock()
        mock_ai_provider.return_value = mock_ai

        # Mock responses with all scores exactly equal
        def mock_complete_with_image(prompt, image_url, model):
            return """
            {
                "scores": {
                    "Creativity": 80,
                    "Visual Impact": 75,
                    "Relevance": 70,
                    "Cohesion": 70
                },
                "feedback": "Identical scores!"
            }
            """

        mock_ai.complete_with_image.side_effect = mock_complete_with_image
        mock_ai.last_usage = {'total_tokens': 500}

        # Mock shuffle to ensure deterministic test
        def mock_shuffle_func(lst):
            # Make user2 the first element
            if len(lst) >= 2 and hasattr(lst[0], 'get'):
                lst[0], lst[1] = lst[1], lst[0]

        mock_shuffle.side_effect = mock_shuffle_func

        result = self.service.judge_battle(self.battle)

        # Winner should be determined by mocked shuffle (user2)
        self.assertIn('winner_id', result)
        mock_shuffle.assert_called_once()


class BattleServiceAwardPointsTestCase(TestCase):
    """Test cases for BattleService point awarding and achievement tracking."""

    def setUp(self):
        """Set up test fixtures."""
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123',
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_challenge',
            name='Test Challenge',
            description='A test challenge',
            winner_points=100,
            participation_points=25,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            phase=BattlePhase.REVEAL,
            status=BattleStatus.ACTIVE,
            winner=self.user1,
        )

        # Create submissions
        self.submission1 = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.user1,
            prompt_text='User 1 prompt',
            submission_type='image',
        )

        self.submission2 = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.user2,
            prompt_text='User 2 prompt',
            submission_type='image',
        )

        self.service = BattleService()

    def test_complete_battle_awards_winner_points(self):
        """Test that complete_battle awards correct points to winner."""
        initial_points = self.user1.total_points

        self.service.complete_battle(self.battle)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.total_points, initial_points + 100)

    def test_complete_battle_awards_participation_points(self):
        """Test that complete_battle awards participation points to loser."""
        initial_points = self.user2.total_points

        self.service.complete_battle(self.battle)

        self.user2.refresh_from_db()
        self.assertEqual(self.user2.total_points, initial_points + 25)

    def test_complete_battle_updates_battle_status(self):
        """Test that complete_battle updates battle phase and status."""
        self.service.complete_battle(self.battle)

        self.battle.refresh_from_db()
        self.assertEqual(self.battle.phase, BattlePhase.COMPLETE)
        self.assertEqual(self.battle.status, BattleStatus.COMPLETED)
        self.assertIsNotNone(self.battle.completed_at)

    @patch('core.battles.services.AchievementTracker.track_event')
    def test_complete_battle_tracks_achievement_for_winner(self, mock_track_event):
        """Test that complete_battle tracks achievement progress for winner."""
        self.service.complete_battle(self.battle)

        # Verify achievement tracking was called for winner
        mock_track_event.assert_called_once_with(
            user=self.user1,
            tracking_field='lifetime_battles_won',
            value=1,
        )

    @patch('core.battles.services.AchievementTracker.track_event')
    def test_complete_battle_no_achievement_tracking_for_loser(self, mock_track_event):
        """Test that complete_battle doesn't track achievements for loser."""
        # Change winner to user2, so user1 is the loser
        self.battle.winner = self.user2
        self.battle.save()

        self.service.complete_battle(self.battle)

        # Achievement tracking should only be called once (for user2, the winner)
        self.assertEqual(mock_track_event.call_count, 1)
        # Verify it was called with user2
        call_args = mock_track_event.call_args
        self.assertEqual(call_args.kwargs['user'], self.user2)

    def test_complete_battle_uses_default_points_without_challenge_type(self):
        """Test that complete_battle uses default points when no challenge_type."""
        # Create battle without challenge_type
        battle_no_type = PromptBattle.objects.create(
            challenger=self.user1,
            opponent=self.user2,
            challenge_text='Test challenge',
            challenge_type=None,
            phase=BattlePhase.REVEAL,
            status=BattleStatus.ACTIVE,
            winner=self.user1,
        )

        BattleSubmission.objects.create(
            battle=battle_no_type,
            user=self.user1,
            prompt_text='User 1 prompt',
            submission_type='image',
        )

        BattleSubmission.objects.create(
            battle=battle_no_type,
            user=self.user2,
            prompt_text='User 2 prompt',
            submission_type='image',
        )

        initial_points_user1 = self.user1.total_points
        initial_points_user2 = self.user2.total_points

        self.service.complete_battle(battle_no_type)

        self.user1.refresh_from_db()
        self.user2.refresh_from_db()

        # Default winner_points = 50, participation_points = 10
        self.assertEqual(self.user1.total_points, initial_points_user1 + 50)
        self.assertEqual(self.user2.total_points, initial_points_user2 + 10)

    def test_complete_battle_idempotent(self):
        """Test that complete_battle can be called multiple times safely."""
        self.service.complete_battle(self.battle)

        initial_points_user1 = self.user1.total_points
        initial_points_user2 = self.user2.total_points

        # Call again - should not award points again
        self.service.complete_battle(self.battle)

        self.user1.refresh_from_db()
        self.user2.refresh_from_db()

        # Points should remain the same (no double awarding)
        self.assertEqual(self.user1.total_points, initial_points_user1)
        self.assertEqual(self.user2.total_points, initial_points_user2)

    @patch('core.battles.services.AchievementTracker.track_event')
    @patch('core.battles.services.logger')
    def test_complete_battle_handles_achievement_tracking_errors(self, mock_logger, mock_track_event):
        """Test that complete_battle handles achievement tracking errors gracefully."""
        # Make achievement tracking raise an error
        mock_track_event.side_effect = Exception('Achievement tracking failed')

        # Should not raise exception
        self.service.complete_battle(self.battle)

        # Verify error was logged
        mock_logger.error.assert_called()
        self.assertIn('Error tracking battle win achievement', str(mock_logger.error.call_args))

        # Battle should still be completed
        self.battle.refresh_from_db()
        self.assertEqual(self.battle.phase, BattlePhase.COMPLETE)
