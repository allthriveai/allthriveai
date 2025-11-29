"""Event models for calendar functionality."""

import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, URLValidator
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class Event(models.Model):
    """Model representing a calendar event."""

    title = models.CharField(max_length=200, help_text='Event title')
    description = models.TextField(blank=True, help_text='Detailed description of the event')
    start_date = models.DateTimeField(help_text='Event start date and time')
    end_date = models.DateTimeField(help_text='Event end date and time')
    location = models.CharField(max_length=255, blank=True, help_text='Event location (physical or virtual)')
    event_url = models.URLField(blank=True, help_text='URL for event registration or more info')
    is_all_day = models.BooleanField(default=False, help_text='Whether this is an all-day event')
    color = models.CharField(
        max_length=7,
        default='#3b82f6',
        validators=[
            RegexValidator(
                regex=r'^#[0-9A-Fa-f]{6}$',
                message='Color must be a valid hex code (e.g., #3b82f6)',
            )
        ],
        help_text='Hex color code for calendar display (e.g., #3b82f6)',
    )
    thumbnail = models.URLField(
        blank=True,
        validators=[URLValidator(schemes=['https'])],
        help_text='URL to event thumbnail image (must be https)',
    )
    timezone_name = models.CharField(
        max_length=63,
        default='UTC',
        help_text='Timezone for event (e.g., America/New_York, UTC)',
    )

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_events',
        help_text='Admin user who created this event',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_events',
        help_text='Last admin user who updated this event',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=True, help_text='Whether event is visible to users')

    class Meta:
        ordering = ['start_date']
        verbose_name = 'Event'
        verbose_name_plural = 'Events'
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['is_published']),
        ]

    def __str__(self):
        return f'{self.title} ({self.start_date.strftime("%Y-%m-%d")})'

    @property
    def is_past(self):
        """Check if event has already ended."""
        return self.end_date < timezone.now()

    @property
    def is_upcoming(self):
        """Check if event is in the future."""
        return self.start_date > timezone.now()

    @property
    def is_ongoing(self):
        """Check if event is currently happening."""
        now = timezone.now()
        return self.start_date <= now <= self.end_date

    def clean(self):
        """Validate event data."""
        super().clean()

        # Validate dates
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError('End date must be after start date.')

        # Validate event_url if provided
        if self.event_url and not self.event_url.startswith('https://'):
            raise ValidationError('Event URL must use HTTPS protocol.')

        # Log validation for audit
        if self.pk:
            logger.info(f'Event {self.pk} ({self.title}) validated successfully')
