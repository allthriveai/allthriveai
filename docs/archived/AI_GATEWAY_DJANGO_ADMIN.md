# AI Gateway + Django Admin Dashboard - Complete Setup

## 🎉 What You Have Now

Your AI Gateway is now complete with **BOTH** approaches for monitoring:

### 1. **Django Admin Dashboard** (Built-In UI)
- ✅ Custom AI Analytics views in Django Admin
- ✅ Real-time cost tracking and charts
- ✅ User spend monitoring with visual progress bars
- ✅ LangSmith health status
- ✅ Zero frontend code needed
- ✅ Accessible at `/admin/ai-analytics/`

### 2. **REST API** (For Custom Frontends)
- ✅ 5 REST endpoints for programmatic access
- ✅ JSON responses for React/Vue/Angular
- ✅ Available at `/api/v1/ai/analytics/*`

---

## Quick Access

### Django Admin Dashboard

```bash
# Start Django
python manage.py runserver

# Visit
http://localhost:8000/admin/

# Login with admin credentials
# Click "🤖 AI Analytics Dashboard"
```

### Make Yourself Staff (if needed)

```bash
python manage.py shell
```
```python
from core.users.models import User
user = User.objects.get(username='your_username')
user.is_staff = True
user.is_superuser = True  # Optional: for full admin access
user.save()
exit()
```

---

## Dashboard URLs

| URL | Description | Access |
|-----|-------------|--------|
| `/admin/` | Django Admin Home | Staff |
| `/admin/ai-analytics/` | **Main AI Analytics Dashboard** | Staff |
| `/admin/ai-analytics/users/` | **User Spend Monitoring** | Staff |
| `/admin/ai-analytics/system/` | System Metrics Detail | Staff |

---

## Features Overview

### Main Dashboard (`/admin/ai-analytics/`)

**LangSmith Connection**
- ✓ Connected / ✗ Disconnected status
- Project name and tracing status

**System Metrics (7-day rolling)**
- 💰 Total Cost (USD)
- 🎯 Total Tokens
- ❌ Error Rate (%)
- 📊 Avg Cost/Request

**Provider Breakdown**
- Requests and cost by provider
- Azure, OpenAI, Anthropic

**Top Users**
- Top 10 spenders today
- Links to user admin pages

**Recent Activity**
- Latest AI operations
- User attribution

### User Monitoring (`/admin/ai-analytics/users/`)

**User Table with:**
- Username (clickable → admin)
- Email
- Daily spend + progress bar
- Monthly spend + progress bar
- Status badge (OK / Warning / Exceeded)

**Filters:**
- All Users
- ⚠️ Warning (>80%)
- 🚫 Exceeded (>100%)

**Visual Progress Bars:**
- Green: 0-80%
- Yellow: 80-99%
- Red: 100%+

---

## File Structure

```
core/
├── admin/
│   └── ai_analytics_admin.py        # Custom admin views & logic
├── admin.py                          # Registers AI dashboard
└── views/
    └── ai_analytics_views.py         # REST API endpoints

templates/
└── admin/
    ├── index.html                    # Adds AI menu to admin home
    └── ai_analytics/
        ├── dashboard.html            # Main dashboard template
        └── user_dashboard.html       # User monitoring template

docs/
├── DJANGO_ADMIN_DASHBOARD.md         # Django Admin guide
├── LANGSMITH_INTEGRATION.md          # LangSmith setup guide
└── AI_GATEWAY_SUMMARY.md             # Overall summary
```

---

## How It Works

### 1. Admin URL Registration

`core/admin.py`:
```python
from .admin.ai_analytics_admin import register_ai_analytics_dashboard
register_ai_analytics_dashboard(admin.site)
```

### 2. Custom Admin Views

`core/admin/ai_analytics_admin.py`:
```python
class AIAnalyticsDashboard:
    def get_urls(self):
        return [
            path('ai-analytics/', self.analytics_dashboard),
            path('ai-analytics/users/', self.user_dashboard),
        ]

    def analytics_dashboard(self, request):
        # Query LangSmith + Redis
        system_stats = langsmith_service.get_system_analytics(days=7)
        top_users = self.get_top_users_by_spend()
        # Render template
        return render(request, 'admin/ai_analytics/dashboard.html', context)
```

### 3. Data Sources

- **LangSmith**: Historical metrics (7-30 days)
- **Redis**: Real-time spend (daily/monthly)
- **Django ORM**: User data, recent activity

### 4. Permissions

All views decorated with `@staff_member_required`:
```python
@staff_member_required
def analytics_dashboard(self, request):
    # Only staff can access
```

---

## Setup Checklist

### ✅ Backend Setup
- [x] Install `langsmith>=0.1.0`
- [x] Configure `LANGSMITH_API_KEY` in `.env`
- [x] Set `LANGSMITH_TRACING_ENABLED=true`
- [x] Restart Django

### ✅ Admin Access
- [ ] Make your user staff: `user.is_staff = True`
- [ ] Login to `/admin/`
- [ ] See "🤖 AI Analytics Dashboard" section

### ✅ Test Dashboard
- [ ] Visit `/admin/ai-analytics/`
- [ ] Verify LangSmith status is "Connected"
- [ ] Make an AI call (project chat)
- [ ] Refresh dashboard to see updated metrics

---

## Comparison: Django Admin vs REST API

| Feature | Django Admin | REST API |
|---------|--------------|----------|
| **Setup Time** | 0 min (already done) | Need to build frontend |
| **Authentication** | Built-in staff login | Need JWT/session handling |
| **UI Design** | Django's default styling | Custom React/Vue |
| **Mobile Friendly** | Yes (responsive) | Depends on your code |
| **Customization** | Limited (HTML templates) | Unlimited (full control) |
| **Use Case** | Internal admin monitoring | Public-facing dashboards |

### When to Use Each

**Django Admin**:
- Internal monitoring by staff
- Quick setup needed
- Don't want to build frontend

**REST API**:
- Public user dashboards
- Mobile apps
- Custom analytics tools
- Third-party integrations

---

## Example Workflows

### Workflow 1: Monitor Daily Costs

1. Go to `/admin/ai-analytics/`
2. Check "Total Cost" card
3. If high, click "Provider Breakdown"
4. Identify most expensive provider
5. Adjust routing logic in code

### Workflow 2: Find High Spenders

1. Go to `/admin/ai-analytics/users/`
2. Click "⚠️ Warning" filter
3. See users at 80%+ of limits
4. Click username → view full admin page
5. Reset spend if needed (future feature)

### Workflow 3: Debug Errors

1. Check "Error Rate" in main dashboard
2. If high, click "View in LangSmith"
3. Filter traces by status: "error"
4. See full stack traces
5. Fix underlying issue

---

## Customization Examples

### Add Export Button

`templates/admin/ai_analytics/user_dashboard.html`:
```html
<a href="{% url 'admin:export_users_csv' %}" class="button">
    📥 Export to CSV
</a>
```

`core/admin/ai_analytics_admin.py`:
```python
def export_users_csv(self, request):
    import csv
    from django.http import HttpResponse

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="users.csv"'

    writer = csv.writer(response)
    writer.writerow(['Username', 'Daily Spend', 'Monthly Spend'])

    for user in self.get_all_users_spend():
        writer.writerow([
            user['user'].username,
            user['daily_spend'],
            user['monthly_spend'],
        ])

    return response
```

### Add Charts with Chart.js

`templates/admin/ai_analytics/dashboard.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<canvas id="costChart" width="400" height="200"></canvas>
<script>
  const ctx = document.getElementById('costChart');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: {{ daily_costs|json }},  // Pass from view
      datasets: [{
        label: 'Daily Cost',
        data: {{ daily_values|json }},
        borderColor: '#417690',
      }]
    }
  });
</script>
```

### Add Email Alerts

`core/admin/ai_analytics_admin.py`:
```python
from django.core.mail import send_mail

def check_and_alert_high_spend(self):
    for user_data in self.get_all_users_spend():
        if user_data['status'] == 'exceeded':
            send_mail(
                'AI Spend Limit Exceeded',
                f"User {user_data['user'].username} exceeded limit",
                'admin@allthrive.ai',
                ['alerts@allthrive.ai'],
            )
```

---

## Production Tips

### 1. Cache Dashboard Data

```python
from django.core.cache import cache

def analytics_dashboard(self, request):
    cache_key = 'ai_dashboard_stats'
    stats = cache.get(cache_key)

    if not stats:
        stats = langsmith_service.get_system_analytics(days=7)
        cache.set(cache_key, stats, timeout=300)  # 5 minutes

    # ... render
```

### 2. Add Admin Permissions

```python
# In models.py
class Meta:
    permissions = [
        ("view_ai_analytics", "Can view AI analytics dashboard"),
        ("reset_user_spend", "Can reset user AI spend"),
    ]

# In admin view
if not request.user.has_perm('core.view_ai_analytics'):
    raise PermissionDenied
```

### 3. Schedule Cleanup

```python
# In Celery tasks
@app.task
def cleanup_old_spend_data():
    # Delete Redis keys older than 32 days
    pass
```

---

## Screenshots (Text-Based)

### Main Dashboard
```
┌────────────────────────────────────────────────┐
│ 🤖 AI Analytics Dashboard                      │
├────────────────────────────────────────────────┤
│ 🔗 LangSmith Status                            │
│ ✓ Connected | allthrive-ai-gateway            │
├────────────────────────────────────────────────┤
│ 📊 System Metrics (Last 7 Days)                │
│ ┌──────────┬──────────┬──────────┬──────────┐ │
│ │$125.50   │6.2M      │0.36%     │$0.01     │ │
│ │Total Cost│Tokens    │Errors    │Avg/Req   │ │
│ └──────────┴──────────┴──────────┴──────────┘ │
├────────────────────────────────────────────────┤
│ 🔌 Provider Breakdown                          │
│ Azure:     10,000 requests │ $100.00           │
│ Anthropic:  2,500 requests │ $25.50            │
├────────────────────────────────────────────────┤
│ 👥 Top Users (Today)                           │
│ alice   │ alice@test.com │ $4.50              │
│ bob     │ bob@test.com   │ $1.20              │
└────────────────────────────────────────────────┘
```

---

## Support & Documentation

- **Django Admin Guide**: `docs/DJANGO_ADMIN_DASHBOARD.md`
- **LangSmith Setup**: `docs/LANGSMITH_INTEGRATION.md`
- **REST API**: `docs/AI_GATEWAY_SUMMARY.md`

---

## What's Next?

### Immediate
1. Set `LANGSMITH_API_KEY` in `.env`
2. Make yourself staff
3. Visit `/admin/ai-analytics/`

### Short Term
- Add CSV export for reports
- Set up email alerts for exceeded limits
- Create scheduled cleanup tasks

### Long Term
- Build React dashboard using REST API
- Add advanced charts (Chart.js, D3.js)
- Create mobile app with analytics

---

**You're all set!** 🚀

Your AI Gateway now has:
- ✅ LangSmith tracing
- ✅ Cost tracking
- ✅ Django Admin dashboard
- ✅ REST API endpoints
- ✅ User spend limits
- ✅ Real-time monitoring

Access your dashboard at: **http://localhost:8000/admin/ai-analytics/**
