# Stripe Testing Guide

Complete guide for testing the AllThrive AI Stripe integration locally and in production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Testing Setup](#local-testing-setup)
3. [Testing Stripe Webhooks](#testing-stripe-webhooks)
4. [Test Card Numbers](#test-card-numbers)
5. [Testing Scenarios](#testing-scenarios)
6. [Debugging Tools](#debugging-tools)
7. [Common Issues](#common-issues)

---

## Prerequisites

### 1. Stripe Account Setup

1. **Create Stripe Account** (if you haven't):
   - Go to https://dashboard.stripe.com/register
   - Sign up for a free account

2. **Get API Keys**:
   - Navigate to: https://dashboard.stripe.com/test/apikeys
   - Copy your **Publishable key** (starts with `pk_test_`)
   - Copy your **Secret key** (starts with `sk_test_`)

3. **Update `.env` file**:
   ```bash
   STRIPE_PUBLIC_KEY=pk_test_your_key_here
   STRIPE_SECRET_KEY=sk_test_your_key_here
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here  # Same as STRIPE_PUBLIC_KEY
   ```

4. **Restart servers** to pick up new environment variables:
   ```bash
   # Backend (if running)
   # Stop with Ctrl+C, then restart

   # Frontend
   # Stop with Ctrl+C, then restart
   npm run dev
   ```

### 2. Install Stripe CLI

The Stripe CLI is essential for testing webhooks locally.

**macOS (via Homebrew)**:
```bash
brew install stripe/stripe-cli/stripe
```

**Linux**:
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows**:
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Verify installation**:
```bash
stripe --version
```

---

## Local Testing Setup

### Step 1: Start Backend Server

```bash
# Activate virtual environment
source .venv/bin/activate

# Run Django development server
python manage.py runserver
```

**Verify**: Backend should be running at http://localhost:8000

### Step 2: Start Frontend Server

```bash
# In a new terminal, from project root
npm run dev
```

**Verify**: Frontend should be running at http://localhost:3000

### Step 3: Login to Stripe CLI

```bash
stripe login
```

This will:
1. Open your browser to authenticate
2. Authorize the CLI to access your Stripe account
3. Store credentials locally

### Step 4: Forward Webhooks to Local Server

```bash
stripe listen --forward-to http://localhost:8000/api/v1/billing/webhooks/stripe/
```

**Expected output**:
```
> Ready! You are using Stripe API Version [2024-XX-XX]. Your webhook signing secret is whsec_xxxxx
```

**Copy the webhook secret** (starts with `whsec_`) and add to `.env`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Keep this terminal running** - it forwards webhook events to your local server.

---

## Testing Stripe Webhooks

### How Webhook Forwarding Works

```
Stripe Test Event → Stripe CLI → Your Local Server
                     (forwards)   (localhost:8000)
```

### Trigger Test Webhooks Manually

In a new terminal:

```bash
# Test subscription created
stripe trigger customer.subscription.created

# Test subscription updated
stripe trigger customer.subscription.updated

# Test subscription deleted
stripe trigger customer.subscription.deleted

# Test payment succeeded
stripe trigger payment_intent.succeeded

# Test payment failed
stripe trigger payment_intent.payment_failed
```

### View Webhook Logs

**In Django console**, you'll see:
```
INFO Received Stripe webhook: customer.subscription.created (ID: evt_xxx)
INFO Created subscription sub_xxx for user 123 on tier community-pro
```

**In Stripe CLI console**, you'll see:
```
2024-12-02 04:00:00 --> customer.subscription.created [evt_xxx]
2024-12-02 04:00:01 <-- [200] POST http://localhost:8000/api/v1/billing/webhooks/stripe/ [evt_xxx]
```

---

## Test Card Numbers

Stripe provides test cards that simulate different scenarios.

### Successful Payments

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - Always succeeds |
| `5555 5555 5555 4444` | Mastercard - Always succeeds |
| `3782 822463 10005` | American Express - Always succeeds |

**For all test cards**:
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

### Failed Payments

| Card Number | Failure Type |
|-------------|--------------|
| `4000 0000 0000 9995` | Declined - Insufficient funds |
| `4000 0000 0000 0002` | Declined - Card declined |
| `4000 0000 0000 9987` | Declined - Lost card |
| `4000 0000 0000 9979` | Declined - Stolen card |

### 3D Secure Authentication

| Card Number | Behavior |
|-------------|----------|
| `4000 0025 0000 3155` | Requires 3D Secure authentication (always succeeds) |
| `4000 0000 0000 3220` | Requires 3D Secure authentication (always fails) |

**Full list**: https://stripe.com/docs/testing#cards

---

## Testing Scenarios

### Scenario 1: Create Monthly Subscription

**Goal**: Test creating a subscription with monthly billing.

**Steps**:

1. **Navigate to Pricing Page**:
   ```
   http://localhost:3000/pricing
   ```

2. **Select Monthly billing** (toggle should be off for monthly)

3. **Click "Get Started"** on any paid tier (e.g., Community Pro)

4. **Fill in payment form**:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`

5. **Click "Subscribe"**

**Expected Result**:
- ✅ Payment form shows success
- ✅ User redirected to dashboard
- ✅ Subscription status shows "Community Pro - Monthly"
- ✅ Backend logs show subscription created
- ✅ Webhook event logged

**Verify in Stripe Dashboard**:
- Go to: https://dashboard.stripe.com/test/subscriptions
- See new subscription listed

### Scenario 2: Create Annual Subscription

**Repeat Scenario 1** but select **Annual billing** (toggle on).

**Expected Result**:
- ✅ Price shows annual amount ($204 for Community Pro)
- ✅ Subscription created with annual interval
- ✅ User billed once for full year

### Scenario 3: Upgrade Subscription

**Goal**: Test upgrading from Community Pro to Pro Learn.

**Steps**:

1. **Create a Community Pro subscription** (see Scenario 1)

2. **Go to Pricing Page** again

3. **Click "Upgrade"** on Pro Learn tier

4. **Confirm upgrade**

**Expected Result**:
- ✅ Subscription changes to Pro Learn
- ✅ Prorated charges applied
- ✅ Features updated (now has Go1 courses)
- ✅ AI request quota updated (500 → 2000)

### Scenario 4: Downgrade Subscription

**Goal**: Test downgrading from Pro Learn to Community Pro.

**Steps**:

1. **Create a Pro Learn subscription**

2. **Go to Pricing Page**

3. **Click "Downgrade"** on Community Pro tier

4. **Confirm downgrade**

**Expected Result**:
- ✅ Subscription scheduled to change at period end
- ✅ Credit applied to account
- ✅ User retains Pro Learn features until period ends

### Scenario 5: Cancel Subscription

**Goal**: Test canceling a subscription.

**Steps**:

1. **Create any paid subscription**

2. **Go to Account Settings → Billing**

3. **Click "Cancel Subscription"**

4. **Confirm cancellation**

**Expected Result**:
- ✅ Subscription marked as "Cancels at period end"
- ✅ User retains access until end date
- ✅ After period ends, user downgraded to Free tier

### Scenario 6: Failed Payment

**Goal**: Test handling of failed payment.

**Steps**:

1. **Try to create subscription** with card `4000 0000 0000 0002` (declined)

2. **Submit payment**

**Expected Result**:
- ❌ Payment fails with clear error message
- ❌ No subscription created
- ✅ User can retry with different card

### Scenario 7: Webhook Idempotency

**Goal**: Test that duplicate webhooks don't create duplicate subscriptions.

**Steps**:

1. **Create a subscription** (triggers webhook)

2. **In Stripe CLI terminal**, find the event ID from logs:
   ```
   --> customer.subscription.created [evt_xxx]
   ```

3. **Replay the webhook**:
   ```bash
   stripe events resend evt_xxx
   ```

**Expected Result**:
- ✅ Backend logs: "Webhook event evt_xxx already processed, skipping"
- ✅ No duplicate subscription created
- ✅ Webhook returns 200 OK

### Scenario 8: Token Purchase

**Goal**: Test purchasing additional AI tokens.

**Steps**:

1. **Go to Token Shop** (when implemented)

2. **Select a token package** (e.g., Starter - 100k tokens for $5)

3. **Complete payment** with test card `4242 4242 4242 4242`

**Expected Result**:
- ✅ Payment succeeds
- ✅ Tokens added to user balance
- ✅ Transaction logged
- ✅ Webhook processed

### Scenario 9: AI Request Quota

**Goal**: Test AI request quota enforcement.

**Steps**:

1. **Create Free tier subscription** (20 AI requests/month)

2. **Make 20 AI requests** through the platform

3. **Try to make 21st request**

**Expected Result**:
- ✅ First 20 requests succeed
- ❌ 21st request blocked with "Quota exceeded" message
- ✅ UI shows "0 requests remaining"

### Scenario 10: Race Condition Test

**Goal**: Verify atomic counter prevents quota bypass.

**Steps**:

1. **Create subscription** with low quota (e.g., 5 requests)

2. **Make 10 concurrent AI requests** simultaneously

**Expected Result**:
- ✅ Exactly 5 requests succeed
- ❌ Exactly 5 requests fail with quota exceeded
- ✅ Counter shows exactly 5 used (not 10)

**Test Script** (Python):
```python
import asyncio
import aiohttp

async def make_request(session, i):
    async with session.post('http://localhost:8000/api/v1/ai/chat/') as resp:
        print(f"Request {i}: {resp.status}")

async def test_race_condition():
    async with aiohttp.ClientSession() as session:
        tasks = [make_request(session, i) for i in range(10)]
        await asyncio.gather(*tasks)

asyncio.run(test_race_condition())
```

---

## Debugging Tools

### 1. Stripe Dashboard

**Main Dashboard**: https://dashboard.stripe.com/test/dashboard

**Key Sections**:

- **Payments**: https://dashboard.stripe.com/test/payments
  - See all payment intents
  - View success/failed payments
  - Inspect payment details

- **Subscriptions**: https://dashboard.stripe.com/test/subscriptions
  - All active/canceled subscriptions
  - Subscription details and history
  - Upcoming invoices

- **Customers**: https://dashboard.stripe.com/test/customers
  - Customer records
  - Payment methods
  - Subscription history

- **Events & Webhooks**: https://dashboard.stripe.com/test/events
  - All webhook events
  - Event payload inspection
  - Webhook delivery status

- **Logs**: https://dashboard.stripe.com/test/logs
  - API request logs
  - Webhook delivery logs
  - Error messages

### 2. Django Admin

Navigate to: http://localhost:8000/admin/billing/

**Key Models**:

- **User Subscriptions**: See all user subscriptions
- **Subscription Changes**: Audit log of all changes
- **Token Purchases**: All token purchases
- **Token Transactions**: Token usage history
- **Webhook Events**: All processed webhook events (with idempotency tracking)

### 3. Browser DevTools

**Network Tab**:
- Inspect API requests to `/api/v1/billing/*`
- Check request/response payloads
- Verify client_secret not logged

**Console Tab**:
- Check for JavaScript errors
- Verify Stripe.js loaded correctly

### 4. Backend Logs

**Watch Django logs**:
```bash
# In backend terminal, you'll see:
INFO Received Stripe webhook: payment_intent.succeeded (ID: evt_xxx)
INFO Completed token purchase 123 for user 456
DEBUG Deducted AI request from user 789 subscription (15/500)
```

**Increase logging verbosity** (in settings.py):
```python
LOGGING = {
    'loggers': {
        'core.billing': {
            'level': 'DEBUG',  # Change from INFO to DEBUG
        }
    }
}
```

### 5. Stripe CLI Commands

**List recent events**:
```bash
stripe events list --limit 20
```

**Get event details**:
```bash
stripe events retrieve evt_xxx
```

**List subscriptions**:
```bash
stripe subscriptions list --limit 10
```

**Get subscription details**:
```bash
stripe subscriptions retrieve sub_xxx
```

**Cancel subscription**:
```bash
stripe subscriptions cancel sub_xxx
```

---

## Common Issues

### Issue 1: Stripe Key Not Found

**Error**: `IntegrationError: Please call Stripe() with your publishable key`

**Solution**:
1. Check `.env` has `VITE_STRIPE_PUBLISHABLE_KEY`
2. Restart frontend dev server: `npm run dev`
3. Verify key starts with `pk_test_`

### Issue 2: Webhook Not Received

**Error**: Webhook events not showing up in backend logs

**Solution**:
1. Check Stripe CLI is running: `stripe listen --forward-to ...`
2. Verify webhook URL is correct (should be `/api/v1/billing/webhooks/stripe/`)
3. Check `STRIPE_WEBHOOK_SECRET` in `.env` matches CLI output
4. Restart Django server after updating webhook secret

### Issue 3: Payment Fails with "Invalid API Key"

**Error**: `Invalid API Key provided`

**Solution**:
1. Verify `STRIPE_SECRET_KEY` in `.env` starts with `sk_test_`
2. Check for extra spaces in `.env` file
3. Restart Django server

### Issue 4: CORS Errors

**Error**: `Access-Control-Allow-Origin` error in browser console

**Solution**:
1. Check `CORS_ALLOWED_ORIGINS` in backend settings includes `http://localhost:3000`
2. Verify frontend is running on port 3000
3. Restart backend server

### Issue 5: Webhook Signature Verification Failed

**Error**: `Webhook signature verification failed`

**Solution**:
1. Update `STRIPE_WEBHOOK_SECRET` with secret from Stripe CLI
2. Restart Django server
3. Restart Stripe CLI listener

### Issue 6: Database Migration Errors

**Error**: `no such table: billing_webhookevent`

**Solution**:
```bash
source .venv/bin/activate
python manage.py migrate billing
```

### Issue 7: Rate Limit Hit on Webhooks

**Error**: `429 Too Many Requests` on webhook endpoint

**Solution**:
- This is the rate limiter working (100 requests/minute)
- If testing, temporarily increase limit in `core/billing/views.py:41`
- For production, this protects against DoS attacks (don't disable)

---

## Next Steps

After testing locally:

1. ✅ All test scenarios pass
2. ✅ Webhooks process correctly
3. ✅ No errors in logs
4. ✅ Idempotency working
5. ✅ Race conditions prevented

**Then move to**:
- [ ] Test with real Stripe account (using live keys)
- [ ] Set up production webhook endpoint
- [ ] Configure webhook IP whitelist
- [ ] Enable monitoring and alerting
- [ ] Load testing with multiple concurrent users

---

## Useful Links

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe API Docs**: https://stripe.com/docs/api
- **Stripe CLI Docs**: https://stripe.com/docs/stripe-cli
- **Test Cards**: https://stripe.com/docs/testing
- **Webhook Testing**: https://stripe.com/docs/webhooks/test
- **Stripe Status**: https://status.stripe.com

---

**Last Updated**: 2025-12-02
**Author**: Claude Code
**Version**: 1.0
