"""Models for Prompt Battle feature - timed competitive prompt generation."""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from core.users.models import User


class BattleStatus(models.TextChoices):
    """Status choices for prompt battles."""

    PENDING = 'pending', 'Pending'
    ACTIVE = 'active', 'Active'
    COMPLETED = 'completed', 'Completed'
    EXPIRED = 'expired', 'Expired'
    CANCELLED = 'cancelled', 'Cancelled'


class BattleType(models.TextChoices):
    """Type of prompt battle."""

    TEXT_PROMPT = 'text_prompt', 'Text Prompt Generation'
    IMAGE_PROMPT = 'image_prompt', 'Image Generation Prompt'
    MIXED = 'mixed', 'Mixed Challenge'


class SubmissionType(models.TextChoices):
    """Type of submission in a battle."""

    TEXT = 'text', 'Text Generation'
    IMAGE = 'image', 'Image Generation'


class InvitationStatus(models.TextChoices):
    """Status of battle invitation."""

    PENDING = 'pending', 'Pending'
    ACCEPTED = 'accepted', 'Accepted'
    DECLINED = 'declined', 'Declined'
    EXPIRED = 'expired', 'Expired'


class PromptBattle(models.Model):
    """Model for prompt generation battles between users.

    A battle is initiated by a challenger who invites an opponent.
    Once accepted, both users have a limited time to create the best
    prompt for a randomly generated challenge.
    """

    challenger = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='battles_initiated', help_text='User who initiated the battle'
    )

    opponent = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='battles_received', help_text='User who was challenged'
    )

    challenge_text = models.TextField(help_text='The AI-generated challenge prompt for this battle')

    status = models.CharField(
        max_length=20,
        choices=BattleStatus.choices,
        default=BattleStatus.PENDING,
        db_index=True,
        help_text='Current status of the battle',
    )

    battle_type = models.CharField(
        max_length=20, choices=BattleType.choices, default=BattleType.TEXT_PROMPT, help_text='Type of prompt battle'
    )

    duration_minutes = models.IntegerField(default=10, help_text='Duration of battle in minutes (default 10)')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    started_at = models.DateTimeField(
        null=True, blank=True, help_text='When the battle officially started (after acceptance)'
    )

    expires_at = models.DateTimeField(
        null=True, blank=True, db_index=True, help_text='When the battle expires (started_at + duration)'
    )

    completed_at = models.DateTimeField(null=True, blank=True, help_text='When the battle was completed')

    winner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='battles_won',
        help_text='Winner of the battle (determined by AI scoring)',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['challenger', '-created_at']),
            models.Index(fields=['opponent', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f'Battle: {self.challenger.username} vs {self.opponent.username} ({self.status})'

    def clean(self):
        """Validate battle data."""
        super().clean()

        # Can't battle yourself
        if self.challenger == self.opponent:
            raise ValidationError('Cannot create a battle with yourself.')

        # Duration must be reasonable
        if self.duration_minutes < 1 or self.duration_minutes > 60:
            raise ValidationError('Battle duration must be between 1 and 60 minutes.')

    def start_battle(self):
        """Start the battle after acceptance."""
        if self.status != BattleStatus.PENDING:
            raise ValidationError('Can only start pending battles.')

        self.status = BattleStatus.ACTIVE
        self.started_at = timezone.now()
        self.expires_at = self.started_at + timezone.timedelta(minutes=self.duration_minutes)
        self.save(update_fields=['status', 'started_at', 'expires_at'])

    def complete_battle(self):
        """Mark battle as completed."""
        if self.status != BattleStatus.ACTIVE:
            raise ValidationError('Can only complete active battles.')

        self.status = BattleStatus.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])

    def expire_battle(self):
        """Mark battle as expired."""
        self.status = BattleStatus.EXPIRED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])

    def cancel_battle(self):
        """Cancel the battle."""
        if self.status not in [BattleStatus.PENDING, BattleStatus.ACTIVE]:
            raise ValidationError('Can only cancel pending or active battles.')

        self.status = BattleStatus.CANCELLED
        self.save(update_fields=['status'])

    @property
    def is_expired(self):
        """Check if battle has expired."""
        if self.expires_at and self.status == BattleStatus.ACTIVE:
            return timezone.now() > self.expires_at
        return False

    @property
    def time_remaining(self):
        """Get remaining time in seconds, or None if not active."""
        if self.status == BattleStatus.ACTIVE and self.expires_at:
            remaining = (self.expires_at - timezone.now()).total_seconds()
            return max(0, remaining)
        return None


class BattleSubmission(models.Model):
    """User submission for a prompt battle.

    Each user in a battle can submit one prompt. The prompt is evaluated
    by AI agents to determine quality and creativity.
    """

    battle = models.ForeignKey(
        PromptBattle,
        on_delete=models.CASCADE,
        related_name='submissions',
        help_text='The battle this submission belongs to',
    )

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='battle_submissions', help_text='User who made this submission'
    )

    prompt_text = models.TextField(help_text='The prompt created by the user')

    submission_type = models.CharField(
        max_length=20, choices=SubmissionType.choices, help_text='Type of submission (text or image prompt)'
    )

    generated_output_url = models.URLField(
        blank=True, null=True, help_text='URL to the generated output (if applicable)'
    )

    generated_output_text = models.TextField(blank=True, help_text='Generated text output (if text submission)')

    score = models.FloatField(null=True, blank=True, help_text='AI-evaluated score (0-100)')

    evaluation_feedback = models.TextField(blank=True, help_text='AI feedback on the prompt quality')

    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    evaluated_at = models.DateTimeField(null=True, blank=True, help_text='When the submission was evaluated')

    class Meta:
        unique_together = [['battle', 'user']]
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['battle', 'user']),
            models.Index(fields=['user', '-submitted_at']),
        ]

    def __str__(self):
        return f'Submission by {self.user.username} in battle {self.battle.id}'

    def clean(self):
        """Validate submission."""
        super().clean()

        # User must be a participant in the battle
        if self.user not in [self.battle.challenger, self.battle.opponent]:
            raise ValidationError('User must be a participant in this battle.')

        # Can only submit to active battles
        if self.battle.status != BattleStatus.ACTIVE:
            raise ValidationError('Can only submit to active battles.')

        # Check if battle has expired
        if self.battle.is_expired:
            raise ValidationError('Battle has expired.')


class BattleInvitation(models.Model):
    """Invitation for a prompt battle.

    When a user wants to challenge another user, an invitation is created.
    The opponent can accept or decline the invitation.
    """

    battle = models.OneToOneField(
        PromptBattle,
        on_delete=models.CASCADE,
        related_name='invitation',
        help_text='The battle associated with this invitation',
    )

    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='battle_invitations_sent', help_text='User who sent the invitation'
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='battle_invitations_received',
        help_text='User who received the invitation',
    )

    message = models.TextField(blank=True, help_text='Optional message from the challenger')

    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, default=InvitationStatus.PENDING, db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    responded_at = models.DateTimeField(null=True, blank=True, help_text='When the invitation was responded to')

    expires_at = models.DateTimeField(db_index=True, help_text='When the invitation expires (24 hours from creation)')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'status', '-created_at']),
            models.Index(fields=['sender', '-created_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f'Invitation from {self.sender.username} to {self.recipient.username} ({self.status})'

    def save(self, *args, **kwargs):
        """Set expiration time on creation."""
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)

    def accept(self):
        """Accept the invitation and start the battle."""
        if self.status != InvitationStatus.PENDING:
            raise ValidationError('Can only accept pending invitations.')

        if self.is_expired:
            raise ValidationError('Invitation has expired.')

        self.status = InvitationStatus.ACCEPTED
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at'])

        # Start the battle
        self.battle.start_battle()

    def decline(self):
        """Decline the invitation."""
        if self.status != InvitationStatus.PENDING:
            raise ValidationError('Can only decline pending invitations.')

        self.status = InvitationStatus.DECLINED
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at'])

        # Cancel the battle
        self.battle.cancel_battle()

    @property
    def is_expired(self):
        """Check if invitation has expired."""
        return timezone.now() > self.expires_at
