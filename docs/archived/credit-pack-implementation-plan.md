# Credit Pack Add-On System Implementation Plan

## Overview
Add an **optional credit pack subscription** that users can purchase separately from their existing subscription tier. This builds on top of the existing billing system (which handles one-time token purchases). Credit packs are recurring monthly subscriptions that grant credits each billing period.

## Current System (Keep As-Is)
- **BETA_MODE**: Global flag that grants unlimited access - keep this active during beta
- **TokenPackage/UserTokenBalance**: Existing one-time token purchase system - keep working
- **SubscriptionTier**: Free, Community Pro, Pro Learn, Creator - unchanged

## Beta Mode Strategy: Track But Don't Block

### The Problem
Currently, when `BETA_MODE=True`, the code returns early without tracking:
```python
if is_beta_mode():
    return True, 'Beta mode - unlimited access'  # No tracking!
```

### The Solution
Add a new setting `CREDIT_PACK_ENFORCEMENT_ENABLED` (default: False) that controls whether credit packs block users:

| BETA_MODE | CREDIT_PACK_ENFORCEMENT_ENABLED | Behavior |
|-----------|--------------------------------|----------|
| True      | False                          | **Track usage, don't block** (current beta) |
| True      | True                           | Track usage, don't block (beta overrides) |
| False     | False                          | Track usage, don't block |
| False     | True                           | **Track AND enforce limits** (production) |

### Implementation

1. **Always track credit pack usage** - even in beta mode, log every AI request
2. **Only block when both**: `BETA_MODE=False` AND `CREDIT_PACK_ENFORCEMENT_ENABLED=True`
3. **Add to settings.py**:
   ```python
   CREDIT_PACK_ENFORCEMENT_ENABLED = config('CREDIT_PACK_ENFORCEMENT_ENABLED', default=False, cast=bool)
   ```

### Modified check_and_reserve_ai_request() Flow
```python
def check_and_reserve_ai_request(user):
    # Always track usage for analytics (even in beta)
    _track_credit_usage(user)

    # In beta mode, grant access but still track
    if is_beta_mode():
        return True, 'Beta mode - unlimited access (tracked)'

    # Check if enforcement is enabled
    if not settings.CREDIT_PACK_ENFORCEMENT_ENABLED:
        return True, 'Enforcement disabled - unlimited access (tracked)'

    # ... existing enforcement logic ...
```

### Why This Matters
- **During beta**: You see exactly how many credits each user would consume
- **Easy switch**: Set `CREDIT_PACK_ENFORCEMENT_ENABLED=True` to start charging
- **No code changes**: Just flip the environment variable

## New Feature: Credit Packs
- **Credit Packs as add-on**: Optional 625, 1250, 2500, 5000 credits at $20, $40, $80, $160/month
- **Separate from tier**: Users can have any tier + any credit pack (or no credit pack)
- **Works alongside existing tokens**: Credit packs add to existing token balance
- **Proration**: Immediate proration when changing credit packs mid-cycle
- **Rollover**: Credits roll over while credit pack subscription is active; forfeit when cancelled
- **UI**: Dropdown selector to add/change credit pack (separate from tier selection)

---

## Phase 1: Database Models

### New Models in `core/billing/models.py`

```python
class CreditPack(models.Model):
    """Defines available recurring credit pack subscriptions."""
    name = models.CharField(max_length=100)  # e.g., "Starter", "Pro", "Business", "Enterprise"
    credits_per_month = models.IntegerField()  # 625, 1250, 2500, 5000
    price_cents = models.IntegerField()  # 2000, 4000, 8000, 16000
    stripe_price_id = models.CharField(max_length=100, blank=True)
    stripe_product_id = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

class UserCreditPackSubscription(models.Model):
    """Tracks user's active credit pack subscription (separate from tier subscription)."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='credit_pack_subscription')
    credit_pack = models.ForeignKey(CreditPack, null=True, on_delete=models.SET_NULL)
    stripe_subscription_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, default='inactive')  # active, cancelled, past_due
    current_period_start = models.DateTimeField(null=True)
    current_period_end = models.DateTimeField(null=True)
    credits_this_period = models.IntegerField(default=0)  # Credits granted this billing period
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Integration with Existing Models

**UserTokenBalance** (existing) - Add field to track credit pack credits:
```python
# Add to UserTokenBalance model
credit_pack_balance = models.IntegerField(default=0)  # Credits from active credit pack subscription
```

**TokenTransaction** (existing) - Already has transaction types, add new ones:
```python
# Add to TRANSACTION_TYPES
('credit_pack_grant', 'Credit Pack Monthly Grant'),
('credit_pack_forfeit', 'Credit Pack Forfeited'),
('credit_pack_usage', 'Credit Pack Usage'),  # Actual deduction when enforced
('credit_pack_usage_tracked', 'Credit Pack Usage Tracked'),  # Tracking only (beta mode)
```

This approach:
- Reuses existing `UserTokenBalance` for the actual balance tracking
- Reuses existing `TokenTransaction` for audit logging
- Only adds new models for credit pack definitions and subscription tracking

---

## Phase 2: Stripe Integration

### Create Stripe Products/Prices
Create 4 credit pack prices in Stripe (recurring monthly):
- `credit_pack_625` - $20/month
- `credit_pack_1250` - $40/month
- `credit_pack_2500` - $80/month
- `credit_pack_5000` - $160/month

### Separate Subscription Approach
Credit packs will be a **separate Stripe subscription** from the tier subscription:
- User's tier subscription remains unchanged
- Credit pack is an independent recurring subscription
- Users can have a credit pack without any paid tier (even Free users)

```python
# In StripeService
def create_credit_pack_subscription(self, user, credit_pack):
    """Create a new credit pack subscription for user."""
    # Get or create Stripe customer
    customer_id = self.get_or_create_customer(user)

    # Create separate subscription for credit pack
    subscription = stripe.Subscription.create(
        customer=customer_id,
        items=[{'price': credit_pack.stripe_price_id}],
        metadata={'type': 'credit_pack', 'user_id': user.id},
        proration_behavior='always_invoice'
    )
    return subscription

def update_credit_pack_subscription(self, user, new_credit_pack):
    """Update existing credit pack subscription."""
    credit_balance = user.credit_balance
    subscription = stripe.Subscription.retrieve(credit_balance.stripe_subscription_id)

    # Update the subscription item
    stripe.Subscription.modify(
        subscription.id,
        items=[{
            'id': subscription['items']['data'][0].id,
            'price': new_credit_pack.stripe_price_id
        }],
        proration_behavior='always_invoice'
    )

def cancel_credit_pack_subscription(self, user):
    """Cancel credit pack subscription (forfeit remaining credits)."""
    credit_balance = user.credit_balance
    if credit_balance.stripe_subscription_id:
        stripe.Subscription.cancel(credit_balance.stripe_subscription_id)
```

---

## Phase 3: Webhook Handling

### Update `core/billing/webhooks.py`

Handle these events for credit management:

1. **`invoice.paid`**: Grant monthly credits
   - Check if invoice is for a credit pack subscription (via metadata)
   - Grant credits based on pack amount
   - Log transaction

2. **`customer.subscription.updated`**: Handle pack changes
   - Check if subscription has credit_pack metadata
   - Update UserCreditBalance.credit_pack
   - Handle proration credits if applicable

3. **`customer.subscription.deleted`**: Forfeit credits on cancellation
   - Check if cancelled subscription is a credit pack
   - Forfeit remaining credits
   - Log forfeit transaction

```python
def handle_invoice_paid(event):
    invoice = event['data']['object']
    subscription_id = invoice.get('subscription')

    # Check if this is a credit pack subscription
    subscription = stripe.Subscription.retrieve(subscription_id)
    if subscription.get('metadata', {}).get('type') != 'credit_pack':
        return  # Not a credit pack subscription

    # Get user and grant credits
    user_id = subscription['metadata'].get('user_id')
    user = User.objects.get(id=user_id)
    price_id = subscription['items']['data'][0]['price']['id']
    credit_pack = CreditPack.objects.get(stripe_price_id=price_id)
    CreditService.grant_monthly_credits(user, credit_pack)
```

---

## Phase 4: Credit Pack Service Layer

### Add to `core/billing/services.py` (StripeService class)

```python
# Add these methods to existing StripeService class

def create_credit_pack_subscription(self, user, credit_pack):
    """Create a new credit pack subscription for user."""
    customer_id = self.get_or_create_customer(user)

    subscription = stripe.Subscription.create(
        customer=customer_id,
        items=[{'price': credit_pack.stripe_price_id}],
        metadata={'type': 'credit_pack', 'user_id': str(user.id)},
        proration_behavior='always_invoice'
    )
    return subscription

def update_credit_pack_subscription(self, subscription_id, new_credit_pack):
    """Update existing credit pack subscription to different pack."""
    subscription = stripe.Subscription.retrieve(subscription_id)

    stripe.Subscription.modify(
        subscription_id,
        items=[{
            'id': subscription['items']['data'][0].id,
            'price': new_credit_pack.stripe_price_id
        }],
        proration_behavior='always_invoice'
    )

def cancel_credit_pack_subscription(self, subscription_id):
    """Cancel credit pack subscription immediately."""
    stripe.Subscription.cancel(subscription_id)
```

### New file: `core/billing/credit_pack_service.py`

```python
class CreditPackService:
    """Service for managing credit pack subscriptions and balances."""

    @staticmethod
    def track_usage(user, tokens_used: int, ai_provider: str = '', ai_model: str = ''):
        """
        Track credit usage for analytics - ALWAYS called, even in beta mode.
        This logs what the user WOULD have used if enforcement was enabled.
        """
        from .utils import get_or_create_token_balance

        balance = get_or_create_token_balance(user)

        # Log the usage (doesn't actually deduct in beta)
        TokenTransaction.objects.create(
            user=user,
            transaction_type='credit_pack_usage_tracked',  # New type for tracking
            amount=-tokens_used,
            balance_after=balance.credit_pack_balance,  # Current balance (not deducted)
            description=f"Tracked usage: {ai_provider} {ai_model}",
            metadata={
                'ai_provider': ai_provider,
                'ai_model': ai_model,
                'enforcement_enabled': settings.CREDIT_PACK_ENFORCEMENT_ENABLED,
                'beta_mode': is_beta_mode(),
            }
        )

    @staticmethod
    def deduct_credits(user, amount: int, description: str = '') -> bool:
        """
        Actually deduct credits - only called when enforcement is enabled.
        Returns False if insufficient credits (will block the request).
        """
        from .utils import get_or_create_token_balance

        balance = get_or_create_token_balance(user)

        if balance.credit_pack_balance < amount:
            return False  # Insufficient credits

        balance.credit_pack_balance -= amount
        balance.save()

        TokenTransaction.objects.create(
            user=user,
            transaction_type='credit_pack_usage',
            amount=-amount,
            balance_after=balance.credit_pack_balance,
            description=description
        )
        return True

    @staticmethod
    def grant_monthly_credits(user, credit_pack):
        """Grant monthly credits from credit pack subscription."""
        from .utils import get_or_create_token_balance

        balance = get_or_create_token_balance(user)
        balance.credit_pack_balance += credit_pack.credits_per_month
        balance.save()

        # Update subscription record
        sub = user.credit_pack_subscription
        sub.credits_this_period = credit_pack.credits_per_month
        sub.save()

        # Log transaction using existing model
        TokenTransaction.objects.create(
            user=user,
            transaction_type='credit_pack_grant',
            amount=credit_pack.credits_per_month,
            balance_after=balance.credit_pack_balance,
            description=f"Monthly credit pack grant: {credit_pack.name}"
        )

    @staticmethod
    def forfeit_credits(user):
        """Forfeit credit pack balance when subscription cancelled."""
        from .utils import get_or_create_token_balance

        balance = get_or_create_token_balance(user)
        if balance.credit_pack_balance > 0:
            forfeited = balance.credit_pack_balance
            balance.credit_pack_balance = 0
            balance.save()

            TokenTransaction.objects.create(
                user=user,
                transaction_type='credit_pack_forfeit',
                amount=-forfeited,
                balance_after=0,
                description="Credit pack subscription cancelled"
            )

    @staticmethod
    def subscribe(user, credit_pack):
        """Subscribe user to a credit pack."""
        from .services import StripeService

        stripe_service = StripeService()
        subscription = stripe_service.create_credit_pack_subscription(user, credit_pack)

        # Create or update subscription record
        sub, _ = UserCreditPackSubscription.objects.get_or_create(user=user)
        sub.credit_pack = credit_pack
        sub.stripe_subscription_id = subscription.id
        sub.status = 'active'
        sub.save()

        return subscription

    @staticmethod
    def change_pack(user, new_pack):
        """Change to a different credit pack."""
        from .services import StripeService

        sub = user.credit_pack_subscription
        stripe_service = StripeService()
        stripe_service.update_credit_pack_subscription(sub.stripe_subscription_id, new_pack)

        sub.credit_pack = new_pack
        sub.save()

    @staticmethod
    def cancel(user):
        """Cancel credit pack subscription and forfeit credits."""
        from .services import StripeService

        sub = user.credit_pack_subscription
        stripe_service = StripeService()
        stripe_service.cancel_credit_pack_subscription(sub.stripe_subscription_id)

        CreditPackService.forfeit_credits(user)

        sub.status = 'cancelled'
        sub.credit_pack = None
        sub.save()
```

---

## Phase 5: API Endpoints

### New endpoints in `core/billing/views.py`

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_packs_list(request):
    """List available credit packs."""
    packs = CreditPack.objects.filter(is_active=True).order_by('sort_order')
    return Response(CreditPackSerializer(packs, many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_balance(request):
    """Get user's current credit balance."""
    balance, _ = UserCreditBalance.objects.get_or_create(user=request.user)
    return Response({
        'currentCredits': balance.current_credits,
        'creditPack': CreditPackSerializer(balance.credit_pack).data if balance.credit_pack else None,
        'lastGrant': balance.last_credit_grant,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_credit_pack(request):
    """Subscribe to a credit pack (new subscription)."""
    pack_id = request.data.get('creditPackId')
    try:
        pack = CreditPack.objects.get(id=pack_id, is_active=True)
        CreditService.subscribe_to_credit_pack(request.user, pack)
        return Response({'success': True})
    except CreditPack.DoesNotExist:
        return Response({'error': 'Invalid credit pack'}, status=400)
    except stripe.error.StripeError as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_credit_pack(request):
    """Change to a different credit pack (requires existing subscription)."""
    pack_id = request.data.get('creditPackId')
    try:
        pack = CreditPack.objects.get(id=pack_id, is_active=True)
        CreditService.change_credit_pack(request.user, pack)
        return Response({'success': True})
    except CreditPack.DoesNotExist:
        return Response({'error': 'Invalid credit pack'}, status=400)
    except stripe.error.StripeError as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_credit_pack(request):
    """Cancel credit pack subscription."""
    try:
        CreditService.cancel_credit_pack(request.user)
        return Response({'success': True})
    except stripe.error.StripeError as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_transactions(request):
    """Get user's credit transaction history."""
    transactions = CreditTransaction.objects.filter(
        user=request.user
    ).order_by('-created_at')[:50]
    return Response(CreditTransactionSerializer(transactions, many=True).data)
```

### URL Routes in `core/billing/urls.py`
```python
path('credit-packs/', credit_packs_list, name='credit-packs-list'),
path('credit-balance/', credit_balance, name='credit-balance'),
path('credit-pack/subscribe/', subscribe_credit_pack, name='subscribe-credit-pack'),
path('credit-pack/change/', change_credit_pack, name='change-credit-pack'),
path('credit-pack/cancel/', cancel_credit_pack, name='cancel-credit-pack'),
path('credit-transactions/', credit_transactions, name='credit-transactions'),
```

---

## Phase 6: Frontend Components

### Credit Pack Selector Component
`frontend/src/components/billing/CreditPackSelector.tsx`

```tsx
interface CreditPack {
  id: number;
  name: string;
  creditsPerMonth: number;
  priceCents: number;
}

function CreditPackSelector({
  packs,
  currentPackId,
  onChange,
  disabled
}: Props) {
  return (
    <div className="relative">
      <select
        value={currentPackId || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border..."
      >
        {packs.map(pack => (
          <option key={pack.id} value={pack.id}>
            {pack.creditsPerMonth.toLocaleString()} credits/mo - ${pack.priceCents / 100}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Credit Pack Card Component
`frontend/src/components/billing/CreditPackCard.tsx`

New card for the billing settings page (`/account/settings/billing`):

```tsx
interface CreditPackCardProps {
  creditPacks: CreditPack[];           // Available packs from API
  currentSubscription: CreditPackSubscription | null;  // User's current pack
  creditPackBalance: number;           // Credits from pack subscription
  onSubscribe: (packId: number) => Promise<void>;
  onChangePack: (packId: number) => Promise<void>;
  onCancel: () => Promise<void>;
  isLoading: boolean;
}

function CreditPackCard({ ... }) {
  // Shows:
  // - Header: "Credit Pack" with status badge (Active/None)
  // - Credit pack balance: X credits remaining
  // - Simple dropdown showing just credits (like Lovable):
  //     [625 credits/mo - $20 ▼]
  //       625 credits/mo - $20
  //       1,250 credits/mo - $40 ✓
  //       2,500 credits/mo - $80
  //       5,000 credits/mo - $160
  // - Subscribe/Change/Cancel buttons based on state
}
```

### Update BillingSettingsPage
Add CreditPackCard between SubscriptionCard and TokenBalanceCard:

```tsx
// In BillingSettingsPage.tsx
<SubscriptionCard ... />

{/* NEW: Credit Pack Section */}
<CreditPackCard
  creditPacks={creditPacks}
  currentSubscription={creditPackSubscription}
  creditPackBalance={tokenBalance?.creditPackBalance || 0}
  onSubscribe={handleSubscribeCreditPack}
  onChangePack={handleChangeCreditPack}
  onCancel={handleCancelCreditPack}
  isLoading={creditPackLoading}
/>

<TokenBalanceCard ... />  {/* Existing one-time tokens */}
```

### Update billing service
`frontend/src/services/billing.ts` - Add:

```typescript
// Types
interface CreditPack {
  id: number;
  name: string;
  creditsPerMonth: number;
  priceCents: number;
}

interface CreditPackSubscription {
  id: number;
  creditPack: CreditPack | null;
  status: string;
  currentPeriodEnd: string;
  creditsThisPeriod: number;
}

// API calls
export const getCreditPacks = () => api.get('/billing/credit-packs/');
export const getCreditPackSubscription = () => api.get('/billing/credit-pack/subscription/');
export const subscribeToCreditPack = (packId: number) => api.post('/billing/credit-pack/subscribe/', { creditPackId: packId });
export const changeCreditPack = (packId: number) => api.post('/billing/credit-pack/change/', { creditPackId: packId });
export const cancelCreditPack = () => api.post('/billing/credit-pack/cancel/');
```

---

## Phase 7: Migration & Seed Data

### Migration
```bash
python manage.py makemigrations billing
python manage.py migrate
```

### Seed Credit Packs
```python
# management/commands/seed_credit_packs.py
CreditPack.objects.bulk_create([
    CreditPack(name='625 credits', credits_per_month=625, price_cents=2000, sort_order=1),
    CreditPack(name='1,250 credits', credits_per_month=1250, price_cents=4000, sort_order=2),
    CreditPack(name='2,500 credits', credits_per_month=2500, price_cents=8000, sort_order=3),
    CreditPack(name='5,000 credits', credits_per_month=5000, price_cents=16000, sort_order=4),
])
```

### Stripe Setup Script
Create prices in Stripe and update `stripe_price_id` for each pack.

---

## Implementation Order

1. **Database Models**: Add CreditPack, UserCreditPackSubscription, update UserTokenBalance
2. **Migrations**: Run makemigrations and migrate
3. **Seed Data**: Create management command to seed credit packs
4. **Stripe Setup**: Create products/prices in Stripe, update stripe_price_id
5. **Service Layer**: Add methods to StripeService, create CreditPackService
6. **Webhooks**: Add credit pack event handling to existing webhook handler
7. **API Endpoints**: Add credit pack management views
8. **Serializers**: Add CreditPackSerializer, CreditPackSubscriptionSerializer
9. **Frontend**: Credit pack selector component and integration
10. **Testing**: Unit tests and integration tests

---

## Critical Files to Modify

**Backend - Settings:**
- `config/settings.py` - Add `CREDIT_PACK_ENFORCEMENT_ENABLED` setting

**Backend - Models & Migrations:**
- `core/billing/models.py` - Add CreditPack, UserCreditPackSubscription models; add credit_pack_balance to UserTokenBalance; add transaction types to TokenTransaction

**Backend - Services:**
- `core/billing/services.py` - Add credit pack methods to StripeService
- `core/billing/credit_pack_service.py` - New file for credit pack business logic (includes track_usage, deduct_credits)
- `core/billing/utils.py` - Modify `check_and_reserve_ai_request()` to always track usage, even in beta mode

**Backend - API:**
- `core/billing/views.py` - Add credit pack endpoints
- `core/billing/urls.py` - Add routes
- `core/billing/serializers.py` - Add serializers
- `core/billing/webhooks.py` - Handle invoice.paid for credit pack subscriptions

**Backend - Admin:**
- `core/billing/admin.py` - Register CreditPack, UserCreditPackSubscription

**Frontend:**
- `frontend/src/pages/settings/BillingSettingsPage.tsx` - Add CreditPackCard section
- `frontend/src/components/billing/CreditPackCard.tsx` - New card component with dropdown selector
- `frontend/src/services/billing.ts` - Add API calls for credit packs

---

## Testing Strategy

1. **Unit Tests**: CreditPackService methods (grant, forfeit, subscribe, change, cancel)
2. **Model Tests**: CreditPack, UserCreditPackSubscription model validation
3. **API Tests**: Credit pack endpoints (list, subscribe, change, cancel, balance)
4. **Webhook Tests**: Mock Stripe invoice.paid events for credit pack subscriptions
5. **Integration Tests**: Full flow from subscribe to credit grant to cancel
