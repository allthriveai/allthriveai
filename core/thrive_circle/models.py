"""Models for the Thrive Circle gamification system."""

import logging
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import F

logger = logging.getLogger(__name__)


class UserTier(models.Model):
    """User's permanent tier based on total XP."""

    TIER_CHOICES = [
        ('ember', 'Ember'),
        ('spark', 'Spark'),
        ('blaze', 'Blaze'),
        ('beacon', 'Beacon'),
        ('phoenix', 'Phoenix'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tier_status')

    # Tier progress
    tier = models.CharField(
        max_length=20, choices=TIER_CHOICES, default='ember', help_text='Current tier based on total XP'
    )
    total_xp = models.IntegerField(
        default=0, validators=[MinValueValidator(0)], help_text='Lifetime XP accumulated (cannot be negative)'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_xp']
        verbose_name = 'User Tier'
        verbose_name_plural = 'User Tiers'
        indexes = [
            models.Index(fields=['tier', '-total_xp']),
            models.Index(fields=['-total_xp']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(total_xp__gte=0), name='total_xp_non_negative'),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.get_tier_display()} ({self.total_xp} XP)'

    def update_tier(self):
        """Update tier based on total XP."""
        if self.total_xp >= 10000:
            new_tier = 'phoenix'
        elif self.total_xp >= 5000:
            new_tier = 'beacon'
        elif self.total_xp >= 2000:
            new_tier = 'blaze'
        elif self.total_xp >= 500:
            new_tier = 'spark'
        else:
            new_tier = 'ember'

        if new_tier != self.tier:
            old_tier = self.tier
            self.tier = new_tier
            self.save()
            # TODO: Send tier upgrade notification in later phase
            return True, old_tier, new_tier
        return False, None, None

    @transaction.atomic
    def add_xp(self, amount, activity_type, description=''):
        """
        Add XP and update tier if threshold crossed.

        Uses atomic transaction and F() expressions to prevent race conditions.
        """
        if amount <= 0:
            raise ValueError(f'XP amount must be positive, got {amount}')

        if amount > 10000:
            logger.warning(
                f'Large XP award: {amount} XP to user {self.user.username}',
                extra={'user_id': self.user.id, 'activity_type': activity_type},
            )

        # Store tier before update for logging
        old_tier = self.tier

        # Atomic XP increment using F() expression to prevent race conditions
        UserTier.objects.filter(pk=self.pk).update(total_xp=F('total_xp') + amount)

        # Refresh to get actual value
        self.refresh_from_db()

        # Create activity record within same transaction
        XPActivity.objects.create(
            user=self.user,
            amount=amount,
            activity_type=activity_type,
            description=description,
            tier_at_time=old_tier,  # Use tier from before XP was added
        )

        # Check for tier upgrade
        upgraded, _, new_tier = self.update_tier()

        # Log tier upgrade
        if upgraded:
            logger.info(
                f'User {self.user.username} upgraded from {old_tier} to {new_tier}',
                extra={
                    'user_id': self.user.id,
                    'old_tier': old_tier,
                    'new_tier': new_tier,
                    'total_xp': self.total_xp,
                    'activity_type': activity_type,
                },
            )

        return self.total_xp


class XPActivity(models.Model):
    """Individual XP-earning activities for tracking and analytics."""

    ACTIVITY_TYPE_CHOICES = [
        ('quiz_complete', 'Quiz Completed'),
        ('project_create', 'Project Created'),
        ('project_update', 'Project Updated'),
        ('comment', 'Comment Posted'),
        ('reaction', 'Reaction Given'),
        ('daily_login', 'Daily Login'),
        ('streak_bonus', 'Streak Bonus'),
        ('weekly_goal', 'Weekly Goal Completed'),
        ('side_quest', 'Side Quest Completed'),
        ('special_event', 'Special Event'),
        ('referral', 'Referral Bonus'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='xp_activities')

    amount = models.IntegerField(help_text='XP amount awarded')
    activity_type = models.CharField(
        max_length=30, choices=ACTIVITY_TYPE_CHOICES, help_text='Type of activity that earned XP'
    )
    description = models.CharField(max_length=255, blank=True, help_text='Human-readable description')

    # Context
    tier_at_time = models.CharField(max_length=20, help_text='User tier when XP was earned')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'XP Activity'
        verbose_name_plural = 'XP Activities'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
            models.Index(fields=['user', 'activity_type']),  # For filtering by user + type
        ]

    def __str__(self):
        return f'{self.user.username} +{self.amount} XP - {self.get_activity_type_display()}'
