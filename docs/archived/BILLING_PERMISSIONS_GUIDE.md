## Billing Permissions & Feature Access Guide

This guide shows you how to protect features based on subscription tiers in AllThrive.

## Quick Reference

### Subscription Tiers & Features

| Feature | Free/Explorer | Community Pro | Pro Learn | Creator/Mentor |
|---------|---------------|---------------|-----------|----------------|
| AI Mentor | ✅ | ✅ | ✅ | ✅ |
| Quests | ✅ | ✅ | ✅ | ✅ |
| Projects | ✅ | ✅ | ✅ | ✅ |
| Marketplace | ❌ | ✅ | ✅ | ✅ |
| Circles | ❌ | ✅ | ✅ | ✅ |
| Go1 Courses | ❌ | ❌ | ✅ | ✅ |
| Analytics | ❌ | ❌ | ✅ | ✅ |
| Creator Tools | ❌ | ❌ | ❌ | ✅ |

### AI Request Limits

- **Free/Explorer**: 100 requests/month
- **Community Pro**: 500 requests/month
- **Pro Learn**: 2,000 requests/month
- **Creator/Mentor**: Unlimited

---

## Using Permissions in DRF Views

### Method 1: Permission Classes

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from core.billing.permissions import RequiresMarketplace, RequiresGo1Courses

class MarketplaceView(APIView):
    """View that requires marketplace access (Community Pro+)"""
    permission_classes = [IsAuthenticated, RequiresMarketplace]

    def get(self, request):
        # User has marketplace access if they get here
        return Response({'message': 'Welcome to the marketplace!'})


class CourseListView(APIView):
    """View that requires Go1 courses (Pro Learn+)"""
    permission_classes = [IsAuthenticated, RequiresGo1Courses]

    def get(self, request):
        # User has Go1 courses access
        courses = get_courses()
        return Response(courses)
```

### Available Permission Classes

```python
from core.billing.permissions import (
    HasActiveSubscription,     # Any active subscription
    RequiresMarketplace,        # Community Pro+
    RequiresGo1Courses,         # Pro Learn+
    RequiresCircles,            # Community Pro+
    RequiresCreatorTools,       # Creator/Mentor only
    RequiresAnalytics,          # Pro Learn+
    RequiresAIMentor,           # All tiers (included for completeness)
    RequiresQuests,             # All tiers
    RequiresProjects,           # All tiers
    CanMakeAIRequest,           # Check AI quota
)
```

---

## Using Decorators in Django Views

### Method 2: Feature Decorators

```python
from core.billing.permissions import require_marketplace, require_creator_tools

@require_marketplace
def marketplace_view(request):
    """Django view that requires marketplace access"""
    # User has marketplace access
    return render(request, 'marketplace.html')


@require_creator_tools
def creator_dashboard(request):
    """View only accessible to Creator/Mentor tier"""
    # User has creator tools access
    return render(request, 'creator/dashboard.html')
```

### Available Decorators

```python
from core.billing.permissions import (
    require_active_subscription,  # Any active subscription
    require_marketplace,           # Community Pro+
    require_go1_courses,           # Pro Learn+
    require_circles,               # Community Pro+
    require_creator_tools,         # Creator/Mentor only
    require_analytics,             # Pro Learn+
    require_ai_quota,              # Check AI request quota
)
```

---

## Protecting AI Endpoints

### Method 3: AI Quota Checking

```python
from rest_framework.views import APIView
from core.billing.permissions import CanMakeAIRequest
from core.billing.utils import process_ai_request

class AIChatView(APIView):
    permission_classes = [IsAuthenticated, CanMakeAIRequest]

    def post(self, request):
        # User can make AI request
        message = request.data.get('message')

        # Call your AI service
        response = ai_service.chat(message)
        tokens_used = response.tokens

        # Track the usage
        success, msg = process_ai_request(
            request.user,
            tokens_used=tokens_used,
            ai_provider='openai',
            ai_model='gpt-4'
        )

        if not success:
            return Response(
                {'error': msg},
                status=429
            )

        return Response({'response': response.text})
```

### Using the Decorator

```python
from core.billing.permissions import require_ai_quota

@require_ai_quota
def ai_chat_view(request):
    """Django view with AI quota check"""
    # User has AI quota available
    # Process the AI request
    pass
```

---

## Using Middleware Context

The `BillingContextMiddleware` adds billing info to every authenticated request:

```python
def my_view(request):
    """View that uses billing context from middleware"""

    # Check if user has feature access
    if request.billing['features']['marketplace']:
        # Show marketplace
        pass

    # Check tier
    if request.billing['tier_slug'] == 'pro-learn':
        # Show Pro Learn specific content
        pass

    # Check AI requests remaining
    ai_remaining = request.billing['ai_requests']['remaining']
    if ai_remaining is not None and ai_remaining < 10:
        # Show low quota warning
        pass

    # Check token balance
    token_balance = request.billing['tokens']['balance']

    # Access subscription object directly
    if request.subscription.is_trial:
        # Show trial banner
        pass
```

### Available Context

```python
request.subscription       # UserSubscription object
request.token_balance      # UserTokenBalance object
request.billing = {
    'is_authenticated': bool,
    'has_active_subscription': bool,
    'is_trial': bool,
    'tier_name': str,
    'tier_slug': str,
    'tier_type': str,
    'features': {
        'marketplace': bool,
        'go1_courses': bool,
        'ai_mentor': bool,
        'quests': bool,
        'circles': bool,
        'projects': bool,
        'creator_tools': bool,
        'analytics': bool,
    },
    'ai_requests': {
        'limit': int,
        'used': int,
        'remaining': int or None,
    },
    'tokens': {
        'balance': int,
    },
    'subscription_status': str,
    'current_period_end': datetime,
}

# Helper method
request.check_ai_quota()  # Returns (can_proceed, message)
```

---

## Frontend Integration

### Passing Billing Context to Templates

```python
from core.billing.utils import get_subscription_status

def my_view(request):
    context = {
        'billing': get_subscription_status(request.user),
    }
    return render(request, 'my_template.html', context)
```

### In Templates

```django
{% if billing.features.marketplace %}
    <a href="/marketplace">Visit Marketplace</a>
{% else %}
    <a href="/billing/upgrade">Upgrade to access Marketplace</a>
{% endif %}

{% if billing.ai_requests.remaining < 10 %}
    <div class="warning">
        Only {{ billing.ai_requests.remaining }} AI requests remaining this month.
        <a href="/billing/tokens">Purchase tokens</a>
    </div>
{% endif %}
```

---

## API Response Format

When a user is denied access, the response follows this format:

```json
{
  "error": "Marketplace not available",
  "message": "Marketplace is not included in your current subscription tier.",
  "feature": "marketplace",
  "upgrade_required": true
}
```

For AI quota exceeded:

```json
{
  "error": "AI request limit exceeded",
  "message": "AI request limit exceeded and no tokens available. Purchase tokens or upgrade your subscription.",
  "can_purchase_tokens": true
}
```

---

## Examples

### Protect a ViewSet

```python
from rest_framework import viewsets
from core.billing.permissions import RequiresCreatorTools

class CreatorProjectViewSet(viewsets.ModelViewSet):
    """Creator-only project management"""
    permission_classes = [IsAuthenticated, RequiresCreatorTools]
    queryset = Project.objects.filter(is_creator_project=True)
    serializer_class = CreatorProjectSerializer
```

### Conditional Feature Display

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.billing.utils import can_access_feature

@api_view(['GET'])
def features_available(request):
    """Return which features are available to the user"""
    features = {}
    for feature in ['marketplace', 'go1_courses', 'circles', 'creator_tools']:
        features[feature] = can_access_feature(request.user, feature)

    return Response({'features': features})
```

### Manual Permission Check

```python
from core.billing.utils import can_access_feature

def my_view(request):
    if not can_access_feature(request.user, 'circles'):
        return JsonResponse({
            'error': 'Circles not available',
            'upgrade_url': '/billing/upgrade',
        }, status=403)

    # User has access to circles
    circles = Circle.objects.filter(members=request.user)
    return render(request, 'circles.html', {'circles': circles})
```

---

## Testing

### Test Permission Classes

```python
from django.test import TestCase
from rest_framework.test import APIClient
from core.billing.models import SubscriptionTier

class MarketplacePermissionTest(TestCase):
    def test_free_tier_denied(self):
        """Free tier users cannot access marketplace"""
        user = create_user_with_tier('free')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/v1/marketplace/')
        self.assertEqual(response.status_code, 403)

    def test_community_pro_allowed(self):
        """Community Pro users can access marketplace"""
        user = create_user_with_tier('community_pro')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/v1/marketplace/')
        self.assertEqual(response.status_code, 200)
```

---

## Best Practices

1. **Always use permissions on paid features** - Don't rely on frontend checks alone
2. **Provide upgrade paths** - Show users how to access locked features
3. **Test all tier combinations** - Ensure permissions work correctly for each tier
4. **Log permission denials** - Track which features users want but can't access
5. **Use middleware context** - Access `request.billing` for simple checks
6. **Use permission classes** - Use `RequiresFeature` classes for robust protection
7. **Handle gracefully** - Provide clear error messages and upgrade CTAs

---

## Common Patterns

### Pattern 1: Tiered Feature Access

```python
from core.billing.permissions import RequiresGo1Courses

@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresGo1Courses])
def advanced_courses(request):
    """Advanced courses for Pro Learn+ users"""
    courses = Course.objects.filter(level='advanced')
    return Response(courses)
```

### Pattern 2: AI Request with Fallback to Tokens

```python
from core.billing.utils import process_ai_request

def handle_ai_request(user, prompt):
    # This automatically handles:
    # 1. Check subscription AI quota
    # 2. Fall back to token balance if quota exceeded
    # 3. Track usage
    # 4. Return clear error if both exhausted

    response = call_openai(prompt)

    success, message = process_ai_request(
        user,
        tokens_used=response.usage.total_tokens,
        ai_provider='openai',
        ai_model='gpt-4'
    )

    if not success:
        raise InsufficientQuotaError(message)

    return response
```

### Pattern 3: Progressive Feature Unlocking

```python
def get_available_features(user):
    """Return list of features based on user's tier"""
    features = []

    if request.billing['features']['marketplace']:
        features.append('marketplace')

    if request.billing['features']['circles']:
        features.append('circles')

    if request.billing['features']['creator_tools']:
        features.append('creator_dashboard')

    return features
```

---

## Need Help?

- See `core/billing/permissions.py` for all available permissions
- See `core/billing/utils.py` for utility functions
- See `core/billing/middleware.py` for middleware implementation
- Check `docs/billing-stripe-implementation-plan.md` for architecture details
