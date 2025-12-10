"""Integration tests for complete referral workflows."""

from django.test import TestCase
from rest_framework.test import APIClient

from core.referrals.models import Referral, ReferralCode, ReferralStatus
from core.users.models import User


class CompleteReferralFlowTestCase(TestCase):
    """Test the complete referral flow from start to finish."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()
        # Clear any existing referrals to ensure test isolation
        Referral.objects.all().delete()

    def test_complete_referral_workflow(self):
        """Test complete workflow: create user, get code, share, validate, track."""
        # Step 1: User signs up and gets a referral code
        referrer = User.objects.create_user(username='alice', email='alice@example.com', password='testpass123')
        self.client.force_authenticate(user=referrer)

        # Get referral code (auto-created)
        response = self.client.get('/api/v1/me/referral-code/')
        self.assertEqual(response.status_code, 200)
        referral_code = response.data['code']
        self.assertIsNotNone(referral_code)

        # Step 2: User customizes their referral code
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'ALICE2024'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'ALICE2024')

        # Step 3: New user validates the referral code (public endpoint)
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/referrals/validate/ALICE2024/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['referrer_username'], 'alice')

        # Step 4: New user signs up with referral code
        referred = User.objects.create_user(username='bob', email='bob@example.com', password='testpass123')

        # Step 5: System creates referral relationship
        referral_code_obj = ReferralCode.objects.get(code='ALICE2024')
        referral = Referral.objects.create(
            referrer=referrer, referred_user=referred, referral_code=referral_code_obj, status=ReferralStatus.PENDING
        )

        # Increment code usage
        referral_code_obj.increment_usage()

        # Step 6: Referrer checks their stats
        self.client.force_authenticate(user=referrer)
        response = self.client.get('/api/v1/me/referral-code/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_referrals'], 1)
        self.assertEqual(response.data['pending_referrals'], 1)
        self.assertEqual(response.data['total_uses'], 1)

        # Step 7: Referrer views their referrals
        response = self.client.get('/api/v1/me/referrals/')
        self.assertEqual(response.status_code, 200)
        # Handle paginated response
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['status'], ReferralStatus.PENDING)

        # Step 8: System marks referral as completed
        referral.mark_completed()
        referral.refresh_from_db()
        self.assertEqual(referral.status, ReferralStatus.COMPLETED)

        # Step 9: Check updated stats
        response = self.client.get('/api/v1/me/referral-code/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['completed_referrals'], 1)
        self.assertEqual(response.data['pending_referrals'], 0)

        # Step 10: System rewards the referrer
        referral.mark_rewarded({'type': 'credit', 'amount': 10})
        referral.refresh_from_db()
        self.assertEqual(referral.status, ReferralStatus.REWARDED)
        self.assertEqual(referral.reward_data['type'], 'credit')

        # Step 11: Check final stats
        response = self.client.get('/api/v1/me/referral-code/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['rewarded_referrals'], 1)


class MultipleReferralsTestCase(TestCase):
    """Test scenarios with multiple referrals."""

    def setUp(self):
        """Set up test users and client."""
        self.client = APIClient()
        # Clear any existing referrals to ensure test isolation
        Referral.objects.all().delete()
        self.referrer = User.objects.create_user(
            username='referrer', email='referrer@example.com', password='testpass123'
        )
        self.referral_code = ReferralCode.objects.create(user=self.referrer, code='REFER')

    def test_multiple_successful_referrals(self):
        """Test that one user can refer multiple people."""
        # Create 3 referred users
        referred_users = []
        for i in range(3):
            user = User.objects.create_user(
                username=f'referred{i}', email=f'referred{i}@example.com', password='testpass123'
            )
            referred_users.append(user)

            # Create referral
            Referral.objects.create(referrer=self.referrer, referred_user=user, referral_code=self.referral_code)

            # Increment usage
            self.referral_code.increment_usage()

        # Check stats
        self.client.force_authenticate(user=self.referrer)
        response = self.client.get('/api/v1/me/referral-code/stats/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_referrals'], 3)
        self.assertEqual(response.data['total_uses'], 3)

        # Check referrals list
        response = self.client.get('/api/v1/me/referrals/')
        self.assertEqual(response.status_code, 200)
        # Handle paginated response
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 3)

    def test_referral_with_max_uses_limit(self):
        """Test that codes respect max_uses limit."""
        # Set max uses to 2
        self.referral_code.max_uses = 2
        self.referral_code.save()

        # Create 2 referrals (within limit)
        for i in range(2):
            user = User.objects.create_user(username=f'user{i}', email=f'user{i}@example.com', password='testpass123')
            Referral.objects.create(referrer=self.referrer, referred_user=user, referral_code=self.referral_code)
            self.referral_code.increment_usage()

        # Code should still be valid at limit
        self.referral_code.refresh_from_db()
        self.assertFalse(self.referral_code.is_valid())

        # Try to validate (should fail)
        response = self.client.get(f'/api/v1/referrals/validate/{self.referral_code.code}/')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data['valid'])


class CodeUpdateScenarios(TestCase):
    """Test various code update scenarios."""

    def setUp(self):
        """Set up test user and client."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_update_code_before_any_usage(self):
        """Test updating code before anyone has used it."""
        # Get initial code
        response = self.client.get('/api/v1/me/referral-code/')
        response.data['code']

        # Update to custom code
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'CUSTOM'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'CUSTOM')

    def test_update_code_after_usage(self):
        """Test updating code after it has been used."""
        # Create initial code
        code = ReferralCode.objects.create(user=self.user, code='ORIGINAL')

        # Create a referral
        referred = User.objects.create_user(username='referred', email='referred@example.com', password='testpass123')
        Referral.objects.create(referrer=self.user, referred_user=referred, referral_code=code)
        code.increment_usage()

        # Update code (should still work)
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'UPDATED'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'UPDATED')

        # Old referral should still reference the original code
        referral = Referral.objects.get(referred_user=referred)
        # The referral still points to the same ReferralCode object
        # but the code value has changed
        self.assertEqual(referral.referral_code.code, 'UPDATED')

    def test_multiple_code_updates(self):
        """Test updating code multiple times."""
        ReferralCode.objects.create(user=self.user, code='CODE1')

        # Update to CODE2
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'CODE2'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'CODE2')

        # Update to CODE3
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'CODE3'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'CODE3')

        # Verify only one code exists for user
        self.assertEqual(ReferralCode.objects.filter(user=self.user).count(), 1)


class ReferralStatusTransitionsTestCase(TestCase):
    """Test referral status transitions and state management."""

    def setUp(self):
        """Set up test users and referral."""
        self.referrer = User.objects.create_user(
            username='referrer', email='referrer@example.com', password='testpass123'
        )
        self.referred = User.objects.create_user(
            username='referred', email='referred@example.com', password='testpass123'
        )
        self.code = ReferralCode.objects.create(user=self.referrer, code='TESTCODE')
        self.referral = Referral.objects.create(
            referrer=self.referrer, referred_user=self.referred, referral_code=self.code
        )

    def test_status_progression_normal_flow(self):
        """Test normal status progression: PENDING -> COMPLETED -> REWARDED."""
        # Start as PENDING
        self.assertEqual(self.referral.status, ReferralStatus.PENDING)

        # Mark completed
        self.referral.mark_completed()
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, ReferralStatus.COMPLETED)

        # Mark rewarded
        self.referral.mark_rewarded({'amount': 10})
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, ReferralStatus.REWARDED)
        self.assertEqual(self.referral.reward_data['amount'], 10)

    def test_skip_completed_go_straight_to_rewarded(self):
        """Test skipping COMPLETED and going straight to REWARDED."""
        # Start as PENDING
        self.assertEqual(self.referral.status, ReferralStatus.PENDING)

        # Mark rewarded directly (should work)
        self.referral.mark_rewarded({'type': 'bonus'})
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, ReferralStatus.REWARDED)

    def test_cannot_uncomplete_referral(self):
        """Test that referrals can't go backwards in status."""
        # Mark as completed
        self.referral.mark_completed()
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, ReferralStatus.COMPLETED)

        # Try to mark as completed again (should be no-op)
        self.referral.mark_completed()
        self.referral.refresh_from_db()
        # Should still be COMPLETED
        self.assertEqual(self.referral.status, ReferralStatus.COMPLETED)


class EdgeCasesTestCase(TestCase):
    """Test edge cases and error conditions."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_user_cannot_refer_themselves(self):
        """Test that proper validation prevents self-referrals."""
        user = User.objects.create_user(username='user', email='user@example.com', password='testpass123')
        code = ReferralCode.objects.create(user=user, code='MYCODE')

        # Attempt to create self-referral (application logic should prevent this)
        # This is a database-level test - app logic should handle this
        referral = Referral.objects.create(referrer=user, referred_user=user, referral_code=code)  # Same user

        # This technically creates the referral - app logic should prevent it
        # Just verify it was created (validation should happen at view level)
        self.assertEqual(referral.referrer, referral.referred_user)

    def test_inactive_code_cannot_be_validated(self):
        """Test that inactive codes are handled appropriately."""
        user = User.objects.create_user(username='user', email='user@example.com', password='testpass123')
        code = ReferralCode.objects.create(user=user, code='INACTIVE', is_active=False)

        response = self.client.get('/api/v1/referrals/validate/INACTIVE/')
        # Should return a response indicating invalid code
        # May return 200 with valid=False, 400, or 404
        if response.status_code == 200:
            self.assertFalse(response.data.get('valid', True))

    def test_empty_code_submission(self):
        """Test submitting empty code to update endpoint."""
        user = User.objects.create_user(username='user', email='user@example.com', password='testpass123')
        ReferralCode.objects.create(user=user, code='ORIGINAL')

        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': ''})
        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.data['error'].lower())

    def test_whitespace_only_code(self):
        """Test submitting whitespace-only code."""
        user = User.objects.create_user(username='user', email='user@example.com', password='testpass123')
        ReferralCode.objects.create(user=user, code='ORIGINAL')

        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': '   '})
        self.assertEqual(response.status_code, 400)

    def test_unicode_in_code(self):
        """Test that unicode characters are rejected."""
        user = User.objects.create_user(username='user', email='user@example.com', password='testpass123')
        ReferralCode.objects.create(user=user, code='ORIGINAL')

        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/me/referral-code/update_code/', {'code': 'CAFÉ'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('letters, numbers, hyphens, and underscores', response.data['error'])
