# AI Usage Tracking & Cost Analytics

🎯 **Complete system for tracking AI API usage, calculating costs, and providing business intelligence dashboards.**

## ✅ What's Built

### 1. **Database Models** (3 models)
- `AIProviderPricing` - Versioned pricing for all AI providers
- `AIUsageLog` - Every AI request with full cost attribution
- `UserAICostSummary` - Pre-aggregated daily summaries for fast queries

### 2. **Usage Tracker** (`tracker.py`)
- ✅ Automatic cost calculation based on tokens
- ✅ Context manager for easy integration
- ✅ Automatic timing and error tracking
- ✅ Daily summary updates
- ✅ Budget checking

### 3. **Django Admin Dashboard**
- ✅ AI Usage Logs with filters, search, and analytics
- ✅ Provider Pricing management
- ✅ User Cost Summaries with trends
- ✅ Summary statistics on all list views
- ✅ Color-coded displays for costs, status, latency

### 4. **Management Command**
- ✅ `sync_ai_pricing` - Syncs latest pricing from all providers
- ✅ 16 models pre-configured (OpenAI, Anthropic, Google, Cohere)

### 5. **Integration Examples**
- ✅ 7 different integration patterns
- ✅ Ready to copy into your endpoints

---

## 🚀 Quick Start

### Step 1: Pricing is Already Synced
```bash
# Already run during setup, but you can update it anytime:
docker-compose exec web python manage.py sync_ai_pricing
```

### Step 2: Access Django Admin
1. Go to http://localhost:8000/admin/
2. Navigate to **AI Usage** section:
   - **AI Usage Logs** - See all requests
   - **AI Provider Pricing** - Manage pricing
   - **User AI Cost Summaries** - Daily aggregates

### Step 3: Integrate Into Your AI Endpoints

**RECOMMENDED: Use Context Manager**
```python
from core.ai_usage.tracker import AIUsageTracker

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def your_ai_endpoint(request):
    user = request.user

    # Wrap your AI call
    with AIUsageTracker.track_ai_request(
        user=user,
        feature='chat',  # or 'project_gen', 'code_review', etc.
        provider='openai',  # or 'anthropic', 'google'
        model='gpt-4'
    ) as tracker:

        # Your existing AI call
        response = openai.ChatCompletion.create(...)

        # Track tokens (REQUIRED)
        tracker.set_tokens(
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens
        )

        # Optional: Add metadata
        tracker.set_metadata(
            response_meta={'finish_reason': response.choices[0].finish_reason}
        )

    return Response({'message': response.choices[0].message.content})
```

**That's it!** The tracker handles:
- ✅ Cost calculation
- ✅ Timing
- ✅ Error tracking
- ✅ Daily summaries
- ✅ Logging

---

## 📊 Django Admin Features

### AI Usage Logs Admin
- **Filters**: Feature, Provider, Model, Status, Date
- **Search**: User email, username, feature, session ID
- **Displays**:
  - Color-coded costs (green/yellow/red)
  - Status badges (success/error/timeout/rate_limited)
  - Latency with color coding
  - Token breakdown on hover
- **Summary Stats**:
  - Total cost
  - Total requests
  - Average cost per request
  - Success rate
  - Top features by cost
  - Top providers by cost
  - Today vs Yesterday comparison

### Provider Pricing Admin
- **Manage all AI model pricing**
- **Version history** (when prices change)
- **Mark old pricing inactive**
- **Add new models easily**

### User Cost Summaries Admin
- **Daily aggregates per user**
- **Cost breakdowns**:
  - By feature
  - By provider
  - Request counts
- **Summary Stats**:
  - Total cost across all users
  - Unique users
  - Top spending users
  - Average daily cost

---

## 🔍 Business Intelligence Queries

### Get User's Monthly Cost
```python
from core.ai_usage.tracker import AIUsageTracker

monthly_cost = AIUsageTracker.get_user_monthly_cost(user)
print(f"User spent ${monthly_cost} this month")
```

### Check Budget
```python
from decimal import Decimal

is_over, current, remaining = AIUsageTracker.check_user_budget(
    user,
    monthly_budget=Decimal('50.00')
)

if is_over:
    # Block expensive requests or show warning
    pass
```

### Top Spending Users (Last 30 Days)
```python
from core.ai_usage.models import UserAICostSummary

top_users = UserAICostSummary.get_top_users_by_cost(days=30, limit=10)
for u in top_users:
    print(f"{u['user__email']}: ${u['total_cost']:.2f}")
```

### Cost per Active User (CAU)
```python
from core.ai_usage.tracker import AIUsageTracker

# Get CAU for last 30 days
cau_data = AIUsageTracker.get_cau(days=30)
print(f"CAU (30d): ${cau_data['cau']:.2f}")
print(f"Active Users: {cau_data['active_users']}")
print(f"Total Cost: ${cau_data['total_cost']:.2f}")

# Get CAU for specific date range
from datetime import date
cau_data = AIUsageTracker.get_cau(
    start_date=date(2025, 12, 1),
    end_date=date(2025, 12, 31)
)
print(f"December CAU: ${cau_data['cau']:.2f}")

# Compare CAU across different periods
cau_7d = AIUsageTracker.get_cau(days=7)
cau_30d = AIUsageTracker.get_cau(days=30)
cau_90d = AIUsageTracker.get_cau(days=90)

print(f"CAU Trend:")
print(f"  7 days:  ${cau_7d['cau']:.2f} ({cau_7d['active_users']} users)")
print(f"  30 days: ${cau_30d['cau']:.2f} ({cau_30d['active_users']} users)")
print(f"  90 days: ${cau_90d['cau']:.2f} ({cau_90d['active_users']} users)")
```

### Feature Cost Analysis
```python
from django.db.models import Sum
from core.ai_usage.models import AIUsageLog

feature_costs = AIUsageLog.objects.values('feature').annotate(
    total_cost=Sum('total_cost'),
    request_count=Count('id')
).order_by('-total_cost')

for fc in feature_costs:
    print(f"{fc['feature']}: ${fc['total_cost']:.2f} ({fc['request_count']} requests)")
```

### Daily Trend
```python
from core.ai_usage.models import UserAICostSummary
from django.db.models import Sum

daily = UserAICostSummary.objects.filter(
    date__gte=last_30_days
).values('date').annotate(
    cost=Sum('total_cost'),
    requests=Sum('total_requests')
).order_by('date')
```

---

## 📈 Key Metrics to Track

### Business Metrics
1. **Cost per Active User (CAU)** ✅ IMPLEMENTED
   - Total AI cost / Active users
   - Track trend over time
   - Use `AIUsageTracker.get_cau(days=30)` to calculate
   - Available in Django Admin for 7d, 30d, and 90d periods

2. **Cost by Feature**
   - Which features are expensive?
   - Should you optimize or charge more?

3. **Gross Margin per User**
   - Subscription revenue - AI costs
   - Are you making money?

4. **LTV:CAC Ratio (AI perspective)**
   - Lifetime value vs. AI cost acquisition
   - Is usage sustainable?

### Operational Metrics
1. **Daily AI Budget**
   - Set alerts if exceeded
   - Track burn rate

2. **Error Rate**
   - % of failed requests
   - Which features have issues?

3. **Average Latency**
   - Performance monitoring
   - User experience indicator

4. **Provider Distribution**
   - Which providers are you using most?
   - Optimization opportunities

---

## 🔧 Advanced Usage

### Add New AI Provider
```bash
# Edit core/ai_usage/management/commands/sync_ai_pricing.py
# Add new provider to pricing_data list
# Then run:
docker-compose exec web python manage.py sync_ai_pricing
```

### Custom Feature Tracking
```python
# Track any custom feature
with AIUsageTracker.track_ai_request(
    user=user,
    feature='custom_analysis',  # Your feature name
    provider='openai',
    model='gpt-4'
) as tracker:
    # Your code
    tracker.set_tokens(input_tokens=100, output_tokens=50)
```

### Session Tracking
```python
# Track related requests in a session
session_id = str(uuid.uuid4())

with AIUsageTracker.track_ai_request(
    user=user,
    feature='multi_step',
    provider='openai',
    model='gpt-4',
    session_id=session_id  # Group related requests
) as tracker:
    # Your code
    tracker.set_tokens(...)
```

### Manual Error Tracking
```python
with AIUsageTracker.track_ai_request(...) as tracker:
    try:
        response = risky_ai_call()
        tracker.set_tokens(...)
    except CustomException as e:
        tracker.mark_error(str(e), status='custom_error')
        raise
```

---

## 🎯 Integration Checklist

- [ ] **Identify all AI endpoints** in your codebase
- [ ] **Wrap each with `track_ai_request`** context manager
- [ ] **Set correct feature names** (be consistent!)
- [ ] **Test with a few requests** - check Django admin
- [ ] **Set up monitoring** - daily budget alerts
- [ ] **Create dashboards** for key metrics
- [ ] **Review weekly** - optimize expensive features

---

## 📁 File Structure

```
core/ai_usage/
├── __init__.py
├── models.py                      # 3 models for tracking
├── admin.py                       # Django admin with analytics
├── tracker.py                     # AIUsageTracker utility
├── integration_example.py         # 7 integration patterns
├── management/
│   └── commands/
│       └── sync_ai_pricing.py     # Pricing sync command
└── migrations/
    └── 0001_initial.py            # Database schema
```

---

## 🎨 Django Admin Screenshots

### AI Usage Logs
- Filter by date, feature, provider, status
- See costs, tokens, latency at a glance
- Summary stats at the top

### Provider Pricing
- All AI model prices in one place
- Easy to update when prices change
- Historical versioning

### User Cost Summaries
- Daily aggregates for fast queries
- Breakdown by feature and provider
- Top spenders list

---

## 💡 Next Steps

1. **Week 1**: Integrate tracker into 2-3 main AI endpoints
2. **Week 2**: Monitor costs, identify expensive features
3. **Week 3**: Optimize or adjust pricing based on data
4. **Week 4**: Set up automated alerts and dashboards

---

## ⚠️ Important Notes

- **Pricing is auto-calculated** based on `AIProviderPricing`
- **Update pricing regularly** when providers change prices
- **Context manager is recommended** for automatic error handling
- **Daily summaries are pre-aggregated** for performance
- **All costs are in USD**

---

## 🆘 Troubleshooting

**Q: I'm not seeing any data in Django Admin**
- Have you integrated the tracker into your endpoints?
- Check logs for errors: `docker-compose logs web | grep "AI Usage"`

**Q: Costs showing as $0**
- Make sure pricing is synced: `python manage.py sync_ai_pricing`
- Check that provider/model names match exactly

**Q: Queries are slow**
- Use `UserAICostSummary` for aggregates (pre-calculated)
- Add date filters to narrow down results

**Q: How do I add a new AI model?**
- Edit `sync_ai_pricing.py` command
- Add new model to pricing_data
- Run command to sync

---

## 📚 Related Documentation

- See `integration_example.py` for 7 integration patterns
- See `tracker.py` for full API documentation
- See `models.py` for data structure details

---

**Built in ~2 hours** ✅
**Ready to track costs** ✅
**Comprehensive analytics** ✅
