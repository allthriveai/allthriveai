"""Models for invitation request management."""

from django.conf import settings
from django.db import models


class InvitationRequest(models.Model):
    """Track requests from users wanting to join the platform.

    When a user submits a request:
    1. Record is created with PENDING status
    2. Email sent to admin (allie@allthrive.ai)
    3. Confirmation email sent to requester
    4. Admin can approve/reject via Django admin
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    # Feature choices for "What feature are you most excited about?"
    FEATURE_CHOICES = [
        ('portfolio', 'AI Automated Portfolio Showcase'),
        ('battles', 'Prompt Battles'),
        ('marketplace', 'Creator Marketplace (sell my courses & projects)'),
        ('learning', 'Structured Learning Path'),
        ('microlearning', 'Microlearning through games'),
        ('challenges', 'Weekly community challenges'),
        ('investing', 'Finding AI projects to invest in'),
        ('community', 'Connecting with other AI curious people'),
    ]

    # Integration choices for portfolio import
    INTEGRATION_CHOICES = [
        ('github', 'GitHub'),
        ('linkedin', 'LinkedIn'),
        ('instagram', 'Instagram'),
        ('figma', 'Figma'),
        ('url', 'Paste any URL'),
    ]

    # Requester info (not linked to User since they don't have account yet)
    email = models.EmailField(
        unique=True,
        help_text='Email address of person requesting invitation',
    )
    name = models.CharField(
        max_length=100,
        help_text='Name of person requesting invitation',
    )
    reason = models.TextField(
        blank=True,
        help_text='Why they want to join (optional)',
    )

    # Feature interest survey
    excited_features = models.JSONField(
        default=list,
        blank=True,
        help_text='Features the requester is most excited about (multi-select)',
    )
    desired_integrations = models.JSONField(
        default=list,
        blank=True,
        help_text='Integrations user wants for portfolio import (shown if portfolio selected)',
    )
    desired_integrations_other = models.CharField(
        max_length=200,
        blank=True,
        help_text='Other integration specified by user',
    )

    # Request metadata
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text='IP address of requester (for spam prevention)',
    )
    user_agent = models.TextField(
        blank=True,
        help_text='Browser user agent (for spam prevention)',
    )

    # Review fields
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_invitations',
        help_text='Admin who reviewed this request',
    )
    review_notes = models.TextField(
        blank=True,
        help_text='Internal notes from reviewer',
    )
    admin_notes = models.TextField(
        blank=True,
        help_text='Free-form admin notes (editable anytime)',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the request was approved/rejected',
    )
    approval_email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the approval/welcome email was sent',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['email']),
        ]
        verbose_name = 'Invitation Request'
        verbose_name_plural = 'Invitation Requests'

    def __str__(self) -> str:
        return f'{self.name} <{self.email}> ({self.status})'

    def approve(self, reviewer, notes: str = ''):
        """Approve this invitation request.

        Args:
            reviewer: User who approved the request
            notes: Optional review notes
        """
        from django.utils import timezone

        self.status = self.Status.APPROVED
        self.reviewed_by = reviewer
        self.review_notes = notes
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

    def reject(self, reviewer, notes: str = ''):
        """Reject this invitation request.

        Args:
            reviewer: User who rejected the request
            notes: Optional review notes
        """
        from django.utils import timezone

        self.status = self.Status.REJECTED
        self.reviewed_by = reviewer
        self.review_notes = notes
        self.reviewed_at = timezone.now()
        self.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

    def get_excited_features_display(self) -> list[str]:
        """Return human-readable labels for selected features."""
        feature_map = dict(self.FEATURE_CHOICES)
        return [feature_map.get(key, key) for key in (self.excited_features or [])]

    def get_desired_integrations_display(self) -> list[str]:
        """Return human-readable labels for selected integrations."""
        integration_map = dict(self.INTEGRATION_CHOICES)
        integrations = [integration_map.get(key, key) for key in (self.desired_integrations or [])]
        if self.desired_integrations_other:
            integrations.append(f'Other: {self.desired_integrations_other}')
        return integrations
