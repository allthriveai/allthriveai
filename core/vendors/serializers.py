"""
Vendor Analytics Serializers
"""

from rest_framework import serializers

from .models import VendorToolAccess


class VendorToolAccessSerializer(serializers.ModelSerializer):
    """Serializer for tool access permissions."""

    tool_id = serializers.IntegerField(source='tool.id')
    tool_name = serializers.CharField(source='tool.name')
    tool_slug = serializers.CharField(source='tool.slug')
    tool_logo_url = serializers.URLField(source='tool.logo_url', allow_blank=True)

    class Meta:
        model = VendorToolAccess
        fields = [
            'tool_id',
            'tool_name',
            'tool_slug',
            'tool_logo_url',
            'can_view_basic',
            'can_view_competitive',
            'can_view_segments',
            'can_view_queries',
            'can_export',
        ]


class ToolAnalyticsSummarySerializer(serializers.Serializer):
    """Serializer for tool analytics summary."""

    tool = serializers.DictField()
    period = serializers.DictField()
    totals = serializers.DictField()
    daily_stats = serializers.ListField()
    top_search_queries = serializers.ListField(required=False)
    co_viewed_tools = serializers.ListField(required=False)
    engagement_breakdown = serializers.DictField(required=False)
    impression_breakdown = serializers.DictField(required=False)


class TrackImpressionSerializer(serializers.Serializer):
    """Serializer for tracking impressions (from frontend)."""

    tool_ids = serializers.ListField(child=serializers.IntegerField(), required=True)
    context = serializers.ChoiceField(
        choices=[
            'search',
            'browse',
            'project',
            'recommend',
            'compare',
            'profile',
            'homepage',
            'tool_detail',
        ],
        required=True,
    )
    positions = serializers.ListField(
        child=serializers.IntegerField(allow_null=True),
        required=False,
        allow_empty=True,
    )
    search_query = serializers.CharField(required=False, allow_blank=True, max_length=500)


class TrackEngagementSerializer(serializers.Serializer):
    """Serializer for tracking engagements (from frontend)."""

    tool_id = serializers.IntegerField(required=True)
    engagement_type = serializers.ChoiceField(
        choices=[
            'page_view',
            'external_click',
            'docs_click',
            'pricing_click',
            'github_click',
            'bookmark',
            'unbookmark',
            'project_add',
            'project_remove',
            'review',
            'compare_add',
        ],
        required=True,
    )
    dwell_time_seconds = serializers.IntegerField(required=False, allow_null=True)
    scroll_depth_percent = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    destination_url = serializers.URLField(required=False, allow_blank=True)
    source_context = serializers.CharField(required=False, allow_blank=True, max_length=50)
