"""Tests for referral API views."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.referrals.models import Referral, ReferralCode, ReferralStatus
from core.users.models import User


class ReferralCodeViewSetTestCase(TestCase):
    """Test ReferralCodeViewSet API endpoints."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.client.force_authenticate(user=self.user)

    def test_list_auto_creates_code(self):
        """Test that GET /me/referral-code/ auto-creates code if missing."""
        response = self.client.get("/api/v1/me/referral-code/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("code", response.data)
        self.assertEqual(response.data["user"], self.user.id)

        # Verify code was created in database
        self.assertTrue(ReferralCode.objects.filter(user=self.user).exists())

    def test_list_returns_existing_code(self):
        """Test that GET returns existing code without creating duplicate."""
        # Create code manually
        existing_code = ReferralCode.objects.create(user=self.user, code="EXISTING")

        response = self.client.get("/api/v1/me/referral-code/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["code"], "EXISTING")
        self.assertEqual(response.data["id"], existing_code.id)

        # Verify no duplicate was created
        self.assertEqual(ReferralCode.objects.filter(user=self.user).count(), 1)

    def test_list_requires_authentication(self):
        """Test that GET /me/referral-code/ requires authentication."""
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/v1/me/referral-code/")
        self.assertEqual(response.status_code, 401)

    def test_stats_endpoint(self):
        """Test GET /me/referral-code/stats/ returns correct statistics."""
        # Create referral code
        code = ReferralCode.objects.create(user=self.user, code="STATSTEST", uses_count=5)

        # Create some referrals with different statuses
        referred1 = User.objects.create_user(
            username="referred1", email="referred1@example.com", password="testpass123"
        )
        referred2 = User.objects.create_user(
            username="referred2", email="referred2@example.com", password="testpass123"
        )

        Referral.objects.create(
            referrer=self.user, referred_user=referred1, referral_code=code, status=ReferralStatus.PENDING
        )
        Referral.objects.create(
            referrer=self.user, referred_user=referred2, referral_code=code, status=ReferralStatus.COMPLETED
        )

        response = self.client.get("/api/v1/me/referral-code/stats/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_referrals"], 2)
        self.assertEqual(response.data["pending_referrals"], 1)
        self.assertEqual(response.data["completed_referrals"], 1)
        self.assertEqual(response.data["rewarded_referrals"], 0)
        self.assertEqual(response.data["total_uses"], 5)

    def test_stats_empty_when_no_code(self):
        """Test stats returns zeros when user has no referral code."""
        response = self.client.get("/api/v1/me/referral-code/stats/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_referrals"], 0)
        self.assertEqual(response.data["pending_referrals"], 0)
        self.assertEqual(response.data["completed_referrals"], 0)
        self.assertEqual(response.data["rewarded_referrals"], 0)
        self.assertEqual(response.data["total_uses"], 0)

    def test_update_code_success(self):
        """Test POST /me/referral-code/update_code/ updates code successfully."""
        # Create initial code
        ReferralCode.objects.create(user=self.user, code="OLDCODE")

        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "NEWCODE"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["code"], "NEWCODE")

        # Verify in database
        self.user.refresh_from_db()
        self.assertEqual(self.user.referral_code.code, "NEWCODE")

    def test_update_code_validates_format(self):
        """Test that update_code validates code format."""
        ReferralCode.objects.create(user=self.user, code="OLDCODE")

        # Too short
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "AB"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("at least 3 characters", response.data["error"])

        # Invalid characters
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "test@code"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("letters, numbers, hyphens, and underscores", response.data["error"])

    def test_update_code_blocks_profanity(self):
        """Test that update_code blocks profane codes."""
        ReferralCode.objects.create(user=self.user, code="OLDCODE")

        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "DAMN"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("inappropriate language", response.data["error"])

        # Verify code wasn't changed
        self.user.refresh_from_db()
        self.assertEqual(self.user.referral_code.code, "OLDCODE")

    def test_update_code_blocks_reserved_words(self):
        """Test that update_code blocks reserved words."""
        ReferralCode.objects.create(user=self.user, code="OLDCODE")

        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "ADMIN"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("reserved word", response.data["error"])

    def test_update_code_prevents_duplicates(self):
        """Test that update_code prevents using an already taken code."""
        # Create code for this user
        ReferralCode.objects.create(user=self.user, code="MYCODE")

        # Create another user with a different code
        other_user = User.objects.create_user(username="other", email="other@example.com", password="testpass123")
        ReferralCode.objects.create(user=other_user, code="TAKEN")

        # Try to update to the taken code
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "TAKEN"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("already taken", response.data["error"])

    def test_update_code_allows_keeping_same_code(self):
        """Test that user can keep their own code (case insensitive)."""
        ReferralCode.objects.create(user=self.user, code="MYCODE")

        # Try to "update" to same code (different case)
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "mycode"})

        # Should succeed (updating to own code is allowed)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["code"], "MYCODE")

    def test_update_code_rate_limiting(self):
        """Test that update_code endpoint is rate limited."""
        ReferralCode.objects.create(user=self.user, code="START")

        # Make 5 requests (the daily limit)
        for i in range(5):
            response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": f"CODE{i}"})
            self.assertEqual(response.status_code, 200)

        # 6th request should be rate limited
        response = self.client.post("/api/v1/me/referral-code/update_code/", {"code": "CODE6"})
        self.assertEqual(response.status_code, 429)

    def test_check_availability_endpoint(self):
        """Test POST /me/referral-code/check_availability/ works correctly."""
        # Create a taken code
        other_user = User.objects.create_user(username="other", email="other@example.com", password="testpass123")
        ReferralCode.objects.create(user=other_user, code="TAKEN")

        # Check available code
        response = self.client.post("/api/v1/me/referral-code/check_availability/", {"code": "AVAILABLE"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["available"])
        self.assertEqual(response.data["code"], "AVAILABLE")

        # Check taken code
        response = self.client.post("/api/v1/me/referral-code/check_availability/", {"code": "TAKEN"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["available"])
        self.assertIn("already taken", response.data["error"])

    def test_check_availability_validates_format(self):
        """Test that check_availability validates code format."""
        # Invalid code
        response = self.client.post("/api/v1/me/referral-code/check_availability/", {"code": "AB"})  # Too short
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["available"])
        self.assertIn("at least 3 characters", response.data["error"])


class ValidateReferralCodeViewTestCase(TestCase):
    """Test the public validate_referral_code endpoint."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="referrer", email="referrer@example.com", password="testpass123")
        self.valid_code = ReferralCode.objects.create(user=self.user, code="VALIDCODE", is_active=True)

    def test_validate_valid_code(self):
        """Test validating a valid referral code."""
        response = self.client.get("/api/v1/referrals/validate/VALIDCODE/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["referrer_username"], "referrer")

    def test_validate_nonexistent_code(self):
        """Test validating a code that doesn't exist."""
        response = self.client.get("/api/v1/referrals/validate/NOTEXIST/")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["valid"])
        self.assertIn("Invalid referral code", response.data["error"])

    def test_validate_inactive_code(self):
        """Test validating an inactive code."""
        inactive_code = ReferralCode.objects.create(user=self.user, code="INACTIVE", is_active=False)

        response = self.client.get("/api/v1/referrals/validate/INACTIVE/")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertIn("no longer valid", response.data["error"])

    def test_validate_expired_code(self):
        """Test validating an expired code."""
        past_date = timezone.now() - timedelta(days=1)
        expired_code = ReferralCode.objects.create(user=self.user, code="EXPIRED", expires_at=past_date)

        response = self.client.get("/api/v1/referrals/validate/EXPIRED/")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

    def test_validate_max_uses_reached(self):
        """Test validating a code that has reached max uses."""
        maxed_code = ReferralCode.objects.create(user=self.user, code="MAXED", max_uses=1, uses_count=1)

        response = self.client.get("/api/v1/referrals/validate/MAXED/")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

    def test_validate_case_insensitive(self):
        """Test that validation is case insensitive."""
        response = self.client.get("/api/v1/referrals/validate/validcode/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        response = self.client.get("/api/v1/referrals/validate/ValidCode/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

    def test_validate_no_authentication_required(self):
        """Test that validation endpoint doesn't require authentication."""
        # Don't authenticate
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/v1/referrals/validate/VALIDCODE/")

        # Should still work
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

    def test_validate_rate_limiting(self):
        """Test that validation endpoint is rate limited."""
        # Make 20 requests (the per-minute limit)
        for i in range(20):
            response = self.client.get("/api/v1/referrals/validate/VALIDCODE/")
            self.assertEqual(response.status_code, 200)

        # 21st request should be rate limited
        response = self.client.get("/api/v1/referrals/validate/VALIDCODE/")
        self.assertEqual(response.status_code, 429)


class ReferralViewSetTestCase(TestCase):
    """Test ReferralViewSet API endpoints."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.referrer = User.objects.create_user(
            username="referrer", email="referrer@example.com", password="testpass123"
        )
        self.referred1 = User.objects.create_user(
            username="referred1", email="referred1@example.com", password="testpass123"
        )
        self.referred2 = User.objects.create_user(
            username="referred2", email="referred2@example.com", password="testpass123"
        )
        self.referral_code = ReferralCode.objects.create(user=self.referrer, code="REFCODE")

        self.client.force_authenticate(user=self.referrer)

    def test_list_referrals(self):
        """Test GET /me/referrals/ returns user's referrals."""
        # Create referrals
        Referral.objects.create(referrer=self.referrer, referred_user=self.referred1, referral_code=self.referral_code)
        Referral.objects.create(referrer=self.referrer, referred_user=self.referred2, referral_code=self.referral_code)

        response = self.client.get("/api/v1/me/referrals/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_list_referrals_only_own(self):
        """Test that users only see their own referrals."""
        # Create referral for this user
        Referral.objects.create(referrer=self.referrer, referred_user=self.referred1, referral_code=self.referral_code)

        # Create another user with their own referral
        other_user = User.objects.create_user(username="other", email="other@example.com", password="testpass123")
        other_code = ReferralCode.objects.create(user=other_user, code="OTHERCODE")
        Referral.objects.create(referrer=other_user, referred_user=self.referred2, referral_code=other_code)

        response = self.client.get("/api/v1/me/referrals/")

        self.assertEqual(response.status_code, 200)
        # Should only see own referral
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["referrer"], self.referrer.id)

    def test_list_referrals_requires_authentication(self):
        """Test that listing referrals requires authentication."""
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/v1/me/referrals/")
        self.assertEqual(response.status_code, 401)

    def test_referrals_read_only(self):
        """Test that referrals endpoint is read-only."""
        # Try to create referral via POST (should not be allowed)
        response = self.client.post(
            "/api/v1/me/referrals/",
            {"referrer": self.referrer.id, "referred_user": self.referred1.id, "referral_code": self.referral_code.id},
        )

        # Should return 405 Method Not Allowed
        self.assertEqual(response.status_code, 405)


class ReferralCodeCollisionHandlingTestCase(TestCase):
    """Test referral code collision handling during auto-creation."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_handles_code_collision(self):
        """Test that collision handling works when code is taken."""
        # Create first user with username "john"
        user1 = User.objects.create_user(username="john", email="john1@example.com", password="testpass123")
        # Manually create their code
        ReferralCode.objects.create(user=user1, code="JOHN")

        # Create second user with same username base
        user2 = User.objects.create_user(
            username="john2", email="john2@example.com", password="testpass123"  # Different username
        )

        # Authenticate as user2 and get their code
        self.client.force_authenticate(user=user2)
        response = self.client.get("/api/v1/me/referral-code/")

        self.assertEqual(response.status_code, 200)
        # Should have a code (not "JOHN" since it's taken)
        self.assertIsNotNone(response.data["code"])
        self.assertNotEqual(response.data["code"], "JOHN")
        # Should have added a suffix
        self.assertTrue(len(response.data["code"]) > 5)
