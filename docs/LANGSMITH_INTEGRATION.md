# LangSmith Integration - AI Gateway Observability

This document explains how LangSmith is integrated into the AllThrive AI Gateway for comprehensive observability, cost tracking, and performance monitoring.

## Overview

LangSmith provides:
- **End-to-end tracing** of all AI operations
- **Automatic cost tracking** per user and system-wide
- **Performance monitoring** (latency, tokens, error rates)
- **Prompt template management** and versioning
- **User attribution** and spend limits
- **Admin dashboard** for analytics

## Architecture

```
Frontend → API Endpoints → LangGraph Agents → AIProvider → LLMs
                ↓              ↓                  ↓
           LangSmith ←────  Traces  ────────  Metadata
                           (auto-instrumented)
```

All AI calls are automatically traced when `LANGSMITH_TRACING_ENABLED=true`.

## Setup

### 1. Get LangSmith API Key

1. Sign up at https://smith.langchain.com
2. Create a new project (e.g., "allthrive-ai-gateway")
3. Generate an API key from Settings > API Keys

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# LangSmith Observability
LANGSMITH_API_KEY=lsv2_pt_your_api_key_here
LANGSMITH_PROJECT=allthrive-ai-gateway
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_TRACING_ENABLED=true

# AI Cost Tracking
AI_COST_TRACKING_ENABLED=true
AI_MONTHLY_SPEND_LIMIT_USD=1000.0
AI_USER_DAILY_SPEND_LIMIT_USD=5.0
```

### 3. Install Dependencies

```bash
source .venv/bin/activate
pip install langsmith>=0.1.0 langchain-anthropic>=0.1.0
```

### 4. Restart Services

```bash
# Restart Django
python manage.py runserver

# Or restart Docker
docker-compose restart backend
```

## Features

### Auto-Instrumentation

LangSmith automatically traces:
- All `ChatOpenAI` calls in project agent
- All `AIProvider.complete()` calls
- All LangGraph agent invocations
- Tool calls and their results

Example trace hierarchy:
```
project_chat_stream
  └─ project_agent
      ├─ agent_node
      │   └─ ChatOpenAI.invoke
      └─ tool_node
          └─ fetch_github_metadata
```

### Cost Tracking

Every AI call tracks:
- **Prompt tokens**: Number of input tokens
- **Completion tokens**: Number of output tokens
- **Cost**: Calculated per provider pricing
- **User attribution**: Linked to user_id
- **Spend limits**: Daily and monthly caps

#### Pricing (as of Jan 2025)

| Provider | Model | Cost per 1K tokens |
|----------|-------|-------------------|
| Azure | GPT-4 Turbo | $0.02 |
| Azure | GPT-3.5 Turbo | $0.001 |
| OpenAI | GPT-4 Turbo | $0.02 |
| OpenAI | GPT-3.5 Turbo | $0.001 |
| Anthropic | Claude 3.5 Sonnet | $0.009 |
| Anthropic | Claude 3 Haiku | $0.0006875 |

**Note**: Update `services/langsmith_service.py:_get_token_cost()` when prices change.

### Spend Limits

Users are automatically blocked when they exceed:
- **Daily limit**: $5 USD (configurable)
- **Monthly limit**: $1000 USD (system-wide configurable)

Limits are enforced in real-time before AI calls are made.

## API Endpoints

### User Analytics

**GET** `/api/v1/ai/analytics/user/?days=30`

Returns user's AI usage for the last N days:

```json
{
  "user_id": 123,
  "period_days": 30,
  "total_cost_usd": 2.45,
  "total_tokens": 125000,
  "total_requests": 342,
  "avg_latency_ms": 1250.5,
  "avg_cost_per_request": 0.0072,
  "daily_spend": 0.15,
  "monthly_spend": 2.45,
  "daily_limit": 5.0,
  "monthly_limit": 1000.0,
  "limit_status": "ok"
}
```

`limit_status`: `ok` | `warning` (>80%) | `exceeded` (>100%)

### Check Spend Limit

**GET** `/api/v1/ai/analytics/user/spend-limit/`

Check if user is within limits:

```json
{
  "within_limits": true,
  "daily_spend": 0.15,
  "daily_limit": 5.0,
  "daily_remaining": 4.85,
  "daily_percent_used": 3.0,
  "monthly_spend": 2.45,
  "monthly_limit": 1000.0,
  "monthly_remaining": 997.55,
  "monthly_percent_used": 0.25,
  "warning_message": null,
  "blocked": false
}
```

### System Analytics (Admin Only)

**GET** `/api/v1/ai/analytics/system/?days=7`

System-wide metrics:

```json
{
  "period_days": 7,
  "total_cost_usd": 125.50,
  "total_tokens": 6275000,
  "total_requests": 12500,
  "error_count": 45,
  "error_rate": 0.36,
  "avg_cost_per_request": 0.01,
  "providers": {
    "azure": {"cost": 100.0, "requests": 10000},
    "anthropic": {"cost": 25.5, "requests": 2500}
  }
}
```

### LangSmith Health Check (Admin Only)

**GET** `/api/v1/ai/analytics/langsmith/health/`

```json
{
  "enabled": true,
  "project": "allthrive-ai-gateway",
  "endpoint": "https://api.smith.langchain.com",
  "connected": true,
  "error": null
}
```

### Reset User Spend (Admin Only)

**POST** `/api/v1/ai/analytics/user/<user_id>/reset/`

Resets spend tracking for a user (useful for testing or resolving billing issues).

## Usage Examples

### In Python Code

#### Track AI Costs Automatically

```python
from services.langsmith_service import langsmith_service

# AIProvider automatically tracks costs when user_id is provided
ai = AIProvider(user_id=request.user.id)
response = ai.complete("Explain Django")  # Cost tracked automatically
```

#### Manual Cost Tracking

```python
cost_info = langsmith_service.track_cost(
    user_id=123,
    provider='azure',
    model='gpt-4',
    prompt_tokens=500,
    completion_tokens=250,
)

if cost_info['limit_exceeded']:
    return Response({'error': 'Daily spend limit exceeded'}, status=429)
```

#### Create Custom Traces

```python
with langsmith_service.create_trace(
    name="custom_ai_operation",
    inputs={"query": "user query"},
    tags=["custom", "feature-x"],
    user_id=request.user.id
):
    # Your AI operation here
    result = my_ai_function()
```

### In Frontend (via API)

```typescript
// Check if user can make AI request
const checkLimit = async () => {
  const response = await fetch('/api/v1/ai/analytics/user/spend-limit/');
  const data = await response.json();

  if (data.blocked) {
    alert(data.warning_message);
    return false;
  }

  if (data.daily_percent_used > 80) {
    console.warn(`You've used ${data.daily_percent_used}% of your daily AI limit`);
  }

  return true;
};

// Get user analytics
const getUserAnalytics = async () => {
  const response = await fetch('/api/v1/ai/analytics/user/?days=30');
  const analytics = await response.json();

  console.log(`Total AI cost this month: $${analytics.monthly_spend}`);
  console.log(`Total requests: ${analytics.total_requests}`);
};
```

## LangSmith Dashboard

### Viewing Traces

1. Go to https://smith.langchain.com
2. Select your project ("allthrive-ai-gateway")
3. View traces in real-time
4. Filter by:
   - User ID (metadata.user_id)
   - Provider (metadata.ai_provider)
   - Tags (auth_chat, project_chat, etc.)
   - Date range
   - Status (success, error)

### Creating Dashboards

LangSmith provides built-in dashboards for:
- **Latency** (p50, p95, p99)
- **Cost** (total, per-user, per-model)
- **Error rates** (by endpoint, by provider)
- **Token usage** (input vs output)

### Setting Up Alerts

1. Go to Settings > Alerts
2. Create alerts for:
   - High error rate (>5%)
   - Slow latency (>5 seconds)
   - High cost ($100/day threshold)
   - Provider failures

## Troubleshooting

### Traces Not Appearing

1. Check `LANGSMITH_API_KEY` is set correctly
2. Verify `LANGSMITH_TRACING_ENABLED=true`
3. Check logs for connection errors:
   ```bash
   docker-compose logs backend | grep -i langsmith
   ```

### Cost Tracking Inaccurate

1. Verify pricing in `services/langsmith_service.py:_get_token_cost()`
2. Check Redis is running (cost data cached in Redis)
3. Ensure `AI_COST_TRACKING_ENABLED=true`

### Spend Limits Not Enforced

1. Check `check_user_spend_limit()` is called before AI operations
2. Verify Redis cache is working (`docker-compose ps redis`)
3. Manually reset user spend:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ai/analytics/user/123/reset/ \
        -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

## Best Practices

1. **Always pass user_id** to AIProvider for cost attribution
2. **Check spend limits** before expensive operations
3. **Use tags** to categorize different AI features (auth_chat, project_chat, etc.)
4. **Monitor daily** cost dashboards to catch anomalies
5. **Update pricing** monthly as providers change rates
6. **Set alerts** in LangSmith for critical thresholds
7. **Review traces** weekly to optimize prompts and reduce tokens

## Security

- **API keys**: Never commit `LANGSMITH_API_KEY` to git
- **User data**: LangSmith stores prompts/responses - ensure GDPR compliance
- **Spend limits**: Prevent abuse with strict daily/monthly caps
- **Admin endpoints**: Only accessible with `IsAdminUser` permission

## Production Checklist

- [ ] Set `LANGSMITH_API_KEY` in production environment
- [ ] Configure appropriate `AI_MONTHLY_SPEND_LIMIT_USD` for your budget
- [ ] Set up LangSmith alerts for errors and high costs
- [ ] Create admin dashboard for monitoring
- [ ] Test spend limit enforcement
- [ ] Document pricing updates in team calendar
- [ ] Set up weekly cost review meetings
- [ ] Enable Redis persistence for cost tracking data

## Support

- **LangSmith Docs**: https://docs.smith.langchain.com
- **Support**: https://github.com/langchain-ai/langsmith-sdk/issues
- **Internal**: See `services/langsmith_service.py` for implementation details
