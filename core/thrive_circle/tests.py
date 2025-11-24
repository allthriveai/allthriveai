"""
Tests for Thrive Circle gamification system.
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import UserTier, XPActivity
from .services import XPService

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
