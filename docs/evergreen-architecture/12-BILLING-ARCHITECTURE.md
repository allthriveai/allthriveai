# Billing, Pricing & AI Guardrails

**Source of Truth** | **Last Updated**: 2025-12-17

This document defines the billing architecture, pricing model, token/credit system, and AI usage guardrails for AllThrive AI. It covers Stripe integration, subscription management, credit packs, and cost protection mechanisms.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Billing Architecture                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│   │ Subscription │    │ Credit Packs │    │   Token Packages          │ │
│   │    Tiers     │    │  (Lovable)   │    │  (Legacy / Add-on)       │ │
│   └──────┬───────┘    └──────┬───────┘    └───────────┬──────────────┘ │
│          │                   │                        │                 │
│          └───────────────────┼────────────────────────┘                 │
│                              │                                          │
│                    ┌─────────▼─────────┐                               │
│                    │  Stripe Webhooks  │                               │
│                    │  (Event Handler)  │                               │
│                    └─────────┬─────────┘                               │
│                              │                                          │
│          ┌───────────────────┼───────────────────┐                     │
│          │                   │                   │                     │
│          ▼                   ▼                   ▼                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐              │
│   │ UserSubscr-  │   │  CreditPack  │   │ TokenBalance │              │
│   │   iption     │   │   Balance    │   │   (Legacy)   │              │
│   └──────────────┘   └──────────────┘   └──────────────┘              │
│                              │                                          │
│                    ┌─────────▼─────────┐                               │
│                    │  AI Request Gate  │                               │
│                    │  (Guardrails)     │                               │
│                    └─────────┬─────────┘                               │
│                              │                                          │
│   ┌──────────────────────────┼──────────────────────────────┐          │
│   │                          │                              │          │
│   ▼                          ▼                              ▼          │
│ ┌────────────┐        ┌────────────┐                ┌────────────┐    │
│ │Daily Limit │        │ Token Limit│                │   Monthly  │    │
│ │ (500/day)  │        │ (32K/req)  │                │   Budget   │    │
│ └────────────┘        └────────────┘                └────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Model

### Subscription Tiers

| Tier | Price | Monthly AI Requests | Features |
|------|-------|---------------------|----------|
| **Free (Explorer)** | $0 | 20/month | Basic access, 10 projects max |
| **Community Pro** | $18/month ($54/quarter) | 200/month | Unlimited projects, AI agents |
| **Pro Learn** | $35/month ($105/quarter) | Unlimited | Go1 courses, mentorship access |

### Credit Packs (Lovable-Style)

Credit packs are one-time purchases that provide AI credits. They follow the "Lovable" model where users buy packs upfront.

| Pack | Credits | Price | Cost/Credit |
|------|---------|-------|-------------|
| **Starter** | 100 | $10 | $0.10 |
| **Builder** | 300 | $25 | $0.083 |
| **Power** | 1,000 | $75 | $0.075 |
| **Pro** | 3,000 | $200 | $0.067 |

**Key Properties**:
- Credits **do not expire**
- Subscription credits reset monthly (not accumulated)
- Credit packs stack with subscription allowance
- 1 credit = 1 AI request (regardless of token count)

---

## Data Models

### Subscription Management

**Location**: `core/billing/models.py`

```python
class SubscriptionTier(models.Model):
    """Defines subscription plan features and limits."""
    slug = CharField(unique=True)  # 'free', 'community-pro', 'pro-learn'
    tier_type = CharField(choices=TIER_TYPES)
    price_monthly = DecimalField()
    price_annual = DecimalField()
    monthly_ai_requests = IntegerField()  # 0 = unlimited
    # Feature flags
    has_marketplace_access = BooleanField()
    has_ai_mentor = BooleanField()
    has_go1_courses = BooleanField()
    # ... other features

class UserSubscription(models.Model):
    """User's active subscription state."""
    user = OneToOneField(User)
    tier = ForeignKey(SubscriptionTier)
    status = CharField()  # 'active', 'cancelled', 'past_due'
    stripe_subscription_id = CharField()
    ai_requests_used_this_month = IntegerField(default=0)
    ai_requests_reset_date = DateField()
    current_period_start = DateTimeField()
    current_period_end = DateTimeField()
```

### Credit Pack System

**Location**: `core/billing/models.py`

```python
class CreditPackType(models.Model):
    """Available credit pack offerings."""
    slug = CharField(unique=True)  # 'starter', 'builder', 'power', 'pro'
    name = CharField()
    credits = IntegerField()
    price_cents = IntegerField()
    stripe_price_id = CharField()
    is_active = BooleanField()

class CreditPackPurchase(models.Model):
    """Individual credit pack purchases."""
    user = ForeignKey(User)
    pack_type = ForeignKey(CreditPackType)
    credits_purchased = IntegerField()
    credits_remaining = IntegerField()
    stripe_payment_intent_id = CharField()
    status = CharField()  # 'pending', 'completed', 'failed', 'refunded'
    purchased_at = DateTimeField()
    completed_at = DateTimeField()

class UserCreditBalance(models.Model):
    """Aggregated credit balance for a user."""
    user = OneToOneField(User)
    total_credits = IntegerField(default=0)
    credits_used = IntegerField(default=0)
    last_updated = DateTimeField()
```

### Usage Tracking

**Location**: `core/billing/models.py`

```python
class CreditUsageLog(models.Model):
    """Detailed log of credit consumption."""
    user = ForeignKey(User)
    credits_used = IntegerField()
    ai_provider = CharField()  # 'openai', 'anthropic', 'google'
    ai_model = CharField()  # 'gpt-4o', 'claude-3-opus', etc.
    input_tokens = IntegerField()
    output_tokens = IntegerField()
    estimated_cost_usd = DecimalField()
    feature = CharField()  # 'chat', 'project_analysis', 'battle'
    timestamp = DateTimeField()
```

---

## Stripe Integration

### Webhook Events

**Endpoint**: `POST /api/v1/billing/webhooks/stripe/`

**Location**: `core/billing/views.py`

| Event | Handler | Purpose |
|-------|---------|---------|
| `checkout.session.completed` | `handle_checkout_session_completed` | Activate subscription/credit pack |
| `invoice.payment_succeeded` | `handle_invoice_payment_succeeded` | Monthly renewal, grant credits |
| `invoice.payment_failed` | `handle_invoice_payment_failed` | Mark subscription past_due |
| `customer.subscription.updated` | `handle_subscription_updated` | Plan changes, cancellations |
| `customer.subscription.deleted` | `handle_subscription_deleted` | Revert to free tier |
| `payment_intent.succeeded` | `handle_payment_intent_succeeded` | One-time purchases (credit packs) |

### Webhook Security

```python
@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

    # Verify webhook signature
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )

    # Idempotency check (prevent duplicate processing)
    with transaction.atomic():
        processed, created = ProcessedWebhookEvent.objects.select_for_update().get_or_create(
            stripe_event_id=event['id'],
            defaults={'event_type': event['type']}
        )
        if not created:
            return HttpResponse(status=200)  # Already processed
```

### Checkout Flow

**New Subscription**:
```python
def create_checkout_session(user, tier_slug, billing_cycle):
    session = stripe.checkout.Session.create(
        customer=get_or_create_customer(user),
        mode='subscription',
        line_items=[{
            'price': tier.stripe_price_id,
            'quantity': 1,
        }],
        success_url=f'{settings.FRONTEND_URL}/billing/success',
        cancel_url=f'{settings.FRONTEND_URL}/pricing',
        metadata={
            'user_id': user.id,
            'tier_slug': tier_slug,
        },
    )
    return session.url
```

**Credit Pack Purchase**:
```python
def create_credit_pack_checkout(user, pack_slug):
    pack = CreditPackType.objects.get(slug=pack_slug)
    session = stripe.checkout.Session.create(
        customer=get_or_create_customer(user),
        mode='payment',  # One-time, not subscription
        line_items=[{
            'price': pack.stripe_price_id,
            'quantity': 1,
        }],
        metadata={
            'user_id': user.id,
            'pack_type': pack_slug,
            'credits': pack.credits,
        },
    )
    return session.url
```

---

## AI Guardrails

### Overview

AllThrive implements multiple layers of protection against AI cost overruns:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Request Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Request                                               │
│        │                                                     │
│        ▼                                                     │
│   ┌─────────────────────────────────────────┐               │
│   │  Layer 1: Daily Request Limit           │               │
│   │  - Soft: 200/day (warning)              │               │
│   │  - Hard: 500/day (block)                │               │
│   │  - Always enforced (even in beta)       │               │
│   └────────────────┬────────────────────────┘               │
│                    │ PASS                                    │
│                    ▼                                         │
│   ┌─────────────────────────────────────────┐               │
│   │  Layer 2: Per-Request Token Limit       │               │
│   │  - Soft: 8,000 tokens (warning)         │               │
│   │  - Hard: 32,000 tokens (block)          │               │
│   │  - Output cap: 4,096 tokens             │               │
│   └────────────────┬────────────────────────┘               │
│                    │ PASS                                    │
│                    ▼                                         │
│   ┌─────────────────────────────────────────┐               │
│   │  Layer 3: Credit/Subscription Check     │               │
│   │  - Beta mode: Bypass (but track)        │               │
│   │  - Production: Enforce limits           │               │
│   └────────────────┬────────────────────────┘               │
│                    │ PASS                                    │
│                    ▼                                         │
│   ┌─────────────────────────────────────────┐               │
│   │  AI Provider Call                        │               │
│   │  (OpenAI / Anthropic / Google)          │               │
│   └─────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Daily Request Limits

**Purpose**: Prevent any single user from making excessive requests

**Location**: `core/billing/utils.py`

```python
# Settings (config/settings.py)
AI_DAILY_REQUEST_SOFT_LIMIT = 200   # Warn above this
AI_DAILY_REQUEST_HARD_LIMIT = 500   # Block above this

# Functions
def check_daily_request_limit(user_id: int) -> tuple[bool, int]:
    """
    Check if user is within daily limit.

    Raises:
        DailyRequestLimitExceededError: If hard limit exceeded
    """

def increment_daily_request_count(user_id: int) -> int:
    """Atomically increment daily counter in Redis."""

def get_user_daily_request_count(user_id: int) -> int:
    """Get current daily count from Redis."""
```

**Storage**: Redis cache with automatic midnight expiry
```
Key: ai_daily_requests:{user_id}:{date}
TTL: Seconds until midnight
```

**Important**: Daily limits are **ALWAYS enforced**, even in beta mode. This is your primary abuse protection.

### Layer 2: Per-Request Token Limits

**Purpose**: Prevent single requests from consuming excessive tokens

**Location**: `services/ai/provider.py`

```python
# Settings (config/settings.py)
AI_TOKEN_SOFT_LIMIT = 8000      # Warn above this (~24K chars)
AI_TOKEN_HARD_LIMIT = 32000     # Block above this (~96K chars)
AI_OUTPUT_TOKEN_LIMIT = 4096    # Max output per request

# Token estimation
def estimate_token_count(text: str) -> int:
    """Estimate tokens using ~3 chars/token heuristic."""
    return max(1, len(text) // 3) if text else 0

# Pre-flight check
def check_token_limits(prompt: str, system_message: str = None, user_id: int = None):
    """
    Check if request is within token limits.

    Raises:
        TokenLimitExceededError: If hard limit exceeded
    """
```

**Integration**: Called at the start of `AIProvider.complete()` and `AIProvider.stream_complete()` before making any API call.

### Layer 3: Credit/Subscription Enforcement

**Purpose**: Ensure users have credits/subscription before AI usage

**Location**: `core/billing/utils.py`

```python
def check_and_reserve_ai_request(user, tokens_used=0, ai_provider='', ai_model=''):
    """
    Atomically check AND reserve an AI request slot.

    Order of operations:
    1. Check daily limit (always enforced)
    2. Increment daily counter
    3. Track credit pack usage (for analytics)
    4. In beta: Allow request
    5. In production: Check subscription/credits
    """
```

---

## Beta Mode

**Setting**: `BETA_MODE = True` in environment

When beta mode is enabled:

| Feature | Beta Behavior |
|---------|---------------|
| Daily Request Limit | **Still enforced** (500/day hard limit) |
| Token Limits | **Still enforced** (32K/request) |
| Subscription Check | **Bypassed** (unlimited monthly) |
| Credit Deduction | **Tracked but not enforced** |
| Feature Access | **All features unlocked** |

```python
def check_and_reserve_ai_request(user, ...):
    # ALWAYS check daily limit first (even in beta)
    check_daily_request_limit(user.id)

    # Track usage (for analytics)
    CreditPackService.track_usage(user, tokens_used, ...)

    # Increment daily counter
    increment_daily_request_count(user.id)

    # Beta mode: Allow without subscription check
    if is_beta_mode():
        return True, f'Beta mode - unlimited access (daily: {count})'
```

---

## Configuration Reference

### Environment Variables

```bash
# Beta Mode
BETA_MODE=true                          # Enable beta (bypass subscriptions)

# Daily Request Limits
AI_DAILY_REQUEST_SOFT_LIMIT=200         # Warn above this
AI_DAILY_REQUEST_HARD_LIMIT=500         # Block above this (0=unlimited)

# Per-Request Token Limits
AI_TOKEN_SOFT_LIMIT=8000                # Warn above this
AI_TOKEN_HARD_LIMIT=32000               # Block above this
AI_OUTPUT_TOKEN_LIMIT=4096              # Max output tokens

# Cost Tracking
AI_COST_TRACKING_ENABLED=true           # Track costs in logs
AI_MONTHLY_SPEND_LIMIT_USD=1000         # Platform-wide monthly limit
AI_USER_DAILY_SPEND_LIMIT_USD=5         # Per-user daily spend limit

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Credit Pack Enforcement
CREDIT_PACK_ENFORCEMENT_ENABLED=false   # Enable credit deduction
```

### Limit Recommendations

| Environment | Daily Hard Limit | Token Hard Limit | Notes |
|-------------|------------------|------------------|-------|
| **Development** | 0 (unlimited) | 32,000 | Fast iteration |
| **Staging** | 100 | 32,000 | Test limit behavior |
| **Production (Beta)** | 500 | 32,000 | Generous but protected |
| **Production (Launch)** | Based on tier | 32,000 | Enforce subscriptions |

---

## API Endpoints

### Subscription Status

```http
GET /api/v1/billing/status/
Authorization: Bearer <jwt>

Response:
{
  "has_subscription": true,
  "tier": {
    "name": "Community Pro",
    "slug": "community-pro",
    "price_monthly": 18.00
  },
  "ai_requests": {
    "limit": 200,
    "used": 45,
    "remaining": 155,
    "reset_date": "2025-01-01"
  },
  "daily_requests": {
    "limit": 500,
    "used": 12,
    "remaining": 488
  },
  "beta_mode": false,
  "features": {
    "marketplace": true,
    "ai_mentor": true,
    "go1_courses": false
  }
}
```

### Credit Pack Purchase

```http
POST /api/v1/billing/credit-packs/purchase/
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "pack_slug": "builder"
}

Response:
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### Stripe Billing Portal

```http
POST /api/v1/billing/portal/
Authorization: Bearer <jwt>

Response:
{
  "portal_url": "https://billing.stripe.com/..."
}
```

---

## Error Handling

### Daily Limit Exceeded

```python
class DailyRequestLimitExceededError(Exception):
    """Raised when user exceeds daily AI request limit."""

    def __init__(self, user_id, request_count, limit):
        self.user_id = user_id
        self.request_count = request_count
        self.limit = limit
        self.message = (
            f"You've reached your daily limit of {limit} AI requests. "
            f"Please try again tomorrow or contact support if you need more."
        )
```

**HTTP Response**: `429 Too Many Requests`
```json
{
  "error": "daily_limit_exceeded",
  "message": "You've reached your daily limit of 500 AI requests.",
  "daily_used": 500,
  "daily_limit": 500,
  "resets_at": "2025-01-02T00:00:00Z"
}
```

### Token Limit Exceeded

```python
class TokenLimitExceededError(Exception):
    """Raised when request exceeds token limit."""

    def __init__(self, estimated_tokens, limit):
        self.estimated_tokens = estimated_tokens
        self.limit = limit
        self.message = (
            f"Request too large: ~{estimated_tokens:,} tokens (limit: {limit:,}). "
            f"Please shorten your message."
        )
```

**HTTP Response**: `413 Payload Too Large`
```json
{
  "error": "token_limit_exceeded",
  "message": "Request too large: ~45,000 tokens (limit: 32,000).",
  "estimated_tokens": 45000,
  "token_limit": 32000
}
```

### Insufficient Credits

**HTTP Response**: `402 Payment Required`
```json
{
  "error": "insufficient_credits",
  "message": "You've used all your credits. Purchase more to continue.",
  "credits_remaining": 0,
  "upgrade_url": "/pricing"
}
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Daily requests per user | > 400 | Warning (approaching limit) |
| Token usage per request | > 20,000 | Warning (large request) |
| Monthly platform spend | > $800 | Warning (80% budget) |
| Failed webhook events | > 5/hour | Critical |
| Credit pack purchase failures | > 10% | Warning |

### Logging

**Structured Logs** (`core/logging_utils.py`):

```python
# Daily limit warnings
logger.warning(
    f'User {user_id} approaching daily request limit: {count}/{limit}',
    extra={
        'user_id': user_id,
        'request_count': count,
        'soft_limit': soft_limit,
        'hard_limit': hard_limit,
    }
)

# Token limit warnings
logger.warning(
    f'Request approaching token limit: {tokens} tokens (soft: {soft}, hard: {hard})',
    extra={
        'user_id': user_id,
        'estimated_tokens': tokens,
        'soft_limit': soft_limit,
        'hard_limit': hard_limit,
    }
)
```

---

## Testing

### Key Test Cases

**Location**: `core/billing/tests/`

```python
# Daily limit tests
def test_daily_limit_blocks_at_hard_limit()
def test_daily_limit_warns_at_soft_limit()
def test_daily_limit_enforced_in_beta_mode()
def test_daily_count_resets_at_midnight()

# Token limit tests
def test_token_limit_blocks_large_requests()
def test_token_limit_warns_at_soft_limit()
def test_complete_checks_token_limits_before_api_call()

# Credit pack tests
def test_credit_purchase_grants_credits()
def test_credits_deducted_on_ai_request()
def test_credits_not_deducted_in_beta_mode()

# Webhook tests
def test_checkout_completed_activates_subscription()
def test_invoice_payment_renews_subscription()
def test_webhook_idempotency_prevents_duplicates()
```

### Running Tests

```bash
# All billing tests
make test-backend -- core/billing/tests/ -v

# Specific test class
docker-compose exec web python manage.py test \
  core.billing.tests.test_utils.DailyRequestLimitTestCase -v 2

# AI provider token limit tests
docker-compose exec web python manage.py test \
  services.tests.test_ai_provider.TokenLimitTestCase -v 2
```

---

## Future Enhancements

### Planned Features

1. **Usage Dashboard**: Real-time visualization of credit/request usage
2. **Budget Alerts**: Email notifications at 50%, 80%, 100% of limits
3. **Team Billing**: Shared credit pools for organizations
4. **Usage Analytics**: Breakdown by feature, model, time period
5. **Auto-Upgrade Prompts**: Smart suggestions when limits approached
6. **Rollover Credits**: Option to carry unused subscription credits

### Compliance

- **PCI DSS**: Stripe handles all payment data
- **GDPR**: User billing data included in data export
- **SOC 2**: Audit logging for all financial transactions

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
