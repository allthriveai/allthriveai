"""Serializers for Thrive Circle API."""

from rest_framework import serializers

from .models import UserTier, XPActivity
from .services import XPConfig


class XPActivitySerializer(serializers.ModelSerializer):
    """Serializer for XP activity records."""

    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = XPActivity
        fields = [
            'id',
            'user',
            'username',
            'amount',
            'activity_type',
            'activity_type_display',
            'description',
            'tier_at_time',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'tier_at_time']


class UserTierSerializer(serializers.ModelSerializer):
    """Serializer for user tier status."""

    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    recent_activities = XPActivitySerializer(source='user.xp_activities', many=True, read_only=True)

    class Meta:
        model = UserTier
        fields = [
            'id',
            'user',
            'username',
            'tier',
            'tier_display',
            'total_xp',
            'created_at',
            'updated_at',
            'recent_activities',
        ]
        read_only_fields = ['id', 'user', 'tier', 'created_at', 'updated_at']


class AwardXPSerializer(serializers.Serializer):
    """Serializer for awarding XP to a user."""

    amount = serializers.IntegerField(
        min_value=1,
        max_value=XPConfig.MAX_SINGLE_AWARD,
        help_text=f'Amount of XP to award (1-{XPConfig.MAX_SINGLE_AWARD})',
    )
    activity_type = serializers.ChoiceField(
        choices=XPActivity.ACTIVITY_TYPE_CHOICES, help_text='Type of activity that earned the XP'
    )
    description = serializers.CharField(
        max_length=255, required=False, allow_blank=True, help_text='Optional human-readable description'
    )

    # Activity types that can only be awarded internally (not via public API)
    INTERNAL_ONLY_ACTIVITIES = {
        'quiz_complete',
        'project_create',
        'project_update',
        'daily_login',
        'streak_bonus',
        'weekly_goal',
    }

    def validate_amount(self, value):
        """Ensure amount is positive and within limits."""
        if value <= 0:
            raise serializers.ValidationError('XP amount must be positive')
        if value > XPConfig.MAX_SINGLE_AWARD:
            raise serializers.ValidationError(f'Single XP award cannot exceed {XPConfig.MAX_SINGLE_AWARD}')
        return value

    def validate_activity_type(self, value):
        """Prevent external callers from awarding internal-only activity types."""
        if value in self.INTERNAL_ONLY_ACTIVITIES:
            raise serializers.ValidationError(f"Activity type '{value}' can only be awarded by the system, not via API")
        return value
