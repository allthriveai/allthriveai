# AI Usage Analytics Architecture

**Source of Truth** | **Last Updated**: 2025-12-20

This document describes AllThrive's AI usage tracking, cost analytics, spend limits, and admin dashboard system.

---

## 1. Overview

The AI usage analytics system provides:
- **Per-request tracking**: Every AI call logged with cost attribution
- **Cost calculation**: Automatic pricing based on provider/model
- **Budget guardrails**: Spend limit enforcement
- **Admin dashboards**: Real-time and historical analytics
- **CAU metric**: Cost per Active User for unit economics

**Key Files:**
- `core/ai_usage/models.py` - Data models
- `core/ai_usage/tracker.py` - Tracking service
- `core/ai_usage/cache_service.py` - Dashboard caching
- `core/ai_usage/views.py` - Admin API endpoints
- `core/ai_usage/tasks.py` - Celery aggregation

---

## 2. Data Models

### 2.1 AIProviderPricing

Tracks pricing for AI models with versioning.

| Field | Type | Purpose |
|-------|------|---------|
| `provider` | str | AI provider (openai, anthropic, gemini) |
| `model` | str | Model identifier |
| `input_price_per_million` | Decimal | Cost per 1M input tokens |
| `output_price_per_million` | Decimal | Cost per 1M output tokens |
| `effective_date` | datetime | When pricing became active |
| `is_active` | bool | Current active pricing |

### 2.2 AIUsageLog

Per-request logging with full cost attribution.

| Field | Type | Purpose |
|-------|------|---------|
| `user` | FK User | Who made the request |
| `session_id` | str | Session tracking |
| `feature` | str | Feature name (chat, project_generation) |
| `request_type` | str | completion, chat, embedding, image |
| `provider`, `model` | str | AI provider and model |
| `input_tokens`, `output_tokens` | int | Token counts |
| `input_cost`, `output_cost`, `total_cost` | Decimal | Calculated costs |
| `pricing_version` | FK | Pricing used for calculation |
| `latency_ms` | int | Request latency |
| `status` | str | success, error, timeout, rate_limited |
| `request_metadata`, `response_metadata` | JSON | Flexible metadata |

### 2.3 UserAICostSummary

Daily pre-aggregated summaries per user.

| Field | Type | Purpose |
|-------|------|---------|
| `user` | FK User | User reference |
| `date` | date | Summary date |
| `total_requests` | int | Total AI requests |
| `total_tokens` | bigint | Total tokens used |
| `total_cost` | Decimal | Total cost (USD) |
| `cost_by_feature` | JSON | `{chat: 0.50, project_gen: 1.20}` |
| `cost_by_provider` | JSON | `{openai: 1.20, anthropic: 0.50}` |

### 2.4 PlatformDailyStats

Platform-wide daily aggregates (Celery-generated).

**User Growth:** `total_users`, `new_users_today`, `dau`, `wau`, `mau`

**AI Usage:** `total_ai_requests`, `total_ai_tokens`, `total_ai_cost`, `cau`

**Content:** `total_projects`, `new_projects_today`, `total_project_views`

**Quality:** `avg_hallucination_score`, `hallucination_flags_count`

---

## 3. Usage Tracking

### 3.1 Basic Tracking

```python
from core.ai_usage import AIUsageTracker

AIUsageTracker.track_usage(
    user=request.user,
    feature='chat',
    provider='openai',
    model='gpt-4',
    input_tokens=100,
    output_tokens=50,
    request_type='chat',
    latency_ms=1234
)
```

### 3.2 Context Manager (Recommended)

Automatic timing and error handling:

```python
with AIUsageTracker.track_ai_request(
    user=request.user,
    feature='chat',
    provider='openai',
    model='gpt-4',
    request_type='chat'
) as tracker:
    response = call_openai_api(...)
    tracker.set_tokens(response.usage.prompt_tokens, response.usage.completion_tokens)
    tracker.set_metadata(response_meta={'finish_reason': response.stop_reason})
```

### 3.3 Gateway Metadata

For AI gateway routing (e.g., OpenRouter):

```python
AIUsageTracker.track_usage(
    user=user,
    feature='chat',
    provider='openai',
    model='gpt-4-turbo',
    input_tokens=100,
    output_tokens=50,
    gateway_metadata={
        'gateway_provider': 'openrouter',
        'gateway_model': 'openai/gpt-4-turbo-2024-04-09',
        'requested_model': 'gpt-4-turbo'
    }
)
```

---

## 4. Cost Calculation

### 4.1 Formula

```python
input_cost = (input_tokens / 1_000_000) * input_price_per_million
output_cost = (output_tokens / 1_000_000) * output_price_per_million
total_cost = input_cost + output_cost
```

### 4.2 Pricing Lookup

```python
pricing = AIUsageTracker.get_current_pricing('openai', 'gpt-4')
# Returns active AIProviderPricing or None
```

### 4.3 Provider Normalization

```python
normalize_provider('google')  # → 'gemini'
normalize_provider('openai')  # → 'openai'
```

---

## 5. Budget Guardrails

### 5.1 Check User Budget

```python
is_over, current_cost, remaining = AIUsageTracker.check_user_budget(
    user=request.user,
    monthly_budget=Decimal('50.00')
)

if is_over:
    return Response({'error': 'Budget exceeded'}, status=429)
```

### 5.2 Integration Pattern

```python
# Before expensive AI operation
monthly_budget = subscription_tier.get_monthly_ai_budget()
is_over, current_cost, remaining = AIUsageTracker.check_user_budget(user, monthly_budget)

if is_over:
    return Response({
        'error': f'Monthly budget exceeded. Used: ${current_cost}, Budget: ${monthly_budget}'
    }, status=429)

# Proceed with AI call
```

---

## 6. CAU Metric (Cost per Active User)

### 6.1 Definition

- **Active User**: Made at least 1 AI request in the period
- **CAU Formula**: Total AI Cost / Number of Active Users

### 6.2 Usage

```python
cau_data = AIUsageTracker.get_cau(days=30)
# {
#     'cau': Decimal('0.45'),
#     'total_cost': Decimal('450.00'),
#     'active_users': 1000,
#     'period_days': 30
# }

# Unit economics
revenue_per_user = Decimal('29.99')
gross_margin = revenue_per_user - cau_data['cau']
```

---

## 7. Dashboard Caching

### 7.1 XFetch Algorithm

Probabilistic early recomputation prevents cache stampede:
- When cache hit occurs, calculates remaining TTL
- Probabilistically triggers background recomputation
- No user-facing latency increase

### 7.2 Cache TTLs

| Cache | TTL | Purpose |
|-------|-----|---------|
| Overview KPIs | 5 min | Dashboard headers |
| Timeseries | 10 min | Charts |
| Breakdowns | 10 min | Feature/provider splits |
| Engagement | 10 min | Engagement metrics |

### 7.3 Cached Functions

```python
from core.ai_usage.cache_service import (
    get_overview_kpis,
    get_timeseries_data,
    get_ai_breakdown,
    get_user_growth_metrics,
    get_engagement_overview
)

kpis = get_overview_kpis(days=30)
# {'totalUsers', 'activeUsers', 'totalAiCost', 'totalProjects'}
```

---

## 8. Admin API Endpoints

All require `IsAdminRole` permission.

### 8.1 Overview

```
GET /api/admin/analytics/overview/?days=30
→ {totalUsers, activeUsers, totalAiCost, totalProjects}
```

### 8.2 Timeseries

```
GET /api/admin/analytics/timeseries/?metric=ai_cost&days=30
→ {data: [{date, value}, ...]}
```

Metrics: `users`, `ai_cost`, `projects`, `engagement`

### 8.3 AI Breakdown

```
GET /api/admin/analytics/ai-breakdown/?type=feature&days=30
→ {breakdown: {feature: {requests, cost}, ...}}
```

Types: `feature`, `provider`

### 8.4 User Growth

```
GET /api/admin/analytics/user-growth/?days=30
→ {totalUsers, newUsers, avgDau, avgMau, growthRate, stickiness}
```

### 8.5 Engagement

```
GET /api/admin/analytics/engagement/heatmap/?days=30
→ {heatmap: 7x24 matrix, peakHour, peakDay}
```

---

## 9. Celery Aggregation Tasks

### 9.1 Platform Stats

```python
# Schedule: Daily at midnight
aggregate_platform_daily_stats(date_str=None)
```

Generates:
- User growth (DAU, WAU, MAU)
- AI usage by feature/provider
- Content metrics
- Engagement metrics
- Hallucination quality metrics

### 9.2 Engagement Stats

```python
# Schedule: Daily at 2 AM
aggregate_engagement_daily_stats(date_str=None)
```

Generates:
- 24-hour activity heatmap
- Feature usage breakdown
- Retention cohorts (D1, D7, D30)
- Funnel metrics

---

## 10. Django Admin

### 10.1 AIUsageLogAdmin

- Color-coded cost display (green <$0.10, yellow <$1, red >$1)
- Anonymized emails (unless `view_pii` permission)
- Changelist summary: total cost, requests, CAU

### 10.2 UserAICostSummaryAdmin

- Top spending users
- CAU metrics (7d, 30d, 90d)
- Searchable by email/username

### 10.3 PlatformDailyStatsAdmin

- Read-only (Celery-generated)
- Admin actions: re-aggregate for specific dates

---

## 11. Privacy

### 11.1 Permissions

| Permission | Scope |
|------------|-------|
| `view_all_usage_logs` | View all usage logs |
| `view_usage_details` | View detailed info |
| `view_all_user_costs` | View all user costs |
| `view_cau_metrics` | View CAU analytics |
| `view_pii` | View email addresses |
| `export_usage_data` | Export usage data |

### 11.2 Anonymization

```python
anonymize_user_id(user_id)
# Returns 12-char SHA256 hash for privacy-safe logging
```

---

## 12. Billing Integration

### 12.1 Monthly Costs

```python
monthly_cost = AIUsageTracker.get_user_monthly_cost(user, year=2024, month=1)
```

### 12.2 Cost by Feature/Provider

From `UserAICostSummary`:
- `cost_by_feature`: Enable feature-based pricing
- `cost_by_provider`: Track provider costs

### 12.3 Usage-Based Billing

```python
# Get daily summaries for billing period
summaries = UserAICostSummary.objects.filter(
    user=user,
    date__range=(start_date, end_date)
)
total = summaries.aggregate(Sum('total_cost'))
```

---

## 13. Architecture Summary

```
AIUsageTracker (tracker.py)
├── track_usage() → Creates AIUsageLog
├── track_ai_request() → Context manager wrapper
├── calculate_cost() → Uses AIProviderPricing
├── update_daily_summary() → Updates UserAICostSummary
├── check_user_budget() → Budget guardrail
└── get_cau() → Business metric

AIUsageLog (per-request)
└── Source of truth for all AI calls

UserAICostSummary (daily aggregates)
└── Fast user-level analytics

PlatformDailyStats (Celery-generated)
└── Platform-wide dashboard data

CacheService (XFetch)
└── Dashboard performance optimization
```

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
