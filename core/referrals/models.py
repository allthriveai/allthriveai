import logging

from django.db import models
from django.utils.crypto import get_random_string

from core.users.models import User

logger = logging.getLogger(__name__)


def generate_referral_code():
    """Generate a referral code placeholder.

    Note: Actual code will be set from username in the view.
    This is just a fallback for migrations/edge cases.
    """
    code = get_random_string(8, allowed_chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789").upper()
    return code


class ReferralCode(models.Model):
    """Model to store user referral codes.

    Each user gets one referral code that they can share with others.
    Tracks usage statistics and can be disabled or set to expire.
    """

    code = models.CharField(
        max_length=50,  # Increased to support username-based codes
        unique=True,
        default=generate_referral_code,
        help_text="Unique referral code (typically username)",
    )
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="referral_code", help_text="User who owns this referral code"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uses_count = models.IntegerField(default=0, help_text="Number of times this code has been used")
    max_uses = models.IntegerField(null=True, blank=True, help_text="Maximum number of uses (null = unlimited)")
    is_active = models.BooleanField(default=True, help_text="Whether this code can be used")
    expires_at = models.DateTimeField(null=True, blank=True, help_text="When this code expires (null = never expires)")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.code} ({self.user.username})"

    def is_valid(self):
        """Check if the referral code is currently valid."""
        from django.utils import timezone

        if not self.is_active:
            return False

        if self.max_uses and self.uses_count >= self.max_uses:
            return False

        if self.expires_at and timezone.now() > self.expires_at:
            return False

        return True

    def increment_usage(self):
        """Atomically increment the usage count to prevent race conditions."""
        from django.db.models import F

        # Atomic update to prevent race conditions
        ReferralCode.objects.filter(pk=self.pk).update(uses_count=F("uses_count") + 1)
        self.refresh_from_db(fields=["uses_count"])

        logger.info(f"Referral code {self.code} usage incremented to {self.uses_count}")


class ReferralStatus(models.TextChoices):
    """Status options for referrals."""

    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    REWARDED = "rewarded", "Rewarded"
    CANCELLED = "cancelled", "Cancelled"


class Referral(models.Model):
    """Model to track individual referrals.

    Records when someone signs up using a referral code,
    creating a relationship between the referrer and the referred user.
    """

    referrer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="referrals_made", help_text="User who made the referral"
    )
    referred_user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="referred_by",
        help_text="User who was referred",
        null=True,
        blank=True,
    )
    referral_code = models.ForeignKey(
        ReferralCode, on_delete=models.CASCADE, related_name="referrals", help_text="The referral code that was used"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=ReferralStatus.choices,
        default=ReferralStatus.PENDING,
        help_text="Current status of the referral",
    )
    notes = models.TextField(blank=True, help_text="Internal notes about this referral")
    reward_data = models.JSONField(default=dict, blank=True, help_text="Data about rewards given for this referral")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["referrer", "status"]),
            models.Index(fields=["referred_user"]),
            models.Index(fields=["referral_code", "-created_at"]),
        ]

    def __str__(self):
        referred = self.referred_user.username if self.referred_user else "Unknown"
        return f"{self.referrer.username} → {referred} ({self.get_status_display()})"

    def mark_completed(self):
        """Mark the referral as completed."""
        if self.status == ReferralStatus.PENDING:
            self.status = ReferralStatus.COMPLETED
            self.save(update_fields=["status"])
            logger.info(
                f"Referral {self.id} marked as completed: "
                f"{self.referrer.username} → {self.referred_user.username if self.referred_user else 'Unknown'}"
            )

    def mark_rewarded(self, reward_info=None):
        """Mark the referral as rewarded."""
        if self.status in [ReferralStatus.PENDING, ReferralStatus.COMPLETED]:
            old_status = self.status
            self.status = ReferralStatus.REWARDED
            if reward_info:
                self.reward_data.update(reward_info)
            self.save(update_fields=["status", "reward_data"])
            logger.info(
                f"Referral {self.id} marked as rewarded (was {old_status}): "
                f"{self.referrer.username} → {self.referred_user.username if self.referred_user else 'Unknown'}"
            )
