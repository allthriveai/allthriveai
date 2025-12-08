"""
Unit tests for achievement service and tracking functionality.
"""

from django.test import TestCase
from services.achievements.service import AchievementService

from core.achievements.models import Achievement, AchievementProgress, CriteriaType, UserAchievement
from core.users.models import User
from services.achievements.tracker import AchievementTracker


class AchievementServiceTestCase(TestCase):
    """Test cases for AchievementService."""

    def setUp(self):
        """Set up test fixtures."""
        # Create test user
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Create test achievements with different criteria types
        self.count_achievement = Achievement.objects.create(
            key='first_project',
            name='First Project',
            description='Create your first project',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=1,
            tracking_field='lifetime_projects_created',
            points=25,
            is_active=True,
        )

        self.threshold_achievement = Achievement.objects.create(
            key='ten_projects',
            name='Project Creator',
            description='Create 10 projects',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=10,
            tracking_field='lifetime_projects_created',
            points=100,
            is_active=True,
        )

        self.streak_achievement = Achievement.objects.create(
            key='week_streak',
            name='Week Warrior',
            description='Maintain a 7-day streak',
            category='streaks',
            criteria_type=CriteriaType.STREAK,
            criteria_value=7,
            tracking_field='current_streak_days',
            points=50,
            is_active=True,
        )

        self.cumulative_achievement = Achievement.objects.create(
            key='thousand_points',
            name='Point Master',
            description='Earn 1000 total points',
            category='engagement',
            criteria_type=CriteriaType.CUMULATIVE,
            criteria_value=1000,
            tracking_field='total_points',
            points=150,
            is_active=True,
        )

    def test_check_criteria_count_type_not_met(self):
        """Test COUNT criteria when threshold not met."""
        self.user.lifetime_projects_created = 0
        self.user.save()

        result = AchievementService._check_criteria(self.user, self.count_achievement)
        self.assertFalse(result)

    def test_check_criteria_count_type_met(self):
        """Test COUNT criteria when threshold is met."""
        self.user.lifetime_projects_created = 1
        self.user.save()

        result = AchievementService._check_criteria(self.user, self.count_achievement)
        self.assertTrue(result)

    def test_check_criteria_streak_type_not_met(self):
        """Test STREAK criteria when streak not long enough."""
        self.user.current_streak_days = 3
        self.user.save()

        result = AchievementService._check_criteria(self.user, self.streak_achievement)
        self.assertFalse(result)

    def test_check_criteria_streak_type_met(self):
        """Test STREAK criteria when streak is long enough."""
        self.user.current_streak_days = 7
        self.user.save()

        result = AchievementService._check_criteria(self.user, self.streak_achievement)
        self.assertTrue(result)

    def test_check_criteria_cumulative_type_met(self):
        """Test CUMULATIVE criteria when threshold is met."""
        self.user.total_points = 1000
        self.user.save()

        result = AchievementService._check_criteria(self.user, self.cumulative_achievement)
        self.assertTrue(result)

    def test_unlock_achievement_success(self):
        """Test successfully unlocking an achievement."""
        self.user.lifetime_projects_created = 1
        self.user.save()

        result = AchievementService.unlock_achievement(self.user, self.count_achievement)

        self.assertTrue(result)
        self.assertTrue(UserAchievement.objects.filter(user=self.user, achievement=self.count_achievement).exists())

        # Verify user stats updated
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_achievements_unlocked, 1)
        self.assertIsNotNone(self.user.last_achievement_earned_at)

    def test_unlock_achievement_already_owned(self):
        """Test that achievement can't be unlocked twice."""
        # First unlock
        UserAchievement.objects.create(user=self.user, achievement=self.count_achievement)

        # Try to unlock again
        result = AchievementService.unlock_achievement(self.user, self.count_achievement)

        self.assertFalse(result)
        # Should still only have 1
        self.assertEqual(UserAchievement.objects.filter(user=self.user).count(), 1)

    def test_unlock_achievement_awards_points(self):
        """Test that unlocking achievement awards points."""
        initial_points = self.user.total_points

        self.user.lifetime_projects_created = 1
        self.user.save()

        AchievementService.unlock_achievement(self.user, self.count_achievement)

        self.user.refresh_from_db()
        # Should have initial points + achievement points
        self.assertEqual(self.user.total_points, initial_points + self.count_achievement.points)

    def test_check_and_unlock_achievements_multiple(self):
        """Test checking and unlocking multiple achievements at once."""
        # Set user stats to meet multiple achievements
        self.user.lifetime_projects_created = 10
        self.user.total_points = 1000
        self.user.save()

        unlocked = AchievementService.check_and_unlock_achievements(self.user)

        # Should unlock both COUNT achievements and CUMULATIVE achievement
        self.assertEqual(len(unlocked), 3)
        self.assertIn(self.count_achievement, unlocked)
        self.assertIn(self.threshold_achievement, unlocked)
        self.assertIn(self.cumulative_achievement, unlocked)

    def test_update_progress(self):
        """Test updating achievement progress."""
        self.user.lifetime_projects_created = 5
        self.user.save()

        progress = AchievementService.update_progress(self.user, self.threshold_achievement, new_value=5)

        self.assertEqual(progress.current_value, 5)
        self.assertEqual(progress.percentage, 50)  # 5/10 = 50%
        self.assertFalse(progress.is_complete)

    def test_update_progress_complete(self):
        """Test progress when achievement criteria is met."""
        progress = AchievementService.update_progress(self.user, self.threshold_achievement, new_value=10)

        self.assertEqual(progress.percentage, 100)
        self.assertTrue(progress.is_complete)

    def test_get_user_stat(self):
        """Test getting user stat value."""
        self.user.lifetime_projects_created = 5
        self.user.save()

        value = AchievementService._get_user_stat(self.user, 'lifetime_projects_created')
        self.assertEqual(value, 5)

    def test_get_user_stat_nonexistent_field(self):
        """Test getting nonexistent user stat returns 0."""
        value = AchievementService._get_user_stat(self.user, 'nonexistent_field')
        self.assertEqual(value, 0)

    def test_get_user_achievements(self):
        """Test retrieving user's earned and in-progress achievements."""
        # Earn one achievement
        UserAchievement.objects.create(user=self.user, achievement=self.count_achievement)

        # Create in-progress for another
        AchievementProgress.objects.create(user=self.user, achievement=self.threshold_achievement, current_value=5)

        data = AchievementService.get_user_achievements(self.user)

        self.assertEqual(len(data['earned']), 1)
        self.assertEqual(len(data['in_progress']), 1)

    def test_reset_user_achievements(self):
        """Test resetting all achievements for a user."""
        # Create some earned achievements
        UserAchievement.objects.create(user=self.user, achievement=self.count_achievement)
        UserAchievement.objects.create(user=self.user, achievement=self.threshold_achievement)

        # Create some progress
        AchievementProgress.objects.create(user=self.user, achievement=self.streak_achievement, current_value=3)

        self.user.total_achievements_unlocked = 2
        self.user.save()

        count = AchievementService.reset_user_achievements(self.user)

        self.assertEqual(count, 2)
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_achievements_unlocked, 0)
        self.assertIsNone(self.user.last_achievement_earned_at)
        self.assertEqual(UserAchievement.objects.filter(user=self.user).count(), 0)
        self.assertEqual(AchievementProgress.objects.filter(user=self.user).count(), 0)


class AchievementTrackerTestCase(TestCase):
    """Test cases for AchievementTracker."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username='trackertest', email='tracker@example.com', password='testpass123'
        )

        # Create achievements for tracking
        self.project_achievement = Achievement.objects.create(
            key='first_project',
            name='First Project',
            description='Create your first project',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=1,
            tracking_field='lifetime_projects_created',
            points=25,
            is_active=True,
        )

        self.quiz_achievement = Achievement.objects.create(
            key='first_quiz',
            name='Quiz Master',
            description='Complete your first quiz',
            category='engagement',
            criteria_type=CriteriaType.COUNT,
            criteria_value=1,
            tracking_field='lifetime_quizzes_completed',
            points=15,
            is_active=True,
        )

    def test_track_project_created(self):
        """Test tracking project creation."""
        self.assertEqual(self.user.lifetime_projects_created, 0)

        unlocked = AchievementTracker.track_project_created(self.user)

        self.user.refresh_from_db()
        self.assertEqual(self.user.lifetime_projects_created, 1)
        self.assertIn(self.project_achievement, unlocked)

    def test_track_quiz_completed(self):
        """Test tracking quiz completion."""
        self.assertEqual(self.user.lifetime_quizzes_completed, 0)

        unlocked = AchievementTracker.track_quiz_completed(self.user)

        self.user.refresh_from_db()
        self.assertEqual(self.user.lifetime_quizzes_completed, 1)
        self.assertIn(self.quiz_achievement, unlocked)

    def test_track_side_quest_completed(self):
        """Test tracking side quest completion."""
        initial = self.user.lifetime_side_quests_completed

        AchievementTracker.track_side_quest_completed(self.user)

        self.user.refresh_from_db()
        self.assertEqual(self.user.lifetime_side_quests_completed, initial + 1)

    def test_track_comment_posted(self):
        """Test tracking comment posting."""
        initial = self.user.lifetime_comments_posted

        AchievementTracker.track_comment_posted(self.user)

        self.user.refresh_from_db()
        self.assertEqual(self.user.lifetime_comments_posted, initial + 1)

    def test_track_battle_completed(self):
        """Test tracking battle completion."""
        # Should not raise an error even without battle-specific fields
        unlocked = AchievementTracker.track_battle_completed(self.user, battle_type='won')

        # Should return empty list since no battle achievements exist
        self.assertEqual(len(unlocked), 0)

    def test_track_streak_milestone(self):
        """Test tracking streak milestone."""
        self.user.current_streak_days = 7
        self.user.save()

        # Should check for achievements without error
        unlocked = AchievementTracker.track_streak_milestone(self.user)

        # No streak achievements in this test, so empty
        self.assertEqual(len(unlocked), 0)

    def test_track_points_milestone(self):
        """Test tracking points milestone."""
        self.user.total_points = 500
        self.user.save()

        unlocked = AchievementTracker.track_points_milestone(self.user)

        # No cumulative achievements in this test, so empty
        self.assertEqual(len(unlocked), 0)

    def test_multiple_tracking_calls(self):
        """Test multiple consecutive tracking calls update counters correctly."""
        AchievementTracker.track_project_created(self.user)
        AchievementTracker.track_project_created(self.user)
        AchievementTracker.track_quiz_completed(self.user)

        self.user.refresh_from_db()
        self.assertEqual(self.user.lifetime_projects_created, 2)
        self.assertEqual(self.user.lifetime_quizzes_completed, 1)

    def test_update_achievement_progress(self):
        """Test that progress is updated when tracking activities."""
        AchievementTracker.track_project_created(self.user)

        progress = AchievementProgress.objects.get(user=self.user, achievement=self.project_achievement)

        self.assertEqual(progress.current_value, 1)
        self.assertTrue(progress.is_complete)


class AchievementIntegrationTestCase(TestCase):
    """Integration tests for achievement system."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username='integrationtest', email='integration@example.com', password='testpass123'
        )

        # Create a progression of achievements
        self.first_project = Achievement.objects.create(
            key='first_project',
            name='First Project',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=1,
            tracking_field='lifetime_projects_created',
            points=25,
            is_active=True,
        )

        self.five_projects = Achievement.objects.create(
            key='five_projects',
            name='Prolific Creator',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=5,
            tracking_field='lifetime_projects_created',
            points=75,
            is_active=True,
        )

        self.ten_projects = Achievement.objects.create(
            key='ten_projects',
            name='Legendary Builder',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=10,
            tracking_field='lifetime_projects_created',
            points=150,
            is_active=True,
        )

    def test_progressive_achievement_unlock(self):
        """Test unlocking achievements progressively as user meets criteria."""
        # Track 1 project
        unlocked = AchievementTracker.track_project_created(self.user)
        self.assertIn(self.first_project, unlocked)
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_achievements_unlocked, 1)

        # Track 4 more projects (total 5)
        # Each track_project_created unlocks achievements for the new state
        for _ in range(4):
            AchievementTracker.track_project_created(self.user)

        # The last track_project_created call should have unlocked five_projects
        # Check manually since it happens in the last track call
        unlocked = AchievementService.check_and_unlock_achievements(self.user)
        # Five projects should be unlocked by now
        user_achievements = UserAchievement.objects.filter(user=self.user)
        achievement_keys = {ua.achievement.key for ua in user_achievements}
        self.assertIn('five_projects', achievement_keys)
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_achievements_unlocked, 2)

        # Track 5 more projects (total 10)
        for _ in range(5):
            AchievementTracker.track_project_created(self.user)

        unlocked = AchievementService.check_and_unlock_achievements(self.user)
        user_achievements = UserAchievement.objects.filter(user=self.user)
        achievement_keys = {ua.achievement.key for ua in user_achievements}
        self.assertIn('ten_projects', achievement_keys)
        self.user.refresh_from_db()
        self.assertEqual(self.user.total_achievements_unlocked, 3)

    def test_secret_achievement_handling(self):
        """Test that secret achievements are handled correctly."""
        secret_achievement = Achievement.objects.create(
            key='secret_builder',
            name='Hidden Achievement',
            category='projects',
            criteria_type=CriteriaType.COUNT,
            criteria_value=1,
            tracking_field='lifetime_projects_created',
            points=10,
            is_secret=True,
            is_active=True,
        )

        self.user.lifetime_projects_created = 1
        self.user.save()

        unlocked = AchievementService.check_and_unlock_achievements(self.user)

        # Should still be unlocked even if secret
        self.assertIn(secret_achievement, unlocked)

    def test_inactive_achievement_not_unlocked(self):
        """Test that inactive achievements cannot be unlocked."""
        # Make achievement inactive
        self.first_project.is_active = False
        self.first_project.save()

        self.user.lifetime_projects_created = 1
        self.user.save()

        unlocked = AchievementService.check_and_unlock_achievements(self.user)

        # Should not be in unlocked list
        self.assertNotIn(self.first_project, unlocked)

    def test_points_awarded_for_achievements(self):
        """Test that points are correctly awarded when achievements are unlocked."""
        initial_points = self.user.total_points

        AchievementTracker.track_project_created(self.user)
        self.user.refresh_from_db()

        # Should have initial + achievement points
        expected_points = initial_points + self.first_project.points
        self.assertEqual(self.user.total_points, expected_points)
