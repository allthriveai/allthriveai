"""Serializers for achievement API endpoints."""

from rest_framework import serializers

from .models import Achievement, AchievementProgress, UserAchievement


class AchievementSerializer(serializers.ModelSerializer):
    """Serializer for Achievement model."""

    category_display = serializers.CharField(source='get_category_display', read_only=True)
    criteria_type_display = serializers.CharField(source='get_criteria_type_display', read_only=True)
    rarity_display = serializers.CharField(source='get_rarity_display', read_only=True)

    class Meta:
        model = Achievement
        fields = [
            'id',
            'key',
            'name',
            'description',
            'icon',
            'color_from',
            'color_to',
            'category',
            'category_display',
            'points',
            'criteria_type',
            'criteria_type_display',
            'criteria_value',
            'tracking_field',
            'rarity',
            'rarity_display',
            'is_secret',
            'order',
        ]
        read_only_fields = ['id']


class UserAchievementSerializer(serializers.ModelSerializer):
    """Serializer for UserAchievement model (earned achievements)."""

    achievement = AchievementSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserAchievement
        fields = ['id', 'user', 'username', 'achievement', 'earned_at', 'progress_at_unlock']
        read_only_fields = ['id', 'user', 'earned_at', 'progress_at_unlock']


class AchievementProgressSerializer(serializers.ModelSerializer):
    """Serializer for AchievementProgress model."""

    achievement = AchievementSerializer(read_only=True)
    percentage = serializers.IntegerField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AchievementProgress
        fields = ['id', 'user', 'username', 'achievement', 'current_value', 'percentage', 'is_complete', 'last_updated']
        read_only_fields = ['id', 'user', 'last_updated']
