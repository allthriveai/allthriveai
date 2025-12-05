"""Models for email notification tracking and preferences."""

import secrets

from django.conf import settings
from django.db import models


class EmailLog(models.Model):
    """Track all sent emails for debugging and analytics.

    Each email sent through the system creates a log entry, allowing us to:
    - Debug delivery issues
    - Track email engagement (future: open rates, click rates)
    - Audit what communications users received
    - Handle bounces and complaints via SES message ID
    """

    class Status(models.TextChoices):
        """Email delivery status."""

        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        BOUNCED = 'bounced', 'Bounced'
        COMPLAINED = 'complained', 'Complained'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_logs',
        help_text='User who received the email',
    )
    email_type = models.CharField(
        max_length=50,
        help_text='Type of email (e.g., billing/low_balance)',
    )
    subject = models.CharField(
        max_length=200,
        help_text='Email subject line',
    )
    recipient_email = models.EmailField(
        help_text='Email address the message was sent to',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(
        blank=True,
        help_text='Error details if send failed',
    )
    ses_message_id = models.CharField(
        max_length=100,
        blank=True,
        help_text='AWS SES Message ID for tracking bounces/complaints',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['ses_message_id']),
            models.Index(fields=['created_at']),  # For log cleanup jobs
        ]
        verbose_name = 'Email Log'
        verbose_name_plural = 'Email Logs'

    def __str__(self) -> str:
        return f'{self.email_type} to {self.recipient_email} ({self.status})'


class EmailPreferences(models.Model):
    """User email notification preferences.

    Controls which categories of email a user wants to receive.
    Includes a secure unsubscribe token for one-click unsubscribe.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_preferences',
    )

    # Category preferences (all default True except marketing)
    email_billing = models.BooleanField(
        default=True,
        help_text='Receive billing and account-related emails (transactional)',
    )
    email_welcome = models.BooleanField(
        default=True,
        help_text='Receive welcome and onboarding emails',
    )
    email_battles = models.BooleanField(
        default=True,
        help_text='Receive prompt battle invitations and results',
    )
    email_achievements = models.BooleanField(
        default=True,
        help_text='Receive achievement unlock notifications',
    )
    email_social = models.BooleanField(
        default=True,
        help_text='Receive social notifications (followers, comments)',
    )
    email_quests = models.BooleanField(
        default=True,
        help_text='Receive quest assignments and streak reminders',
    )
    email_marketing = models.BooleanField(
        default=False,
        help_text='Receive marketing and promotional emails (opt-in only)',
    )

    # Secure unsubscribe token
    unsubscribe_token = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
        help_text='Secure token for one-click unsubscribe',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Email Preferences'
        verbose_name_plural = 'Email Preferences'

    def __str__(self) -> str:
        return f'Email preferences for {self.user}'

    def save(self, *args, **kwargs):
        """Generate unsubscribe token if not set."""
        if not self.unsubscribe_token:
            self.unsubscribe_token = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def is_category_enabled(self, category: str) -> bool:
        """Check if a category is enabled for this user.

        Args:
            category: Category name (e.g., 'billing', 'battles')

        Returns:
            True if the category is enabled, False otherwise
        """
        field_name = f'email_{category}'
        return getattr(self, field_name, True)
