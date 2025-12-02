"""
Test Stripe API connection.

Run this script to verify your Stripe API keys are configured correctly.
"""

import sys
from pathlib import Path

# Add the project root to Python path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

try:
    import stripe
    from decouple import config
except ImportError as e:
    print('❌ Missing required package. Run: pip install stripe python-decouple')
    print(f'Error: {e}')
    sys.exit(1)


def test_stripe_connection():
    """Test Stripe API connection with your API keys."""

    print('🔍 Testing Stripe connection...')
    print()

    # Load Stripe secret key from environment
    stripe_secret_key = config('STRIPE_SECRET_KEY', default='')
    stripe_public_key = config('STRIPE_PUBLIC_KEY', default='')

    if not stripe_secret_key:
        print('❌ STRIPE_SECRET_KEY not found in environment')
        print()
        print('To fix:')
        print('1. Copy .env.example to .env: cp .env.example .env')
        print('2. Get your test keys from: https://dashboard.stripe.com/test/apikeys')
        print('3. Add them to .env:')
        print('   STRIPE_SECRET_KEY=sk_test_...')
        print('   STRIPE_PUBLIC_KEY=pk_test_...')
        return False

    if not stripe_public_key:
        print('⚠️  STRIPE_PUBLIC_KEY not found in environment')
        print("   (This is OK for now - we'll need it in the frontend later)")
        print()

    # Verify key format
    if not stripe_secret_key.startswith('sk_test_') and not stripe_secret_key.startswith('sk_live_'):
        print(f'❌ Invalid STRIPE_SECRET_KEY format: {stripe_secret_key[:15]}...')
        print('   Expected format: sk_test_... or sk_live_...')
        return False

    # Check if using live keys in development
    if stripe_secret_key.startswith('sk_live_'):
        print("⚠️  WARNING: You're using LIVE MODE keys!")
        print('   For development, use TEST MODE keys (sk_test_...)')
        print()
    else:
        print('✅ Using TEST MODE keys (good for development)')
        print()

    # Set API key
    stripe.api_key = stripe_secret_key

    try:
        # Test API connection by retrieving account balance
        print('📡 Connecting to Stripe API...')
        balance = stripe.Balance.retrieve()

        print('✅ Stripe connection successful!')
        print()
        print('Account Balance:')
        for bal in balance.available:
            amount = bal['amount'] / 100  # Convert cents to dollars
            currency = bal['currency'].upper()
            print(f'  Available: ${amount:.2f} {currency}')

        for bal in balance.pending:
            amount = bal['amount'] / 100
            currency = bal['currency'].upper()
            print(f'  Pending: ${amount:.2f} {currency}')

        print()
        print('🎉 All good! Your Stripe integration is ready.')
        print()
        print('Next steps:')
        print('1. Proceed to Phase 1: Create billing models')
        print('2. Read docs/STRIPE_SETUP.md for more details')

        return True

    except stripe.error.AuthenticationError as e:
        print('❌ Authentication failed - Invalid API key')
        print(f'Error: {e}')
        print()
        print('To fix:')
        print('1. Check your STRIPE_SECRET_KEY in .env')
        print('2. Get your test keys from: https://dashboard.stripe.com/test/apikeys')
        print("3. Make sure you copied the full key (they're long!)")
        return False

    except stripe.error.APIConnectionError as e:
        print('❌ Network error - Cannot connect to Stripe')
        print(f'Error: {e}')
        print()
        print('To fix:')
        print('1. Check your internet connection')
        print("2. Check if you're behind a proxy/firewall")
        return False

    except Exception as e:
        print(f'❌ Unexpected error: {e}')
        print()
        print('Please check your Stripe configuration')
        return False


if __name__ == '__main__':
    success = test_stripe_connection()
    sys.exit(0 if success else 1)
