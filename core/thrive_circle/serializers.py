"""Serializers for Thrive Circle API."""

import json
import sys

from rest_framework import serializers

from core.users.models import User

from .models import PointActivity, QuestCategory, SideQuest, UserSideQuest, WeeklyGoal
from .services import PointsConfig

# Maximum sizes for JSON fields to prevent abuse
MAX_REQUIREMENTS_SIZE = 4096  # 4KB
MAX_STEPS_SIZE = 32768  # 32KB (steps can be larger due to narrative content)
MAX_PROGRESS_DATA_SIZE = 8192  # 8KB


def validate_json_size(value, max_size: int, field_name: str):
    """
    Validate that a JSON field doesn't exceed maximum size.

    Args:
        value: The JSON value (dict or list)
        max_size: Maximum allowed size in bytes
        field_name: Name of the field for error message

    Raises:
        serializers.ValidationError: If size exceeds limit
    """
    if value is None:
        return value

    try:
        size = sys.getsizeof(json.dumps(value))
        if size > max_size:
            raise serializers.ValidationError(
                f'{field_name} exceeds maximum size of {max_size} bytes (got {size} bytes)'
            )
    except (TypeError, ValueError) as e:
        raise serializers.ValidationError(f'{field_name} contains invalid JSON: {e}') from e

    return value


class PointActivitySerializer(serializers.ModelSerializer):
    """Serializer for point activity records."""

    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PointActivity
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


class UserPointsSerializer(serializers.ModelSerializer):
    """Serializer for user points/gamification status."""

    tier_display = serializers.CharField(read_only=True)
    recent_activities = PointActivitySerializer(source='point_activities', many=True, read_only=True)
    points_to_next_level = serializers.IntegerField(read_only=True)
    points_to_next_tier = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'tier',
            'tier_display',
            'total_points',
            'level',
            # Progress helpers
            'points_to_next_level',
            'points_to_next_tier',
            # Streak fields
            'current_streak_days',
            'longest_streak_days',
            'last_activity_date',
            # Lifetime stats
            'lifetime_quizzes_completed',
            'lifetime_projects_created',
            'lifetime_side_quests_completed',
            'lifetime_comments_posted',
            # Activities
            'recent_activities',
        ]
        read_only_fields = ['id', 'username', 'tier', 'total_points', 'level']


class AwardPointsSerializer(serializers.Serializer):
    """Serializer for awarding points to a user."""

    amount = serializers.IntegerField(
        min_value=1,
        max_value=PointsConfig.MAX_SINGLE_AWARD,
        help_text=f'Amount of points to award (1-{PointsConfig.MAX_SINGLE_AWARD})',
    )
    activity_type = serializers.ChoiceField(
        choices=PointActivity.ACTIVITY_TYPE_CHOICES, help_text='Type of activity that earned the points'
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
            raise serializers.ValidationError('Points amount must be positive')
        if value > PointsConfig.MAX_SINGLE_AWARD:
            raise serializers.ValidationError(f'Single points award cannot exceed {PointsConfig.MAX_SINGLE_AWARD}')
        return value

    def validate_activity_type(self, value):
        """Prevent external callers from awarding internal-only activity types."""
        if value in self.INTERNAL_ONLY_ACTIVITIES:
            raise serializers.ValidationError(f"Activity type '{value}' can only be awarded by the system, not via API")
        return value


class WeeklyGoalSerializer(serializers.ModelSerializer):
    """Serializer for weekly goals."""

    goal_type_display = serializers.CharField(source='get_goal_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)

    class Meta:
        model = WeeklyGoal
        fields = [
            'id',
            'user',
            'username',
            'goal_type',
            'goal_type_display',
            'week_start',
            'week_end',
            'current_progress',
            'target_progress',
            'progress_percentage',
            'is_completed',
            'completed_at',
            'points_reward',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'is_completed', 'completed_at']


class QuestCategorySerializer(serializers.ModelSerializer):
    """Serializer for Quest Categories/Pathways."""

    category_type_display = serializers.CharField(source='get_category_type_display', read_only=True)
    quest_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = QuestCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'category_type',
            'category_type_display',
            'icon',
            'color_from',
            'color_to',
            'completion_bonus_points',
            'order',
            'is_active',
            'is_featured',
            'quest_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class QuestCategoryDetailSerializer(QuestCategorySerializer):
    """Detailed serializer with quests included."""

    quests = serializers.SerializerMethodField()

    class Meta(QuestCategorySerializer.Meta):
        fields = QuestCategorySerializer.Meta.fields + ['quests']

    def get_quests(self, obj):
        quests = obj.quests.filter(is_active=True).order_by('order')
        return SideQuestSerializer(quests, many=True).data


class SideQuestSerializer(serializers.ModelSerializer):
    """Serializer for Side Quest definitions."""

    quest_type_display = serializers.CharField(source='get_quest_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    topic_display = serializers.CharField(source='get_topic_display', read_only=True, allow_null=True)
    skill_level_display = serializers.CharField(source='get_skill_level_display', read_only=True, allow_null=True)
    is_available = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True, allow_null=True)
    step_count = serializers.SerializerMethodField()

    class Meta:
        model = SideQuest
        fields = [
            'id',
            'title',
            'description',
            'quest_type',
            'quest_type_display',
            'difficulty',
            'difficulty_display',
            'category',
            'category_name',
            'category_slug',
            'topic',
            'topic_display',
            'skill_level',
            'skill_level_display',
            'requirements',
            'points_reward',
            'order',
            'is_daily',
            'is_repeatable',
            'is_active',
            'is_available',
            'starts_at',
            'expires_at',
            # Multi-step guided quest fields
            'is_guided',
            'steps',
            'narrative_intro',
            'narrative_complete',
            'estimated_minutes',
            'step_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_available(self, obj):
        """Check if quest is currently available."""
        return obj.is_available()

    def get_step_count(self, obj):
        """Get the number of steps in a guided quest."""
        if obj.is_guided and obj.steps:
            return len(obj.steps)
        return 0


class UserSideQuestSerializer(serializers.ModelSerializer):
    """Serializer for User Side Quest progress."""

    side_quest = SideQuestSerializer(read_only=True)
    side_quest_id = serializers.UUIDField(write_only=True, required=False)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)

    # Multi-step guided quest progress fields
    current_step = serializers.SerializerMethodField()
    next_step_url = serializers.SerializerMethodField()
    steps_progress = serializers.SerializerMethodField()

    def validate_progress_data(self, value):
        """Validate progress_data JSON field size."""
        return validate_json_size(value, MAX_PROGRESS_DATA_SIZE, 'progress_data')

    class Meta:
        model = UserSideQuest
        fields = [
            'id',
            'user',
            'username',
            'side_quest',
            'side_quest_id',
            'status',
            'status_display',
            'current_progress',
            'target_progress',
            'progress_percentage',
            'progress_data',
            # Multi-step guided quest progress
            'current_step_index',
            'completed_step_ids',
            'step_completed_at',
            'current_step',
            'next_step_url',
            'steps_progress',
            'is_completed',
            'completed_at',
            'points_awarded',
            'started_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'started_at',
            'updated_at',
            'is_completed',
            'completed_at',
            'points_awarded',
        ]

    def get_current_step(self, obj):
        """Get the current step for guided quests."""
        return obj.get_current_step()

    def get_next_step_url(self, obj):
        """Get the destination URL for the current step."""
        return obj.get_next_step_url()

    def get_steps_progress(self, obj):
        """Get progress for all steps in the quest."""
        return obj.get_steps_progress()
