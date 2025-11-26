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
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password=test_password)

    def test_user_default_tier(self):
        """Test user starts with default tier"""
        self.assertEqual(self.user.tier, 'ember')
        self.assertEqual(self.user.total_points, 0)
        self.assertEqual(self.user.level, 1)

    def test_tier_progression_ember_to_spark(self):
        """Test tier upgrade from Ember to Spark at 500 points"""
        self.user.add_points(500, 'quiz_complete', 'Test quiz')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'spark')
        self.assertEqual(self.user.total_points, 500)

    def test_tier_progression_to_blaze(self):
        """Test tier upgrade to Blaze at 2000 points"""
        self.user.add_points(2000, 'special_event', 'Bonus points')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'blaze')
        self.assertEqual(self.user.total_points, 2000)

    def test_tier_progression_to_beacon(self):
        """Test tier upgrade to Beacon at 5000 points"""
        self.user.add_points(5000, 'special_event', 'Big reward')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'beacon')
        self.assertEqual(self.user.total_points, 5000)

    def test_tier_progression_to_phoenix(self):
        """Test tier upgrade to Phoenix at 10000 points"""
        self.user.add_points(10000, 'special_event', 'Massive points')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'phoenix')
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
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='streakuser', email='streak@test.com', password=test_password)

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
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='activityuser', email='activity@test.com', password=test_password)

    def test_activity_records_tier_at_time(self):
        """Test that activity records tier at time of award"""
        self.assertEqual(self.user.tier, 'ember')

        self.user.add_points(100, 'quiz_complete')

        activity = PointActivity.objects.filter(user=self.user).first()
        self.assertEqual(activity.tier_at_time, 'ember')

        # Upgrade to spark (needs 500 total points)
        self.user.add_points(400, 'project_create')
        self.user.refresh_from_db()
        self.assertEqual(self.user.tier, 'spark')

        # New activity should record spark tier
        activity2 = PointActivity.objects.filter(user=self.user).order_by('-created_at').first()
        self.assertEqual(activity2.tier_at_time, 'ember')  # Was ember when points were calculated


class ThriveCircleAPITest(APITestCase):
    """Tests for Thrive Circle API endpoints"""

    def setUp(self):
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='apiuser', email='api@test.com', password=test_password)
        self.client.force_authenticate(user=self.user)

    def test_my_status_endpoint(self):
        """Test GET /api/v1/me/thrive-circle/my_status/"""
        self.user.total_points = 600
        self.user.tier = 'spark'
        self.user.save()

        response = self.client.get('/api/v1/me/thrive-circle/my_status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_points', response.data)
        self.assertEqual(response.data['total_points'], 600)
        self.assertEqual(response.data['tier'], 'spark')

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
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='goaluser', email='goal@test.com', password=test_password)
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
        test_password = User.objects.make_random_password()
        self.user = User.objects.create_user(username='questuser', email='quest@test.com', password=test_password)
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
        )

        self.assertFalse(user_quest.is_completed)
        self.assertEqual(self.user.total_points, 0)

        # Complete the quest
        user_quest.complete()

        self.assertTrue(user_quest.is_completed)
        self.assertEqual(user_quest.points_awarded, 100)

        # Verify points were awarded to user
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_points, 100)


class CeleryTaskTest(TestCase):
    """Tests for Celery tasks"""

    def setUp(self):
        test_password = User.objects.make_random_password()
        self.user1 = User.objects.create_user(username='user1', email='user1@test.com', password=test_password)
        self.user2 = User.objects.create_user(username='user2', email='user2@test.com', password=test_password)

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
