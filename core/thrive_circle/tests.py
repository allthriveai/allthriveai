# ruff: noqa: S106
"""
Tests for Thrive Circle unified points system.
"""

import datetime
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import PointActivity, SideQuest, UserSideQuest, WeeklyGoal
from .tasks import check_streak_bonuses, create_weekly_goals
from .utils import get_week_start

User = get_user_model()


class UserPointsModelTest(TestCase):
    """Tests for User model points system"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

    def test_user_default_tier(self):
        """Test user starts with default tier"""
        self.assertEqual(self.user.tier, 'seedling')
        self.assertEqual(self.user.total_points, 0)
        self.assertEqual(self.user.level, 1)

    def test_tier_progression_seedling_to_sprout(self):
        """Test tier upgrade from Seedling to Sprout at 1000 points"""
        self.user.add_points(1000, 'quiz_complete', 'Test quiz')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'sprout')
        self.assertEqual(self.user.total_points, 1000)

    def test_tier_progression_to_blossom(self):
        """Test tier upgrade to Blossom at 2500 points"""
        self.user.add_points(2500, 'special_event', 'Bonus points')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'blossom')
        self.assertEqual(self.user.total_points, 2500)

    def test_tier_progression_to_bloom(self):
        """Test tier upgrade to Bloom at 5000 points"""
        self.user.add_points(5000, 'special_event', 'Big reward')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'bloom')
        self.assertEqual(self.user.total_points, 5000)

    def test_tier_progression_to_evergreen(self):
        """Test tier upgrade to Evergreen at 10000 points"""
        self.user.add_points(10000, 'special_event', 'Massive points')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'evergreen')
        self.assertEqual(self.user.total_points, 10000)

    def test_level_progression(self):
        """Test level increases with points"""
        self.assertEqual(self.user.level, 1)

        # Level 2 at 100 points
        self.user.add_points(100, 'quiz_complete')
        self.user.refresh_from_db()
        self.assertEqual(self.user.level, 2)

        # Level 3 at 250 points (need 150 more)
        self.user.add_points(150, 'project_create')
        self.user.refresh_from_db()
        self.assertEqual(self.user.level, 3)

    def test_add_points_creates_activity(self):
        """Test that adding points creates an activity record"""
        self.user.add_points(100, 'quiz_complete', 'Test quiz completed')

        activity = PointActivity.objects.filter(user=self.user).first()
        self.assertIsNotNone(activity)
        self.assertEqual(activity.amount, 100)
        self.assertEqual(activity.activity_type, 'quiz_complete')
        self.assertEqual(activity.description, 'Test quiz completed')

    def test_add_points_rejects_negative(self):
        """Test that negative points are rejected"""
        with self.assertRaises(ValueError):
            self.user.add_points(-50, 'quiz_complete')

    def test_add_points_rejects_zero(self):
        """Test that zero points are rejected"""
        with self.assertRaises(ValueError):
            self.user.add_points(0, 'quiz_complete')

    def test_concurrent_points_additions(self):
        """Test that concurrent points additions work correctly"""
        self.user.add_points(100, 'quiz_complete')
        self.user.add_points(200, 'project_create')

        self.user.refresh_from_db()
        self.assertEqual(self.user.total_points, 300)


class StreakTrackingTest(TestCase):
    """Tests for streak tracking functionality"""

    def setUp(self):
        self.user = User.objects.create_user(username='streakuser', email='streak@test.com', password='testpass123')

    def test_first_activity_sets_streak_to_one(self):
        """Test that first points activity sets streak to 1"""
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()

        self.assertEqual(self.user.current_streak_days, 1)
        self.assertEqual(self.user.longest_streak_days, 1)
        self.assertEqual(self.user.last_activity_date, timezone.now().date())

    def test_same_day_activity_doesnt_increment_streak(self):
        """Test that multiple activities on the same day don't increment streak"""
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak_days, 1)

        self.user.add_points(20, 'project_create')
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak_days, 1)

    @patch('django.utils.timezone.now')
    def test_consecutive_day_increments_streak(self, mock_now):
        """Test that activity on consecutive days increments streak"""
        # Day 1
        mock_now.return_value = datetime.datetime(2025, 1, 1, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak_days, 1)

        # Day 2
        mock_now.return_value = datetime.datetime(2025, 1, 2, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak_days, 2)

    @patch('django.utils.timezone.now')
    def test_missing_day_resets_streak(self, mock_now):
        """Test that missing a day resets streak to 1"""
        # Day 1
        mock_now.return_value = datetime.datetime(2025, 1, 1, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')

        # Day 2
        mock_now.return_value = datetime.datetime(2025, 1, 2, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')

        # Day 3
        mock_now.return_value = datetime.datetime(2025, 1, 3, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak_days, 3)

        # Skip to Day 5 (missed Day 4)
        mock_now.return_value = datetime.datetime(2025, 1, 5, 12, 0, 0, tzinfo=datetime.UTC)
        self.user.add_points(10, 'quiz_complete')
        self.user.refresh_from_db()

        self.assertEqual(self.user.current_streak_days, 1)
        self.assertEqual(self.user.longest_streak_days, 3)


class PointActivityModelTest(TestCase):
    """Tests for PointActivity model"""

    def setUp(self):
        self.user = User.objects.create_user(username='activityuser', email='activity@test.com', password='testpass123')

    def test_activity_records_tier_at_time(self):
        """Test that activity records tier at time of award"""
        self.assertEqual(self.user.tier, 'seedling')

        self.user.add_points(100, 'quiz_complete')

        activity = PointActivity.objects.filter(user=self.user).first()
        self.assertEqual(activity.tier_at_time, 'seedling')

        # Upgrade to sprout (needs 1000 total points)
        self.user.add_points(900, 'project_create')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'sprout')

        # New activity should record sprout tier
        activity2 = PointActivity.objects.filter(user=self.user).order_by('-created_at').first()
        self.assertEqual(activity2.tier_at_time, 'seedling')  # Was seedling when points were calculated


class ThriveCircleAPITest(APITestCase):
    """Tests for Thrive Circle API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(username='apiuser', email='api@test.com', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_my_status_endpoint(self):
        """Test GET /api/v1/me/thrive-circle/my_status/"""
        self.user.total_points = 1500
        self.user.tier = 'sprout'
        self.user.save()

        response = self.client.get('/api/v1/me/thrive-circle/my_status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_points', response.data)
        self.assertEqual(response.data['total_points'], 1500)
        self.assertEqual(response.data['tier'], 'sprout')

    def test_award_points_endpoint_valid(self):
        """Test POST /api/v1/me/thrive-circle/award_points/ with valid data"""
        response = self.client.post(
            '/api/v1/me/thrive-circle/award_points/',
            {'amount': 50, 'activity_type': 'comment', 'description': 'Posted helpful comment'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['total_points'], 50)

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated users cannot access endpoints"""
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/v1/me/thrive-circle/my_status/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class WeeklyGoalTest(TestCase):
    """Tests for weekly goals"""

    def setUp(self):
        self.user = User.objects.create_user(username='goaluser', email='goal@test.com', password='testpass123')
        self.week_start = get_week_start()

        self.goal = WeeklyGoal.objects.create(
            user=self.user,
            goal_type='activities_3',
            week_start=self.week_start,
            week_end=self.week_start + timedelta(days=6),
            target_progress=3,
            points_reward=30,
        )

    def test_goal_created_successfully(self):
        """Test that weekly goal is created"""
        self.assertEqual(self.goal.current_progress, 0)
        self.assertFalse(self.goal.is_completed)
        self.assertEqual(self.goal.points_reward, 30)

    def test_goal_progress_percentage(self):
        """Test goal progress percentage calculation"""
        self.assertEqual(self.goal.progress_percentage, 0)

        self.goal.current_progress = 1
        self.goal.save()
        self.assertEqual(self.goal.progress_percentage, 33)

        self.goal.current_progress = 3
        self.goal.save()
        self.assertEqual(self.goal.progress_percentage, 100)


class SideQuestTest(TestCase):
    """Tests for side quests"""

    def setUp(self):
        self.user = User.objects.create_user(username='questuser', email='quest@test.com', password='testpass123')
        self.quest = SideQuest.objects.create(
            title='Test Quest',
            description='Complete 5 quizzes',
            quest_type='quiz_mastery',
            difficulty='easy',
            points_reward=100,
            requirements={'target': 5},
        )

    def test_side_quest_created(self):
        """Test that side quest is created"""
        self.assertEqual(self.quest.title, 'Test Quest')
        self.assertEqual(self.quest.points_reward, 100)
        self.assertTrue(self.quest.is_active)

    def test_side_quest_is_available(self):
        """Test that active quest is available"""
        self.assertTrue(self.quest.is_available())

        self.quest.is_active = False
        self.quest.save()
        self.assertFalse(self.quest.is_available())

    def test_user_side_quest_completion(self):
        """Test user side quest completion awards points"""
        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=self.quest,
            target_progress=5,
            current_progress=5,  # Set progress to target to meet requirements
            status='in_progress',
        )

        self.assertFalse(user_quest.is_completed)
        self.assertEqual(self.user.total_points, 0)

        # Complete the quest (requirements now met)
        user_quest.complete()

        self.assertTrue(user_quest.is_completed)
        self.assertEqual(user_quest.points_awarded, 100)

        # Verify points were awarded to user
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_points, 100)

    def test_user_side_quest_completion_fails_without_progress(self):
        """Test that completing a quest without meeting requirements fails"""
        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=self.quest,
            target_progress=5,
            current_progress=0,  # Progress not met
            status='in_progress',
        )

        # Completing without meeting requirements should raise ValueError
        with self.assertRaises(ValueError) as context:
            user_quest.complete()

        self.assertIn('requirements not met', str(context.exception).lower())
        self.assertFalse(user_quest.is_completed)


class AutoTrackingIntegrationTest(TestCase):
    """
    Integration tests for auto-tracking user actions to quest progress.

    These tests verify the critical user flow:
    User performs action → Signal fires → Quest progress updates → Quest completes → Points awarded
    """

    def setUp(self):
        self.user = User.objects.create_user(username='trackuser', email='track@test.com', password='testpass123')
        # Reset points to 0 for clean test state
        self.user.total_points = 0
        self.user.save(update_fields=['total_points'])
        # Create a second user who owns projects (we can't track actions on own projects)
        self.project_owner = User.objects.create_user(
            username='projectowner', email='owner@test.com', password='testpass123'
        )

    def test_comment_increments_quest_progress(self):
        """
        Test that creating a comment automatically increments quest progress.

        Critical user flow:
        1. User has an active 'comment_post' quest
        2. User posts a comment on another user's project
        3. Signal fires and quest progress increments
        """
        from core.projects.models import Project, ProjectComment

        # Create a quest that tracks comment_post actions
        quest = SideQuest.objects.create(
            title='Community Contributor',
            description='Post 3 comments on projects',
            quest_type='comment_post',
            difficulty='easy',
            points_reward=50,
            requirements={'target': 3},
        )

        # User starts the quest
        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=quest,
            status='in_progress',
            current_progress=0,
            target_progress=3,
        )

        # Create a project owned by another user
        project = Project.objects.create(
            user=self.project_owner,
            title='Test Project',
            description='A test project',
            type='project',
        )

        # Verify initial state
        self.assertEqual(user_quest.current_progress, 0)
        self.assertEqual(self.user.total_points, 0)

        # User posts a comment (this triggers the signal)
        ProjectComment.objects.create(
            project=project,
            user=self.user,
            content='Great project!',
        )

        # Refresh and verify progress incremented
        user_quest.refresh_from_db()
        self.assertEqual(user_quest.current_progress, 1)

        # Post two more comments to complete the quest
        ProjectComment.objects.create(
            project=project,
            user=self.user,
            content='Really helpful!',
        )
        ProjectComment.objects.create(
            project=project,
            user=self.user,
            content='Thanks for sharing!',
        )

        # Verify quest is now completed
        user_quest.refresh_from_db()
        self.user.refresh_from_db()

        self.assertEqual(user_quest.current_progress, 3)
        self.assertTrue(user_quest.is_completed)
        self.assertEqual(user_quest.points_awarded, 50)
        self.assertEqual(self.user.total_points, 50)

    def test_commenting_own_project_does_not_increment_progress(self):
        """
        Test that commenting on your own project does NOT increment quest progress.

        This ensures users can't game the system by commenting on their own work.
        """
        from core.projects.models import Project, ProjectComment

        # Create a quest
        quest = SideQuest.objects.create(
            title='Comment Quest',
            description='Post comments',
            quest_type='comment_post',
            difficulty='easy',
            points_reward=25,
            requirements={'target': 1},
        )

        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=quest,
            status='in_progress',
            current_progress=0,
            target_progress=1,
        )

        # Create a project owned by the SAME user
        own_project = Project.objects.create(
            user=self.user,  # User's own project
            title='My Project',
            description='My own project',
            type='project',
        )

        # Comment on own project
        ProjectComment.objects.create(
            project=own_project,
            user=self.user,
            content='Self comment',
        )

        # Progress should NOT have incremented
        user_quest.refresh_from_db()
        self.assertEqual(user_quest.current_progress, 0)
        self.assertFalse(user_quest.is_completed)


class QuestCompletionAPITest(APITestCase):
    """
    Integration tests for quest completion API responses.

    These tests verify that when a quest is completed:
    1. The API returns proper completion data
    2. Points are correctly awarded
    3. The response includes data needed for celebration UI
    """

    def setUp(self):
        self.user = User.objects.create_user(username='apiuser2', email='api2@test.com', password='testpass123')
        self.client.force_authenticate(user=self.user)

        # Create a quest
        self.quest = SideQuest.objects.create(
            title='Test Quest for Celebration',
            description='A quest to test completion',
            quest_type='comment_post',
            difficulty='medium',
            points_reward=75,
            requirements={'target': 1},
        )

    def test_complete_endpoint_returns_celebration_data(self):
        """
        Test that the complete endpoint returns data needed for celebration UI.

        The frontend needs:
        - is_completed: true
        - points_awarded: number
        - side_quest: full quest details including title, description
        """
        # Create a quest that meets completion requirements
        UserSideQuest.objects.create(
            user=self.user,
            side_quest=self.quest,
            status='in_progress',
            current_progress=1,  # Meets target
            target_progress=1,
        )

        # Complete the quest via API
        response = self.client.post(f'/api/v1/me/side-quests/{self.quest.id}/complete/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify celebration data is present
        data = response.data
        self.assertTrue(data['is_completed'])
        self.assertEqual(data['points_awarded'], 75)
        self.assertIn('side_quest', data)
        self.assertEqual(data['side_quest']['title'], 'Test Quest for Celebration')
        self.assertEqual(data['side_quest']['points_reward'], 75)

        # Verify user received points
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_points, 75)

    def test_my_quests_shows_completed_status(self):
        """
        Test that my_quests endpoint shows completed quests correctly.

        Users should be able to see their completed quests with proper status.
        """
        # Create and complete a quest
        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=self.quest,
            status='in_progress',
            current_progress=1,
            target_progress=1,
        )
        user_quest.complete()

        # Fetch my quests
        response = self.client.get('/api/v1/me/side-quests/my-quests/?status=completed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        completed_quest = response.data[0]
        self.assertTrue(completed_quest['is_completed'])
        self.assertEqual(completed_quest['points_awarded'], 75)
        self.assertEqual(completed_quest['status'], 'completed')

    def test_cannot_complete_quest_without_progress(self):
        """
        Test that completing a quest without meeting requirements fails.

        This is a security test to ensure users can't bypass quest requirements.
        """
        # Create a quest that does NOT meet completion requirements
        user_quest = UserSideQuest.objects.create(
            user=self.user,
            side_quest=self.quest,
            status='in_progress',
            current_progress=0,  # Does not meet target
            target_progress=1,
        )

        # Try to complete via API
        response = self.client.post(f'/api/v1/me/side-quests/{self.quest.id}/complete/')

        # Should be rejected
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('requirements not met', response.data['error'].lower())

        # Verify quest is still not completed
        user_quest.refresh_from_db()
        self.assertFalse(user_quest.is_completed)

        # Verify no points were awarded
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_points, 0)


class CeleryTaskTest(TestCase):
    """Tests for Celery tasks"""

    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', email='user1@test.com', password='testpass123')
        self.user2 = User.objects.create_user(username='user2', email='user2@test.com', password='testpass123')

    def test_create_weekly_goals_task(self):
        """Test that create_weekly_goals creates goals for all active users"""
        result = create_weekly_goals()

        self.assertEqual(result['users'], 2)
        self.assertGreater(result['goals_created'], 0)

        # Verify goals were created
        goals = WeeklyGoal.objects.filter(user=self.user1)
        self.assertGreater(goals.count(), 0)

    def test_check_streak_bonuses_task(self):
        """Test that check_streak_bonuses awards bonuses to active users"""
        # Give users streaks
        self.user1.current_streak_days = 3
        self.user1.last_activity_date = timezone.now().date()
        self.user1.save()

        self.user2.current_streak_days = 5
        self.user2.last_activity_date = timezone.now().date()
        self.user2.save()

        result = check_streak_bonuses()

        self.assertEqual(result['active_users'], 2)
        self.assertEqual(result['bonuses_awarded'], 2)
        self.assertGreater(result['total_points'], 0)
