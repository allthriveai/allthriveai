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

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the request was approved/rejected',
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
