"""Referral serializers."""

from rest_framework import serializers

from .models import Referral, ReferralCode


class ReferralCodeSerializer(serializers.ModelSerializer):
    """Serializer for user referral codes.

    Exposes the referral code and usage statistics for a user.
    The user field is read-only and automatically set to the authenticated user.
    """

    username = serializers.ReadOnlyField(source='user.username')
    is_valid = serializers.SerializerMethodField()
    referral_url = serializers.SerializerMethodField()

    class Meta:
        model = ReferralCode
        fields = [
            'id',
            'code',
            'username',
            'created_at',
            'uses_count',
            'max_uses',
            'is_active',
            'expires_at',
            'is_valid',
            'referral_url',
        ]
        read_only_fields = ['id', 'code', 'username', 'created_at', 'uses_count']

    def get_is_valid(self, obj):
        """Check if the referral code is currently valid."""
        return obj.is_valid()

    def get_referral_url(self, obj):
        """Generate a full referral URL.

        Raises:
            AttributeError: If FRONTEND_URL is not configured in settings
        """
        from django.conf import settings

        base_url = settings.FRONTEND_URL  # No fallback - must be configured
        return f'{base_url}/auth?ref={obj.code}'


class ReferralSerializer(serializers.ModelSerializer):
    """Serializer for individual referrals.

    Tracks the relationship between referrer and referred users.
    """

    referrer_username = serializers.ReadOnlyField(source='referrer.username')
    referred_username = serializers.SerializerMethodField()
    referral_code_value = serializers.ReadOnlyField(source='referral_code.code')
    status_display = serializers.ReadOnlyField(source='get_status_display')

    class Meta:
        model = Referral
        fields = [
            'id',
            'referrer_username',
            'referred_username',
            'referral_code_value',
            'created_at',
            'status',
            'status_display',
            'reward_data',
        ]
        read_only_fields = ['id', 'created_at']

    def get_referred_username(self, obj):
        """Get referred user's username if available."""
        return obj.referred_user.username if obj.referred_user else None


class ReferralStatsSerializer(serializers.Serializer):
    """Serializer for referral statistics."""

    total_referrals = serializers.IntegerField()
    pending_referrals = serializers.IntegerField()
    completed_referrals = serializers.IntegerField()
    rewarded_referrals = serializers.IntegerField()
    total_uses = serializers.IntegerField()
