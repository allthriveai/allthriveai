# Stripe Setup Guide

## Phase 0: Environment Setup

This guide walks you through setting up Stripe for the AllThrive billing system.

## Step 1: Create a Stripe Account

1. **Go to Stripe**: https://dashboard.stripe.com/register
2. **Create a test account** (free, no credit card required)
3. **Verify your email**
4. **Skip the onboarding wizard** for now (we'll configure products later)

## Step 2: Get Your API Keys

### Test Mode Keys (for development)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. You'll see two keys:
   - **Publishable key** - Starts with `pk_test_`
   - **Secret key** - Starts with `sk_test_` (click "Reveal test key")

### Add Keys to .env

Copy `.env.example` to `.env` if you haven't already:

```bash
cp .env.example .env
```

Then update these lines in your `.env` file:

```bash
STRIPE_PUBLIC_KEY=pk_test_51ABC...  # Your publishable key
STRIPE_SECRET_KEY=sk_test_51ABC...   # Your secret key (keep this secret!)
STRIPE_WEBHOOK_SECRET=               # We'll add this in Step 4
```

**⚠️ Important:**
- Never commit `.env` to git
- The `.env` file is in `.gitignore`
- Never expose your secret key in frontend code

## Step 3: Install Stripe Package

The package has been added to `requirements.txt`. Install it:

```bash
pip install -r requirements.txt
```

Or install just Stripe:

```bash
pip install stripe>=8.0.0
```

## Step 4: Set Up Webhook Endpoint (Later)

We'll set up webhooks in Phase 3, but here's what you'll need to know:

### For Local Development (Stripe CLI)

Install Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server (run this when testing)
stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe/
```

This command will output a webhook signing secret starting with `whsec_` - add it to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

### For Production

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "+ Add endpoint"
3. Enter URL: `https://yourapp.com/api/v1/billing/webhooks/stripe/`
4. Select events to listen to (we'll specify these in Phase 3)
5. Copy the signing secret and add to production `.env`

## Step 5: Test the Connection

We'll create a simple test script to verify everything works:

```python
# test_stripe.py
import os
import stripe
from decouple import config

# Load Stripe secret key
stripe.api_key = config('STRIPE_SECRET_KEY')

try:
    # Test API connection
    balance = stripe.Balance.retrieve()
    print("✅ Stripe connection successful!")
    print(f"Available balance: {balance.available}")
    print(f"Pending balance: {balance.pending}")
except stripe.error.AuthenticationError as e:
    print("❌ Authentication failed - check your STRIPE_SECRET_KEY")
    print(f"Error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
```

Run it:

```bash
python test_stripe.py
```

Expected output:
```
✅ Stripe connection successful!
Available balance: [{'amount': 0, 'currency': 'usd', ...}]
Pending balance: [{'amount': 0, 'currency': 'usd', ...}]
```

## Step 6: Understand Test vs Live Mode

### Test Mode (Development)
- **Keys start with:** `pk_test_` and `sk_test_`
- **Test cards:** Use `4242 4242 4242 4242` (Visa)
- **No real money** - all transactions are simulated
- **Webhook testing:** Use Stripe CLI

### Live Mode (Production)
- **Keys start with:** `pk_live_` and `sk_live_`
- **Real cards only**
- **Real money** - transactions charge actual cards
- **Account verification required** before accepting payments

**We'll use Test Mode for all development and Phase 1-11 testing.**

## Step 7: Create Test Products (Phase 2)

In Phase 2, we'll create Stripe Products and Prices via code, but you can also create them manually:

1. Go to: https://dashboard.stripe.com/test/products
2. Click "+ Add product"
3. Create subscription tiers:
   - **Community Pro**: $54/quarter
   - **Pro Learn**: $105/quarter
   - **Creator/Mentor**: TBD

4. Create token packages (one-time payments):
   - **Starter**: $5
   - **Booster**: $20
   - **Power**: $35

**Note:** We'll create these programmatically in Phase 2 via the seed command.

## Troubleshooting

### "Invalid API Key provided"
- Check that you copied the full key (they're long!)
- Make sure there are no spaces before/after the key in `.env`
- Verify you're using a test key (`sk_test_...`)

### "No such customer"
- You're trying to access a customer that doesn't exist yet
- We'll create customers in Phase 2

### Webhook signature verification failed
- Check your `STRIPE_WEBHOOK_SECRET` matches the one from Stripe CLI
- Make sure you're running `stripe listen` when testing locally

## Security Checklist

Before going to production:

- [ ] Never commit `.env` to git
- [ ] Use environment variables for all keys
- [ ] Never expose `STRIPE_SECRET_KEY` to frontend
- [ ] Use `STRIPE_PUBLIC_KEY` only in frontend
- [ ] Verify webhook signatures on all webhook handlers
- [ ] Use HTTPS in production
- [ ] Enable webhook signature verification
- [ ] Set up Stripe's Radar for fraud detection
- [ ] Configure 3D Secure for European customers

## Next Steps

Once you have:
- ✅ Stripe account created
- ✅ API keys in `.env`
- ✅ Stripe package installed
- ✅ Connection test passing

You're ready for **Phase 1: Database Models**!

## Resources

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Docs**: https://stripe.com/docs
- **Stripe API Reference**: https://stripe.com/docs/api
- **Test Cards**: https://stripe.com/docs/testing
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **Webhook Events**: https://stripe.com/docs/api/events/types
