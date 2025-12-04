# Phase 8 Setup Instructions - Subscribe Modal with Stripe

**Status**: ✅ Complete - Ready to Test
**Date**: 2025-12-02

---

## Quick Start

The Subscribe Modal with Stripe payment integration is now complete! Follow these steps to set it up:

### 1. Restart Vite Dev Server

The Stripe packages were just installed, so you need to restart the frontend dev server:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it:
cd frontend
npm run dev
```

### 2. Add Stripe Publishable Key to .env

Add your Stripe test publishable key to `frontend/.env`:

```bash
# frontend/.env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_test_key_here
```

**Get your test key from**: https://dashboard.stripe.com/test/apikeys

### 3. Verify Backend Has Stripe Secret Key

Make sure your backend `.env` has the Stripe secret key:

```bash
# .env (root directory)
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## How It Works

### User Flow

1. **User Hits Paywall**
   ```
   User clicks "View Analytics" (free user)
   → Backend returns 403 with { upgrade_required: true, feature: "analytics" }
   → SubscribeModalProvider catches the error
   → Modal opens with Community Pro pre-selected
   ```

2. **User Selects Tier**
   ```
   Modal displays 3 tiers:
   - Community Pro ($54/quarter)
   - Pro Learn ($105/quarter)
   - Creator/Mentor (TBD pricing)

   User can click any tier to select it
   Selected tier shows neon glow effect
   ```

3. **User Continues to Payment**
   ```
   User clicks "Continue to Payment"
   → Frontend calls POST /api/v1/billing/subscriptions/create/
   → Backend creates Stripe subscription (with trial if applicable)
   → Backend returns { clientSecret, subscriptionId, status }
   → Modal transitions to payment form
   ```

4. **User Enters Payment Details**
   ```
   Stripe Elements payment form appears
   → User enters card details (test card: 4242 4242 4242 4242)
   → User clicks "Complete Payment"
   → Stripe confirms payment
   → Modal closes, subscription is active
   ```

---

## Testing the Flow

### Test Card Numbers (Stripe Test Mode)

```
✅ Success: 4242 4242 4242 4242 (any future date, any CVC)
❌ Decline: 4000 0000 0000 0002
⏰ 3D Secure: 4000 0025 0000 3155
```

### Manual Test Steps

1. **Test Automatic Paywall Modal**
   ```
   1. Log in as free user
   2. Navigate to Analytics page
   3. Modal should auto-open with "Community Pro" selected
   4. Verify message shows "Upgrade to access Analytics"
   ```

2. **Test Tier Selection**
   ```
   1. Click each tier card
   2. Verify selected tier has neon ring
   3. Verify "Continue to Payment" button enables
   ```

3. **Test Payment Form**
   ```
   1. Select Community Pro
   2. Click "Continue to Payment"
   3. Enter test card: 4242 4242 4242 4242
   4. Expiry: 12/34, CVC: 123
   5. Click "Complete Payment"
   6. Verify modal closes
   7. Check backend - user should now have Community Pro subscription
   ```

4. **Test Back Navigation**
   ```
   1. On payment step, click "Back to plans"
   2. Verify returns to tier selection
   3. Verify can re-select tier and continue
   ```

5. **Test Error Handling**
   ```
   1. Use decline card: 4000 0000 0000 0002
   2. Verify error message displays
   3. Verify can retry with valid card
   ```

---

## Architecture

### Frontend Components

```
SubscribeModalProvider (App.tsx)
├── Axios Interceptor (catches 403 errors)
├── Feature-to-Tier Mapping
└── SubscribeModal
    ├── Step 1: Tier Selection
    │   ├── Tier Cards (Community Pro, Pro Learn, Creator)
    │   ├── Feature Lists
    │   └── "Continue to Payment" Button
    └── Step 2: Payment Form
        └── StripePaymentForm
            ├── Stripe Elements
            ├── Payment Element
            └── "Complete Payment" Button
```

### API Flow

```
1. GET /api/v1/billing/tiers/
   → Returns all available tiers

2. POST /api/v1/billing/subscriptions/create/
   Body: { tier_slug: "community-pro" }
   → Creates Stripe subscription
   → Returns: { clientSecret, subscriptionId, status }

3. Stripe.confirmPayment()
   → Confirms payment with Stripe
   → Triggers webhook to backend

4. Webhook: customer.subscription.created
   → Updates UserSubscription in database
   → Activates features for user
```

---

## Files Modified/Created

### Frontend

**Created**:
- `frontend/src/components/billing/StripePaymentForm.tsx` - Stripe Elements payment form
- `frontend/src/hooks/useSubscribeModal.ts` - Zustand state management
- `frontend/src/components/billing/SubscribeModalProvider.tsx` - Global provider

**Modified**:
- `frontend/src/components/billing/SubscribeModal.tsx` - Updated to multi-step flow
- `frontend/src/components/billing/index.ts` - Added StripePaymentForm export
- `frontend/src/App.tsx` - Added SubscribeModalProvider
- `frontend/.env.example` - Added VITE_STRIPE_PUBLISHABLE_KEY
- `frontend/package.json` - Added @stripe/stripe-js, @stripe/react-stripe-js

### Backend

**Modified**:
- `core/billing/management/commands/seed_billing.py` - Updated tier configuration
  - Free: 20 AI requests (not 100)
  - Community Pro: Has analytics (new)
  - Pro Learn: Only tier with Go1 courses
  - Creator: No Go1 courses, 5000 AI limit (not unlimited)

**Run**:
- `python manage.py seed_billing` - Applied new tier config to database

---

## Environment Variables

### Frontend (.env)

```bash
# Required for Stripe payment form
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Existing variables
VITE_API_URL=http://localhost:8000
VITE_APP_URL=http://localhost:3000
```

### Backend (.env)

```bash
# Required for Stripe integration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database, etc.
DATABASE_URL=...
```

---

## Tier Configuration

The database now has the correct tier structure per your business model:

| Tier | AI Requests/mo | Price | Features |
|------|---------------|-------|----------|
| **Free** | 20 | $0 | Marketplace, Circles, Quests, Projects |
| **Community Pro** | 500 | $54/qtr ($18/mo) | **+ Analytics** |
| **Pro Learn** | 2,000 | $105/qtr ($35/mo) | + Analytics + **Go1 Courses** |
| **Creator** | 5,000 | TBD | + Analytics + **Creator Tools** (no Go1) |

**Key Points**:
- ❌ NO ONE gets unlimited AI requests (cost control)
- ✅ Free users get community features (marketplace, circles, quests, projects)
- 💰 Features that cost you money (AI, Go1) cost users money
- 🎨 Go1 courses ONLY in Pro Learn (not Creator)
- 📊 Analytics starts at Community Pro (not Pro Learn)

---

## Troubleshooting

### Issue: "Failed to resolve import @stripe/stripe-js"

**Solution**: Restart Vite dev server

```bash
# In frontend directory
npm run dev
```

The packages are installed, Vite just needs to be restarted to pick them up.

### Issue: Stripe Elements not loading

**Check**:
1. Is `VITE_STRIPE_PUBLISHABLE_KEY` in `frontend/.env`?
2. Does it start with `pk_test_`?
3. Did you restart the dev server after adding it?

**Debug**:
```javascript
// Check in browser console
console.log(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
// Should show: "pk_test_..."
// If undefined, add to .env and restart dev server
```

### Issue: Payment fails with "Invalid API key"

**Check**:
1. Is `STRIPE_SECRET_KEY` in backend `.env`?
2. Does it start with `sk_test_`?
3. Did you restart Django server after adding it?

### Issue: Modal doesn't open on 403 error

**Check**:
1. Is backend returning `upgrade_required: true` in 403 response?
2. Is `SubscribeModalProvider` wrapping your app in `App.tsx`?

**Debug**:
```typescript
// Add to SubscribeModalProvider.tsx (line 35)
console.log('403 Response:', error.response.data);
```

### Issue: Subscription created but user still can't access feature

**Check**:
1. Check Django admin: Does UserSubscription have correct tier?
2. Check Stripe dashboard: Is subscription status "active"?
3. Did webhook fire? Check Django logs for "customer.subscription.created"

**Manual fix**:
```python
# Django shell
from core.billing.models import UserSubscription, SubscriptionTier
user = User.objects.get(email='test@example.com')
tier = SubscriptionTier.objects.get(tier_type='community_pro')
sub = UserSubscription.objects.get(user=user)
sub.tier = tier
sub.status = 'active'
sub.save()
```

---

## Next Steps

### Immediate (Complete Phase 8)

- [ ] Restart Vite dev server
- [ ] Add Stripe publishable key to `.env`
- [ ] Test end-to-end payment flow
- [ ] Test all tier selections
- [ ] Test error handling

### Future Phases

- [ ] **Phase 9**: Billing management page (view subscription, cancel, upgrade)
- [ ] **Phase 10**: Token shop page (buy AI token packs)
- [ ] **Phase 11**: Full testing & security audit
- [ ] **Phase 12**: Production setup

---

## Success Criteria

Phase 8 is complete when:

✅ Modal opens automatically on paywall (403 errors)
✅ Tiers display with correct features and pricing
✅ Payment form loads with Stripe Elements
✅ Test payment succeeds (4242 4242 4242 4242)
✅ UserSubscription updated in database
✅ User gains access to previously blocked feature
✅ Error handling works (decline card shows error)
✅ Back navigation works (payment → tier selection)

---

## Documentation

- `PHASE_8_COMPLETION_SUMMARY.md` - Full technical overview
- `SUBSCRIBE_MODAL_IMPLEMENTATION.md` - Original implementation guide
- `UPDATED_TIER_STRATEGY.md` - Business model & tier configuration
- `TIER_FEATURE_SYSTEM.md` - How feature flags work
- `PAYWALL_IMPLEMENTATION_SUMMARY.md` - Paywall system overview

---

**Created**: 2025-12-02
**Status**: ✅ Ready to Test
**Next**: Restart dev server and test payment flow
