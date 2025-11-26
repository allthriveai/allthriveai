# Django Admin - AI Analytics Dashboard

## Overview

Your Django Admin now includes a **custom AI Analytics Dashboard** for monitoring your AI Gateway in real-time - no separate frontend needed!

## Features

### 📊 **Main Dashboard** (`/admin/ai-analytics/`)

- **LangSmith Connection Status**: Real-time health check
- **System Metrics (7 days)**:
  - Total cost across all users
  - Total tokens consumed
  - Error rate percentage
  - Average cost per request
- **Provider Breakdown**: Cost and requests by provider (Azure, OpenAI, Anthropic)
- **Top Users**: Highest spenders today
- **Recent Activity**: Latest AI-related actions

### 👥 **User Spend Monitoring** (`/admin/ai-analytics/users/`)

- **All Users Table** with:
  - Daily spend with visual progress bar
  - Monthly spend with visual progress bar
  - Status badges (OK, Warning, Exceeded)
  - Percentage of limit used
- **Filters**:
  - All Users
  - Warning (>80% of limit)
  - Exceeded (>100% of limit)

## Accessing the Dashboard

### 1. **From Django Admin Home**

```
http://localhost:8000/admin/
```

Scroll down to see "🤖 AI Gateway Analytics" section with:
- 📊 AI Analytics Dashboard
- 👥 User Spend Monitoring
- 🔍 View in LangSmith

### 2. **Direct URLs**

- **Main Dashboard**: `http://localhost:8000/admin/ai-analytics/`
- **User Monitoring**: `http://localhost:8000/admin/ai-analytics/users/`
- **System Metrics**: `http://localhost:8000/admin/ai-analytics/system/`

### 3. **Permissions**

Only **staff users** can access these dashboards.

To make a user staff:
```bash
python manage.py shell
```
```python
from core.users.models import User
user = User.objects.get(username='your_username')
user.is_staff = True
user.save()
```

Or use Django admin:
1. Go to `/admin/core/user/`
2. Click on user
3. Check "Staff status"
4. Save

## Dashboard Sections Explained

### LangSmith Status

Shows if tracing is enabled and connected:
- ✓ **Connected**: LangSmith API working, traces being sent
- ✗ **Disconnected**: Check `LANGSMITH_API_KEY` in `.env`

### System Metrics

7-day rolling window showing:
- **Total Cost**: Sum of all AI costs
- **Total Tokens**: Input + output tokens across all models
- **Error Rate**: Percentage of failed AI calls
- **Avg Cost/Request**: Average cost per AI operation

### Provider Breakdown

Table showing cost and request count for each provider:
- **Azure**: If using Azure OpenAI
- **OpenAI**: If using OpenAI directly
- **Anthropic**: If using Claude models

### Top Users

Top 10 users by **daily spend** (today):
- Username (clickable → user admin page)
- Email
- Daily spend in USD

### User Spend Monitoring

Full list of active users with:
- **Progress Bars**:
  - Green: 0-80% of limit
  - Yellow: 80-99% of limit
  - Red: 100%+ of limit
- **Status Badges**:
  - ✓ OK: Under 80%
  - ⚠️ Warning: 80-99%
  - 🚫 Exceeded: 100%+

### Filters

- **All Users**: Everyone (default)
- **Warning**: Users at 80-99% of limits
- **Exceeded**: Users over limits (blocked)

## Visual Examples

### Main Dashboard
```
┌─────────────────────────────────────────────┐
│ 🤖 AI Analytics Dashboard                   │
├─────────────────────────────────────────────┤
│ 🔗 LangSmith Status                         │
│ ✓ Connected | Project: allthrive-ai-gateway│
├─────────────────────────────────────────────┤
│ 📊 System Metrics (Last 7 Days)             │
│ ┌────────────┬────────────┬────────────┐   │
│ │Total Cost  │Total Tokens│Error Rate  │   │
│ │$125.50     │6.2M        │0.36%       │   │
│ └────────────┴────────────┴────────────┘   │
├─────────────────────────────────────────────┤
│ 🔌 Provider Breakdown                       │
│ Azure:     10,000 requests | $100.00        │
│ Anthropic:  2,500 requests | $25.50         │
└─────────────────────────────────────────────┘
```

### User Monitoring
```
┌───────────────────────────────────────────────────┐
│ 👥 User AI Spend Monitoring                       │
├───────────────────────────────────────────────────┤
│ Filter: [All] [⚠️ Warning] [🚫 Exceeded]          │
├──────────┬─────────────┬─────────────┬──────────┤
│ User     │ Daily Spend │Monthly Spend│ Status   │
├──────────┼─────────────┼─────────────┼──────────┤
│ alice    │ $4.50       │ $45.20      │ ⚠️ Warn  │
│          │ ████████░░  │ ████░░░░░░  │          │
│          │ 90%         │ 45%         │          │
├──────────┼─────────────┼─────────────┼──────────┤
│ bob      │ $0.15       │ $2.50       │ ✓ OK     │
│          │ ██░░░░░░░░  │ ░░░░░░░░░░  │          │
│          │ 3%          │ 0.3%        │          │
└──────────┴─────────────┴─────────────┴──────────┘
```

## Technical Implementation

### Files Created

1. **`core/admin/ai_analytics_admin.py`** (370 lines)
   - Custom admin views
   - Data aggregation logic
   - URL routing

2. **`templates/admin/ai_analytics/dashboard.html`**
   - Main dashboard template
   - Bootstrap styling

3. **`templates/admin/ai_analytics/user_dashboard.html`**
   - User monitoring template
   - Progress bars and status badges

4. **`templates/admin/index.html`**
   - Extends default admin home
   - Adds AI Analytics section

### How It Works

1. **Registration**: `core/admin.py` imports and registers the dashboard
2. **URL Injection**: Custom URLs added to admin site via `get_urls()` override
3. **Data Source**: Queries Redis cache and LangSmith API
4. **Permissions**: Uses `@staff_member_required` decorator

### Data Flow

```
Django Admin Request
      ↓
@staff_member_required decorator
      ↓
AIAnalyticsDashboard.analytics_dashboard()
      ↓
langsmith_service.get_system_analytics(days=7)
      ↓
Redis cache for current spend
      ↓
Render HTML template
      ↓
Display in browser
```

## Customization

### Change Time Windows

Edit `core/admin/ai_analytics_admin.py`:

```python
# Line ~50
system_stats = langsmith_service.get_system_analytics(days=30)  # Was 7
```

### Change User Limit

Edit `core/admin/ai_analytics_admin.py`:

```python
# Line ~143
users = User.objects.filter(is_active=True)[:500]  # Was 200
```

### Add More Charts

Install `django-chartjs` or use Google Charts:

```bash
pip install django-chartjs
```

Then in template:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<canvas id="costChart"></canvas>
<script>
  new Chart(document.getElementById('costChart'), {
    type: 'line',
    data: { ... }
  });
</script>
```

## Troubleshooting

### "Page not found (404)" when visiting `/admin/ai-analytics/`

**Cause**: Admin URLs not registered

**Fix**: Ensure `core/admin.py` has:
```python
from .admin.ai_analytics_admin import register_ai_analytics_dashboard
register_ai_analytics_dashboard(admin.site)
```

### "LangSmith Disconnected"

**Cause**: `LANGSMITH_API_KEY` not set

**Fix**: Add to `.env`:
```bash
LANGSMITH_API_KEY=lsv2_pt_your_key_here
LANGSMITH_TRACING_ENABLED=true
```

### All users show $0.00 spend

**Cause**: No AI calls made yet or Redis not running

**Fix**:
1. Make an AI call (project chat, auth chat)
2. Check Redis: `redis-cli ping` should return `PONG`
3. Restart Django: `python manage.py runserver`

### "Permission Denied"

**Cause**: User is not staff

**Fix**: Make user staff in admin or shell:
```python
user.is_staff = True
user.save()
```

## Next Steps

### 1. Add Real-Time Updates

Use Django Channels for WebSocket updates:
```bash
pip install channels channels-redis
```

### 2. Export Reports

Add CSV/PDF export buttons:
```python
import csv
from django.http import HttpResponse

def export_users_csv(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="users.csv"'
    # ... write CSV
    return response
```

### 3. Email Alerts

Send alerts when users exceed limits:
```python
from django.core.mail import send_mail

if daily_spend > daily_limit:
    send_mail(
        'AI Spend Limit Exceeded',
        f'User {user.username} exceeded daily limit',
        'admin@allthrive.ai',
        ['alerts@allthrive.ai'],
    )
```

### 4. Custom Permissions

Create fine-grained permissions:
```python
class Meta:
    permissions = [
        ("view_ai_analytics", "Can view AI analytics"),
        ("reset_user_spend", "Can reset user spend"),
    ]
```

## Benefits of Django Admin Dashboard

✅ **No Extra Frontend**: Use Django's built-in UI
✅ **Staff-Only Access**: Automatic authentication
✅ **Fast Setup**: 5 minutes to deploy
✅ **Mobile Responsive**: Works on any device
✅ **Customizable**: HTML templates easy to edit
✅ **Secure**: Django's built-in security
✅ **Zero Dependencies**: No React/Vue/Angular needed

## Alternative: REST API Frontend

If you need a custom React dashboard later, the REST APIs are already ready:

- `GET /api/v1/ai/analytics/user/`
- `GET /api/v1/ai/analytics/system/`
- `GET /api/v1/ai/analytics/user/spend-limit/`

See `docs/LANGSMITH_INTEGRATION.md` for API details.

---

**You now have a production-ready AI Analytics Dashboard in Django Admin!** 🎉

Access it at: **http://localhost:8000/admin/ai-analytics/**
