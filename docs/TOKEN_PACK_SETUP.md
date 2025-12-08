# Token Pack Purchase Implementation

## Overview

Token packs are now fully implemented on the billing settings page at `/account/settings/billing`. Users can purchase one-time token packages directly from their billing dashboard.

## Features

✅ **Token Package Selection**
- 3 packages available: Starter (100k), Booster (500k), Power (1M)
- Clear pricing and value comparison
- Price per 1M tokens calculated

✅ **Seamless Payment Flow**
- Stripe Payment Intent for one-time payments
- Embedded Stripe Elements for secure card input
- No redirect - all handled in modal

✅ **Real-time Balance Updates**
- Token balance refreshes after successful purchase
- Transaction history tracked in database

✅ **Error Handling**
- Payment errors displayed clearly
- Network error recovery
- Validation feedback

## User Flow

1. User clicks "Buy More Tokens" on billing page
2. Modal opens showing 3 token packages
3. User selects a package
4. Payment form appears with package summary
5. User enters payment details
6. Payment processed via Stripe
7. Tokens added to account via webhook
8. Balance refreshed automatically

## Technical Implementation

### Frontend Components

**BuyTokensModal** (`frontend/src/components/billing/BuyTokensModal.tsx`)
- Manages token purchase flow
- Two-step process: package selection → payment
- Integrates with StripePaymentForm

**Updated Files:**
- `frontend/src/pages/settings/BillingSettingsPage.tsx` - Added modal trigger
- `frontend/src/services/billing.ts` - Fixed snake_case conversion
- `frontend/src/components/billing/index.ts` - Export BuyTokensModal

### Backend API

**Endpoint:** `POST /api/v1/billing/tokens/purchase/`

**Request:**
```json
{
  "package_slug": "booster-500k"
}
```

**Response:**
```json
{
  "payment_intent_id": "pi_xxx",
  "client_secret": "pi_xxx_secret_xxx",
  "amount": 20.00,
  "token_amount": 500000,
  "purchase_id": 123
}
```

### Webhook Processing

**Event:** `payment_intent.succeeded`

**Handler:** `StripeService.handle_payment_intent_succeeded()`

**Process:**
1. Finds TokenPurchase by payment_intent_id
2. Marks purchase as completed
3. Adds tokens to UserTokenBalance atomically
4. Logs transaction in TokenTransaction

## Testing

### 1. Verify Stripe Configuration

```bash
# Check environment variables
grep STRIPE .env

# Should have:
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2. Seed Token Packages

```bash
# Create packages in database and sync to Stripe
make django-shell
python manage.py seed_billing --with-stripe
```

**Expected Output:**
```
🌱 Seeding billing data...

📋 Seeding Subscription Tiers
  ✅ Created: Free / Explorer ($0.00/mo)
  ...

🪙  Seeding Token Packages
  ✅ Created: Starter - 100,000 tokens for $5.00
    ✅ Synced to Stripe: Starter (product=prod_xxx...)
  ✅ Created: Booster - 500,000 tokens for $20.00
    ✅ Synced to Stripe: Booster (product=prod_xxx...)
  ✅ Created: Power - 1,000,000 tokens for $35.00
    ✅ Synced to Stripe: Power (product=prod_xxx...)

✅ Billing data seeded successfully!
```

### 3. Test Webhook Locally

```bash
# Terminal 1: Run backend
make up

# Terminal 2: Run frontend
cd frontend && npm run dev -- --port 3000

# Terminal 3: Forward webhooks
stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe/
```

### 4. Test Purchase Flow

1. **Navigate** to http://localhost:3000/account/settings/billing
2. **Login** (required)
3. **Verify** token balance displays
4. **Click** "Buy More Tokens"
5. **Select** a token package (e.g., Booster)
6. **Enter** test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/34)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)
7. **Click** "Complete Payment"
8. **Verify** success and balance updates

### 5. Test Stripe Test Cards

**Successful Payment:**
```
4242 4242 4242 4242  # Visa
5555 5555 5555 4444  # Mastercard
```

**Declined:**
```
4000 0000 0000 0002  # Generic decline
4000 0000 0000 9995  # Insufficient funds
```

**3D Secure Required:**
```
4000 0025 0000 3155  # 3DS authentication required
```

**More cards:** https://stripe.com/docs/testing#cards

### 6. Verify Backend

```bash
# Check token purchase created
make django-shell
```

```python
from core.billing.models import TokenPurchase, UserTokenBalance

# List purchases
TokenPurchase.objects.all().values('id', 'user__email', 'package__name', 'status', 'token_amount')

# Check user balance
balance = UserTokenBalance.objects.get(user__email='your@email.com')
print(f"Balance: {balance.balance:,}")
print(f"Total purchased: {balance.total_purchased:,}")
```

### 7. Check Webhook Events

```bash
# View webhook processing
make logs-backend | grep -i webhook

# Check WebhookEvent records
make django-shell
```

```python
from core.billing.models import WebhookEvent

# List recent webhooks
WebhookEvent.objects.filter(
    event_type='payment_intent.succeeded'
).values('event_type', 'processed', 'created_at')[:5]
```

## Production Deployment

### 1. Configure Production Stripe Keys

```bash
# .env.production
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Seed Production Data

```bash
# SSH into production server
python manage.py seed_billing --with-stripe
```

### 3. Configure Stripe Webhook Endpoint

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/v1/billing/webhooks/stripe/`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `customer.subscription.*`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Test in Production

Use Stripe Dashboard "Send test webhook" feature to verify:
- Webhook endpoint is accessible
- Signature verification works
- Events are processed correctly

## Troubleshooting

### "Failed to load token packages"

**Cause:** Backend API not returning packages

**Solution:**
```bash
make django-shell
python manage.py seed_billing --with-stripe
```

### "Failed to initiate purchase"

**Cause:** Missing Stripe price IDs

**Solution:**
```bash
# Verify packages have Stripe IDs
make django-shell
```
```python
from core.billing.models import TokenPackage
TokenPackage.objects.values('name', 'stripe_product_id', 'stripe_price_id')
```

### "Payment failed: Invalid signature"

**Cause:** Wrong webhook secret or endpoint

**Solution:**
1. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Verify webhook URL is correct
3. Test with `stripe listen` locally

### Tokens not added after payment

**Cause:** Webhook not processed

**Solution:**
```python
# Check webhook event
from core.billing.models import WebhookEvent
WebhookEvent.objects.filter(processed=False).values('event_type', 'processing_error')

# Check purchase status
from core.billing.models import TokenPurchase
TokenPurchase.objects.filter(status='pending').values('id', 'stripe_payment_intent_id', 'created_at')
```

### Balance not refreshing in UI

**Cause:** Cache or network issue

**Solution:**
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for errors
- Verify API returns updated balance

## API Reference

### Get Token Packages
```http
GET /api/v1/billing/packages/
```

**Response:**
```json
[
  {
    "id": 1,
    "slug": "starter-100k",
    "name": "Starter",
    "packageType": "starter",
    "tokenAmount": 100000,
    "price": "5.00",
    "description": "100,000 AI tokens - perfect for occasional extra requests",
    "isActive": true,
    "stripePriceId": "price_xxx"
  }
]
```

### Purchase Tokens
```http
POST /api/v1/billing/tokens/purchase/
Content-Type: application/json
Authorization: Bearer <token>

{
  "package_slug": "booster-500k"
}
```

**Response:**
```json
{
  "payment_intent_id": "pi_xxx",
  "client_secret": "pi_xxx_secret_xxx",
  "amount": 20.00,
  "token_amount": 500000,
  "purchase_id": 123
}
```

### Get Token Balance
```http
GET /api/v1/billing/tokens/balance/
Authorization: Bearer <token>
```

**Response:**
```json
{
  "balance": 500000,
  "totalPurchased": 1000000,
  "totalUsed": 500000
}
```

## Support

For issues or questions:
- Check backend logs: `make logs-backend`
- Check frontend console
- Verify Stripe webhook events in dashboard
- Review WebhookEvent model for processing errors
