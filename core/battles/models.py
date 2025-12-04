"""Models for Prompt Battle feature - timed competitive prompt generation."""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from core.users.models import User


class BattlePhase(models.TextChoices):
    """Phase choices for real-time battle state machine."""

    WAITING = 'waiting', 'Waiting for Opponent'
    COUNTDOWN = 'countdown', 'Countdown'
    ACTIVE = 'active', 'Active'
    GENERATING = 'generating', 'AI Generating'
    JUDGING = 'judging', 'AI Judging'
    REVEAL = 'reveal', 'Results Reveal'
    COMPLETE = 'complete', 'Complete'


class MatchSource(models.TextChoices):
    """How the battle match was created."""

    DIRECT = 'direct', 'Direct Challenge'
    RANDOM = 'random', 'Random Match'
    AI_OPPONENT = 'ai_opponent', 'AI Opponent'


class MatchType(models.TextChoices):
    """Type of matchmaking requested."""

    RANDOM = 'random', 'Random Match'
    AI_OPPONENT = 'ai', 'AI Opponent (Pip)'


class VoteSource(models.TextChoices):
    """Source of a battle vote."""

    AI = 'ai', 'AI Judge'
    COMMUNITY = 'community', 'Community Vote'
    PANEL = 'panel', 'Judge Panel'


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


class ChallengeType(models.Model):
    """Database-driven challenge type configuration.

    Allows adding new challenge types without code changes.
    Each challenge type defines templates, variables, and judging criteria.
    """

    key = models.CharField(
        max_length=50, unique=True, help_text="Unique identifier (e.g., 'dreamscape', 'movie_poster')"
    )
    name = models.CharField(max_length=100, help_text='Display name for the challenge type')
    description = models.TextField(help_text='Description of what this challenge type is about')

    category = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'taxonomy_type': 'category'},
        related_name='challenge_types',
        help_text='Category this challenge type belongs to',
    )

    # Challenge templates with variable placeholders
    templates = models.JSONField(
        default=list,
        help_text='List of challenge templates with {variable} placeholders',
    )

    # Variables for template substitution
    variables = models.JSONField(
        default=dict,
        help_text='Variable options for template substitution: {"style": ["surreal", "cosmic"]}',
    )

    # Judging criteria (weights should sum to 100)
    judging_criteria = models.JSONField(
        default=list,
        help_text='List of criteria: [{"name": "creativity", "weight": 30, "description": "..."}]',
    )

    # AI judging prompt (optional - uses default if empty)
    ai_judge_prompt = models.TextField(
        blank=True,
        help_text='Custom AI judging prompt (uses default if empty)',
    )

    # Configuration
    default_duration_minutes = models.IntegerField(default=3, help_text='Default battle duration in minutes')
    min_submission_length = models.IntegerField(default=10, help_text='Minimum prompt length in characters')
    max_submission_length = models.IntegerField(default=2000, help_text='Maximum prompt length in characters')

    # Points configuration
    winner_points = models.IntegerField(default=50, help_text='Points awarded to winner')
    participation_points = models.IntegerField(default=10, help_text='Points for participation')

    # Status
    is_active = models.BooleanField(default=True, help_text='Whether this challenge type is available')
    difficulty = models.CharField(
        max_length=20,
        choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')],
        default='medium',
    )

    # Ordering
    order = models.IntegerField(default=0, help_text='Display order (lower = first)')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        indexes = [
            models.Index(fields=['is_active', 'order']),
            models.Index(fields=['category', 'is_active']),
        ]

    def __str__(self):
        return self.name

    def generate_challenge(self) -> str:
        """Generate a random challenge from templates and variables."""
        import random

        if not self.templates:
            return self.description

        template = random.choice(self.templates)  # noqa: S311 - game randomization

        for var_name, var_options in self.variables.items():
            placeholder = '{' + var_name + '}'
            if placeholder in template and var_options:
                template = template.replace(placeholder, random.choice(var_options))  # noqa: S311

        return template


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

    # Real-time battle phase (state machine)
    phase = models.CharField(
        max_length=20,
        choices=BattlePhase.choices,
        default=BattlePhase.WAITING,
        db_index=True,
        help_text='Current phase of the real-time battle',
    )

    # Connection tracking for real-time battles
    challenger_connected = models.BooleanField(default=False, help_text='Is challenger connected via WebSocket')
    opponent_connected = models.BooleanField(default=False, help_text='Is opponent connected via WebSocket')

    # Link to challenge type configuration
    challenge_type = models.ForeignKey(
        ChallengeType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='battles',
        help_text='The challenge type configuration used for this battle',
    )

    # How the match was created
    match_source = models.CharField(
        max_length=20,
        choices=MatchSource.choices,
        default=MatchSource.DIRECT,
        help_text='How this battle match was created',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['challenger', '-created_at']),
            models.Index(fields=['opponent', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['expires_at']),
            # Phase is frequently queried in tasks and consumers
            models.Index(fields=['phase', 'status']),
            models.Index(fields=['phase', '-created_at']),
            # Winner lookups for leaderboard
            models.Index(fields=['winner', '-completed_at']),
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
        max_length=20,
        choices=SubmissionType.choices,
        default=SubmissionType.IMAGE,
        help_text='Type of submission (text or image prompt)',
    )

    generated_output_url = models.URLField(
        blank=True, null=True, help_text='URL to the generated output (if applicable)'
    )

    generated_output_text = models.TextField(blank=True, help_text='Generated text output (if text submission)')

    score = models.FloatField(null=True, blank=True, help_text='AI-evaluated score (0-100)')

    # Detailed scoring by criteria
    criteria_scores = models.JSONField(
        default=dict,
        blank=True,
        help_text='Breakdown by judging criteria: {"creativity": 85, "relevance": 90}',
    )

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


class BattleVote(models.Model):
    """Vote on a battle submission.

    Designed for future expansion to community judging.
    Currently used for AI judge votes.
    """

    battle = models.ForeignKey(
        PromptBattle,
        on_delete=models.CASCADE,
        related_name='votes',
        help_text='The battle being voted on',
    )

    submission = models.ForeignKey(
        BattleSubmission,
        on_delete=models.CASCADE,
        related_name='votes',
        help_text='The submission being voted on',
    )

    voter = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='battle_votes_cast',
        help_text='User who voted (null for AI judge)',
    )

    vote_source = models.CharField(
        max_length=20,
        choices=VoteSource.choices,
        default=VoteSource.AI,
        help_text='Source of this vote',
    )

    score = models.FloatField(help_text='Score given (0-100)')

    criteria_scores = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-criteria breakdown: {"creativity": 85, "relevance": 90}',
    )

    feedback = models.TextField(blank=True, help_text='Feedback explaining the vote')

    weight = models.FloatField(default=1.0, help_text='Vote weight for aggregation')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['submission', 'voter', 'vote_source']]
        indexes = [
            models.Index(fields=['battle', 'vote_source']),
            models.Index(fields=['submission', '-created_at']),
        ]

    def __str__(self):
        voter_name = self.voter.username if self.voter else 'AI'
        return f'Vote by {voter_name} on submission {self.submission_id}'


class BattleMatchmakingQueue(models.Model):
    """Queue for users waiting to be matched.

    Supports random matching and future skill-based matching.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='matchmaking_queue',
        help_text='User waiting in queue',
    )

    match_type = models.CharField(
        max_length=20,
        choices=MatchType.choices,
        default=MatchType.RANDOM,
        help_text='Type of match requested',
    )

    challenge_type = models.ForeignKey(
        ChallengeType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='Preferred challenge type (null = any)',
    )

    queued_at = models.DateTimeField(auto_now_add=True, help_text='When user joined queue')

    expires_at = models.DateTimeField(help_text='When queue entry expires')

    class Meta:
        verbose_name_plural = 'Battle matchmaking queue entries'
        indexes = [
            models.Index(fields=['match_type', 'queued_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f'{self.user.username} waiting for {self.get_match_type_display()}'

    def save(self, *args, **kwargs):
        """Set default expiration if not provided."""
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(minutes=5)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if queue entry has expired."""
        return timezone.now() > self.expires_at
