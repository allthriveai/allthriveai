from django.conf import settings
from django.db import models


class FeedbackItem(models.Model):
    """Unified model for feature requests and bug reports."""

    class Type(models.TextChoices):
        FEATURE = 'feature', 'Feature Request'
        BUG = 'bug', 'Bug Report'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        DECLINED = 'declined', 'Declined'

    class Category(models.TextChoices):
        # Features
        EXPLORE = 'explore', 'Explore'
        GAMES = 'games', 'Games'
        PROMPT_BATTLES = 'prompt_battles', 'Prompt Battles'
        LOUNGE = 'lounge', 'Lounge'
        LEARN = 'learn', 'Learn'
        # Agents
        AVA = 'ava', 'Ava'
        SAGE = 'sage', 'Sage'
        HAVEN = 'haven', 'Haven'
        GUIDE = 'guide', 'Guide'
        # General
        UI_UX = 'ui_ux', 'UI/UX'
        RESPONSIVE = 'responsive', 'Responsive Design'
        ACCESSIBILITY = 'accessibility', 'Accessibility'
        ACCOUNT = 'account', 'Account & Settings'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_items',
    )
    feedback_type = models.CharField(max_length=20, choices=Type.choices)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.EXPLORE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    vote_count = models.PositiveIntegerField(default=0, db_index=True)
    admin_response = models.TextField(blank=True)  # Optional admin response
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-vote_count', '-created_at']
        indexes = [
            models.Index(fields=['feedback_type', 'status', '-vote_count']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f'{self.get_feedback_type_display()}: {self.title}'


class FeedbackVote(models.Model):
    """Track member votes on feedback items."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_votes',
    )
    feedback_item = models.ForeignKey(
        FeedbackItem,
        on_delete=models.CASCADE,
        related_name='votes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'feedback_item'],
                name='unique_feedback_vote_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'feedback_item']),  # Fast vote lookups
        ]

    def __str__(self):
        return f'{self.user.username} voted on {self.feedback_item.title}'


class FeedbackComment(models.Model):
    """Comments on feedback items from community members."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_comments',
    )
    feedback_item = models.ForeignKey(
        FeedbackItem,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    content = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']  # Oldest first for conversation flow
        indexes = [
            models.Index(fields=['feedback_item', 'created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} on {self.feedback_item.title[:30]}'
