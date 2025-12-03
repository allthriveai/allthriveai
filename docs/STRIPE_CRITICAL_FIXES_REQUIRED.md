# 🚨 CRITICAL STRIPE INTEGRATION FIXES REQUIRED

**Status**: ⚠️ DO NOT DEPLOY TO PRODUCTION
**Date**: 2025-12-02
**Severity**: CRITICAL - Application will crash on subscription creation

---

## Executive Summary

A comprehensive code review of the Stripe integration revealed **5 critical issues** and **5 warnings** that must be addressed before production deployment. The most severe issue will cause immediate application crashes.

**Security Score**: 5/10
**Recommendation**: Fix all critical issues before ANY production deployment

---

## 🔴 CRITICAL ISSUE #1: Database Model Mismatch (WILL CRASH APP)

### Problem
The code references `stripe_price_id_quarterly` throughout `services.py`, but this field **does not exist** in the database model.

### Business Model
- Your pricing is quarterly: $54/quarter, $105/quarter, etc.
- Database model has: `stripe_price_id_monthly`, `stripe_price_id_annual`
- Code references: `stripe_price_id_quarterly` ❌

### Impact
- **Application will crash** with `AttributeError` when creating subscriptions
- All subscription operations will fail completely
- Payment system is currently broken

### Locations
- `core/billing/services.py:128` - References quarterly price
- `core/billing/services.py:144` - References quarterly price
- `core/billing/services.py:300` - References quarterly price
- `core/billing/services.py:312` - References quarterly price
- `core/billing/models.py:57-60` - Only has monthly/annual fields

### Fix Options

**Option A: Add Quarterly Field to Model (RECOMMENDED)**

```python
# core/billing/models.py
class SubscriptionTier(models.Model):
    # Pricing
    price_monthly = models.DecimalField(...)  # Keep for flexibility
    price_quarterly = models.DecimalField(  # ADD THIS
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        default=Decimal('0.00'),
        help_text='Price in USD per quarter (3 months)',
    )
    price_annual = models.DecimalField(...)  # Keep for flexibility

    # Stripe Integration
    stripe_price_id_monthly = models.CharField(...)  # Keep
    stripe_price_id_quarterly = models.CharField(  # ADD THIS
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text='Stripe Price ID for quarterly billing'
    )
    stripe_price_id_annual = models.CharField(...)  # Keep
```

**Migration Required:**
```bash
python manage.py makemigrations billing
python manage.py migrate billing
```

**Update Seed Data:**
```python
# core/billing/management/commands/seed_billing.py
{
    'tier_type': 'community_pro',
    'price_monthly': Decimal('18.00'),   # $18/mo
    'price_quarterly': Decimal('54.00'),  # ADD THIS - $54/quarter
    'price_annual': Decimal('216.00'),    # Keep for future
    # ...
}
```

**Option B: Use Monthly Field for Quarterly Prices (NOT RECOMMENDED)**

Change all references from `quarterly` to `monthly` but this is confusing and semantically wrong.

---

## 🔴 CRITICAL ISSUE #2: Missing Webhook Idempotency

### Problem
Stripe can send the same webhook event multiple times (network retries, failures, etc.). The code doesn't check if an event was already processed, so:

- Token purchases could be credited TWICE
- Users get free tokens
- Revenue loss

### Location
`core/billing/services.py:604-661` - `handle_payment_intent_succeeded()`

### Current Code (VULNERABLE)
```python
@staticmethod
@transaction.atomic
def handle_payment_intent_succeeded(event_data: dict[str, Any]) -> None:
    payment_intent = event_data['object']
    payment_intent_id = payment_intent['id']

    purchase = TokenPurchase.objects.get(stripe_payment_intent_id=payment_intent_id)
    purchase.stripe_charge_id = payment_intent.get('latest_charge')
    purchase.mark_completed()  # ❌ Could add tokens TWICE if webhook fires twice!
```

### Fix Required

**Step 1: Create WebhookEvent Model**
```python
# core/billing/models.py
class WebhookEvent(models.Model):
    """Track processed Stripe webhook events for idempotency."""

    stripe_event_id = models.CharField(max_length=255, unique=True, db_index=True)
    event_type = models.CharField(max_length=100)
    processed_at = models.DateTimeField(auto_now_add=True)
    raw_data = models.JSONField()  # Store for debugging

    class Meta:
        indexes = [
            models.Index(fields=['-processed_at']),  # For cleanup queries
        ]
```

**Step 2: Update Webhook Handler**
```python
@csrf_exempt
@require_http_methods(['POST'])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.headers.get('stripe-signature')

    try:
        event = StripeService.verify_webhook_signature(payload, sig_header)

        # ✅ CHECK IF ALREADY PROCESSED
        if WebhookEvent.objects.filter(stripe_event_id=event['id']).exists():
            logger.info(f"Webhook {event['id']} already processed, skipping")
            return HttpResponse('Event already processed', status=200)

        # Process event
        event_type = event['type']
        event_data = event['data']

        # Handle different event types...

        # ✅ MARK AS PROCESSED
        WebhookEvent.objects.create(
            stripe_event_id=event['id'],
            event_type=event_type,
            raw_data=event
        )

        return HttpResponse('Webhook received', status=200)
    except Exception as e:
        logger.error(f'Error processing webhook: {e}', exc_info=True)
        return HttpResponse('Webhook processing failed', status=500)
```

**Step 3: Cleanup Task**
```python
# Clean up old webhook events (keep 90 days)
WebhookEvent.objects.filter(
    processed_at__lt=timezone.now() - timedelta(days=90)
).delete()
```

---

## 🔴 CRITICAL ISSUE #3: Race Condition in AI Request Counter

### Problem
Multiple concurrent requests can bypass the AI quota limit because the check and increment are not atomic.

### Location
- `core/billing/models.py:157-169` - `can_make_ai_request()`
- `core/billing/utils.py:134` - Counter increment

### Current Code (VULNERABLE)
```python
# User makes 2 concurrent requests with 1 request remaining:
# Request A: Check quota (1/100) ✅ Pass
# Request B: Check quota (1/100) ✅ Pass (before A increments!)
# Request A: Increment (2/100)
# Request B: Increment (3/100) ❌ User exceeded quota!
```

### Fix Required

**Use Django F() Expression for Atomic Update:**

```python
# core/billing/utils.py
from django.db.models import F

def increment_ai_request_count(user):
    """Atomically increment AI request counter."""
    subscription = get_user_subscription(user)

    # Reset if needed
    if subscription.ai_requests_reset_date and subscription.ai_requests_reset_date < timezone.now().date():
        subscription.ai_requests_used_this_month = 0
        subscription.ai_requests_reset_date = timezone.now().date()
        subscription.save()

    # ✅ ATOMIC INCREMENT with check
    updated = UserSubscription.objects.filter(
        id=subscription.id,
        ai_requests_used_this_month__lt=F('tier__monthly_ai_requests')  # Check quota
    ).update(
        ai_requests_used_this_month=F('ai_requests_used_this_month') + 1  # Increment
    )

    if updated == 0:
        # Quota exceeded
        raise QuotaExceededError('AI request quota exceeded')

    # Refresh from DB
    subscription.refresh_from_db()
    return subscription
```

---

## 🔴 CRITICAL ISSUE #4: No Rate Limiting on Webhook Endpoint

### Problem
Attackers could flood the webhook endpoint with fake requests, exhausting server resources.

### Location
`core/billing/views.py:38` - `stripe_webhook`

### Fix Required

**Use Django Rate Limiting:**

```bash
pip install django-ratelimit
```

```python
# core/billing/views.py
from django_ratelimit.decorators import ratelimit

@csrf_exempt
@require_http_methods(['POST'])
@ratelimit(key='ip', rate='100/m', method='POST')  # ✅ 100 requests per minute per IP
def stripe_webhook(request):
    # Check if rate limited
    if getattr(request, 'limited', False):
        logger.warning(f'Webhook rate limit exceeded from IP: {request.META.get("REMOTE_ADDR")}')
        return HttpResponse('Rate limit exceeded', status=429)

    # ... rest of webhook handler
```

**Better: IP Whitelist for Stripe**

```python
# config/settings.py
STRIPE_WEBHOOK_IPS = [
    '3.18.12.63',
    '3.130.192.231',
    '13.235.14.237',
    # ... all Stripe webhook IPs
    # From: https://stripe.com/docs/ips
]

# core/billing/views.py
def stripe_webhook(request):
    client_ip = request.META.get('REMOTE_ADDR')

    # ✅ CHECK IP WHITELIST
    if client_ip not in settings.STRIPE_WEBHOOK_IPS:
        logger.warning(f'Webhook from non-Stripe IP: {client_ip}')
        return HttpResponse('Unauthorized', status=403)

    # ... rest of handler
```

---

## 🔴 CRITICAL ISSUE #5: Client Secret Could Be Logged

### Problem
The subscription creation response includes `client_secret`. If this response is logged anywhere (error logs, debug logs, etc.), the secret could be exposed.

### Location
`core/billing/services.py:194-207` - `create_subscription` return value

### Fix Required

**Option A: Add Logging Sanitization**

```python
# core/billing/utils.py
def sanitize_for_logging(data: dict) -> dict:
    """Remove sensitive fields before logging."""
    sensitive_keys = ['client_secret', 'password', 'token', 'api_key']
    sanitized = data.copy()

    for key in sensitive_keys:
        if key in sanitized:
            sanitized[key] = '***REDACTED***'

    return sanitized

# Usage in any logging
logger.info(f'Subscription created: {sanitize_for_logging(result)}')
```

**Option B: Never Return Client Secret in Dict with Other Data**

```python
# Return client_secret separately
def create_subscription(user, tier):
    # ... create subscription

    # Return tuple instead of dict
    return (
        {
            'subscription_id': stripe_subscription.id,
            'status': stripe_subscription.status,
            # NO client_secret here
        },
        client_secret  # Returned separately
    )
```

---

## 🟡 WARNING #1: Missing Payment Amount Validation

### Problem
No server-side check that the Stripe price ID corresponds to the correct tier price.

### Fix Required

```python
# core/billing/services.py
@staticmethod
def create_subscription(user, tier: SubscriptionTier) -> dict[str, Any]:
    # ... existing code

    # ✅ VALIDATE PRICE MATCHES TIER
    stripe_price = stripe.Price.retrieve(tier.stripe_price_id_quarterly)
    expected_amount = int(tier.price_quarterly * 100)  # Convert to cents

    if stripe_price['unit_amount'] != expected_amount:
        raise StripeServiceError(
            f'Price mismatch: Stripe has {stripe_price["unit_amount"]}, '
            f'expected {expected_amount}'
        )

    # Continue with subscription creation...
```

---

## 🟡 WARNING #2: Error Messages Leak Information

### Problem
Raw exception messages are returned to frontend, potentially revealing internal implementation details.

### Fix Required

```python
# core/billing/views.py
def create_subscription_view(request):
    try:
        # ... subscription creation
    except StripeServiceError as e:
        logger.error(f'Subscription creation failed for user {request.user.id}: {e}', exc_info=True)

        # ✅ SANITIZE ERROR MESSAGE
        user_message = 'Unable to create subscription. Please try again or contact support.'
        return Response({'error': user_message}, status=status.HTTP_400_BAD_REQUEST)
```

---

## 🟡 WARNING #3: Missing Transaction Rollback Handling

### Problem
If Stripe API call fails after database update, the database won't properly roll back.

### Fix Required

```python
@staticmethod
@transaction.atomic
def create_subscription(user, tier: SubscriptionTier) -> dict[str, Any]:
    try:
        # 1. Update database first
        user_subscription = get_user_subscription(user)
        user_subscription.tier = tier
        user_subscription.save()

        # 2. Call Stripe (might fail)
        stripe_subscription = stripe.Subscription.create(...)

        # 3. If successful, finalize
        user_subscription.stripe_subscription_id = stripe_subscription.id
        user_subscription.save()

    except stripe.error.StripeError as e:
        # ✅ EXPLICIT ROLLBACK
        transaction.set_rollback(True)
        raise StripeServiceError(f'Stripe API error: {str(e)}')

    except Exception as e:
        # ✅ ROLLBACK ON ANY ERROR
        transaction.set_rollback(True)
        raise
```

---

## Implementation Priority

### Phase 1: URGENT (Before ANY Testing)
1. **Fix database model mismatch** - Add `price_quarterly` and `stripe_price_id_quarterly`
2. **Create migration and update seed data**
3. **Test that subscription creation doesn't crash**

### Phase 2: CRITICAL (Before Production)
4. **Add webhook idempotency** - Create WebhookEvent model
5. **Fix AI request counter race condition** - Use F() expressions
6. **Add rate limiting to webhook** - Install django-ratelimit
7. **Sanitize client secret logging** - Add logging utils

### Phase 3: IMPORTANT (Before Scale)
8. **Add payment amount validation**
9. **Sanitize error messages**
10. **Improve transaction rollback handling**
11. **Add Stripe IP whitelist**
12. **Add comprehensive test suite**

---

## Testing Checklist

After implementing fixes:

- [ ] Subscription creation works without crashes
- [ ] Quarterly pricing displays correctly
- [ ] Duplicate webhook events don't credit tokens twice
- [ ] Concurrent AI requests don't exceed quota
- [ ] Webhook endpoint rejects high-frequency requests
- [ ] Client secret never appears in logs
- [ ] Failed Stripe API calls roll back database changes
- [ ] Error messages don't reveal internal details
- [ ] Payment amounts are validated before charging

---

## Files to Modify

### Immediate (Phase 1)
1. `core/billing/models.py` - Add quarterly fields
2. `core/billing/migrations/00XX_add_quarterly_pricing.py` - New migration
3. `core/billing/management/commands/seed_billing.py` - Update seed data

### Critical (Phase 2)
4. `core/billing/models.py` - Add WebhookEvent model
5. `core/billing/views.py` - Update webhook handler
6. `core/billing/utils.py` - Fix AI counter, add sanitization
7. `core/billing/services.py` - Add validation, improve error handling
8. `requirements.txt` - Add django-ratelimit

---

## Estimated Time to Fix

- **Phase 1 (Urgent)**: 2-3 hours
  - Add fields to model
  - Create migration
  - Update seed data
  - Test basic flow

- **Phase 2 (Critical)**: 4-6 hours
  - Implement idempotency
  - Fix race conditions
  - Add rate limiting
  - Add logging sanitization

- **Phase 3 (Important)**: 3-4 hours
  - Add validations
  - Improve error handling
  - Add tests

**Total**: 9-13 hours to production-ready state

---

## Long-term Recommendations

1. **Add comprehensive test suite** (unit + integration tests)
2. **Implement webhook event replay** for debugging
3. **Add monitoring and alerting** for failed payments
4. **Create runbook** for common payment issues
5. **Set up Stripe test mode** for QA environment
6. **Document payment flows** with sequence diagrams
7. **Add fraud detection** rules
8. **Implement soft delete** for audit trail
9. **Add Stripe dashboard integration** for support team
10. **Create admin tools** for managing subscriptions

---

**Created**: 2025-12-02
**Review Score**: 5/10 (Security Risk)
**Status**: ⚠️ NOT PRODUCTION READY
**Next Action**: Fix Phase 1 issues immediately
