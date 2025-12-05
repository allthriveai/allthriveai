"""
Vendor Analytics Models

Models for tracking tool analytics and managing vendor access.

Key concepts:
- VendorToolAccess: Links vendor users to tools they can see analytics for
- ToolImpression: Every time a tool appears on screen (search results, listings, etc.)
- ToolEngagement: Meaningful actions (page views, clicks, bookmarks, etc.)
- ToolCompetitorView: Tracks which tools are viewed in the same session
- ToolDailyStats: Pre-aggregated daily metrics for fast dashboard queries
"""

from django.conf import settings
from django.db import models


class VendorToolAccess(models.Model):
    """
    Links vendor users to the tools they can view analytics for.

    Admin manually creates these records to grant access.
    A vendor user can have access to multiple tools (e.g., Anthropic employee
    might have access to Claude, Claude API, etc.)
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vendor_tool_access',
        limit_choices_to={'role': 'vendor'},
        help_text='Vendor user who has access to this tool analytics',
    )
    tool = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='vendor_access',
        help_text='Tool this vendor has analytics access to',
    )

    # Access level (for future use)
    can_view_basic = models.BooleanField(default=True, help_text='Can view impressions, views, clicks')
    can_view_competitive = models.BooleanField(default=False, help_text='Can view "also viewed" data')
    can_view_segments = models.BooleanField(default=False, help_text='Can view user segment breakdown')
    can_view_queries = models.BooleanField(default=False, help_text='Can view discovery search queries')
    can_export = models.BooleanField(default=False, help_text='Can export data')

    # Metadata
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendor_access_granted',
        help_text='Admin who granted this access',
    )
    notes = models.TextField(blank=True, help_text='Internal notes about this access grant')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vendor Tool Access'
        verbose_name_plural = 'Vendor Tool Access'
        unique_together = ['user', 'tool']
        ordering = ['user__username', 'tool__name']

    def __str__(self):
        return f'{self.user.username} -> {self.tool.name}'


class ToolImpression(models.Model):
    """
    Track every time a tool appears on a user's screen.

    This is the foundation of all analytics - we track impressions in:
    - Search results
    - Directory browsing
    - Project detail pages (tools used)
    - Recommendations
    - Comparisons
    - User profiles

    High-volume table - designed for write performance with minimal indexes.
    Aggregated into ToolDailyStats for fast reads.
    """

    class ImpressionContext(models.TextChoices):
        SEARCH_RESULT = 'search', 'Search Result'
        DIRECTORY_BROWSE = 'browse', 'Directory Browse'
        PROJECT_DETAIL = 'project', 'Project Detail'
        RECOMMENDATION = 'recommend', 'Recommendation'
        COMPARISON = 'compare', 'Comparison'
        PROFILE = 'profile', 'User Profile'
        HOMEPAGE = 'homepage', 'Homepage'
        TOOL_DETAIL = 'tool_detail', 'Tool Detail (Related)'

    tool = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='impressions',
    )

    # User identification (privacy-respecting)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='Authenticated user (null for anonymous)',
    )
    session_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text='Session ID for anonymous user tracking',
    )

    # Context
    context = models.CharField(max_length=20, choices=ImpressionContext.choices)
    position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Position in list (1-indexed) for CTR calculation',
    )

    # Attribution
    search_query = models.CharField(
        max_length=500,
        blank=True,
        help_text='Search query if impression came from search',
    )
    referrer_tool_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Tool ID if impression came from "related tools"',
    )

    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Tool Impression'
        verbose_name_plural = 'Tool Impressions'
        indexes = [
            # Primary query: tool + date range
            models.Index(fields=['tool', '-created_at']),
            # For session analysis
            models.Index(fields=['session_id', '-created_at']),
            # For context breakdown
            models.Index(fields=['tool', 'context', '-created_at']),
        ]

    def __str__(self):
        return f'{self.tool.name} - {self.context} @ {self.created_at}'


class ToolEngagement(models.Model):
    """
    Track meaningful actions beyond impressions.

    Engagements are higher-value signals than impressions:
    - Page view: User clicked through to tool detail page
    - External click: User clicked to tool's website (high intent)
    - Bookmark: User saved tool for later
    - Project add: User added tool to their project
    - Review: User left a review
    """

    class EngagementType(models.TextChoices):
        PAGE_VIEW = 'page_view', 'Viewed Tool Page'
        EXTERNAL_CLICK = 'external_click', 'Clicked Website'
        DOCS_CLICK = 'docs_click', 'Clicked Documentation'
        PRICING_CLICK = 'pricing_click', 'Clicked Pricing'
        GITHUB_CLICK = 'github_click', 'Clicked GitHub'
        BOOKMARK = 'bookmark', 'Bookmarked'
        UNBOOKMARK = 'unbookmark', 'Removed Bookmark'
        PROJECT_ADD = 'project_add', 'Added to Project'
        PROJECT_REMOVE = 'project_remove', 'Removed from Project'
        REVIEW = 'review', 'Left Review'
        COMPARISON_ADD = 'compare_add', 'Added to Comparison'

    tool = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='engagements',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    session_id = models.CharField(max_length=64)

    engagement_type = models.CharField(max_length=20, choices=EngagementType.choices)

    # For page_view engagements
    dwell_time_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Time spent on page in seconds',
    )
    scroll_depth_percent = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='How far user scrolled (0-100)',
    )

    # For click engagements
    destination_url = models.URLField(
        blank=True,
        help_text='URL clicked (for external clicks)',
    )

    # Attribution
    source_context = models.CharField(
        max_length=50,
        blank=True,
        help_text='Where user came from (search, browse, recommendation)',
    )

    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional engagement-specific data',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Tool Engagement'
        verbose_name_plural = 'Tool Engagements'
        indexes = [
            models.Index(fields=['tool', 'engagement_type', '-created_at']),
            models.Index(fields=['tool', '-created_at']),
            models.Index(fields=['session_id', '-created_at']),
        ]

    def __str__(self):
        return f'{self.tool.name} - {self.engagement_type} @ {self.created_at}'


class ToolCompetitorView(models.Model):
    """
    Track which tools are viewed together in the same session.

    This powers "also viewed" competitive intelligence.
    Created when a user views multiple tool pages in one session.
    """

    session_id = models.CharField(max_length=64, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    # The two tools viewed in same session (ordered: tool_a.id < tool_b.id)
    tool_a = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='competitor_views_a',
    )
    tool_b = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='competitor_views_b',
    )

    # Time between views (for relevance scoring)
    minutes_between = models.PositiveIntegerField(
        default=0,
        help_text='Minutes between viewing tool_a and tool_b',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Tool Competitor View'
        verbose_name_plural = 'Tool Competitor Views'
        # Ensure consistent ordering: tool_a.id < tool_b.id
        unique_together = ['session_id', 'tool_a', 'tool_b']
        indexes = [
            models.Index(fields=['tool_a', '-created_at']),
            models.Index(fields=['tool_b', '-created_at']),
        ]

    def __str__(self):
        return f'{self.tool_a.name} <-> {self.tool_b.name}'

    def save(self, *args, **kwargs):
        # Ensure consistent ordering: tool_a.id < tool_b.id
        if self.tool_a_id > self.tool_b_id:
            self.tool_a_id, self.tool_b_id = self.tool_b_id, self.tool_a_id
        super().save(*args, **kwargs)


class ToolDailyStats(models.Model):
    """
    Pre-aggregated daily statistics for fast dashboard queries.

    Updated by scheduled Celery task (aggregate_tool_daily_stats).
    This is what vendors see in their dashboard.
    """

    tool = models.ForeignKey(
        'core.Tool',
        on_delete=models.CASCADE,
        related_name='daily_stats',
    )
    date = models.DateField(db_index=True)

    # Volume metrics
    impressions = models.PositiveIntegerField(default=0)
    search_impressions = models.PositiveIntegerField(default=0)
    browse_impressions = models.PositiveIntegerField(default=0)
    recommendation_impressions = models.PositiveIntegerField(default=0)

    # Engagement metrics
    page_views = models.PositiveIntegerField(default=0)
    unique_visitors = models.PositiveIntegerField(default=0)
    external_clicks = models.PositiveIntegerField(default=0)
    docs_clicks = models.PositiveIntegerField(default=0)
    pricing_clicks = models.PositiveIntegerField(default=0)
    github_clicks = models.PositiveIntegerField(default=0)
    bookmarks_added = models.PositiveIntegerField(default=0)
    bookmarks_removed = models.PositiveIntegerField(default=0)
    project_adds = models.PositiveIntegerField(default=0)
    reviews = models.PositiveIntegerField(default=0)

    # Calculated metrics
    ctr = models.FloatField(
        default=0,
        help_text='Click-through rate: page_views / impressions',
    )
    engagement_rate = models.FloatField(
        default=0,
        help_text='Engagement rate: (external_clicks + bookmarks) / page_views',
    )
    avg_dwell_time_seconds = models.FloatField(
        default=0,
        help_text='Average time on page in seconds',
    )

    # Top search queries that led to impressions
    top_search_queries = models.JSONField(
        default=list,
        blank=True,
        help_text='Top 10 search queries: [{query, count}]',
    )

    # Competitive data
    top_co_viewed_tools = models.JSONField(
        default=list,
        blank=True,
        help_text='Top 10 co-viewed tools: [{tool_id, tool_name, count}]',
    )

    # User segments (only for vendors with segment access)
    user_roles_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text='Breakdown by user role: {role: count}',
    )

    # Metadata
    aggregated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tool Daily Stats'
        verbose_name_plural = 'Tool Daily Stats'
        unique_together = ['tool', 'date']
        ordering = ['-date']
        indexes = [
            models.Index(fields=['tool', '-date']),
        ]

    def __str__(self):
        return f'{self.tool.name} - {self.date}'

    def calculate_rates(self):
        """Calculate CTR and engagement rate."""
        if self.impressions > 0:
            self.ctr = round(self.page_views / self.impressions, 4)
        else:
            self.ctr = 0

        if self.page_views > 0:
            engagement_actions = self.external_clicks + self.bookmarks_added + self.project_adds
            self.engagement_rate = round(engagement_actions / self.page_views, 4)
        else:
            self.engagement_rate = 0
