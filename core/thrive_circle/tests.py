"""
Tests for Thrive Circle gamification system.
"""

import datetime
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework import status
from rest_framework.test import APITestCase

from .models import UserTier, WeeklyGoal, XPActivity
from .services import XPService
from .tasks import check_streak_bonuses, create_weekly_goals
from .utils import get_week_start

User = get_user_model()


class UserTierModelTest(TestCase):
    """Tests for UserTier model"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')  # noqa: S106

    def test_create_user_tier(self):
        """Test creating a user tier"""
        tier = UserTier.objects.create(user=self.user)
        self.assertEqual(tier.tier, 'ember')
        self.assertEqual(tier.total_xp, 0)

    def test_tier_progression_ember_to_spark(self):
        """Test tier upgrade from Ember to Spark at 500 XP"""
        tier = UserTier.objects.create(user=self.user)

        tier.add_xp(500, 'quiz_complete', 'Test quiz')
        self.assertEqual(tier.tier, 'spark')
        self.assertEqual(tier.total_xp, 500)

    def test_tier_progression_ember_to_blaze(self):
        """Test tier upgrade from Ember to Blaze at 2000 XP"""
        tier = UserTier.objects.create(user=self.user)

        tier.add_xp(2000, 'special_event', 'Bonus XP')
        self.assertEqual(tier.tier, 'blaze')
        self.assertEqual(tier.total_xp, 2000)

    def test_tier_progression_to_phoenix(self):
        """Test tier upgrade to Phoenix at 10000 XP"""
        tier = UserTier.objects.create(user=self.user)

        tier.add_xp(10000, 'special_event', 'Massive XP')
        self.assertEqual(tier.tier, 'phoenix')
        self.assertEqual(tier.total_xp, 10000)

    def test_incremental_tier_progression(self):
        """Test tier upgrades happen incrementally"""
        tier = UserTier.objects.create(user=self.user)

        # Ember -> Spark
        tier.add_xp(300, 'quiz_complete')
        self.assertEqual(tier.tier, 'ember')

        tier.add_xp(200, 'quiz_complete')
        self.assertEqual(tier.tier, 'spark')
        self.assertEqual(tier.total_xp, 500)

        # Spark -> Blaze
        tier.add_xp(1500, 'project_create')
        self.assertEqual(tier.tier, 'blaze')
        self.assertEqual(tier.total_xp, 2000)

    def test_add_xp_creates_activity(self):
        """Test that adding XP creates an activity record"""
        tier = UserTier.objects.create(user=self.user)

        tier.add_xp(100, 'quiz_complete', 'Test quiz completed')

        activity = XPActivity.objects.filter(user=self.user).first()
        self.assertIsNotNone(activity)
        self.assertEqual(activity.amount, 100)
        self.assertEqual(activity.activity_type, 'quiz_complete')
        self.assertEqual(activity.description, 'Test quiz completed')

    def test_add_xp_rejects_negative(self):
        """Test that negative XP is rejected"""
        tier = UserTier.objects.create(user=self.user)

        with self.assertRaises(ValueError):
            tier.add_xp(-50, 'quiz_complete')

    def test_add_xp_rejects_zero(self):
        """Test that zero XP is rejected"""
        tier = UserTier.objects.create(user=self.user)

        with self.assertRaises(ValueError):
            tier.add_xp(0, 'quiz_complete')

    def test_concurrent_xp_additions(self):
        """Test that concurrent XP additions don't create race conditions"""
        tier = UserTier.objects.create(user=self.user)

        # Simulate concurrent additions (in real scenario these would be separate requests)
        tier.add_xp(100, 'quiz_complete')
        tier_reloaded = UserTier.objects.get(pk=tier.pk)
        tier_reloaded.add_xp(200, 'project_create')

        # Total should be 300
        tier.refresh_from_db()
        self.assertEqual(tier.total_xp, 300)

    def test_one_tier_per_user(self):
        """Test that each user can only have one UserTier"""
        UserTier.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserTier.objects.create(user=self.user)


class XPServiceTest(TestCase):
    """Tests for XP service layer"""

    def test_calculate_quiz_xp_perfect_score(self):
        """Test XP calculation for perfect quiz score"""
        xp = XPService.calculate_quiz_xp(100)
        # Base (10) + Bonus (100 * 0.4 = 40) + Perfect bonus (10) = 60
        self.assertEqual(xp, 60)

    def test_calculate_quiz_xp_zero_score(self):
        """Test XP calculation for zero quiz score"""
        xp = XPService.calculate_quiz_xp(0)
        # Base (10) + Bonus (0 * 0.4 = 0) = 10
        self.assertEqual(xp, 10)

    def test_calculate_quiz_xp_mid_score(self):
        """Test XP calculation for mid-range quiz score"""
        xp = XPService.calculate_quiz_xp(75)
        # Base (10) + Bonus (75 * 0.4 = 30) = 40
        self.assertEqual(xp, 40)

    def test_calculate_quiz_xp_invalid_score(self):
        """Test that invalid scores are rejected"""
        with self.assertRaises(ValueError):
            XPService.calculate_quiz_xp(-10)

        with self.assertRaises(ValueError):
            XPService.calculate_quiz_xp(150)

    def test_get_tier_for_xp(self):
        """Test tier determination from XP"""
        self.assertEqual(XPService.get_tier_for_xp(0), 'ember')
        self.assertEqual(XPService.get_tier_for_xp(499), 'ember')
        self.assertEqual(XPService.get_tier_for_xp(500), 'spark')
        self.assertEqual(XPService.get_tier_for_xp(1999), 'spark')
        self.assertEqual(XPService.get_tier_for_xp(2000), 'blaze')
        self.assertEqual(XPService.get_tier_for_xp(4999), 'blaze')
        self.assertEqual(XPService.get_tier_for_xp(5000), 'beacon')
        self.assertEqual(XPService.get_tier_for_xp(9999), 'beacon')
        self.assertEqual(XPService.get_tier_for_xp(10000), 'phoenix')
        self.assertEqual(XPService.get_tier_for_xp(99999), 'phoenix')

    def test_get_xp_to_next_tier(self):
        """Test XP needed to reach next tier"""
        next_tier, xp_needed = XPService.get_xp_to_next_tier(100)
        self.assertEqual(next_tier, 'spark')
        self.assertEqual(xp_needed, 400)  # 500 - 100

        next_tier, xp_needed = XPService.get_xp_to_next_tier(1500)
        self.assertEqual(next_tier, 'blaze')
        self.assertEqual(xp_needed, 500)  # 2000 - 1500

        next_tier, xp_needed = XPService.get_xp_to_next_tier(15000)
        self.assertEqual(next_tier, 'phoenix')
        self.assertEqual(xp_needed, 0)  # Already at max

    def test_validate_xp_award_positive(self):
        """Test XP validation accepts valid awards"""
        # Should not raise
        XPService.validate_xp_award(50, 'quiz_complete')
        XPService.validate_xp_award(1, 'comment')
        XPService.validate_xp_award(1000, 'special_event')

    def test_validate_xp_award_negative(self):
        """Test XP validation rejects negative awards"""
        with self.assertRaises(ValueError):
            XPService.validate_xp_award(-50, 'quiz_complete')

    def test_validate_xp_award_zero(self):
        """Test XP validation rejects zero awards"""
        with self.assertRaises(ValueError):
            XPService.validate_xp_award(0, 'quiz_complete')

    def test_validate_xp_award_excessive(self):
        """Test XP validation rejects excessive awards"""
        with self.assertRaises(ValueError):
            XPService.validate_xp_award(10000, 'quiz_complete')


class ThriveCircleAPITest(APITestCase):
    """Tests for Thrive Circle API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')  # noqa: S106
        self.client.force_authenticate(user=self.user)

    def test_my_status_endpoint(self):
        """Test GET /api/v1/me/thrive-circle/my_status/"""
        tier = UserTier.objects.create(user=self.user, total_xp=0)
        # Set to spark tier manually for testing
        tier.total_xp = 600
        tier.tier = 'spark'
        tier.save()

        response = self.client.get('/api/v1/me/thrive-circle/my_status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tier_status', response.data)
        self.assertIn('recent_activities', response.data)
        self.assertEqual(response.data['tier_status']['total_xp'], 600)
        self.assertEqual(response.data['tier_status']['tier'], 'spark')

    def test_award_xp_endpoint_valid(self):
        """Test POST /api/v1/me/thrive-circle/award_xp/ with valid data"""
        UserTier.objects.create(user=self.user)

        response = self.client.post(
            '/api/v1/me/thrive-circle/award_xp/',
            {'amount': 50, 'activity_type': 'comment', 'description': 'Posted helpful comment'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tier_status']['total_xp'], 50)
        self.assertFalse(response.data['tier_upgraded'])

    def test_award_xp_endpoint_rejects_system_activities(self):
        """Test that system activity types are rejected via API"""
        UserTier.objects.create(user=self.user)

        response = self.client.post(
            '/api/v1/me/thrive-circle/award_xp/',
            {
                'amount': 50,
                'activity_type': 'quiz_complete',  # System-only
                'description': 'Trying to cheat',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_award_xp_endpoint_validates_amount(self):
        """Test that excessive XP amounts are rejected"""
        UserTier.objects.create(user=self.user)

        response = self.client.post(
            '/api/v1/me/thrive-circle/award_xp/',
            {
                'amount': 10000,  # Exceeds max
                'activity_type': 'comment',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated users cannot access endpoints"""
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/v1/me/thrive-circle/my_status/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class StreakTrackingTest(TestCase):
    """Tests for Phase 2 streak tracking functionality"""

    def setUp(self):
        self.user = User.objects.create_user(username='streakuser', email='streak@test.com', password='test123')  # noqa: S106
        self.tier = UserTier.objects.create(user=self.user)

    def test_first_activity_sets_streak_to_one(self):
        """Test that first XP activity sets streak to 1"""
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()

        self.assertEqual(self.tier.current_streak_days, 1)
        self.assertEqual(self.tier.longest_streak_days, 1)
        self.assertEqual(self.tier.last_activity_date, timezone.now().date())

    def test_same_day_activity_doesnt_increment_streak(self):
        """Test that multiple activities on the same day don't increment streak"""
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 1)

        # Second activity same day
        self.tier.add_xp(20, 'project_create')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 1)  # Still 1, not 2

    @patch('django.utils.timezone.now')
    def test_consecutive_day_increments_streak(self, mock_now):
        """Test that activity on consecutive days increments streak"""
        # Day 1
        mock_now.return_value = datetime.datetime(2025, 1, 1, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 1)

        # Day 2 (next day)
        mock_now.return_value = datetime.datetime(2025, 1, 2, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 2)
        self.assertEqual(self.tier.longest_streak_days, 2)

        # Day 3
        mock_now.return_value = datetime.datetime(2025, 1, 3, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 3)
        self.assertEqual(self.tier.longest_streak_days, 3)

    @patch('django.utils.timezone.now')
    def test_missing_day_resets_streak(self, mock_now):
        """Test that missing a day resets streak to 1"""
        # Build up a 3-day streak
        mock_now.return_value = datetime.datetime(2025, 1, 1, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        mock_now.return_value = datetime.datetime(2025, 1, 2, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        mock_now.return_value = datetime.datetime(2025, 1, 3, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 3)

        # Skip to Day 5 (missed Day 4)
        mock_now.return_value = datetime.datetime(2025, 1, 5, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()

        self.assertEqual(self.tier.current_streak_days, 1)  # Reset to 1
        self.assertEqual(self.tier.longest_streak_days, 3)  # But longest is preserved

    @patch('django.utils.timezone.now')
    def test_longest_streak_preserved(self, mock_now):
        """Test that longest streak is preserved even after current resets"""
        # Build a 5-day streak
        for day in range(1, 6):
            mock_now.return_value = datetime.datetime(2025, 1, day, 12, 0, 0, tzinfo=datetime.UTC)
            self.tier.add_xp(10, 'quiz_complete')

        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 5)
        self.assertEqual(self.tier.longest_streak_days, 5)

        # Break streak
        mock_now.return_value = datetime.datetime(2025, 1, 10, 12, 0, 0, tzinfo=datetime.UTC)
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.refresh_from_db()

        self.assertEqual(self.tier.current_streak_days, 1)
        self.assertEqual(self.tier.longest_streak_days, 5)  # Still 5

    def test_concurrent_streak_updates(self):
        """Test that concurrent streak updates don't create race conditions (uses F() expressions)"""
        # This simulates concurrent requests updating the same user's streak
        self.tier.add_xp(10, 'quiz_complete')

        # Reload tier to simulate separate request
        tier_copy = UserTier.objects.get(pk=self.tier.pk)
        tier_copy.add_xp(20, 'project_create')

        # Both should see streak = 1 (same day)
        self.tier.refresh_from_db()
        self.assertEqual(self.tier.current_streak_days, 1)
        self.assertEqual(self.tier.total_xp, 30)


class WeeklyGoalTest(TestCase):
    """Tests for Phase 2 weekly goals functionality"""

    def setUp(self):
        self.user = User.objects.create_user(username='goaluser', email='goal@test.com', password='test123')  # noqa: S106
        self.tier = UserTier.objects.create(user=self.user)
        self.week_start = get_week_start()

        # Create a goal
        self.goal = WeeklyGoal.objects.create(
            user=self.user,
            goal_type='activities_3',
            week_start=self.week_start,
            week_end=self.week_start + timedelta(days=6),
            target_progress=3,
            xp_reward=30,
        )

    def test_goal_progress_increments(self):
        """Test that completing activities increments goal progress"""
        self.assertEqual(self.goal.current_progress, 0)

        # Complete a quiz (counts towards activities_3)
        self.tier.add_xp(10, 'quiz_complete')

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_progress, 1)

    def test_goal_completion_awards_bonus_xp(self):
        """Test that completing a goal awards bonus XP"""
        # Complete 2 activities
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.add_xp(10, 'project_create')

        self.tier.refresh_from_db()
        self.assertEqual(self.tier.total_xp, 20)

        # Complete 3rd activity - should trigger goal completion
        self.tier.add_xp(10, 'side_quest')

        self.tier.refresh_from_db()
        self.goal.refresh_from_db()

        # Original XP (30) + Goal bonus (30) = 60
        self.assertEqual(self.tier.total_xp, 60)
        self.assertTrue(self.goal.is_completed)
        self.assertIsNotNone(self.goal.completed_at)

    def test_no_infinite_recursion_on_goal_completion(self):
        """Test that goal completion bonus XP doesn't trigger infinite recursion"""
        # This was a critical bug - bonus XP award would call check_weekly_goals again
        self.tier.add_xp(10, 'quiz_complete')
        self.tier.add_xp(10, 'project_create')

        # This should complete the goal and award bonus WITHOUT infinite recursion
        self.tier.add_xp(10, 'side_quest')

        # Verify we're still alive (no RecursionError)
        self.tier.refresh_from_db()
        self.assertTrue(self.tier.total_xp > 0)

        # Verify only ONE weekly_goal activity was created
        goal_activities = XPActivity.objects.filter(user=self.user, activity_type='weekly_goal')
        self.assertEqual(goal_activities.count(), 1)

    def test_concurrent_goal_updates(self):
        """Test that concurrent goal progress updates don't lose data (uses F() expressions)"""
        # Simulate two concurrent quiz completions
        self.tier.add_xp(10, 'quiz_complete')

        # Reload tier to simulate separate request
        tier_copy = UserTier.objects.get(pk=self.tier.pk)
        tier_copy.add_xp(10, 'quiz_complete')

        # Goal should have progress = 2 (both increments counted)
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_progress, 2)

    def test_comment_activity_counts_towards_help_goal(self):
        """Test that comments count towards 'help_5' goal"""
        help_goal = WeeklyGoal.objects.create(
            user=self.user,
            goal_type='help_5',
            week_start=self.week_start,
            week_end=self.week_start + timedelta(days=6),
            target_progress=5,
            xp_reward=40,
        )

        self.tier.add_xp(5, 'comment', 'Helped someone')

        help_goal.refresh_from_db()
        self.assertEqual(help_goal.current_progress, 1)

    def test_completed_goal_not_incremented(self):
        """Test that already completed goals don't get incremented"""
        # Mark goal as completed
        self.goal.is_completed = True
        self.goal.current_progress = 3
        self.goal.save()

        # Try to add more activities
        self.tier.add_xp(10, 'quiz_complete')

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_progress, 3)  # Still 3, not 4

    def test_weekly_goals_api_endpoint(self):
        """Test GET /api/v1/me/thrive-circle/weekly_goals/"""
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get('/api/v1/me/thrive-circle/weekly_goals/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['goal_type'], 'activities_3')


class CeleryTaskTest(TestCase):
    """Tests for Phase 2 Celery tasks"""

    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', email='user1@test.com', password='test123')  # noqa: S106
        self.user2 = User.objects.create_user(username='user2', email='user2@test.com', password='test123')  # noqa: S106
        UserTier.objects.create(user=self.user1)
        UserTier.objects.create(user=self.user2)

    def test_create_weekly_goals_task(self):
        """Test that create_weekly_goals creates goals for all active users"""
        result = create_weekly_goals()

        self.assertEqual(result['users'], 2)
        self.assertEqual(result['goals_created'], 8)  # 2 users × 4 goal types

        # Verify goals were created
        week_start = get_week_start()
        user1_goals = WeeklyGoal.objects.filter(user=self.user1, week_start=week_start)
        self.assertEqual(user1_goals.count(), 4)

        user2_goals = WeeklyGoal.objects.filter(user=self.user2, week_start=week_start)
        self.assertEqual(user2_goals.count(), 4)

    def test_create_weekly_goals_idempotent(self):
        """Test that running create_weekly_goals twice doesn't duplicate goals"""
        create_weekly_goals()
        result = create_weekly_goals()  # Run again

        # Should not create duplicates
        self.assertEqual(result['goals_created'], 0)

        week_start = get_week_start()
        total_goals = WeeklyGoal.objects.filter(week_start=week_start).count()
        self.assertEqual(total_goals, 8)  # Still 8, not 16

    @patch('django.utils.timezone.now')
    def test_check_streak_bonuses_task(self, mock_now):
        """Test that check_streak_bonuses awards XP to users with streaks"""
        mock_now.return_value = datetime.datetime(2025, 1, 5, 12, 0, 0, tzinfo=datetime.UTC)

        # Give user1 a 3-day streak
        tier1 = UserTier.objects.get(user=self.user1)
        tier1.current_streak_days = 3
        tier1.last_activity_date = date(2025, 1, 5)
        tier1.save()

        # Give user2 a 5-day streak
        tier2 = UserTier.objects.get(user=self.user2)
        tier2.current_streak_days = 5
        tier2.last_activity_date = date(2025, 1, 5)
        tier2.save()

        result = check_streak_bonuses()

        self.assertEqual(result['active_users'], 2)
        self.assertEqual(result['bonuses_awarded'], 2)
        self.assertEqual(result['total_xp'], 40)  # (3*5) + (5*5) = 15 + 25 = 40

        # Verify XP was awarded
        tier1.refresh_from_db()
        tier2.refresh_from_db()
        self.assertEqual(tier1.total_xp, 15)
        self.assertEqual(tier2.total_xp, 25)

    def test_check_streak_bonuses_handles_errors(self):
        """Test that check_streak_bonuses continues on error"""
        # Create a user with a streak
        tier = UserTier.objects.get(user=self.user1)
        tier.current_streak_days = 3
        tier.last_activity_date = timezone.now().date()
        tier.save()

        # Mock add_xp to raise an error
        with patch.object(UserTier, 'add_xp', side_effect=Exception('Test error')):
            result = check_streak_bonuses()

        # Task should complete with 1 failure
        self.assertEqual(result['failed'], 1)
        self.assertIn(self.user1.id, result['failed_user_ids'])

    def test_create_weekly_goals_performance(self):
        """Test that bulk_create is used for performance"""
        # Create 50 users
        users = []
        for i in range(50):
            user = User.objects.create_user(username=f'bulkuser{i}', email=f'bulk{i}@test.com', password='test123')  # noqa: S106
            UserTier.objects.create(user=user)
            users.append(user)

        # Run task and measure query count
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as context:
            result = create_weekly_goals()

        # Should use bulk_create (only a few queries, not 200+)
        # Exact count may vary, but should be much less than 50 users × 4 goals = 200
        self.assertLess(len(context.captured_queries), 50)
        self.assertEqual(result['goals_created'], 208)  # 52 users × 4 goals


class CircleProjectsAPITest(APITestCase):
    """Tests for circle_projects API endpoint"""

    def setUp(self):
        """Create test users with different tiers and their projects"""
        # Create users in different tiers
        self.ember_user1 = User.objects.create_user(
            username='ember1', email='ember1@test.com', password=get_random_string(12)
        )
        self.ember_user2 = User.objects.create_user(
            username='ember2', email='ember2@test.com', password=get_random_string(12)
        )
        self.spark_user1 = User.objects.create_user(
            username='spark1', email='spark1@test.com', password=get_random_string(12)
        )
        self.spark_user2 = User.objects.create_user(
            username='spark2', email='spark2@test.com', password=get_random_string(12)
        )
        self.blaze_user = User.objects.create_user(
            username='blaze1', email='blaze1@test.com', password=get_random_string(12)
        )

        # Create tier statuses
        self.ember_tier1 = UserTier.objects.create(user=self.ember_user1, tier='ember', total_xp=0)
        self.ember_tier2 = UserTier.objects.create(user=self.ember_user2, tier='ember', total_xp=100)
        self.spark_tier1 = UserTier.objects.create(user=self.spark_user1, tier='spark', total_xp=600)
        self.spark_tier2 = UserTier.objects.create(user=self.spark_user2, tier='spark', total_xp=800)
        self.blaze_tier = UserTier.objects.create(user=self.blaze_user, tier='blaze', total_xp=1600)

        # Import Project model
        from core.projects.models import Project

        # Create published projects for each user
        self.ember1_project = Project.objects.create(
            user=self.ember_user1,
            title='Ember Project 1',
            slug='ember-project-1',
            description='A project by ember user 1',
            type='other',
            is_published=True,
            is_archived=False,
            published_at=timezone.now(),
        )

        self.ember2_project = Project.objects.create(
            user=self.ember_user2,
            title='Ember Project 2',
            slug='ember-project-2',
            description='A project by ember user 2',
            type='other',
            is_published=True,
            is_archived=False,
            published_at=timezone.now(),
        )

        self.spark1_project = Project.objects.create(
            user=self.spark_user1,
            title='Spark Project 1',
            slug='spark-project-1',
            description='A project by spark user 1',
            type='other',
            is_published=True,
            is_archived=False,
            published_at=timezone.now(),
        )

        self.spark2_project = Project.objects.create(
            user=self.spark_user2,
            title='Spark Project 2',
            slug='spark-project-2',
            description='A project by spark user 2',
            type='other',
            is_published=True,
            is_archived=False,
            published_at=timezone.now(),
        )

        self.blaze_project = Project.objects.create(
            user=self.blaze_user,
            title='Blaze Project 1',
            slug='blaze-project-1',
            description='A project by blaze user',
            type='other',
            is_published=True,
            is_archived=False,
            published_at=timezone.now(),
        )

        # Create an unpublished project (should not appear in results)
        self.unpublished_project = Project.objects.create(
            user=self.ember_user1,
            title='Unpublished Project',
            slug='unpublished-project',
            description='Not published',
            type='other',
            is_published=False,
            is_archived=False,
        )

        # Create an archived project (should not appear in results)
        self.archived_project = Project.objects.create(
            user=self.ember_user2,
            title='Archived Project',
            slug='archived-project',
            description='Archived',
            type='other',
            is_published=True,
            is_archived=True,
            published_at=timezone.now(),
        )

    def test_ember_user_sees_only_ember_projects(self):
        """Ember users should only see projects from other Ember users"""
        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()

        # Should only see ember2's project (not own project, not other tiers)
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]['slug'], 'ember-project-2')

    def test_spark_user_sees_only_spark_projects(self):
        """Spark users should only see projects from other Spark users"""
        self.client.force_authenticate(user=self.spark_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()

        # Should only see spark2's project (not own project, not other tiers)
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]['slug'], 'spark-project-2')

    def test_user_does_not_see_own_projects(self):
        """Users should not see their own projects in circle feed"""
        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()

        # Should not include own project
        project_slugs = [p['slug'] for p in projects]
        self.assertNotIn('ember-project-1', project_slugs)

    def test_unpublished_projects_not_shown(self):
        """Unpublished projects should not appear in circle feed"""
        self.client.force_authenticate(user=self.ember_user2)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()

        # Should not include unpublished project
        project_slugs = [p['slug'] for p in projects]
        self.assertNotIn('unpublished-project', project_slugs)

    def test_archived_projects_not_shown(self):
        """Archived projects should not appear in circle feed"""
        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()

        # Should not include archived project
        project_slugs = [p['slug'] for p in projects]
        self.assertNotIn('archived-project', project_slugs)

    def test_tier_change_updates_visible_projects(self):
        """When a user's tier changes, they should see different projects"""
        # Start as ember user
        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')
        ember_projects = response.json()
        self.assertEqual(len(ember_projects), 1)
        self.assertEqual(ember_projects[0]['slug'], 'ember-project-2')

        # Upgrade to spark tier
        self.ember_tier1.tier = 'spark'
        self.ember_tier1.total_xp = 600
        self.ember_tier1.save()

        # Should now see spark projects
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')
        spark_projects = response.json()
        self.assertEqual(len(spark_projects), 2)
        spark_slugs = {p['slug'] for p in spark_projects}
        self.assertEqual(spark_slugs, {'spark-project-1', 'spark-project-2'})

    def test_limit_parameter_works(self):
        """Limit parameter should restrict number of results"""
        # Create more ember projects
        from core.projects.models import Project

        for i in range(10, 20):  # Start from 10 to avoid email conflicts
            user = User.objects.create_user(
                username=f'ember_user_{i}', email=f'ember_test_{i}@test.com', password=get_random_string(12)
            )
            UserTier.objects.create(user=user, tier='ember', total_xp=50)
            Project.objects.create(
                user=user,
                title=f'Ember Project {i}',
                slug=f'ember-project-extra-{i}',
                description='Extra project',
                type='other',
                is_published=True,
                is_archived=False,
                published_at=timezone.now(),
            )

        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/?limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.json()
        self.assertEqual(len(projects), 5)

    def test_max_limit_enforced(self):
        """Limit should not exceed 50"""
        self.client.force_authenticate(user=self.ember_user1)
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/?limit=100')

        # Should work but limit to 50 (even if we don't have 50 projects)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_user_denied(self):
        """Unauthenticated users should not access circle projects"""
        response = self.client.get('/api/v1/me/thrive-circle/circle-projects/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
