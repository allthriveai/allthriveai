# 🔒 Tier-Based Feature Restriction System

**How AllThrive Controls Feature Access by Subscription Tier**

---

## 📊 System Overview

The tier-based feature system uses **boolean flags** on subscription tiers to control access. Here's the complete flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIER FEATURE SYSTEM                          │
└─────────────────────────────────────────────────────────────────┘

1. DATABASE MODEL (Feature Flags)
   SubscriptionTier.has_analytics = True/False
   SubscriptionTier.has_creator_tools = True/False
   SubscriptionTier.monthly_ai_requests = 100/500/2000/0

2. SEED DATA (Tier Configuration)
   Free: has_analytics=False, monthly_ai_requests=100
   Pro Learn: has_analytics=True, monthly_ai_requests=2000

3. USER SUBSCRIPTION (Active Tier)
   UserSubscription.tier → SubscriptionTier (Free/Pro/etc)

4. PERMISSION CHECK (Utility Function)
   can_access_feature(user, 'analytics')
   → user.subscription.tier.has_analytics

5. PERMISSION CLASS (DRF Permission)
   @permission_classes([RequiresAnalytics])
   → calls can_access_feature()

6. VIEW PROTECTION (API Endpoint)
   @api_view(['GET'])
   @permission_classes([IsAuthenticated, RequiresAnalytics])
   def analytics_view(request): ...
```

---

## 1️⃣ Database Model - Feature Flags

**File**: `core/billing/models.py`

Each `SubscriptionTier` has boolean flags for features:

```python
class SubscriptionTier(models.Model):
    # Feature Flags (Boolean)
    has_marketplace_access = models.BooleanField(default=False)
    has_go1_courses = models.BooleanField(default=False)
    has_ai_mentor = models.BooleanField(default=False)
    has_quests = models.BooleanField(default=False)
    has_circles = models.BooleanField(default=False)
    has_projects = models.BooleanField(default=False)
    has_creator_tools = models.BooleanField(default=False)
    has_analytics = models.BooleanField(default=False)

    # Quota Limits (Integer, 0 = unlimited)
    monthly_ai_requests = models.IntegerField(default=0)
```

**Why this approach?**
- ✅ Simple and explicit
- ✅ Easy to query in database
- ✅ Easy to display in admin
- ✅ Type-safe (boolean)
- ✅ Easy to extend (add new fields)

---

## 2️⃣ Seed Data - Tier Configuration

**File**: `core/billing/management/commands/seed_billing.py`

Tiers are configured with specific feature access:

```python
# FREE TIER
{
    'tier_type': 'free',
    'monthly_ai_requests': 100,
    'has_marketplace_access': False,  # ❌
    'has_go1_courses': False,          # ❌
    'has_ai_mentor': True,              # ✅
    'has_quests': True,                 # ✅
    'has_circles': False,               # ❌
    'has_projects': True,               # ✅
    'has_creator_tools': False,        # ❌
    'has_analytics': False,            # ❌
}

# COMMUNITY PRO ($54/quarter)
{
    'tier_type': 'community_pro',
    'monthly_ai_requests': 500,
    'has_marketplace_access': True,    # ✅
    'has_go1_courses': False,          # ❌
    'has_ai_mentor': True,              # ✅
    'has_quests': True,                 # ✅
    'has_circles': True,                # ✅
    'has_projects': True,               # ✅
    'has_creator_tools': False,        # ❌
    'has_analytics': False,            # ✅
}

# PRO LEARN ($105/quarter)
{
    'tier_type': 'pro_learn',
    'monthly_ai_requests': 2000,
    'has_marketplace_access': True,    # ✅
    'has_go1_courses': True,           # ✅
    'has_ai_mentor': True,              # ✅
    'has_quests': True,                 # ✅
    'has_circles': True,                # ✅
    'has_projects': True,               # ✅
    'has_creator_tools': False,        # ❌
    'has_analytics': True,             # ✅
}

# CREATOR/MENTOR (TBD)
{
    'tier_type': 'creator_mentor',
    'monthly_ai_requests': 0,  # 5000
    'has_marketplace_access': True,    # ✅
    'has_go1_courses': True,           # ✅
    'has_ai_mentor': True,              # ✅
    'has_quests': True,                 # ✅
    'has_circles': True,                # ✅
    'has_projects': True,               # ✅
    'has_creator_tools': True,         # ✅
    'has_analytics': True,             # ✅
}
```

**Run seed command**:
```bash
python manage.py seed_billing
```

---

## 3️⃣ User Subscription - Active Tier

**File**: `core/billing/models.py`

Each user has a `UserSubscription` linking them to a tier:

```python
class UserSubscription(models.Model):
    user = models.OneToOneField(User, related_name='subscription')
    tier = models.ForeignKey(SubscriptionTier)
    status = models.CharField(choices=[
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ])

    # Stripe integration
    stripe_subscription_id = models.CharField(...)
    current_period_end = models.DateTimeField(...)
```

**Example Query**:
```python
# Get user's tier
user = request.user
subscription = user.subscription
tier = subscription.tier

# Check feature access
if tier.has_analytics:
    # User can access analytics
    pass
```

---

## 4️⃣ Permission Check - Utility Function

**File**: `core/billing/utils.py`

The `can_access_feature()` function checks if a user has access:

```python
def can_access_feature(user, feature: str) -> bool:
    """
    Check if user's tier allows access to a feature.

    Args:
        user: Django User instance
        feature: 'marketplace', 'analytics', 'creator_tools', etc.

    Returns:
        True if user has access, False otherwise
    """
    subscription = get_user_subscription(user)
    if not subscription or not subscription.is_active:
        return False

    # Map feature names to model fields
    feature_map = {
        'marketplace': 'has_marketplace_access',
        'go1_courses': 'has_go1_courses',
        'ai_mentor': 'has_ai_mentor',
        'quests': 'has_quests',
        'circles': 'has_circles',
        'projects': 'has_projects',
        'creator_tools': 'has_creator_tools',
        'analytics': 'has_analytics',
    }

    # Get the boolean field from the tier
    return getattr(subscription.tier, feature_map[feature], False)
```

**Usage**:
```python
if can_access_feature(request.user, 'analytics'):
    # Show analytics
else:
    # Show upgrade prompt
```

---

## 5️⃣ Permission Class - DRF Permission

**File**: `core/billing/permissions.py`

DRF permission classes for views:

```python
class RequiresFeature(permissions.BasePermission):
    """Base permission class to check tier access."""

    feature_name = None  # Override in subclass

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Call utility function
        return can_access_feature(request.user, self.feature_name)


# Specific permission classes for each feature
class RequiresAnalytics(RequiresFeature):
    feature_name = 'analytics'

class RequiresCreatorTools(RequiresFeature):
    feature_name = 'creator_tools'

class RequiresMarketplace(RequiresFeature):
    feature_name = 'marketplace'

class RequiresCircles(RequiresFeature):
    feature_name = 'circles'

class RequiresGo1Courses(RequiresFeature):
    feature_name = 'go1_courses'
```

---

## 6️⃣ View Protection - API Endpoint

**File**: `core/views/ai_analytics_views.py` (example)

Apply permission to views:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from core.billing.permissions import RequiresAnalytics

@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresAnalytics])
def analytics_dashboard(request):
    """
    Analytics endpoint - requires Pro Learn+ tier.

    If user doesn't have access:
    - Returns 403 Forbidden
    - Response includes upgrade_required: true
    - Frontend modal opens automatically
    """
    # User has access, show analytics
    return Response({
        'analytics_data': {...}
    })
```

**What happens when blocked?**

User hits endpoint → DRF checks permissions → `RequiresAnalytics.has_permission()` → `can_access_feature(user, 'analytics')` → `user.subscription.tier.has_analytics` = False → **403 Forbidden**

Response:
```json
{
  "detail": "Analytics is not available in your current subscription tier. Upgrade to access this feature.",
  "feature": "analytics",
  "upgrade_required": true
}
```

---

## 🎯 Feature Access Matrix

| Feature | Free | Community Pro | Pro Learn | Creator/Mentor |
|---------|------|---------------|-----------|----------------|
| **AI Mentor** | ✅ | ✅ | ✅ | ✅ |
| **Quests** | ✅ | ✅ | ✅ | ✅ |
| **Projects** | ✅ | ✅ | ✅ | ✅ |
| **Marketplace** | ✅ | ✅ | ✅ | ✅ |
| **Circles** | ✅ | ✅ | ✅ | ✅ |
| **Go1 Courses** | ❌ | ❌ | ✅ | ❌ |
| **Analytics** | ❌ | ✅ | ✅ | ✅ |
| **Creator Tools** | ❌ | ❌ | ❌ | ✅ |
| **AI Requests/mo** | 100 | 500 | 2000 | Unlimited |

---

## 🔧 How to Add a New Feature

### 1. Add to Model

**File**: `core/billing/models.py`

```python
class SubscriptionTier(models.Model):
    # ... existing fields ...
    has_new_feature = models.BooleanField(default=False)
```

### 2. Create Migration

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Update Seed Data

**File**: `core/billing/management/commands/seed_billing.py`

```python
{
    'tier_type': 'pro_learn',
    # ... existing features ...
    'has_new_feature': True,  # NEW
}
```

### 4. Add to Feature Map

**File**: `core/billing/utils.py`

```python
feature_map = {
    # ... existing features ...
    'new_feature': 'has_new_feature',  # NEW
}
```

### 5. Create Permission Class

**File**: `core/billing/permissions.py`

```python
class RequiresNewFeature(RequiresFeature):
    feature_name = 'new_feature'
```

### 6. Protect Endpoint

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresNewFeature])
def new_feature_view(request):
    # Your feature code
    pass
```

### 7. Re-seed Database

```bash
python manage.py seed_billing
```

Done! Your new feature is now tier-restricted.

---

## 🧪 Testing Feature Access

### Test in Django Shell

```python
python manage.py shell

from django.contrib.auth import get_user_model
from core.billing.utils import can_access_feature

User = get_user_model()
user = User.objects.get(email='test@example.com')

# Check feature access
print(can_access_feature(user, 'analytics'))  # False (if Free tier)

# Check tier
print(user.subscription.tier.name)  # "Free / Explorer"
print(user.subscription.tier.has_analytics)  # False

# Upgrade user (simulate)
from core.billing.models import SubscriptionTier
pro_tier = SubscriptionTier.objects.get(tier_type='pro_learn')
user.subscription.tier = pro_tier
user.subscription.save()

# Check again
print(can_access_feature(user, 'analytics'))  # True
```

### Test API Endpoint

```bash
# Test with free user (should get 403)
curl -H "Authorization: Bearer $FREE_USER_TOKEN" \
     http://localhost:8000/api/ai-analytics/user/

# Expected response:
{
  "detail": "Analytics is not available in your current subscription tier.",
  "feature": "analytics",
  "upgrade_required": true
}

# Test with Pro Learn user (should work)
curl -H "Authorization: Bearer $PRO_USER_TOKEN" \
     http://localhost:8000/api/ai-analytics/user/

# Expected: 200 OK with analytics data
```

---

## 📊 Database Schema Visualization

```
┌─────────────────────────┐
│   SubscriptionTier      │
├─────────────────────────┤
│ id (PK)                 │
│ tier_type               │  'free', 'community_pro', etc.
│ name                    │  'Free / Explorer'
│ price_monthly           │  $0, $18, $35, etc.
│                         │
│ FEATURE FLAGS:          │
│ has_analytics          │  False/True
│ has_creator_tools      │  False/True
│ has_marketplace_access │  False/True
│ has_go1_courses        │  False/True
│ has_circles            │  False/True
│ monthly_ai_requests    │  100/500/2000/0
└─────────────────────────┘
           ▲
           │ tier_id (FK)
           │
┌─────────────────────────┐
│   UserSubscription      │
├─────────────────────────┤
│ id (PK)                 │
│ user_id (FK) ────────┐  │
│ tier_id (FK) ────────┘  │  Points to SubscriptionTier
│ status                  │  'active', 'cancelled', 'expired'
│ stripe_subscription_id  │
│ current_period_end      │
└─────────────────────────┘
           ▲
           │ user_id (FK)
           │
┌─────────────────────────┐
│        User             │
├─────────────────────────┤
│ id (PK)                 │
│ email                   │
│ username                │
└─────────────────────────┘
```

---

## 🎨 Frontend Usage

### Check Feature Access

```tsx
import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatus } from '@/services/billing';

function AnalyticsButton() {
  const { data: subscription } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
  });

  if (!subscription?.hasAnalytics) {
    return (
      <button onClick={() => openSubscribeModal({
        blockedFeature: 'Analytics',
        selectedTierSlug: 'pro_learn',
      })}>
        🔒 Upgrade for Analytics
      </button>
    );
  }

  return (
    <Link to="/analytics">
      View Analytics
    </Link>
  );
}
```

### Subscription Status API

**Endpoint**: `GET /api/billing/subscription/status/`

**Response**:
```json
{
  "tierSlug": "free",
  "tierName": "Free / Explorer",
  "status": "active",
  "currentPeriodEnd": "2025-03-01T00:00:00Z",
  "features": {
    "hasAnalytics": false,
    "hasCreatorTools": false,
    "hasMarketplace": false,
    "hasGo1Courses": false,
    "hasCircles": false,
    "monthlyAiRequests": 100
  }
}
```

---

## 🚀 Advantages of This System

1. **Simple & Explicit**
   - Boolean flags are clear
   - Easy to understand what each tier includes

2. **Database-Driven**
   - No hardcoded tier logic
   - Easy to change tier features via admin

3. **Type-Safe**
   - Boolean fields prevent errors
   - Django ORM validates data

4. **Scalable**
   - Easy to add new features (just add a boolean field)
   - Easy to add new tiers (just add a row)

5. **Centralized**
   - Single source of truth (`SubscriptionTier` model)
   - All permission checks use same logic

6. **Flexible**
   - Supports quotas (AI requests)
   - Supports boolean features
   - Can add numeric limits easily

7. **Admin-Friendly**
   - Can change tier features via Django Admin
   - No code deployment needed for tier changes

---

## 📝 Summary

**The System in 3 Steps**:

1. **Define** features as boolean flags on `SubscriptionTier` model
2. **Check** access using `can_access_feature(user, 'feature_name')`
3. **Protect** endpoints with `@permission_classes([RequiresFeature])`

**Files Involved**:
- `core/billing/models.py` - Tier model with feature flags
- `core/billing/utils.py` - Feature access checking
- `core/billing/permissions.py` - DRF permission classes
- `core/billing/management/commands/seed_billing.py` - Tier configuration

**Example Flow**:
```
User requests /api/analytics/
→ DRF checks RequiresAnalytics permission
→ Calls can_access_feature(user, 'analytics')
→ Checks user.subscription.tier.has_analytics
→ Returns True/False
→ Allow/Block request
```

That's it! Simple, explicit, database-driven feature access control. 🎉

---

**Created**: 2025-12-02
**Last Updated**: 2025-12-02
**Status**: Production Ready ✅
