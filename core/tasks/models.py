from django.conf import settings
from django.db import models
from django.utils.text import slugify


class TaskOption(models.Model):
    """
    Configurable options for task attributes (status, type, priority).
    Admins can add/edit/reorder without code changes.
    """

    class OptionType(models.TextChoices):
        STATUS = 'status', 'Status'
        TYPE = 'type', 'Type'
        PRIORITY = 'priority', 'Priority'

    option_type = models.CharField(max_length=20, choices=OptionType.choices, db_index=True)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, blank=True, help_text='Auto-generated from name if not provided')
    color = models.CharField(max_length=50, default='slate', help_text='Tailwind color name or hex')
    icon = models.CharField(max_length=100, blank=True, help_text='Heroicon name')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    is_closed_status = models.BooleanField(default=False, help_text='For status: marks task as done')

    class Meta:
        ordering = ['option_type', 'order', 'name']
        unique_together = ['option_type', 'slug']
        indexes = [models.Index(fields=['option_type', 'is_active', 'order'])]
        constraints = [
            models.UniqueConstraint(
                fields=['option_type'], condition=models.Q(is_default=True), name='unique_default_per_option_type'
            )
        ]

    def __str__(self):
        return f'{self.get_option_type_display()}: {self.name}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Task(models.Model):
    """Core task model with flexible category relationships."""

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Category FKs (allows referential integrity + rich metadata)
    status = models.ForeignKey(
        TaskOption,
        on_delete=models.PROTECT,
        related_name='tasks_by_status',
        limit_choices_to={'option_type': 'status', 'is_active': True},
    )
    task_type = models.ForeignKey(
        TaskOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_by_type',
        limit_choices_to={'option_type': 'type', 'is_active': True},
    )
    priority = models.ForeignKey(
        TaskOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_by_priority',
        limit_choices_to={'option_type': 'priority', 'is_active': True},
    )

    # Assignment (limited to admin users in serializer/view)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
    )

    # Ordering (per-status for Kanban columns)
    order_in_status = models.PositiveIntegerField(default=0, db_index=True)

    # Due dates & reminders
    due_date = models.DateTimeField(null=True, blank=True)
    last_reminder_sent_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Metadata & Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tasks',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_tasks',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['order_in_status', '-created_at']
        indexes = [
            models.Index(fields=['status', 'order_in_status']),
            models.Index(fields=['assignee', 'status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['is_archived', '-created_at']),
        ]

    def __str__(self):
        return self.title


class TaskDashboard(models.Model):
    """Saved filter configurations (views) for the task list."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)

    # View configuration
    view_mode = models.CharField(
        max_length=20,
        choices=[('kanban', 'Kanban'), ('table', 'Table')],
        default='kanban',
    )
    filters = models.JSONField(
        default=dict,
        help_text='Saved filters: {status_ids, type_ids, priority_ids, assignee_ids, search, due_filter}',
    )
    sort_by = models.CharField(max_length=50, default='order_in_status')
    sort_direction = models.CharField(
        max_length=4,
        choices=[('asc', 'Asc'), ('desc', 'Desc')],
        default='asc',
    )

    # Display
    is_default = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    icon = models.CharField(max_length=100, blank=True)

    # Ownership
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_task_dashboards',
    )
    is_shared = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
