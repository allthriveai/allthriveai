"""Tests for referral models."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.referrals.models import Referral, ReferralCode, ReferralStatus
from core.users.models import User


class ReferralCodeModelTestCase(TestCase):
    """Test ReferralCode model methods."""

    def setUp(self):
        """Set up test users."""
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

    def test_create_referral_code(self):
        """Test creating a referral code."""
        code = ReferralCode.objects.create(user=self.user, code="TESTCODE")

        self.assertEqual(code.code, "TESTCODE")
        self.assertEqual(code.user, self.user)
        self.assertEqual(code.uses_count, 0)
        self.assertTrue(code.is_active)
        self.assertIsNone(code.max_uses)
        self.assertIsNone(code.expires_at)

    def test_referral_code_unique(self):
        """Test that referral codes must be unique."""
        ReferralCode.objects.create(user=self.user, code="UNIQUE")

        # Create another user
        other_user = User.objects.create_user(username="other", email="other@example.com", password="testpass123")

        # Should raise error on duplicate code
        with self.assertRaises(Exception):
            ReferralCode.objects.create(user=other_user, code="UNIQUE")

    def test_is_valid_active_code(self):
        """Test that active codes are valid."""
        code = ReferralCode.objects.create(user=self.user, code="ACTIVE", is_active=True)

        self.assertTrue(code.is_valid())

    def test_is_valid_inactive_code(self):
        """Test that inactive codes are invalid."""
        code = ReferralCode.objects.create(user=self.user, code="INACTIVE", is_active=False)

        self.assertFalse(code.is_valid())

    def test_is_valid_expired_code(self):
        """Test that expired codes are invalid."""
        past_date = timezone.now() - timedelta(days=1)
        code = ReferralCode.objects.create(user=self.user, code="EXPIRED", expires_at=past_date)

        self.assertFalse(code.is_valid())

    def test_is_valid_future_expiry(self):
        """Test that codes with future expiry are valid."""
        future_date = timezone.now() + timedelta(days=30)
        code = ReferralCode.objects.create(user=self.user, code="FUTURE", expires_at=future_date)

        self.assertTrue(code.is_valid())

    def test_is_valid_max_uses_reached(self):
        """Test that codes with max uses reached are invalid."""
        code = ReferralCode.objects.create(user=self.user, code="MAXED", max_uses=5, uses_count=5)

        self.assertFalse(code.is_valid())

    def test_is_valid_max_uses_not_reached(self):
        """Test that codes below max uses are valid."""
        code = ReferralCode.objects.create(user=self.user, code="NOTMAXED", max_uses=5, uses_count=3)

        self.assertTrue(code.is_valid())

    def test_increment_usage(self):
        """Test atomically incrementing usage count."""
        code = ReferralCode.objects.create(user=self.user, code="INCREMENT")

        self.assertEqual(code.uses_count, 0)

        # Increment once
        code.increment_usage()
        self.assertEqual(code.uses_count, 1)

        # Increment again
        code.increment_usage()
        self.assertEqual(code.uses_count, 2)

    def test_increment_usage_atomic(self):
        """Test that increment_usage is atomic."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        code = ReferralCode.objects.create(user=self.user, code="ATOMIC")

        # Capture queries to ensure we're using F() expression
        with CaptureQueriesContext(connection) as queries:
            code.increment_usage()

        # Check that UPDATE uses F() expression (atomic)
        update_queries = [q for q in queries if "UPDATE" in q["sql"]]
        self.assertTrue(len(update_queries) > 0)

    def test_str_representation(self):
        """Test string representation of referral code."""
        code = ReferralCode.objects.create(user=self.user, code="STRTEST")

        self.assertEqual(str(code), "STRTEST (testuser)")


class ReferralModelTestCase(TestCase):
    """Test Referral model methods."""

    def setUp(self):
        """Set up test users and referral codes."""
        self.referrer = User.objects.create_user(
            username="referrer", email="referrer@example.com", password="testpass123"
        )
        self.referred = User.objects.create_user(
            username="referred", email="referred@example.com", password="testpass123"
        )
        self.referral_code = ReferralCode.objects.create(user=self.referrer, code="REFER123")

    def test_create_referral(self):
        """Test creating a referral."""
        referral = Referral.objects.create(
            referrer=self.referrer, referred_user=self.referred, referral_code=self.referral_code
        )

        self.assertEqual(referral.referrer, self.referrer)
        self.assertEqual(referral.referred_user, self.referred)
        self.assertEqual(referral.referral_code, self.referral_code)
        self.assertEqual(referral.status, ReferralStatus.PENDING)
        self.assertEqual(referral.reward_data, {})

    def test_mark_completed(self):
        """Test marking a referral as completed."""
        referral = Referral.objects.create(
            referrer=self.referrer,
            referred_user=self.referred,
            referral_code=self.referral_code,
            status=ReferralStatus.PENDING,
        )

        referral.mark_completed()
        referral.refresh_from_db()

        self.assertEqual(referral.status, ReferralStatus.COMPLETED)

    def test_mark_completed_only_from_pending(self):
        """Test that mark_completed only works from PENDING status."""
        # Create already completed referral
        referral = Referral.objects.create(
            referrer=self.referrer,
            referred_user=self.referred,
            referral_code=self.referral_code,
            status=ReferralStatus.COMPLETED,
        )

        # Try to mark completed again (should not change)
        referral.mark_completed()
        referral.refresh_from_db()

        # Status should remain COMPLETED, not change to something else
        self.assertEqual(referral.status, ReferralStatus.COMPLETED)

    def test_mark_rewarded_from_pending(self):
        """Test marking a referral as rewarded from pending status."""
        referral = Referral.objects.create(
            referrer=self.referrer,
            referred_user=self.referred,
            referral_code=self.referral_code,
            status=ReferralStatus.PENDING,
        )

        reward_info = {"type": "credit", "amount": 10}
        referral.mark_rewarded(reward_info)
        referral.refresh_from_db()

        self.assertEqual(referral.status, ReferralStatus.REWARDED)
        self.assertEqual(referral.reward_data["type"], "credit")
        self.assertEqual(referral.reward_data["amount"], 10)

    def test_mark_rewarded_from_completed(self):
        """Test marking a referral as rewarded from completed status."""
        referral = Referral.objects.create(
            referrer=self.referrer,
            referred_user=self.referred,
            referral_code=self.referral_code,
            status=ReferralStatus.COMPLETED,
        )

        referral.mark_rewarded({"type": "bonus"})
        referral.refresh_from_db()

        self.assertEqual(referral.status, ReferralStatus.REWARDED)

    def test_mark_rewarded_without_reward_info(self):
        """Test marking as rewarded without providing reward info."""
        referral = Referral.objects.create(
            referrer=self.referrer,
            referred_user=self.referred,
            referral_code=self.referral_code,
            status=ReferralStatus.PENDING,
        )

        referral.mark_rewarded()
        referral.refresh_from_db()

        self.assertEqual(referral.status, ReferralStatus.REWARDED)
        self.assertEqual(referral.reward_data, {})

    def test_str_representation(self):
        """Test string representation of referral."""
        referral = Referral.objects.create(
            referrer=self.referrer, referred_user=self.referred, referral_code=self.referral_code
        )

        expected = "referrer → referred (Pending)"
        self.assertEqual(str(referral), expected)

    def test_str_representation_without_referred_user(self):
        """Test string representation when referred_user is None."""
        referral = Referral.objects.create(referrer=self.referrer, referred_user=None, referral_code=self.referral_code)

        expected = "referrer → Unknown (Pending)"
        self.assertEqual(str(referral), expected)

    def test_referral_ordering(self):
        """Test that referrals are ordered by created_at descending."""
        # Create multiple referrals
        referral1 = Referral.objects.create(
            referrer=self.referrer, referred_user=self.referred, referral_code=self.referral_code
        )

        # Create another referred user
        referred2 = User.objects.create_user(
            username="referred2", email="referred2@example.com", password="testpass123"
        )

        referral2 = Referral.objects.create(
            referrer=self.referrer, referred_user=referred2, referral_code=self.referral_code
        )

        # Get all referrals
        referrals = list(Referral.objects.all())

        # Most recent should be first
        self.assertEqual(referrals[0].id, referral2.id)
        self.assertEqual(referrals[1].id, referral1.id)


class ReferralCodeUserRelationshipTestCase(TestCase):
    """Test the relationship between users and referral codes."""

    def test_user_can_have_one_referral_code(self):
        """Test that a user can only have one referral code."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        # Create first code
        code1 = ReferralCode.objects.create(user=user, code="CODE1")

        # Try to create second code for same user (should fail)
        with self.assertRaises(Exception):
            ReferralCode.objects.create(user=user, code="CODE2")

    def test_access_referral_code_from_user(self):
        """Test accessing referral code from user object."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        code = ReferralCode.objects.create(user=user, code="USERCODE")

        # Access via related name
        self.assertEqual(user.referral_code, code)
        self.assertEqual(user.referral_code.code, "USERCODE")

    def test_access_user_from_referral_code(self):
        """Test accessing user from referral code object."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        code = ReferralCode.objects.create(user=user, code="CODEUSER")

        self.assertEqual(code.user, user)
        self.assertEqual(code.user.username, "testuser")

    def test_referral_code_deleted_with_user(self):
        """Test that referral code is deleted when user is deleted."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        code = ReferralCode.objects.create(user=user, code="DELETETEST")
        code_id = code.id

        # Delete user
        user.delete()

        # Code should be deleted
        self.assertFalse(ReferralCode.objects.filter(id=code_id).exists())
