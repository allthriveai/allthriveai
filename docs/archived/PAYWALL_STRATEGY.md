# 🔐 Paywall Implementation Strategy

## Executive Summary

**Current Status**: ✅ Permission system exists but not enforced on endpoints
**Goal**: Enforce tier-based feature access across all AllThrive features
**Approach**: Progressive rollout - start with high-value features, expand gradually
**Timeline**: 2-3 weeks for complete implementation

---

## 📊 Current Feature Matrix (from SubscriptionTier model)

| Feature | Free | Community Pro | Pro Learn | Creator/Mentor |
|---------|------|---------------|-----------|----------------|
| **AI Mentor** | ✅ | ✅ | ✅ | ✅ |
| **Quests** | ✅ | ✅ | ✅ | ✅ |
| **Projects** | ✅ | ✅ | ✅ | ✅ |
| **Marketplace** | ❌ | ✅ | ✅ | ✅ |
| **Circles** | ❌ | ✅ | ✅ | ✅ |
| **Go1 Courses** | ❌ | ❌ | ✅ | ✅ |
| **Analytics** | ❌ | ❌ | ✅ | ✅ |
| **Creator Tools** | ❌ | ❌ | ❌ | ✅ |
| **Monthly AI Requests** | Limited | Higher | Unlimited | Unlimited |

---

## 🎯 Paywall Implementation Priority

### **Phase 1: High-Value Features (Week 1)** 🔥 CRITICAL

These features drive upgrades and protect your highest-value content:

#### 1. **Creator Tools** (Creator/Mentor only)
- **Why First**: Highest tier exclusive, least risky to break
- **Endpoints to Protect**:
  ```python
  # Check what exists:
  core/tools/views.py
  ```
- **Implementation**:
  ```python
  from core.billing.permissions import RequiresCreatorTools

  @api_view(['POST'])
  @permission_classes([IsAuthenticated, RequiresCreatorTools])
  def create_course_view(request):
      # Existing code
  ```

#### 2. **Go1 Courses** (Pro Learn+)
- **Why**: Premium learning content, clear value differentiator
- **Endpoints to Protect**:
  ```python
  # Likely in:
  core/learning_paths/views.py
  ```
- **Implementation**:
  ```python
  from core.billing.permissions import RequiresGo1Courses

  @api_view(['GET'])
  @permission_classes([IsAuthenticated, RequiresGo1Courses])
  def list_go1_courses_view(request):
      # Existing code
  ```

#### 3. **Analytics** (Pro Learn+)
- **Why**: Business intelligence = high perceived value
- **Endpoints to Protect**:
  ```python
  core/views/ai_analytics_views.py
  core/admin/ai_analytics_admin.py  # Admin only
  ```
- **Implementation**:
  ```python
  from core.billing.permissions import RequiresAnalytics

  @api_view(['GET'])
  @permission_classes([IsAuthenticated, RequiresAnalytics])
  def analytics_dashboard_view(request):
      # Existing code
  ```

---

### **Phase 2: Community Features (Week 2)** 💬

#### 4. **Circles** (Community Pro+)
- **Why**: Community engagement drives retention
- **Endpoints to Protect**:
  ```python
  core/thrive_circle/views.py
  ```
- **Implementation**:
  ```python
  from core.billing.permissions import RequiresCircles

  # Protect circle creation/management
  @api_view(['POST'])
  @permission_classes([IsAuthenticated, RequiresCircles])
  def create_circle_view(request):
      pass

  # Allow viewing but not participating?
  @api_view(['GET'])
  @permission_classes([IsAuthenticated])  # All can view
  def list_circles_view(request):
      pass

  @api_view(['POST'])
  @permission_classes([IsAuthenticated, RequiresCircles])  # Pro to post
  def post_in_circle_view(request):
      pass
  ```

#### 5. **Marketplace** (Community Pro+)
- **Why**: Monetization opportunity
- **Endpoints**: (Need to find marketplace endpoints)
- **Strategy**: Free users can browse, Pro can purchase/list

---

### **Phase 3: AI Rate Limiting (Week 3)** 🤖

#### 6. **AI Request Quotas**
- **Why**: Prevent abuse, encourage upgrades
- **Already Implemented**: `CanMakeAIRequest` permission class exists
- **Endpoints to Protect**:
  ```python
  core/agents/views.py
  core/agents/project_chat_views.py
  core/agents/auth_chat_views.py
  ```
- **Implementation**:
  ```python
  from core.billing.permissions import CanMakeAIRequest

  @api_view(['POST'])
  @permission_classes([IsAuthenticated, CanMakeAIRequest])
  def ai_chat_view(request):
      # Existing code
      # IMPORTANT: Track usage with AIUsageTracker!
      from core.ai_usage.tracker import AIUsageTracker

      with AIUsageTracker.track_ai_request(
          user=request.user,
          feature='chat',
          provider='openai',
          model='gpt-4'
      ) as tracker:
          # AI call
          tracker.set_tokens(input_tokens=..., output_tokens=...)
  ```

---

## 🛠️ Implementation Checklist

### **Before You Start**
- [ ] Review all endpoints in:
  - `core/tools/views.py` (Creator Tools)
  - `core/learning_paths/views.py` (Go1 Courses)
  - `core/views/ai_analytics_views.py` (Analytics)
  - `core/thrive_circle/views.py` (Circles)
  - `core/agents/views.py` (AI features)
- [ ] Verify SubscriptionTier seed data is correct
- [ ] Test permission classes work in isolation

### **For Each Feature**

**1. Backend (Django)**
```python
# Step 1: Add permission to view
from core.billing.permissions import Requires{Feature}

@api_view(['POST'])
@permission_classes([IsAuthenticated, Requires{Feature}])
def protected_view(request):
    # Your existing code
    pass
```

**2. Frontend (React)**
```typescript
// Step 1: Check user tier in frontend
import { useSubscription } from '@/hooks/useSubscription';

function ProtectedFeature() {
  const { subscription, hasFeature } = useSubscription();

  if (!hasFeature('marketplace')) {
    return <UpgradePrompt feature="Marketplace" />;
  }

  return <ActualFeature />;
}

// Step 2: Handle 403 errors gracefully
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403 && error.response?.data?.upgrade_required) {
      // Show upgrade modal
      showUpgradeModal(error.response.data.feature);
    }
    return Promise.reject(error);
  }
);
```

**3. Error Responses**
```json
{
  "error": "Marketplace not available",
  "message": "Marketplace is not included in your current subscription tier.",
  "feature": "marketplace",
  "upgrade_required": true,
  "current_tier": "free",
  "required_tier": "community_pro"
}
```

---

## 🎨 User Experience Strategy

### **Soft Paywall vs Hard Paywall**

#### **Soft Paywall** (Recommended for growth)
- ✅ Let users SEE the feature
- ✅ Let them TRY once or twice
- ❌ Block after initial usage
- **Best for**: Marketplace, Circles, Analytics

**Example - Circles**:
```python
def post_in_circle_view(request):
    user_tier = get_user_subscription(request.user).tier

    if user_tier.tier_type == 'free':
        # Check if user has posted before
        post_count = CirclePost.objects.filter(user=request.user).count()

        if post_count >= 3:  # Allow 3 free posts
            return JsonResponse({
                'error': 'Post limit reached',
                'message': 'Free users can make 3 posts. Upgrade to Community Pro for unlimited posts.',
                'posts_made': post_count,
                'upgrade_required': True
            }, status=403)

    # Allow the post
    # ... existing code
```

#### **Hard Paywall** (No access without upgrade)
- ❌ Complete block from feature
- **Best for**: Go1 Courses, Creator Tools, Advanced Analytics

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresGo1Courses])
def go1_courses_view(request):
    # No access at all without Pro Learn tier
    pass
```

---

## 📱 Frontend Components Needed

### **1. Upgrade Prompt Component**
```typescript
// components/UpgradePrompt.tsx
interface UpgradePromptProps {
  feature: string;
  currentTier: string;
  requiredTier: string;
  onUpgrade: () => void;
}

function UpgradePrompt({ feature, currentTier, requiredTier }: UpgradePromptProps) {
  return (
    <div className="upgrade-prompt">
      <h3>🔒 {feature} is a Premium Feature</h3>
      <p>Upgrade from {currentTier} to {requiredTier} to unlock this feature.</p>
      <button onClick={onUpgrade}>Upgrade Now</button>
      <button>Learn More</button>
    </div>
  );
}
```

### **2. Feature Gate Hook**
```typescript
// hooks/useFeatureGate.ts
export function useFeatureGate(featureName: string) {
  const { subscription } = useSubscription();

  const hasAccess = subscription?.tier?.[`has_${featureName}`] || false;

  const gate = (Component: React.ComponentType) => {
    if (!hasAccess) {
      return <UpgradePrompt feature={featureName} />;
    }
    return <Component />;
  };

  return { hasAccess, gate };
}

// Usage:
function MarketplacePage() {
  const { hasAccess, gate } = useFeatureGate('marketplace');

  if (!hasAccess) {
    return <UpgradePrompt feature="Marketplace" />;
  }

  return <ActualMarketplace />;
}
```

### **3. AI Request Counter**
```typescript
// components/AIRequestCounter.tsx
function AIRequestCounter() {
  const { user } = useAuth();
  const { data: quota } = useQuery('/api/billing/ai-quota/');

  return (
    <div className="ai-quota-indicator">
      <span>{quota.remaining} / {quota.limit} AI requests remaining</span>
      {quota.remaining < 10 && (
        <button onClick={() => navigate('/pricing')}>
          Purchase More Tokens
        </button>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Strategy

### **1. Unit Tests for Permissions**
```python
# core/billing/tests/test_permissions.py
def test_free_user_cannot_access_marketplace():
    user = create_user_with_tier('free')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get('/api/marketplace/')
    assert response.status_code == 403
    assert 'upgrade_required' in response.json()

def test_community_pro_can_access_marketplace():
    user = create_user_with_tier('community_pro')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get('/api/marketplace/')
    assert response.status_code == 200
```

### **2. Integration Tests**
```python
def test_ai_quota_enforcement():
    # Create user with 5 AI request limit
    user = create_user_with_tier('free')
    user.subscription.tier.monthly_ai_requests = 5
    user.subscription.tier.save()

    # Make 5 successful requests
    for i in range(5):
        response = client.post('/api/agents/chat/', {...})
        assert response.status_code == 200

    # 6th request should fail
    response = client.post('/api/agents/chat/', {...})
    assert response.status_code == 429  # Too Many Requests
    assert 'upgrade' in response.json()['message'].lower()
```

### **3. Frontend E2E Tests**
```typescript
// cypress/e2e/paywall.cy.ts
describe('Feature Paywalls', () => {
  it('blocks free user from marketplace', () => {
    cy.loginAs('free_user');
    cy.visit('/marketplace');
    cy.contains('Upgrade to Community Pro');
    cy.contains('button', 'Upgrade Now').should('be.visible');
  });

  it('allows community_pro to access marketplace', () => {
    cy.loginAs('community_pro_user');
    cy.visit('/marketplace');
    cy.get('[data-testid="marketplace-items"]').should('be.visible');
  });
});
```

---

## 🚨 Common Pitfalls & Solutions

### **Pitfall 1: Inconsistent Enforcement**
**Problem**: Backend allows but frontend blocks (or vice versa)
**Solution**: ✅ **ALWAYS enforce on backend**, frontend is just UX

### **Pitfall 2: Poor Error Messages**
**Problem**: Generic "Access Denied" confuses users
**Solution**: ✅ Specific, actionable messages with upgrade paths

### **Pitfall 3: Breaking Existing Users**
**Problem**: Current users lose access after paywall
**Solution**: ✅ Grandfather existing users or provide grace period

```python
# Grace period example
def has_feature_access(user, feature):
    subscription = get_user_subscription(user)

    # Grace period: users before paywall launch get 30 days
    if user.date_joined < PAYWALL_LAUNCH_DATE:
        grace_end = PAYWALL_LAUNCH_DATE + timedelta(days=30)
        if timezone.now() < grace_end:
            return True  # Grace period

    # Normal check
    return getattr(subscription.tier, f'has_{feature}', False)
```

### **Pitfall 4: No Token Purchase CTA**
**Problem**: Users hit AI limit but don't know they can buy tokens
**Solution**: ✅ Clear token purchase option in error response

---

## 📊 Analytics to Track

### **Conversion Metrics**
```python
# Track paywall interactions
class PaywallEvent(models.Model):
    user = models.ForeignKey(User)
    feature = models.CharField(max_length=50)
    action = models.CharField(choices=[
        ('blocked', 'Blocked'),
        ('viewed_upgrade', 'Viewed Upgrade Modal'),
        ('clicked_upgrade', 'Clicked Upgrade'),
        ('completed_upgrade', 'Completed Upgrade')
    ])
    timestamp = models.DateTimeField(auto_now_add=True)

# Key metrics:
# - Paywall hit rate: % of users hitting paywalls
# - Conversion rate: % who upgrade after hitting paywall
# - Feature abandonment: % who leave after paywall
# - Token purchase rate: % who buy tokens vs upgrade
```

---

## 🎯 Recommended Implementation Order

### **Week 1: High-Value Features**
1. Monday: Creator Tools paywall
2. Tuesday: Go1 Courses paywall
3. Wednesday: Analytics paywall
4. Thursday: Frontend upgrade prompts
5. Friday: Testing & bug fixes

### **Week 2: Community Features**
1. Monday: Circles soft paywall
2. Tuesday: Marketplace soft paywall
3. Wednesday: Frontend feature gates
4. Thursday: E2E testing
5. Friday: User acceptance testing

### **Week 3: AI Rate Limiting**
1. Monday: Add AI quota checks to all AI endpoints
2. Tuesday: Integrate with AIUsageTracker
3. Wednesday: Token purchase flow testing
4. Thursday: Load testing
5. Friday: Launch preparation

---

## 🚀 Launch Strategy

### **Soft Launch (Week 1)**
- Enable paywalls for 10% of users
- Monitor error rates, user feedback
- A/B test upgrade prompts

### **Full Launch (Week 2)**
- Roll out to 100% of users
- Monitor conversion rates
- Be ready to adjust messaging

### **Post-Launch (Week 3+)**
- Analyze which features drive most upgrades
- Optimize paywall messaging
- Consider adjusting tier features

---

## 📁 Files to Modify

```
Backend:
✓ core/tools/views.py                  # Add RequiresCreatorTools
✓ core/learning_paths/views.py         # Add RequiresGo1Courses
✓ core/views/ai_analytics_views.py     # Add RequiresAnalytics
✓ core/thrive_circle/views.py          # Add RequiresCircles
✓ core/agents/views.py                 # Add CanMakeAIRequest
✓ core/billing/tests/test_paywalls.py  # New test file

Frontend:
✓ hooks/useFeatureGate.ts              # New hook
✓ components/UpgradePrompt.tsx         # New component
✓ components/AIRequestCounter.tsx      # New component
✓ utils/api.ts                         # Add 403 interceptor
```

---

## 💡 Quick Start

**Want to start NOW?** Here's the fastest path:

1. **Pick ONE feature** (recommend: Analytics - least risky)
2. **Add permission to views**:
   ```python
   from core.billing.permissions import RequiresAnalytics

   @permission_classes([IsAuthenticated, RequiresAnalytics])
   ```
3. **Test with free user** - should get 403
4. **Test with Pro Learn user** - should work
5. **Repeat for other features**

**That's it!** The permission system is already built, you just need to add the decorators.

---

**Created**: 2025-12-02
**Status**: Ready to implement
**Next Step**: Choose Phase 1 feature and add permission class
