"""
Django Admin Dashboard for AI Analytics

Provides:
- Real-time cost tracking dashboard
- User spend monitoring
- System-wide metrics
- LangSmith health status
- Interactive charts
"""

from datetime import datetime

from django.contrib import admin as django_admin
from django.contrib.admin.views.decorators import staff_member_required
from django.core.cache import cache
from django.shortcuts import render
from django.urls import path

from core.projects.models import Project
from core.users.models import User
from services.ai.langsmith import langsmith_service


class AIAnalyticsDashboard:
    """Custom admin dashboard for AI analytics."""

    def __init__(self, admin_site):
        self.admin_site = admin_site

    def get_urls(self):
        """Add custom admin URLs."""
        return [
            path('ai-analytics/', self.admin_view(self.analytics_dashboard), name='ai_analytics_dashboard'),
            path('ai-analytics/system/', self.admin_view(self.system_dashboard), name='ai_system_dashboard'),
            path('ai-analytics/users/', self.admin_view(self.user_dashboard), name='ai_user_dashboard'),
        ]

    def admin_view(self, view):
        """Wrapper to ensure staff permission."""
        return staff_member_required(view)

    def analytics_dashboard(self, request):
        """Main AI analytics dashboard."""
        # Get system analytics for last 7 days
        try:
            if langsmith_service.enabled:
                system_stats = langsmith_service.get_system_analytics(days=7)
            else:
                system_stats = {
                    'period_days': 7,
                    'total_cost_usd': 0.0,
                    'total_tokens': 0,
                    'total_requests': 0,
                    'error_count': 0,
                    'error_rate': 0.0,
                    'providers': {},
                }
        except Exception as e:
            system_stats = {'error': str(e)}

        # Get top users by spend
        top_users = self.get_top_users_by_spend(days=7)

        # Get LangSmith health
        from django.conf import settings

        langsmith_health = {
            'enabled': settings.LANGSMITH_TRACING_ENABLED,
            'project': settings.LANGSMITH_PROJECT,
            'connected': langsmith_service.enabled,
        }

        # Get recent AI activity (project chats)
        recent_activity = self.get_recent_ai_activity(limit=10)

        context = {
            **self.admin_site.each_context(request),
            'title': 'AI Analytics Dashboard',
            'system_stats': system_stats,
            'top_users': top_users,
            'langsmith_health': langsmith_health,
            'recent_activity': recent_activity,
            'has_permission': True,
        }

        return render(request, 'admin/ai_analytics/dashboard.html', context)

    def system_dashboard(self, request):
        """Detailed system metrics."""
        days = int(request.GET.get('days', 30))

        try:
            if langsmith_service.enabled:
                system_stats = langsmith_service.get_system_analytics(days=days)

                # Calculate daily breakdown
                daily_costs = self.get_daily_cost_breakdown(days=days)
            else:
                system_stats = {'error': 'LangSmith not enabled'}
                daily_costs = []
        except Exception as e:
            system_stats = {'error': str(e)}
            daily_costs = []

        context = {
            **self.admin_site.each_context(request),
            'title': 'System AI Metrics',
            'system_stats': system_stats,
            'daily_costs': daily_costs,
            'days': days,
            'has_permission': True,
        }

        return render(request, 'admin/ai_analytics/system_dashboard.html', context)

    def user_dashboard(self, request):
        """User-level spend monitoring."""
        # Get all users with their spend
        users_with_spend = self.get_all_users_spend()

        # Get filters
        status_filter = request.GET.get('status', 'all')  # all, warning, exceeded

        # Filter users
        if status_filter == 'warning':
            users_with_spend = [u for u in users_with_spend if u['status'] == 'warning']
        elif status_filter == 'exceeded':
            users_with_spend = [u for u in users_with_spend if u['status'] == 'exceeded']

        context = {
            **self.admin_site.each_context(request),
            'title': 'User AI Spend Monitoring',
            'users': users_with_spend,
            'status_filter': status_filter,
            'has_permission': True,
        }

        return render(request, 'admin/ai_analytics/user_dashboard.html', context)

    def get_top_users_by_spend(self, days=7):
        """Get top users by AI spend."""
        today = datetime.utcnow().strftime('%Y-%m-%d')

        users = User.objects.filter(is_active=True)[:100]  # Limit to 100 users
        user_spend = []

        for user in users:
            daily_key = f'ai_cost:user:{user.id}:daily:{today}'
            daily_spend = cache.get(daily_key, 0.0)

            if daily_spend > 0:
                user_spend.append(
                    {
                        'user': user,
                        'daily_spend': daily_spend,
                    }
                )

        # Sort by spend
        user_spend.sort(key=lambda x: x['daily_spend'], reverse=True)
        return user_spend[:10]

    def get_all_users_spend(self):
        """Get all users with their current spend."""
        from django.conf import settings

        today = datetime.utcnow().strftime('%Y-%m-%d')
        month = datetime.utcnow().strftime('%Y-%m')

        users = User.objects.filter(is_active=True).order_by('-date_joined')[:200]
        users_with_spend = []

        for user in users:
            daily_key = f'ai_cost:user:{user.id}:daily:{today}'
            monthly_key = f'ai_cost:user:{user.id}:monthly:{month}'

            daily_spend = cache.get(daily_key, 0.0)
            monthly_spend = cache.get(monthly_key, 0.0)

            daily_limit = settings.AI_USER_DAILY_SPEND_LIMIT_USD
            monthly_limit = settings.AI_MONTHLY_SPEND_LIMIT_USD

            daily_pct = (daily_spend / daily_limit * 100) if daily_limit > 0 else 0
            monthly_pct = (monthly_spend / monthly_limit * 100) if monthly_limit > 0 else 0

            # Determine status
            if daily_pct >= 100 or monthly_pct >= 100:
                status = 'exceeded'
            elif daily_pct >= 80 or monthly_pct >= 80:
                status = 'warning'
            else:
                status = 'ok'

            users_with_spend.append(
                {
                    'user': user,
                    'daily_spend': daily_spend,
                    'monthly_spend': monthly_spend,
                    'daily_pct': daily_pct,
                    'monthly_pct': monthly_pct,
                    'status': status,
                }
            )

        return users_with_spend

    def get_daily_cost_breakdown(self, days=30):
        """Get daily cost breakdown (mock data - would come from LangSmith)."""
        # This would query LangSmith for actual daily costs
        # For now, return empty list
        return []

    def get_recent_ai_activity(self, limit=10):
        """Get recent AI-related activity."""
        # Get recent projects (proxy for AI activity)
        recent_projects = Project.objects.select_related('user').order_by('-created_at')[:limit]

        activity = []
        for project in recent_projects:
            activity.append(
                {
                    'user': project.user,
                    'action': 'Project created',
                    'description': project.title,
                    'timestamp': project.created_at,
                }
            )

        return activity


# Register the dashboard with admin site
def register_ai_analytics_dashboard(admin_site):
    """Register AI analytics dashboard with Django admin."""
    dashboard = AIAnalyticsDashboard(admin_site)

    # Add custom URLs to admin
    original_get_urls = admin_site.get_urls

    def get_urls():
        urls = original_get_urls()
        custom_urls = dashboard.get_urls()
        return custom_urls + urls

    admin_site.get_urls = get_urls


# Auto-register on import
register_ai_analytics_dashboard(django_admin.site)
