"""
Asana integration models for Echo task management.

This module provides models for storing Asana OAuth tokens and caching tasks locally.
All tokens are encrypted at rest using Fernet symmetric encryption.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from .encryption import SecretField


class AsanaIntegration(models.Model):
    """
    User's Asana OAuth connection.

    Each user connects their own Asana account via OAuth.
    Tokens are encrypted at rest and never exposed to the frontend.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='asana_integration',
        help_text='User who owns this Asana connection',
    )

    # Encrypted OAuth tokens - NEVER expose these to the frontend
    access_token = SecretField(
        help_text='Encrypted Asana access token',
    )
    refresh_token = SecretField(
        help_text='Encrypted Asana refresh token',
    )

    # Token expiration for auto-refresh
    token_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the access token expires',
    )

    # Asana workspace selection
    workspace_gid = models.CharField(
        max_length=100,
        help_text='Asana workspace GID',
    )
    workspace_name = models.CharField(
        max_length=255,
        help_text='Asana workspace name for display',
    )

    # Optional: sync specific project only
    project_gid = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Optional: specific Asana project GID to sync',
    )
    project_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Optional: Asana project name for display',
    )

    # Sync settings
    sync_enabled = models.BooleanField(
        default=True,
        help_text='Enable automatic background sync',
    )
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When tasks were last synced from Asana',
    )
    last_sync_error = models.TextField(
        blank=True,
        default='',
        help_text='Error message from last failed sync',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'asana_integrations'
        verbose_name = 'Asana Integration'
        verbose_name_plural = 'Asana Integrations'

    def __str__(self):
        return f'Asana: {self.workspace_name} ({self.user.username})'

    def is_token_expired(self) -> bool:
        """Check if the access token has expired."""
        if not self.token_expires_at:
            return True
        # Add a 5-minute buffer to avoid edge cases
        return timezone.now() >= (self.token_expires_at - timezone.timedelta(minutes=5))

    def mark_sync_error(self, error_message: str):
        """Record a sync error and disable sync if auth failed."""
        self.last_sync_error = error_message
        self.save(update_fields=['last_sync_error', 'updated_at'])

    def mark_sync_success(self):
        """Record a successful sync."""
        self.last_synced_at = timezone.now()
        self.last_sync_error = ''
        self.save(update_fields=['last_synced_at', 'last_sync_error', 'updated_at'])


class TaskCache(models.Model):
    """
    Locally cached Asana task for fast access.

    Asana is the source of truth - this is just a local cache for quick display.
    Tasks sync bidirectionally: changes here push to Asana, changes in Asana pull here.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cached_tasks',
        help_text='User who owns this task',
    )

    # Asana identifiers
    asana_gid = models.CharField(
        max_length=100,
        help_text='Asana task GID',
    )

    # Task content
    title = models.CharField(
        max_length=255,
        help_text='Task title',
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text='Task notes/description',
    )

    # Task state
    completed = models.BooleanField(
        default=False,
        help_text='Whether the task is completed',
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Task due date',
    )

    # Asana project info
    project_gid = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Asana project GID',
    )
    project_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Asana project name',
    )

    # Soft delete - when task is deleted in Asana
    is_deleted = models.BooleanField(
        default=False,
        help_text='True if deleted in Asana (soft delete)',
    )

    # Link to AllThrive content idea (optional)
    content_idea = models.ForeignKey(
        'content_engine.ContentIdea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asana_tasks',
        help_text='Linked content idea (optional)',
    )

    # Sync tracking
    synced_at = models.DateTimeField(
        auto_now=True,
        help_text='When this task was last synced',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'asana_task_cache'
        # Same asana_gid can exist for different users (if they share a workspace)
        unique_together = ['user', 'asana_gid']
        ordering = ['due_date', '-synced_at']
        indexes = [
            models.Index(fields=['user', 'completed']),
            models.Index(fields=['user', 'due_date']),
            models.Index(fields=['asana_gid']),
        ]
        verbose_name = 'Cached Asana Task'
        verbose_name_plural = 'Cached Asana Tasks'

    def __str__(self):
        status = '✓' if self.completed else '○'
        return f'{status} {self.title} ({self.user.username})'

    @property
    def is_overdue(self) -> bool:
        """Check if task is overdue (has due date in the past and not completed)."""
        if self.completed or not self.due_date:
            return False
        return self.due_date < timezone.now().date()
