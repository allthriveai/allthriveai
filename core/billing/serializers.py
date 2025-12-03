"""
Billing API Serializers
"""

from rest_framework import serializers

from .models import (
    SubscriptionChange,
    SubscriptionTier,
    TokenPackage,
    TokenPurchase,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
)


class SubscriptionTierSerializer(serializers.ModelSerializer):
    """Serializer for subscription tier information."""

    class Meta:
        model = SubscriptionTier
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'tier_type',
            'price_monthly',
            'price_annual',
            'trial_period_days',
            'monthly_ai_requests',
            'has_marketplace_access',
            'has_go1_courses',
            'has_ai_mentor',
            'has_quests',
            'has_circles',
            'has_projects',
            'has_creator_tools',
            'has_analytics',
            'is_active',
            'stripe_price_id_monthly',
            'stripe_price_id_annual',
        ]
        read_only_fields = fields


class UserSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for user subscription details."""

    tier = SubscriptionTierSerializer(read_only=True)
    ai_requests_remaining = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = [
            'tier',
            'status',
            'current_period_start',
            'current_period_end',
            'trial_start',
            'trial_end',
            'canceled_at',
            'ai_requests_used_this_month',
            'ai_requests_remaining',
            'ai_requests_reset_date',
        ]
        read_only_fields = fields

    def get_ai_requests_remaining(self, obj):
        """Calculate remaining AI requests for the month."""
        if obj.tier.monthly_ai_requests == 0:
            return None  # Unlimited
        return max(0, obj.tier.monthly_ai_requests - obj.ai_requests_used_this_month)


class TokenPackageSerializer(serializers.ModelSerializer):
    """Serializer for token package information."""

    price_per_token = serializers.DecimalField(max_digits=10, decimal_places=4, read_only=True)

    class Meta:
        model = TokenPackage
        fields = [
            'slug',
            'name',
            'description',
            'package_type',
            'token_amount',
            'price',
            'price_per_token',
        ]
        read_only_fields = fields


class UserTokenBalanceSerializer(serializers.ModelSerializer):
    """Serializer for user token balance."""

    class Meta:
        model = UserTokenBalance
        fields = [
            'balance',
            'total_purchased',
            'total_used',
            'last_purchase_date',
        ]
        read_only_fields = fields


class TokenPurchaseSerializer(serializers.ModelSerializer):
    """Serializer for token purchase records."""

    package = TokenPackageSerializer(read_only=True)

    class Meta:
        model = TokenPurchase
        fields = [
            'id',
            'package',
            'token_amount',
            'price_paid',
            'status',
            'created_at',
            'completed_at',
        ]
        read_only_fields = fields


class TokenTransactionSerializer(serializers.ModelSerializer):
    """Serializer for token transaction history."""

    class Meta:
        model = TokenTransaction
        fields = [
            'id',
            'transaction_type',
            'amount',
            'balance_after',
            'description',
            'ai_provider',
            'ai_model',
            'created_at',
        ]
        read_only_fields = fields


class SubscriptionChangeSerializer(serializers.ModelSerializer):
    """Serializer for subscription change history."""

    from_tier = SubscriptionTierSerializer(read_only=True)
    to_tier = SubscriptionTierSerializer(read_only=True)

    class Meta:
        model = SubscriptionChange
        fields = [
            'id',
            'change_type',
            'from_tier',
            'to_tier',
            'reason',
            'effective_date',
            'created_at',
        ]
        read_only_fields = fields


# Write Serializers (for POST/PUT requests)


class CreateSubscriptionSerializer(serializers.Serializer):
    """Serializer for creating a new subscription."""

    tier_slug = serializers.SlugField()
    billing_interval = serializers.ChoiceField(
        choices=['monthly', 'annual'],
        default='monthly',
        required=False,
        help_text='Billing interval: monthly or annual',
    )

    def validate_tier_slug(self, value):
        """Validate that the tier exists and is active."""
        try:
            tier = SubscriptionTier.objects.get(slug=value, is_active=True)
            if tier.tier_type == 'free':
                raise serializers.ValidationError('Cannot subscribe to free tier')
            return value
        except SubscriptionTier.DoesNotExist as e:
            raise serializers.ValidationError('Invalid tier') from e


class UpdateSubscriptionSerializer(serializers.Serializer):
    """Serializer for updating an existing subscription."""

    tier_slug = serializers.SlugField()

    def validate_tier_slug(self, value):
        """Validate that the tier exists and is active."""
        try:
            SubscriptionTier.objects.get(slug=value, is_active=True)
            return value
        except SubscriptionTier.DoesNotExist as e:
            raise serializers.ValidationError('Invalid tier') from e


class CancelSubscriptionSerializer(serializers.Serializer):
    """Serializer for canceling a subscription."""

    immediate = serializers.BooleanField(default=False, help_text='Cancel immediately instead of at period end')


class CreateTokenPurchaseSerializer(serializers.Serializer):
    """Serializer for creating a token purchase."""

    package_slug = serializers.SlugField()

    def validate_package_slug(self, value):
        """Validate that the package exists and is active."""
        try:
            TokenPackage.objects.get(slug=value, is_active=True)
            return value
        except TokenPackage.DoesNotExist as e:
            raise serializers.ValidationError('Invalid package') from e


class SubscriptionStatusSerializer(serializers.Serializer):
    """Serializer for complete subscription status response."""

    has_subscription = serializers.BooleanField()
    tier = serializers.DictField(required=False)
    status = serializers.CharField()
    is_active = serializers.BooleanField(required=False)
    is_trial = serializers.BooleanField(required=False)
    current_period_end = serializers.DateTimeField(required=False, allow_null=True)
    trial_end = serializers.DateTimeField(required=False, allow_null=True)
    ai_requests = serializers.DictField(required=False)
    tokens = serializers.DictField(required=False)
    features = serializers.DictField(required=False)
