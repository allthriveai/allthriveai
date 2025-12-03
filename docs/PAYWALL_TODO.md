# 🔐 Paywall Implementation - Action Plan

## ✅ What's Already Done

You have a **complete permission system** already built:
- ✅ Permission classes (`RequiresMarketplace`, `RequiresAnalytics`, etc.)
- ✅ Function decorators (`@require_feature`)
- ✅ Utility functions (`can_access_feature`, `can_make_ai_request`)
- ✅ Subscription tier model with feature flags
- ✅ Error response formatting

**All you need to do**: Add the decorators to your views!

---

## 🚀 Quick Start (30 minutes)

### Step 1: Find Your Endpoints (5 min)
```bash
# Find all your API views
grep -r "@api_view" core/ --include="*.py"

# Or specific features:
grep -r "def.*view" core/tools/views.py           # Creator Tools
grep -r "def.*view" core/learning_paths/views.py  # Go1 Courses
grep -r "def.*view" core/thrive_circle/views.py   # Circles
grep -r "def.*view" core/agents/views.py          # AI features
```

### Step 2: Add ONE Permission (10 min)
Pick the EASIEST feature first (recommend: Analytics)

**Before**:
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_dashboard(request):
    # ... existing code
    pass
```

**After**:
```python
from core.billing.permissions import RequiresAnalytics

@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresAnalytics])  # ← Just add this!
def analytics_dashboard(request):
    # ... existing code
    pass
```

### Step 3: Test It (10 min)
```bash
# Test with free user (should get 403)
curl -H "Authorization: Bearer $FREE_USER_TOKEN" \
     http://localhost:8000/api/analytics/

# Should return:
{
  "error": "Analytics not available",
  "message": "Analytics is not included in your current subscription tier.",
  "feature": "analytics",
  "upgrade_required": true
}

# Test with Pro Learn user (should work)
curl -H "Authorization: Bearer $PRO_USER_TOKEN" \
     http://localhost:8000/api/analytics/

# Should return normal data
```

### Step 4: Repeat for Other Features (5 min each)
Just add the permission class - that's it!

---

## 📋 Implementation Checklist

### **Priority 1: High-Value Features** (Do First!)

#### Creator Tools (Creator/Mentor tier only)
- [ ] Find endpoints in `core/tools/views.py`
- [ ] Add `@permission_classes([IsAuthenticated, RequiresCreatorTools])`
- [ ] Test with free user (should fail)
- [ ] Test with Creator tier user (should work)

#### Go1 Courses (Pro Learn+)
- [ ] Find endpoints in `core/learning_paths/views.py`
- [ ] Add `@permission_classes([IsAuthenticated, RequiresGo1Courses])`
- [ ] Test with Community Pro user (should fail)
- [ ] Test with Pro Learn user (should work)

#### Analytics (Pro Learn+)
- [ ] Find endpoints in `core/views/ai_analytics_views.py`
- [ ] Add `@permission_classes([IsAuthenticated, RequiresAnalytics])`
- [ ] Test with free user (should fail)
- [ ] Test with Pro Learn user (should work)

---

### **Priority 2: Community Features** (Do Second)

#### Circles (Community Pro+)
- [ ] Find endpoints in `core/thrive_circle/views.py`
- [ ] Decide: Soft or Hard paywall?
  - **Soft**: Allow viewing, block posting
  - **Hard**: Block everything
- [ ] Add `@permission_classes([IsAuthenticated, RequiresCircles])`
- [ ] Consider: Allow N free posts, then block
- [ ] Test with free user
- [ ] Test with Community Pro user

#### Marketplace (Community Pro+)
- [ ] Find marketplace endpoints
- [ ] Decide paywall strategy:
  - Allow browsing?
  - Block purchases?
  - Block listing items?
- [ ] Add `@permission_classes([IsAuthenticated, RequiresMarketplace])`
- [ ] Test both user tiers

---

### **Priority 3: AI Rate Limiting** (Do Last)

#### AI Endpoints
- [ ] Find all AI endpoints:
  - `core/agents/views.py`
  - `core/agents/project_chat_views.py`
  - `core/agents/auth_chat_views.py`
- [ ] Add `@permission_classes([IsAuthenticated, CanMakeAIRequest])`
- [ ] **IMPORTANT**: Add AI usage tracking:
  ```python
  from core.ai_usage.tracker import AIUsageTracker

  with AIUsageTracker.track_ai_request(
      user=request.user,
      feature='chat',
      provider='openai',
      model='gpt-4'
  ) as tracker:
      # Your AI call
      tracker.set_tokens(input_tokens=..., output_tokens=...)
  ```
- [ ] Test quota enforcement
- [ ] Test token purchase flow

---

## 🧪 Testing Checklist

### Manual Testing
```bash
# 1. Create test users for each tier
docker-compose exec -T web python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from core.billing.models import UserSubscription, SubscriptionTier

User = get_user_model()

# Create free tier user
free_user = User.objects.create_user(email='free@test.com', password='test123')
free_tier = SubscriptionTier.objects.get(tier_type='free')
UserSubscription.objects.create(user=free_user, tier=free_tier, status='active')

# Create Community Pro user
pro_user = User.objects.create_user(email='pro@test.com', password='test123')
pro_tier = SubscriptionTier.objects.get(tier_type='community_pro')
UserSubscription.objects.create(user=pro_user, tier=pro_tier, status='active')

# Create Pro Learn user
learn_user = User.objects.create_user(email='learn@test.com', password='test123')
learn_tier = SubscriptionTier.objects.get(tier_type='pro_learn')
UserSubscription.objects.create(user=learn_user, tier=learn_tier, status='active')
```

### Automated Tests
```python
# core/billing/tests/test_paywalls.py
from django.test import TestCase
from rest_framework.test import APIClient

class PaywallTests(TestCase):
    def test_free_user_blocked_from_analytics(self):
        """Free users cannot access analytics"""
        user = self.create_user_with_tier('free')
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/analytics/')

        self.assertEqual(response.status_code, 403)
        self.assertIn('upgrade_required', response.json())
        self.assertEqual(response.json()['feature'], 'analytics')

    def test_pro_learn_can_access_analytics(self):
        """Pro Learn users can access analytics"""
        user = self.create_user_with_tier('pro_learn')
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/analytics/')

        self.assertEqual(response.status_code, 200)

    def test_ai_quota_enforcement(self):
        """Test AI request quota is enforced"""
        user = self.create_user_with_tier('free')
        # Set low quota for testing
        user.subscription.tier.monthly_ai_requests = 2
        user.subscription.tier.save()
        self.client.force_authenticate(user=user)

        # First 2 requests should work
        for i in range(2):
            response = self.client.post('/api/agents/chat/', {'message': 'test'})
            self.assertEqual(response.status_code, 200)

        # 3rd request should fail
        response = self.client.post('/api/agents/chat/', {'message': 'test'})
        self.assertEqual(response.status_code, 429)  # Too Many Requests
```

---

## 🎯 Feature-Specific Notes

### **Analytics Dashboard**
```python
# core/views/ai_analytics_views.py
from core.billing.permissions import RequiresAnalytics

@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresAnalytics])
def analytics_dashboard_view(request):
    # Existing code - no changes needed!
    pass
```

### **Circles (Soft Paywall Example)**
```python
# core/thrive_circle/views.py
from core.billing.permissions import RequiresCircles

@api_view(['GET'])
@permission_classes([IsAuthenticated])  # Everyone can VIEW
def list_circles_view(request):
    # Free users can see circles exist
    pass

@api_view(['POST'])
@permission_classes([IsAuthenticated, RequiresCircles])  # Pro to POST
def create_post_in_circle_view(request):
    # Only paid users can post
    pass
```

### **AI Chat with Tracking**
```python
# core/agents/views.py
from core.billing.permissions import CanMakeAIRequest
from core.ai_usage.tracker import AIUsageTracker

@api_view(['POST'])
@permission_classes([IsAuthenticated, CanMakeAIRequest])
def ai_chat_view(request):
    message = request.data.get('message')

    # Track AI usage
    with AIUsageTracker.track_ai_request(
        user=request.user,
        feature='chat',
        provider='openai',
        model='gpt-4'
    ) as tracker:
        # Your existing AI call
        response = openai.ChatCompletion.create(
            model='gpt-4',
            messages=[{'role': 'user', 'content': message}]
        )

        # Track tokens
        tracker.set_tokens(
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens
        )

    return Response({'message': response.choices[0].message.content})
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting IsAuthenticated
```python
# WRONG - missing IsAuthenticated
@permission_classes([RequiresAnalytics])

# RIGHT - always include IsAuthenticated first
@permission_classes([IsAuthenticated, RequiresAnalytics])
```

### ❌ Mistake 2: Not Testing with Free User
Always test that free users get blocked!

### ❌ Mistake 3: Breaking Existing Features
Test that paid users still have access after adding permissions.

### ❌ Mistake 4: No AI Usage Tracking
If you add `CanMakeAIRequest`, you MUST also track usage with `AIUsageTracker`.

---

## 📊 What to Monitor After Launch

### Key Metrics
```sql
-- Paywall hit rate
SELECT
    COUNT(*) as paywall_hits,
    feature,
    COUNT(DISTINCT user_id) as unique_users
FROM api_logs
WHERE status_code = 403
GROUP BY feature;

-- Conversion rate
SELECT
    COUNT(*) as upgrades,
    previous_tier,
    new_tier
FROM subscription_changes
WHERE created_at > '2025-12-01'  -- After paywall launch
GROUP BY previous_tier, new_tier;

-- Feature abandonment
SELECT
    feature,
    COUNT(*) as blocked_attempts,
    COUNT(DISTINCT user_id) as users_blocked
FROM api_logs
WHERE status_code = 403
    AND user_id NOT IN (
        SELECT user_id FROM subscription_changes
        WHERE created_at > blocked_at
    )
GROUP BY feature;
```

---

## 🎉 Success Criteria

### You'll know it's working when:
- ✅ Free users get clear 403 errors with upgrade messaging
- ✅ Paid users access features normally
- ✅ AI quota is enforced (users hit limits)
- ✅ Token purchases increase
- ✅ Upgrade conversions happen

### Red Flags to Watch For:
- ⚠️ Paid users getting blocked (permissions too strict)
- ⚠️ High bounce rate on paywall (messaging unclear)
- ⚠️ No upgrades after launch (features not valuable enough)
- ⚠️ Customer support tickets about access (confusing errors)

---

## 🚀 Quick Implementation Script

Want to implement ALL paywalls at once? Here's a script:

```bash
#!/bin/bash
# paywall_audit.sh - Find all endpoints that need protection

echo "=== Finding Unprotected Endpoints ==="

# Analytics
echo "\n📊 Analytics endpoints:"
grep -n "def.*view" core/views/ai_analytics_views.py

# Creator Tools
echo "\n🛠️  Creator Tools endpoints:"
grep -n "def.*view" core/tools/views.py

# Go1 Courses
echo "\n📚 Learning Paths endpoints:"
grep -n "def.*view" core/learning_paths/views.py

# Circles
echo "\n💬 Circles endpoints:"
grep -n "def.*view" core/thrive_circle/views.py

# AI
echo "\n🤖 AI endpoints:"
grep -n "def.*view" core/agents/views.py
grep -n "def.*view" core/agents/project_chat_views.py
grep -n "def.*view" core/agents/auth_chat_views.py

echo "\n✅ Review these endpoints and add permissions!"
```

Run it:
```bash
chmod +x paywall_audit.sh
./paywall_audit.sh > paywall_audit.txt
```

---

## 📝 Next Steps

1. **Choose your starting feature** (recommend: Analytics - safest)
2. **Add the permission class** (literally 1 line)
3. **Test it** (2 curl commands)
4. **Repeat** for other features

**Time estimate**: 15-30 minutes per feature

**Total time for all features**: 3-4 hours

**Ready to start?** Pick your first feature and let's implement it!

---

**Created**: 2025-12-02
**Status**: Ready to implement
**Difficulty**: ⭐ Easy (permission system already built!)
