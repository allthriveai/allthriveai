"""Data models for Echo Social Media Coach."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class OnboardingPhase(models.TextChoices):
    """Phases of Echo onboarding flow."""

    INTRO = 'intro', 'Introduction'
    GOALS = 'goals', 'Goals'
    PLATFORMS = 'platforms', 'Platforms'
    TOPICS = 'topics', 'Topics'
    COMPLETE = 'complete', 'Complete'


class EchoProfile(models.Model):
    """
    Echo profile for a user.

    Stores onboarding state and user preferences for the Echo assistant.
    This includes goals, target platforms, content pillars, and other
    contextual information that Echo uses to personalize assistance.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='echo_profile',
    )

    # Onboarding state
    onboarding_phase = models.CharField(
        max_length=20,
        choices=OnboardingPhase.choices,
        default=OnboardingPhase.INTRO,
        db_index=True,
        help_text='Current phase of Echo onboarding',
    )

    # Goals (what user wants to achieve with Echo)
    goals = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text='E.g., ["grow my audience", "become a thought leader", "get consulting clients"]',
    )

    # Target platforms (where they create content)
    target_platforms = ArrayField(
        models.CharField(max_length=50),
        default=list,
        blank=True,
        help_text='E.g., ["twitter", "linkedin", "youtube", "newsletter"]',
    )

    # Content pillars (main themes/topics)
    content_pillars = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text='E.g., ["AI agents", "autonomous coding", "developer tools"]',
    )

    # Additional context
    audience_description = models.TextField(
        blank=True,
        help_text='Description of target audience',
    )

    # Preferences
    preferred_posting_times = models.JSONField(
        default=dict,
        blank=True,
        help_text='E.g., {"twitter": ["9am", "12pm"], "linkedin": ["8am"]}',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Echo Profile'
        verbose_name_plural = 'Echo Profiles'
        indexes = [
            models.Index(fields=['user', 'onboarding_phase']),
        ]

    def __str__(self):
        return f'Echo Profile for {self.user.username} ({self.onboarding_phase})'

    @property
    def is_onboarded(self) -> bool:
        """Check if user has completed onboarding."""
        return self.onboarding_phase == OnboardingPhase.COMPLETE

    def advance_onboarding(self) -> bool:
        """
        Advance to the next onboarding phase.

        Returns True if advanced, False if already complete.
        """
        phases = list(OnboardingPhase.values)
        current_index = phases.index(self.onboarding_phase)

        if current_index < len(phases) - 1:
            self.onboarding_phase = phases[current_index + 1]
            self.save(update_fields=['onboarding_phase', 'updated_at'])
            return True
        return False

    def complete_onboarding(self) -> None:
        """Mark onboarding as complete."""
        self.onboarding_phase = OnboardingPhase.COMPLETE
        self.save(update_fields=['onboarding_phase', 'updated_at'])


class MessageRole(models.TextChoices):
    """Valid roles for Echo messages."""

    USER = 'user', 'User'
    ASSISTANT = 'assistant', 'Assistant'
    SYSTEM = 'system', 'System'
    TOOL = 'tool', 'Tool'


class EchoConversation(models.Model):
    """
    A conversation session with Echo.

    Each conversation has a unique session_id and can contain multiple messages.
    Conversations are ordered by most recently updated first.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='echo_conversations',
    )

    session_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text='Unique identifier for the conversation session',
    )

    title = models.CharField(
        max_length=255,
        blank=True,
        help_text='Auto-generated or user-set conversation title',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Echo Conversation'
        verbose_name_plural = 'Echo Conversations'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['session_id']),
        ]

    def __str__(self):
        title_preview = self.title[:50] if self.title else 'Untitled'
        return f'Conversation {self.session_id}: {title_preview}'


class EchoMessage(models.Model):
    """
    A single message in an Echo conversation.

    Messages can be from user, assistant, system, or tool.
    They may include quick_select options (clickable response options)
    and inline_cards (rich content cards rendered inline).
    """

    conversation = models.ForeignKey(
        EchoConversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )

    role = models.CharField(
        max_length=20,
        choices=MessageRole.choices,
        db_index=True,
        help_text='Who sent this message',
    )

    content = models.TextField(
        help_text='The message text content',
    )

    quick_select = models.JSONField(
        default=list,
        blank=True,
        help_text='Clickable response options, e.g., [{"label": "Yes", "value": "yes"}]',
    )

    inline_cards = models.JSONField(
        default=list,
        blank=True,
        help_text='Rich content cards, e.g., [{"type": "idea", "id": 123, "title": "..."}]',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Echo Message'
        verbose_name_plural = 'Echo Messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
        ]

    def __str__(self):
        content_preview = self.content[:50] if self.content else ''
        return f'{self.role}: {content_preview}...'
