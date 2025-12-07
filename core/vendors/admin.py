"""
Vendor Analytics Admin Configuration

Allows admins to:
- Grant vendor users access to specific tools
- View analytics data
- Monitor engagement metrics
"""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    ToolCompetitorView,
    ToolDailyStats,
    ToolEngagement,
    ToolImpression,
    VendorToolAccess,
)


class VendorUserFilter(admin.SimpleListFilter):
    """Filter to show only vendor users in the user dropdown."""

    title = 'vendor user'
    parameter_name = 'user__role'

    def lookups(self, request, model_admin):
        from core.users.models import User

        vendors = User.objects.filter(role='vendor').values_list('id', 'username', 'email')
        return [(v[0], f'{v[1]} ({v[2]})') for v in vendors]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(user_id=self.value())
        return queryset


@admin.register(VendorToolAccess)
class VendorToolAccessAdmin(admin.ModelAdmin):
    """Admin for managing which vendors can see which tools' analytics."""

    list_display = [
        'user_display',
        'tool_display',
        'access_level_display',
        'granted_by',
        'created_at',
    ]
    list_filter = [
        VendorUserFilter,
        'can_view_competitive',
        'can_view_queries',
        'can_export',
        'created_at',
    ]
    search_fields = [
        'user__username',
        'user__email',
        'tool__name',
        'tool__slug',
    ]
    raw_id_fields = ['user', 'tool']
    readonly_fields = ['created_at', 'updated_at', 'granted_by']
    list_per_page = 50

    fieldsets = [
        (
            'Vendor & Tool Assignment',
            {
                'fields': ('user', 'tool'),
                'description': 'Select a vendor user and the tool they should have analytics access to.',
            },
        ),
        (
            'Access Permissions',
            {
                'fields': (
                    'can_view_basic',
                    'can_view_competitive',
                    'can_view_segments',
                    'can_view_queries',
                    'can_export',
                ),
                'description': 'Configure what data this vendor can see for this tool.',
            },
        ),
        (
            'Admin Notes',
            {
                'fields': ('notes',),
                'classes': ('collapse',),
            },
        ),
        (
            'Audit Info',
            {
                'fields': ('granted_by', 'created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    ]

    actions = ['grant_full_access', 'grant_basic_access', 'revoke_competitive_access']

    @admin.display(
        description='Vendor User',
        ordering='user__username',
    )
    def user_display(self, obj):
        """Display user with link and role badge."""
        url = reverse('admin:users_user_change', args=[obj.user.id])
        badge_style = 'background:#0ea5e9;color:white;padding:2px 6px;border-radius:3px;font-size:11px;'
        badge = f'<span style="{badge_style}">vendor</span>'
        return format_html(
            '<a href="{}">{}</a> {}',
            url,
            obj.user.username,
            badge,
        )

    @admin.display(
        description='Tool',
        ordering='tool__name',
    )
    def tool_display(self, obj):
        """Display tool with link."""
        url = reverse('admin:tools_tool_change', args=[obj.tool.id])
        if obj.tool.logo_url:
            img_style = 'width:20px;height:20px;border-radius:4px;' + 'vertical-align:middle;margin-right:8px;'
            return format_html(
                '<a href="{}"><img src="{}" style="{}">{}</a>',
                url,
                obj.tool.logo_url,
                img_style,
                obj.tool.name,
            )
        return format_html('<a href="{}">{}</a>', url, obj.tool.name)

    @admin.display(description='Access Level')
    def access_level_display(self, obj):
        """Show access level as badges."""
        badges = []
        style_base = 'padding:2px 6px;border-radius:3px;margin:1px;font-size:11px;'
        if obj.can_view_basic:
            style = f'background:#10b981;color:white;{style_base}'
            badges.append(f'<span style="{style}">Basic</span>')
        if obj.can_view_competitive:
            style = f'background:#3b82f6;color:white;{style_base}'
            badges.append(f'<span style="{style}">Competitive</span>')
        if obj.can_view_segments:
            style = f'background:#8b5cf6;color:white;{style_base}'
            badges.append(f'<span style="{style}">Segments</span>')
        if obj.can_view_queries:
            style = f'background:#f59e0b;color:white;{style_base}'
            badges.append(f'<span style="{style}">Queries</span>')
        if obj.can_export:
            style = f'background:#64748b;color:white;{style_base}'
            badges.append(f'<span style="{style}">Export</span>')
        return format_html(' '.join(badges)) if badges else '-'

    def save_model(self, request, obj, form, change):
        if not change:  # New object
            obj.granted_by = request.user
        super().save_model(request, obj, form, change)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Filter user dropdown to only show vendor users."""
        if db_field.name == 'user':
            from core.users.models import User

            kwargs['queryset'] = User.objects.filter(role='vendor').order_by('username')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    @admin.action(description='Grant full access (all permissions)')
    def grant_full_access(self, request, queryset):
        updated = queryset.update(
            can_view_basic=True,
            can_view_competitive=True,
            can_view_segments=True,
            can_view_queries=True,
            can_export=True,
        )
        self.message_user(request, f'Granted full access to {updated} vendor access record(s).')

    @admin.action(description='Grant basic access only')
    def grant_basic_access(self, request, queryset):
        updated = queryset.update(
            can_view_basic=True,
            can_view_competitive=False,
            can_view_segments=False,
            can_view_queries=False,
            can_export=False,
        )
        self.message_user(request, f'Set basic access for {updated} vendor access record(s).')

    @admin.action(description='Revoke competitive intelligence access')
    def revoke_competitive_access(self, request, queryset):
        updated = queryset.update(can_view_competitive=False)
        self.message_user(request, f'Revoked competitive access for {updated} vendor access record(s).')


@admin.register(ToolImpression)
class ToolImpressionAdmin(admin.ModelAdmin):
    """Read-only admin for viewing impression data."""

    list_display = ['tool', 'context', 'user', 'position', 'search_query_truncated', 'created_at']
    list_filter = ['context', 'created_at', 'tool']
    search_fields = ['tool__name', 'user__username', 'search_query']
    date_hierarchy = 'created_at'
    list_per_page = 100
    readonly_fields = [
        'tool',
        'user',
        'session_id',
        'context',
        'position',
        'search_query',
        'referrer_tool_id',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False  # Impressions are created programmatically

    def has_change_permission(self, request, obj=None):
        return False  # Read-only

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser  # Only superusers can delete

    @admin.display(description='Search Query')
    def search_query_truncated(self, obj):
        if obj.search_query:
            return obj.search_query[:50] + '...' if len(obj.search_query) > 50 else obj.search_query
        return '-'


@admin.register(ToolEngagement)
class ToolEngagementAdmin(admin.ModelAdmin):
    """Read-only admin for viewing engagement data."""

    list_display = ['tool', 'engagement_type', 'user', 'dwell_time_seconds', 'source_context', 'created_at']
    list_filter = ['engagement_type', 'created_at', 'tool']
    search_fields = ['tool__name', 'user__username']
    date_hierarchy = 'created_at'
    list_per_page = 100
    readonly_fields = [
        'tool',
        'user',
        'session_id',
        'engagement_type',
        'dwell_time_seconds',
        'scroll_depth_percent',
        'destination_url',
        'source_context',
        'metadata',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(ToolCompetitorView)
class ToolCompetitorViewAdmin(admin.ModelAdmin):
    """Read-only admin for viewing competitive data."""

    list_display = ['tool_a', 'tool_b', 'user', 'minutes_between', 'created_at']
    list_filter = ['created_at', 'tool_a', 'tool_b']
    search_fields = ['tool_a__name', 'tool_b__name', 'user__username']
    date_hierarchy = 'created_at'
    list_per_page = 100
    readonly_fields = ['session_id', 'user', 'tool_a', 'tool_b', 'minutes_between', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(ToolDailyStats)
class ToolDailyStatsAdmin(admin.ModelAdmin):
    """Admin for viewing aggregated daily stats."""

    list_display = [
        'tool',
        'date',
        'impressions',
        'page_views',
        'external_clicks',
        'bookmarks_added',
        'ctr_display',
        'engagement_rate_display',
    ]
    list_filter = ['date', 'tool']
    search_fields = ['tool__name']
    date_hierarchy = 'date'
    list_per_page = 50
    readonly_fields = [
        'tool',
        'date',
        'impressions',
        'search_impressions',
        'browse_impressions',
        'recommendation_impressions',
        'page_views',
        'unique_visitors',
        'external_clicks',
        'docs_clicks',
        'pricing_clicks',
        'github_clicks',
        'bookmarks_added',
        'bookmarks_removed',
        'project_adds',
        'reviews',
        'ctr',
        'engagement_rate',
        'avg_dwell_time_seconds',
        'top_search_queries',
        'top_co_viewed_tools',
        'user_roles_breakdown',
        'aggregated_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description='CTR')
    def ctr_display(self, obj):
        return f'{obj.ctr * 100:.1f}%'

    @admin.display(description='Engagement')
    def engagement_rate_display(self, obj):
        return f'{obj.engagement_rate * 100:.1f}%'
