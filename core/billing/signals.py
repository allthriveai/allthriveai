"""
Billing Signals

Handles automatic creation of billing records when users are created.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_billing_records(sender, instance, created, **kwargs):
    """
    Create UserSubscription and UserTokenBalance for new users.

    New users are automatically assigned to the Free/Explorer tier.
    """
    if created:
        from .models import SubscriptionTier, UserSubscription, UserTokenBalance

        # Get or create Free tier
        free_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='free',
            defaults={
                'slug': 'free-explorer',
                'name': 'Free / Explorer',
                'description': 'Free tier with basic access',
                'price_monthly': 0,
                'price_annual': 0,
                'monthly_ai_requests': 100,  # Default limit, will be updated by seed command
                'is_active': True,
                'display_order': 0,
            },
        )

        # Create subscription
        UserSubscription.objects.create(
            user=instance,
            tier=free_tier,
            status='active',
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=90),  # 1 quarter
            ai_requests_reset_date=timezone.now().date(),
        )

        # Create token balance
        UserTokenBalance.objects.create(
            user=instance,
            balance=0,
        )
