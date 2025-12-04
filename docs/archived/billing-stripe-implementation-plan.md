# Billing & Stripe Integration - Implementation Plan

**Status:** Planning
**Created:** 2025-12-02
**Owner:** Engineering Team

## Executive Summary

This document outlines the implementation plan for adding subscription billing and token purchases to AllThrive using Stripe. This is a **foundational feature** that will be implemented in **incremental phases** to allow for thorough testing at each stage.

**Scope - Phase 1:**
- 4-tier subscription system (Free, Community Pro, Pro Learn, Creator/Mentor)
- Token package purchases for additional AI credits
- Stripe integration for payments (subscriptions + one-time purchases)
- No marketplace/creator payouts yet (that's Phase 2)

---

## Current State

**What We Have:**
- ✅ User roles and permissions system
- ✅ Role-based AI request limits
- ✅ Gamification (points, levels, tiers)
- ✅ Projects, quizzes, learning paths
- ❌ **No Stripe integration**
- ❌ **No subscription management**
- ❌ **No payment processing**

**What We're Building:**
1. **Subscription tiers** - Stripe subscriptions for platform access
2. **Token packages** - One-time purchases for extra AI credits
3. **Usage tracking** - Enforce tier limits and token consumption
4. **Billing management** - User dashboard for subscription/payment management

---

## Subscription Tiers

Based on `docs/evergreen-architecture/Feature Matrix - Membership Tiers.md`:

### 1. Free / Explorer ($0)
- **Projects:** 10 max
- **AI Tokens:** Very limited (3 AI-assisted uploads)
- **Marketplace:** Can view only
- **Features:** All community features, basic gamification

### 2. Community Pro ($54/quarter = ~$18/month)
- **Trial:** 7-day free trial
- **Projects:** Unlimited
- **AI Tokens:** More generous allowance
- **Marketplace:** Can view only
- **Features:**
  - Custom profile designs
  - Private projects
  - Pair sessions & deep reviews
  - AI proactive agents
  - Analytics (profile views, engagement)
  - Priority support

### 3. Pro Learn ($105/quarter = ~$35/month)
- **Projects:** Unlimited
- **AI Tokens:** More generous allowance
- **Marketplace:** Can BUY mentorship sessions
- **Features:**
  - All Community Pro features
  - Go1 premium courses (1000+ courses)
  - Advanced AI course recommendations
  - Completion certificates
  - Advanced analytics
  - Follower insights

### 4. Creator / Mentor (TBD pricing)
- **Projects:** Unlimited
- **AI Tokens:** Most generous allowance
- **Marketplace:** Can SELL (digital products, courses, mentorship)
- **Features:**
  - All Pro Learn features
  - Application/invite-only to become seller
  - **Note:** Selling functionality is Phase 2 (requires Stripe Connect)

---

## Token Packages (Add-Ons)

Users can purchase additional AI tokens when they exceed their tier limits:

| Package | Tokens | Interactions | Price |
|---------|--------|--------------|-------|
| **Starter** | 100K | ~65 | $5 |
| **Booster** | 500K | ~330 | $20 |
| **Power** | 1M | ~650 | $35 |

**Key Features:**
- Tokens never expire
- Stack with tier limits
- Usage tracked in dashboard

---

## Architecture Overview

### Stripe Integration Strategy

**Type:** Simple Stripe (not Connect)
**Why:** Platform is the only seller in Phase 1. No creator payouts needed yet.

**Payment Types:**
1. **Recurring Subscriptions** - Quarterly billing for tiers
2. **One-Time Purchases** - Token packages

### Data Models

#### Core Tables (in `core/billing/`):

1. **SubscriptionTier** - Tier definitions (seeded)
2. **UserSubscription** - User's current subscription
3. **TokenPackage** - Package definitions (seeded)
4. **UserTokenBalance** - User's token balance
5. **TokenPurchase** - Individual token purchases
6. **TokenTransaction** - Audit log of token usage
7. **SubscriptionChange** - Audit log of tier changes

### Key Services

1. **StripeService** - Centralized Stripe API integration
2. **Webhook Handler** - Process Stripe events
3. **Permission Checker** - Validate tier limits and token balance

---

## Phased Implementation Strategy

This is a **large feature**. We'll implement incrementally with testing gates between phases.

### 🎯 Phase 0: Preparation & Setup (3 days)

**Goal:** Get Stripe account and environment ready

**Tasks:**
- [ ] Create Stripe test account
- [ ] Set up webhook endpoint URL (test mode)
- [ ] Add environment variables to `.env`
- [ ] Install Stripe Python SDK
- [ ] Create `core/billing/` Django app

**Testing:**
- ✅ Stripe API keys work
- ✅ Can ping Stripe API
- ✅ Webhook endpoint reachable

**Blockers to Next Phase:**
- Must have Stripe test account fully configured
- Must be able to receive webhooks locally (Stripe CLI)

---

### 🎯 Phase 1: Database & Models (1 week)

**Goal:** Define all data models and create database schema

**Tasks:**
- [ ] Define all 7 models in `core/billing/models.py`
- [ ] Create migrations
- [ ] Add model admin interfaces
- [ ] Create seed data command for tiers and packages
- [ ] Run migrations on dev database

**Testing:**
- ✅ All models can be created via Django admin
- ✅ Seed command creates 4 tiers correctly
- ✅ Seed command creates 3 token packages
- ✅ Can create UserSubscription for a test user
- ✅ Foreign key relationships work correctly

**Test Data Created:**
```python
# Run seed command
python manage.py seed_billing_data

# Verify in Django admin:
# - 4 SubscriptionTiers
# - 3 TokenPackages
# - Test UserSubscription
```

**Blockers to Next Phase:**
- All models must pass Django system checks
- Must be able to create test data via admin

---

### 🎯 Phase 2: Stripe Service Layer (1 week)

**Goal:** Implement Stripe API integration WITHOUT hitting real endpoints yet

**Tasks:**
- [ ] Create `StripeService` class
- [ ] Implement customer creation
- [ ] Implement subscription creation/update/cancel
- [ ] Implement token payment intent creation
- [ ] Write unit tests with mocked Stripe API

**Testing:**
- ✅ Unit tests pass with mocked Stripe
- ✅ Can create test Stripe customer (manual test)
- ✅ Can create test subscription (manual test)
- ✅ Can create test payment intent (manual test)
- ✅ Error handling works (invalid tier, etc.)

**Manual Test Script:**
```python
# In Django shell
from core.billing.stripe_service import StripeService
from core.users.models import User

user = User.objects.first()
tier = SubscriptionTier.objects.get(slug='community-pro')

# Test customer creation
customer_id = StripeService.create_customer(user)
print(f"Created customer: {customer_id}")

# Check in Stripe dashboard - customer should exist
```

**Blockers to Next Phase:**
- Must be able to create Stripe customers
- Must be able to create test subscriptions in Stripe dashboard

---

### 🎯 Phase 3: Webhook Handler (1 week)

**Goal:** Process Stripe webhook events reliably

**Tasks:**
- [ ] Create webhook endpoint view
- [ ] Implement signature verification
- [ ] Implement event handlers (subscription created/updated/deleted)
- [ ] Implement payment intent succeeded handler
- [ ] Add error logging and Sentry integration
- [ ] Test with Stripe CLI

**Testing:**
- ✅ Webhook signature verification works
- ✅ Can receive test events from Stripe CLI
- ✅ Subscription created event updates UserSubscription
- ✅ Subscription canceled event downgrades to free tier
- ✅ Payment intent succeeded adds tokens

**Test with Stripe CLI:**
```bash
# Forward webhooks to local endpoint
stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe/

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
```

**Blockers to Next Phase:**
- Webhooks must process successfully 100% of the time
- Must handle duplicate events (idempotency)

---

### 🎯 Phase 4: Subscription API Endpoints (1 week)

**Goal:** Allow users to subscribe, cancel, and manage subscriptions

**Tasks:**
- [ ] Create serializers for all models
- [ ] Implement GET /tiers/ - list available tiers
- [ ] Implement GET /subscription/ - current subscription
- [ ] Implement POST /subscribe/ - create subscription
- [ ] Implement POST /cancel/ - cancel subscription
- [ ] Implement POST /update/ - change tier/billing period
- [ ] Add permission classes
- [ ] Write API tests

**Testing:**
- ✅ Can list all tiers via API
- ✅ Can get current subscription for authenticated user
- ✅ Can create subscription with test payment method
- ✅ Can cancel subscription (access continues until period end)
- ✅ Can upgrade from Community Pro to Pro Learn
- ✅ Unauthenticated users get 401

**API Test Script:**
```bash
# Get tiers
curl http://localhost:8000/api/v1/billing/tiers/

# Get current subscription (with auth)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/billing/subscription/

# Subscribe to Community Pro
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"tier_slug":"community-pro","billing_period":"quarterly","payment_method_id":"pm_card_visa"}' \
  http://localhost:8000/api/v1/billing/subscribe/
```

**Blockers to Next Phase:**
- All subscription endpoints must work end-to-end
- Stripe subscription must be created and visible in dashboard

---

### 🎯 Phase 5: Token Purchase Flow (1 week)

**Goal:** Allow users to buy token packages

**Tasks:**
- [ ] Implement GET /tokens/packages/ - list packages
- [ ] Implement GET /tokens/balance/ - user's balance
- [ ] Implement POST /tokens/purchase/ - buy package
- [ ] Implement GET /tokens/history/ - transaction history
- [ ] Update webhook to grant tokens on payment success
- [ ] Add token consumption logic
- [ ] Write integration tests

**Testing:**
- ✅ Can list token packages
- ✅ Can get current balance (starts at 0)
- ✅ Can purchase Starter package
- ✅ Webhook grants tokens after payment
- ✅ Balance increases correctly
- ✅ Transaction history shows purchase

**End-to-End Test:**
```python
1. User purchases Starter package ($5, 100K tokens)
2. Stripe payment intent created
3. User completes payment in Stripe checkout
4. Webhook fires payment_intent.succeeded
5. TokenPurchase created
6. UserTokenBalance.available_tokens += 100000
7. TokenTransaction logged
8. GET /tokens/balance/ shows 100K tokens
```

**Blockers to Next Phase:**
- Token purchase must work end-to-end
- Webhook must reliably grant tokens

---

### 🎯 Phase 6: Permission & Usage Enforcement (1 week)

**Goal:** Actually enforce tier limits and consume tokens

**Tasks:**
- [ ] Create permission checking middleware
- [ ] Update AI chat endpoint to check limits
- [ ] Update image generation endpoint to check limits
- [ ] Implement token consumption logic
- [ ] Add usage tracking
- [ ] Implement "out of requests" error responses
- [ ] Write permission tests

**Testing:**
- ✅ Free user blocked after 3 AI uploads
- ✅ Free user can exceed limit with purchased tokens
- ✅ Token consumed correctly on AI request
- ✅ Community Pro user has higher limits
- ✅ Usage stats accurate (daily usage count)
- ✅ Graceful error messages when limits hit

**Permission Test Cases:**
```python
Test Case 1: Free user, no tokens
- Make 3 AI requests → Success
- Make 4th request → 403 Error "Upgrade or buy tokens"

Test Case 2: Free user with 100K tokens
- Make 3 AI requests → Uses daily limit
- Make 4th request → Consumes 1 token, succeeds
- Check balance → 99,999 tokens remaining

Test Case 3: Community Pro user
- Make 100 AI requests → All succeed (higher limit)
- Check usage stats → Shows 100 requests today
```

**Blockers to Next Phase:**
- Permission checking must work reliably
- Token consumption must be atomic (no race conditions)

---

### 🎯 Phase 7: Frontend - Pricing Page (1 week)

**Goal:** Users can view tiers and pricing

**Tasks:**
- [ ] Create `/pricing` page
- [ ] Build tier comparison table
- [ ] Add monthly/quarterly toggle
- [ ] Create feature checklists
- [ ] Add "Start Free Trial" / "Subscribe" CTAs
- [ ] Mobile responsive design
- [ ] Connect to backend API

**Testing:**
- ✅ Pricing page loads and displays 4 tiers
- ✅ Monthly/quarterly toggle switches prices
- ✅ Feature lists match feature matrix
- ✅ CTAs link to subscription flow
- ✅ Mobile layout works on iPhone/Android

**Visual QA:**
- [ ] Screenshot on desktop (1920x1080)
- [ ] Screenshot on tablet (768px)
- [ ] Screenshot on mobile (375px)

---

### 🎯 Phase 8: Frontend - Subscribe Flow (1.5 weeks)

**Goal:** Users can subscribe to a tier with Stripe checkout

**Tasks:**
- [ ] Install @stripe/react-stripe-js
- [ ] Create SubscribeModal component
- [ ] Integrate Stripe Elements (card input)
- [ ] Handle payment method submission
- [ ] Show loading/success/error states
- [ ] Redirect after successful subscription
- [ ] Add "Start 7-day trial" for Community Pro
- [ ] Write Cypress E2E tests

**Testing:**
- ✅ Can click "Subscribe" from pricing page
- ✅ Modal opens with tier details
- ✅ Stripe card element renders
- ✅ Can enter test card (4242 4242 4242 4242)
- ✅ Payment succeeds
- ✅ User redirected to dashboard
- ✅ Subscription shows as active
- ✅ Webhook processed subscription

**E2E Test (Cypress):**
```javascript
it('can subscribe to Community Pro', () => {
  cy.visit('/pricing')
  cy.contains('Community Pro').click()
  cy.contains('Start Free Trial').click()

  // Fill Stripe form
  cy.get('iframe').then($iframe => {
    const doc = $iframe.contents()
    cy.wrap(doc.find('input[name="cardnumber"]')).type('4242424242424242')
    cy.wrap(doc.find('input[name="exp-date"]')).type('1225')
    cy.wrap(doc.find('input[name="cvc"]')).type('123')
  })

  cy.contains('Start Trial').click()
  cy.url().should('include', '/account/billing')
  cy.contains('Community Pro').should('be.visible')
  cy.contains('Trial active').should('be.visible')
})
```

**Blockers to Next Phase:**
- Subscription flow must work end-to-end
- Must create real Stripe subscription

---

### 🎯 Phase 9: Frontend - Billing Management (1 week)

**Goal:** Users can view and manage their subscription

**Tasks:**
- [ ] Create `/account/billing` page
- [ ] Show current tier and status
- [ ] Display usage stats (AI requests today, this month)
- [ ] Show token balance
- [ ] Add upgrade/downgrade buttons
- [ ] Add cancel subscription button
- [ ] Show billing history
- [ ] Update payment method UI

**Testing:**
- ✅ Billing page loads for subscribed user
- ✅ Shows correct tier (Community Pro)
- ✅ Usage stats accurate
- ✅ Token balance displayed
- ✅ Can upgrade to Pro Learn (prorated)
- ✅ Can cancel subscription
- ✅ Access continues until period end after cancel

**User Flows to Test:**
```
Flow 1: View billing
1. Login as Community Pro user
2. Go to /account/billing
3. See "Community Pro" tier
4. See "Next billing: Jan 1, 2026"
5. See "45 AI requests today"

Flow 2: Upgrade
1. Click "Upgrade to Pro Learn"
2. Confirm upgrade
3. See "Pro Learn" tier
4. Receive prorated charge email from Stripe

Flow 3: Cancel
1. Click "Cancel subscription"
2. Confirm cancellation
3. See "Cancels on: Jan 1, 2026"
4. Access still works until that date
```

---

### 🎯 Phase 10: Frontend - Token Shop (1 week)

**Goal:** Users can buy token packages

**Tasks:**
- [ ] Create `/tokens` page
- [ ] Display token balance prominently
- [ ] Show 3 package cards
- [ ] Add purchase flow with Stripe
- [ ] Show transaction history
- [ ] Add usage projections
- [ ] Create "Out of Tokens" modal

**Testing:**
- ✅ Token shop page loads
- ✅ Balance shows correctly
- ✅ Can purchase Starter package
- ✅ Payment succeeds
- ✅ Balance increases immediately
- ✅ Transaction appears in history
- ✅ "Out of tokens" modal triggers when balance = 0

**Purchase Flow Test:**
```
1. User at token limit sees modal
2. Click "Buy Tokens"
3. Redirect to /tokens
4. Click "Starter Pack - $5"
5. Stripe checkout opens
6. Enter test card 4242 4242 4242 4242
7. Payment succeeds
8. Modal closes
9. Balance shows +100K tokens
10. User can continue AI request
```

---

### 🎯 Phase 11: Testing & Bug Fixes (1 week)

**Goal:** Ensure everything works reliably before launch

**Tasks:**
- [ ] Run full regression test suite
- [ ] Test all subscription upgrade/downgrade paths
- [ ] Test edge cases (expired cards, failed payments)
- [ ] Load test webhook endpoint
- [ ] Security audit (OWASP checklist)
- [ ] Fix all critical bugs
- [ ] Performance optimization

**Test Scenarios:**
1. **Failed Payment**
   - Use test card 4000000000000002 (decline)
   - Verify user gets clear error message
   - Subscription not created

2. **Webhook Failures**
   - Simulate webhook timeout
   - Verify retry logic works
   - Check idempotency (duplicate events)

3. **Race Conditions**
   - Multiple users buying tokens simultaneously
   - Token balance updates atomically
   - No duplicate charges

4. **Edge Cases**
   - Cancel during trial period
   - Upgrade immediately after subscription
   - Change payment method mid-cycle

**Performance Targets:**
- Subscription checkout < 3 seconds (p95)
- Webhook processing < 1 second (p95)
- Token purchase < 2 seconds (p95)

---

### 🎯 Phase 12: Production Prep (3 days)

**Goal:** Ready for production launch

**Tasks:**
- [ ] Create production Stripe account
- [ ] Create production tiers/prices in Stripe
- [ ] Set up production webhook endpoint
- [ ] Update environment variables (production keys)
- [ ] Set up Stripe webhook monitoring
- [ ] Configure Sentry for error tracking
- [ ] Write deployment runbook
- [ ] Create user documentation

**Pre-Launch Checklist:**
- [ ] All environment variables set
- [ ] Webhook endpoint verified in Stripe dashboard
- [ ] Database migrations run on production
- [ ] Seed data created (tiers & packages)
- [ ] Sentry configured and tested
- [ ] Rollback plan documented
- [ ] Team trained on Stripe dashboard
- [ ] Support team briefed on common issues

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0. Preparation | 3 days | 3 days |
| 1. Models | 1 week | 1.5 weeks |
| 2. Stripe Service | 1 week | 2.5 weeks |
| 3. Webhooks | 1 week | 3.5 weeks |
| 4. Subscription API | 1 week | 4.5 weeks |
| 5. Token Purchase | 1 week | 5.5 weeks |
| 6. Permissions | 1 week | 6.5 weeks |
| 7. Pricing Page | 1 week | 7.5 weeks |
| 8. Subscribe Flow | 1.5 weeks | 9 weeks |
| 9. Billing Mgmt | 1 week | 10 weeks |
| 10. Token Shop | 1 week | 11 weeks |
| 11. Testing | 1 week | 12 weeks |
| 12. Production | 3 days | 12.5 weeks |

**Total:** ~3 months (12.5 weeks)

---

## Testing Gates

Each phase must pass its testing criteria before moving to the next phase. This prevents cascading bugs and ensures incremental progress.

**Definition of Done for Each Phase:**
- [ ] All tasks completed
- [ ] All tests passing
- [ ] Code reviewed
- [ ] No critical bugs
- [ ] Documentation updated
- [ ] Demo'd to product team

---

## Risk Mitigation

### High-Risk Areas

1. **Webhook Reliability**
   - **Risk:** Missed webhooks = incorrect access grants
   - **Mitigation:** Comprehensive logging, retry logic, manual reconciliation tool

2. **Token Consumption Race Conditions**
   - **Risk:** Multiple requests consume same token
   - **Mitigation:** Database-level atomic operations, transactions

3. **Failed Payments**
   - **Risk:** User expects access but payment failed
   - **Mitigation:** Clear error messages, webhook monitoring, status checks

4. **Stripe API Changes**
   - **Risk:** Stripe updates break our integration
   - **Mitigation:** Pin Stripe SDK version, test in sandbox first

### Rollback Plan

If critical issues arise in production:

1. **Immediate:** Disable new subscriptions (feature flag)
2. **Within 1 hour:** Roll back to previous deployment
3. **Within 4 hours:** Fix critical bug and redeploy
4. **Ongoing:** Manually process any stuck subscriptions

---

## Success Metrics

**Launch Goals (First Month):**
- 100 total signups
- 10% conversion to paid tier (10 paid users)
- $1,000 MRR (Monthly Recurring Revenue)
- < 5% failed payments
- Zero payment disputes

**Technical Metrics:**
- 99.9% webhook delivery success
- < 3 second checkout time (p95)
- < 1 second webhook processing (p95)
- Zero duplicate charges

---

## Future Enhancements (Phase 2)

Once Phase 1 is stable and launched:

### Marketplace for Creator/Mentor Tier
- Stripe Connect integration for creator payouts
- Sell digital projects, courses, mentorship
- 5% platform fee
- Invite-only access (application required)

### Advanced Features
- Annual billing (10-15% discount)
- Team plans
- Usage-based billing
- Referral rewards
- Gift subscriptions

---

## Appendix: Key Files

### Backend Files to Create
- `core/billing/__init__.py`
- `core/billing/models.py` - All 7 models
- `core/billing/stripe_service.py` - Stripe API wrapper
- `core/billing/webhooks.py` - Webhook handlers
- `core/billing/views.py` - API endpoints
- `core/billing/serializers.py` - DRF serializers
- `core/billing/permissions.py` - Permission checking
- `core/billing/admin.py` - Django admin
- `core/billing/urls.py` - URL routing
- `core/billing/tests/` - Test suite
- `core/billing/management/commands/seed_billing_data.py`

### Frontend Files to Create
- `frontend/src/pages/PricingPage.tsx`
- `frontend/src/pages/TokenShopPage.tsx`
- `frontend/src/pages/account/BillingPage.tsx`
- `frontend/src/components/billing/SubscribeModal.tsx`
- `frontend/src/components/billing/TierCard.tsx`
- `frontend/src/components/tokens/TokenBalanceWidget.tsx`
- `frontend/src/components/tokens/TokenPackageCard.tsx`
- `frontend/src/components/tokens/OutOfTokensModal.tsx`
- `frontend/src/services/billing.ts`

### Files to Update
- `core/users/models.py` - Add subscription relationship
- `core/agents/views.py` - Add permission checking
- `core/integrations/views.py` - Add permission checking
- `config/settings.py` - Add Stripe config
- `config/urls.py` - Include billing URLs
- `requirements.txt` - Add `stripe` package
- `frontend/package.json` - Add `@stripe/react-stripe-js`

---

## Questions & Decisions

### Decisions Made
- ✅ Use quarterly billing as primary (reduces churn)
- ✅ Tokens never expire (better UX)
- ✅ 7-day trial for Community Pro only
- ✅ Simple Stripe (no Connect) for Phase 1

### Open Questions
1. **Creator/Mentor pricing?** - TBD, depends on marketplace features
2. **Annual billing discount?** - 10-15% recommended
3. **Refund policy?** - Suggest 7 days for subscriptions, no refunds for tokens
4. **Payment method requirement for trial?** - Recommend yes (reduces fraud)

---

**Next Steps:**
1. Review this plan with product & engineering teams
2. Get approval to start Phase 0
3. Create Stripe test account
4. Begin implementation!
