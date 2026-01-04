"""SMS logging models for audit and debugging."""

from django.conf import settings
from django.db import models


class SMSLog(models.Model):
    """
    Track sent SMS messages for audit, debugging, and cost tracking.

    Every SMS sent through the platform is logged here, whether successful or not.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        DELIVERED = 'delivered', 'Delivered'
        FAILED = 'failed', 'Failed'
        UNDELIVERED = 'undelivered', 'Undelivered'

    class MessageType(models.TextChoices):
        BATTLE_INVITATION = 'battle_invitation', 'Battle Invitation'
        BATTLE_RESULT = 'battle_result', 'Battle Result'
        BATTLE_REMINDER = 'battle_reminder', 'Battle Reminder'
        STREAK_ALERT = 'streak_alert', 'Streak Alert'
        PHONE_VERIFICATION = 'phone_verification', 'Phone Verification'
        OTHER = 'other', 'Other'

    # User who triggered the SMS (null for system messages)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sms_logs',
        help_text='User who triggered this SMS',
    )

    # Recipient info
    to_phone = models.CharField(max_length=20, db_index=True, help_text='Recipient phone number')

    # Message details
    message_type = models.CharField(
        max_length=30,
        choices=MessageType.choices,
        default=MessageType.OTHER,
        db_index=True,
    )
    body = models.TextField(help_text='SMS message body')

    # Status tracking
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    provider_message_id = models.CharField(max_length=100, blank=True, help_text='Provider message ID')
    error_code = models.CharField(max_length=20, blank=True, help_text='Error code from provider')
    error_message = models.TextField(blank=True, help_text='Error details')

    # Cost tracking (in USD cents)
    cost_cents = models.IntegerField(null=True, blank=True, help_text='Cost in USD cents')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    # Related object (e.g., battle invitation)
    related_object_type = models.CharField(max_length=50, blank=True, help_text='Type of related object')
    related_object_id = models.IntegerField(null=True, blank=True, help_text='ID of related object')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['to_phone', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['message_type', '-created_at']),
        ]
        verbose_name = 'SMS Log'
        verbose_name_plural = 'SMS Logs'

    def __str__(self):
        return f'SMS to {self.to_phone} ({self.status}) - {self.message_type}'
