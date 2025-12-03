#!/usr/bin/env python
"""
Comprehensive Billing Backend Test Suite

Tests all billing code paths and checks for silent failures.
Run with: python scripts/test_billing_comprehensive.py
"""

import os
import sys
from decimal import Decimal

import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SECRET_KEY', 'test-secret-key')
os.environ.setdefault('DEBUG', 'True')
os.environ.setdefault('DATABASE_URL', 'sqlite:///test_db.sqlite3')
os.environ.setdefault('STRIPE_SECRET_KEY', 'sk_test_fake')
os.environ.setdefault('STRIPE_WEBHOOK_SECRET', 'whsec_fake')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

from core.billing.models import (
    SubscriptionTier,
    TokenPackage,
    TokenTransaction,
)
from core.billing.utils import (
    can_access_feature,
    can_make_ai_request,
    deduct_tokens,
    get_or_create_token_balance,
    get_user_subscription,
    process_ai_request,
)

User = get_user_model()


class TestResults:
    """Track test results and failures."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def pass_test(self, test_name):
        self.passed += 1
        print(f'✅ {test_name}')

    def fail_test(self, test_name, error):
        self.failed += 1
        self.errors.append((test_name, str(error)))
        print(f'❌ {test_name}: {error}')

    def print_summary(self):
        print('\n' + '=' * 60)
        print(f'Test Results: {self.passed} passed, {self.failed} failed')
        print('=' * 60)
        if self.errors:
            print('\nFailed Tests:')
            for test_name, error in self.errors:
                print(f'  ❌ {test_name}')
                print(f'     {error}')
        print()


results = TestResults()


def test_subscription_tier_model():
    """Test SubscriptionTier model and validators."""
    try:
        # Test tier creation with unique tier_type
        tier = SubscriptionTier.objects.create(
            slug='test-tier-unique',
            name='Test Tier',
            tier_type='test',  # Use unique tier_type to avoid conflicts
            price_quarterly=Decimal('0.00'),
            monthly_ai_requests=100,
            has_ai_mentor=True,
            has_quests=True,
            has_projects=True,
        )
        assert tier.slug == 'test-tier-unique'
        assert tier.monthly_ai_requests == 100

        # Test validators
        assert tier.price_quarterly >= 0, 'Price should be non-negative'
        assert tier.monthly_ai_requests >= 0, 'AI requests should be non-negative'

        tier.delete()
        results.pass_test('SubscriptionTier model creation and validation')
    except Exception as e:
        results.fail_test('SubscriptionTier model creation and validation', e)


def test_user_subscription_creation():
    """Test UserSubscription auto-creation for new users."""
    try:
        # Create free tier if doesn't exist
        free_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='free',
            defaults={
                'slug': 'free',
                'name': 'Free',
                'price_quarterly': Decimal('0.00'),
                'monthly_ai_requests': 100,
            },
        )

        # Create new user
        user = User.objects.create_user(
            username='test_user_sub',
            email='test_sub@example.com',
            password='testpass123',  # noqa: S106
        )

        # Check auto-created subscription
        subscription = get_user_subscription(user)
        assert subscription is not None, 'Subscription should be auto-created'
        assert subscription.tier.tier_type == 'free', 'New users should get free tier'
        assert subscription.is_active, 'New subscription should be active'

        user.delete()
        results.pass_test('UserSubscription auto-creation for new users')
    except Exception as e:
        results.fail_test('UserSubscription auto-creation for new users', e)


def test_token_balance_creation():
    """Test UserTokenBalance auto-creation."""
    try:
        user = User.objects.create_user(
            username='test_user_tokens',
            email='test_tokens@example.com',
            password='testpass123',  # noqa: S106
        )

        # Check auto-created token balance
        token_balance = get_or_create_token_balance(user)
        assert token_balance is not None, 'Token balance should be auto-created'
        assert token_balance.balance == 0, 'Initial balance should be 0'

        user.delete()
        results.pass_test('UserTokenBalance auto-creation')
    except Exception as e:
        results.fail_test('UserTokenBalance auto-creation', e)


def test_feature_access_free_tier():
    """Test feature access for free tier users."""
    try:
        user = User.objects.create_user(
            username='test_free_features',
            email='test_free@example.com',
            password='testpass123',  # noqa: S106
        )

        # Free tier should have basic features
        assert can_access_feature(user, 'ai_mentor'), 'Free tier should have AI mentor'
        assert can_access_feature(user, 'quests'), 'Free tier should have quests'
        assert can_access_feature(user, 'projects'), 'Free tier should have projects'

        # Free tier should NOT have premium features
        assert not can_access_feature(user, 'marketplace'), 'Free tier should NOT have marketplace'
        assert not can_access_feature(user, 'go1_courses'), 'Free tier should NOT have Go1 courses'
        assert not can_access_feature(user, 'circles'), 'Free tier should NOT have circles'

        user.delete()
        results.pass_test('Feature access for free tier users')
    except Exception as e:
        results.fail_test('Feature access for free tier users', e)


def test_ai_request_tracking():
    """Test AI request tracking and limits."""
    try:
        user = User.objects.create_user(
            username='test_ai_tracking',
            email='test_ai@example.com',
            password='testpass123',  # noqa: S106
        )

        subscription = get_user_subscription(user)

        # Should be able to make AI request
        can_request, reason = can_make_ai_request(user)
        assert can_request, f'Should be able to make AI request: {reason}'

        # Track AI request usage
        initial_used = subscription.ai_requests_used_this_month
        success, msg = process_ai_request(user, tokens_used=100, ai_provider='openai', ai_model='gpt-4')

        # Refresh subscription
        subscription.refresh_from_db()

        assert success, f'AI request should succeed: {msg}'
        assert subscription.ai_requests_used_this_month == initial_used + 1, 'AI request count should increment'

        user.delete()
        results.pass_test('AI request tracking and limits')
    except Exception as e:
        results.fail_test('AI request tracking and limits', e)


def test_ai_request_limit_exceeded():
    """Test AI request behavior when limit exceeded."""
    try:
        user = User.objects.create_user(
            username='test_ai_limit',
            email='test_limit@example.com',
            password='testpass123',  # noqa: S106
        )

        subscription = get_user_subscription(user)

        # Exhaust AI requests
        subscription.ai_requests_used_this_month = subscription.tier.monthly_ai_requests
        subscription.save()

        # Should not be able to make AI request (no tokens)
        can_request, reason = can_make_ai_request(user)
        assert not can_request, 'Should NOT be able to make AI request when limit exceeded'

        user.delete()
        results.pass_test('AI request limit exceeded behavior')
    except Exception as e:
        results.fail_test('AI request limit exceeded behavior', e)


def test_token_fallback():
    """Test token fallback when AI requests exhausted."""
    try:
        user = User.objects.create_user(
            username='test_token_fallback',
            email='test_fallback@example.com',
            password='testpass123',  # noqa: S106
        )

        subscription = get_user_subscription(user)
        token_balance = get_or_create_token_balance(user)

        # Exhaust AI requests
        subscription.ai_requests_used_this_month = subscription.tier.monthly_ai_requests
        subscription.save()

        # Add tokens
        token_balance.balance = 1000
        token_balance.save()

        # Should be able to make AI request using tokens
        can_request, reason = can_make_ai_request(user)
        assert can_request, f'Should be able to make AI request using tokens: {reason}'

        # Process request should deduct tokens
        success, msg = process_ai_request(user, tokens_used=100, ai_provider='openai', ai_model='gpt-4')
        token_balance.refresh_from_db()

        assert success, f'AI request should succeed using tokens: {msg}'
        assert token_balance.balance == 900, 'Tokens should be deducted'

        user.delete()
        results.pass_test('Token fallback when AI requests exhausted')
    except Exception as e:
        results.fail_test('Token fallback when AI requests exhausted', e)


def test_token_deduction():
    """Test token deduction and transaction logging."""
    try:
        user = User.objects.create_user(
            username='test_token_deduct',
            email='test_deduct@example.com',
            password='testpass123',  # noqa: S106
        )

        token_balance = get_or_create_token_balance(user)
        token_balance.balance = 500
        token_balance.save()

        initial_balance = token_balance.balance

        # Deduct tokens
        success = deduct_tokens(user, amount=100, description='AI request', ai_provider='openai', ai_model='gpt-4')

        token_balance.refresh_from_db()

        assert success, 'Token deduction should succeed'
        assert token_balance.balance == initial_balance - 100, 'Balance should decrease'

        # Check transaction was logged
        transaction = TokenTransaction.objects.filter(
            user=user,
            transaction_type='usage',  # deduct_tokens creates 'usage' type transactions
        ).first()

        assert transaction is not None, 'Transaction should be logged'
        # TokenTransaction stores the amount as absolute value (100), not negative
        assert abs(transaction.amount) == 100, f'Transaction amount should match (got {transaction.amount})'

        user.delete()
        results.pass_test('Token deduction and transaction logging')
    except Exception as e:
        results.fail_test('Token deduction and transaction logging', e)


def test_insufficient_tokens():
    """Test behavior when insufficient tokens."""
    try:
        user = User.objects.create_user(
            username='test_insufficient',
            email='test_insufficient@example.com',
            password='testpass123',  # noqa: S106
        )

        token_balance = get_or_create_token_balance(user)
        token_balance.balance = 50
        token_balance.save()

        # Try to deduct more than balance
        success = deduct_tokens(user, amount=100, description='AI request')

        assert not success, 'Deduction should fail when insufficient tokens'

        # Balance should remain unchanged
        token_balance.refresh_from_db()
        assert token_balance.balance == 50, 'Balance should not change on failed deduction'

        user.delete()
        results.pass_test('Insufficient tokens behavior')
    except Exception as e:
        results.fail_test('Insufficient tokens behavior', e)


def test_token_package_model():
    """Test TokenPackage model."""
    try:
        package = TokenPackage.objects.create(
            package_type='100k',
            name='100K Tokens',
            token_amount=100000,
            price=Decimal('5.00'),
            description='100,000 tokens package',
        )

        assert package.token_amount == 100000
        assert package.price == Decimal('5.00')
        assert package.is_active

        package.delete()
        results.pass_test('TokenPackage model creation')
    except Exception as e:
        results.fail_test('TokenPackage model creation', e)


def test_subscription_tier_upgrade_path():
    """Test that tier upgrades maintain data integrity."""
    try:
        user = User.objects.create_user(
            username='test_upgrade',
            email='test_upgrade@example.com',
            password='testpass123',  # noqa: S106
        )

        # Create pro tier
        pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'community-pro',
                'name': 'Community Pro',
                'price_quarterly': Decimal('39.00'),
                'monthly_ai_requests': 500,
                'has_marketplace_access': True,
            },
        )

        subscription = get_user_subscription(user)

        # Simulate upgrade
        subscription.tier = pro_tier
        subscription.save()

        subscription.refresh_from_db()

        assert subscription.tier.tier_type == 'community_pro', 'Tier should be upgraded'
        assert subscription.tier.has_marketplace_access, 'Should have marketplace access'

        # Check feature access
        assert can_access_feature(user, 'marketplace'), 'Should have marketplace after upgrade'

        user.delete()
        results.pass_test('Subscription tier upgrade path')
    except Exception as e:
        results.fail_test('Subscription tier upgrade path', e)


def test_invalid_feature_access():
    """Test behavior with invalid feature names."""
    try:
        user = User.objects.create_user(
            username='test_invalid_feature',
            email='test_invalid@example.com',
            password='testpass123',  # noqa: S106
        )

        # Should return False for invalid feature (not raise exception)
        has_access = can_access_feature(user, 'nonexistent_feature')
        assert not has_access, 'Invalid feature should return False'

        user.delete()
        results.pass_test('Invalid feature access handling')
    except Exception as e:
        results.fail_test('Invalid feature access handling', e)


def test_logging_exists():
    """Test that logging is properly configured."""
    try:
        import logging

        logger = logging.getLogger('core.billing')

        assert logger is not None, 'Logger should exist'

        # Test that logger can log without errors
        logger.debug('Test debug message')
        logger.info('Test info message')
        logger.warning('Test warning message')
        logger.error('Test error message')

        results.pass_test('Logging configuration')
    except Exception as e:
        results.fail_test('Logging configuration', e)


def test_stripe_service_error_handling():
    """Test StripeService error handling with invalid data."""
    try:
        # Test with invalid Stripe key (should log error, not crash)
        import stripe

        from core.billing.services import StripeService

        # This should handle the error gracefully
        try:
            # We're in test mode with fake keys, so this will fail
            # The important thing is it doesn't crash silently
            result = StripeService.get_or_create_customer(None)
            # If we get here, check if result indicates failure
            assert result is None or isinstance(result, str), 'Should return None or error string for invalid user'
        except (stripe.error.AuthenticationError, AttributeError):
            # Expected errors are fine - we're testing error handling
            pass

        results.pass_test('StripeService error handling')
    except Exception as e:
        results.fail_test('StripeService error handling', e)


def cleanup_test_data():
    """Clean up any test data."""
    print('\n🧹 Cleaning up test data...')
    try:
        # Delete test users
        User.objects.filter(email__contains='@example.com').delete()

        # Delete test tiers created during tests
        SubscriptionTier.objects.filter(slug__startswith='test-tier').delete()
        SubscriptionTier.objects.filter(tier_type='test').delete()

        print('✅ Cleanup complete')
    except Exception as e:
        print(f'⚠️  Cleanup warning: {e}')


def main():
    """Run all tests."""
    print('\n' + '=' * 60)
    print('COMPREHENSIVE BILLING BACKEND TEST SUITE')
    print('=' * 60 + '\n')

    # Model tests
    print('📦 Testing Models...')
    test_subscription_tier_model()
    test_user_subscription_creation()
    test_token_balance_creation()
    test_token_package_model()

    # Feature access tests
    print('\n🔐 Testing Feature Access...')
    test_feature_access_free_tier()
    test_subscription_tier_upgrade_path()
    test_invalid_feature_access()

    # AI request tests
    print('\n🤖 Testing AI Request Tracking...')
    test_ai_request_tracking()
    test_ai_request_limit_exceeded()
    test_token_fallback()

    # Token tests
    print('\n🪙 Testing Token System...')
    test_token_deduction()
    test_insufficient_tokens()

    # Infrastructure tests
    print('\n🔧 Testing Infrastructure...')
    test_logging_exists()
    test_stripe_service_error_handling()

    # Cleanup
    cleanup_test_data()

    # Print results
    results.print_summary()

    # Exit with error code if tests failed
    sys.exit(1 if results.failed > 0 else 0)


if __name__ == '__main__':
    main()
