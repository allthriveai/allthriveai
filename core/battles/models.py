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
    INVITATION = 'invitation', 'SMS Invitation'


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
        db_table = 'core_challengetype'
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
        User,
        on_delete=models.CASCADE,
        related_name='battles_received',
        help_text='User who was challenged (null for SMS invitations until accepted)',
        null=True,
        blank=True,
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

    # Track when the phase last changed (for detecting stuck battles)
    phase_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text='When the battle phase last changed (used for stuck battle detection)',
    )

    # Track judging retry attempts to prevent infinite loops
    judging_retry_count = models.PositiveSmallIntegerField(
        default=0,
        help_text='Number of times judging has been retried (force-complete after 3)',
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
        db_table = 'core_promptbattle'
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
        opponent_name = self.opponent.username if self.opponent else 'TBD'
        return f'Battle: {self.challenger.username} vs {opponent_name} ({self.status})'

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

    def set_phase(self, new_phase: str, save: bool = True) -> None:
        """Update the battle phase and track when it changed.

        Args:
            new_phase: The new phase to transition to
            save: Whether to save immediately (default True)
        """
        self.phase = new_phase
        self.phase_changed_at = timezone.now()
        if save:
            self.save(update_fields=['phase', 'phase_changed_at'])

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
        db_table = 'core_battlesubmission'
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


class InvitationType(models.TextChoices):
    """Type of battle invitation."""

    PLATFORM = 'platform', 'Platform User'  # Invitation to existing user
    SMS = 'sms', 'SMS'  # Invitation via SMS to phone number
    RANDOM = 'random', 'Random Match'  # Random active user matching
    LINK = 'link', 'Shareable Link'  # Shareable link (user shares manually)


class BattleInvitation(models.Model):
    """Invitation for a prompt battle.

    When a user wants to challenge another user, an invitation is created.
    The opponent can accept or decline the invitation.

    Supports three invitation types:
    - Platform: Direct invitation to existing user
    - SMS: Invitation via text message (recipient may not be a user yet)
    - Random: Auto-match with active users
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

    # For platform invitations - the recipient user
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='battle_invitations_received',
        null=True,
        blank=True,
        help_text='User who received the invitation (for platform invitations)',
    )

    # For SMS invitations - phone number and optional name
    recipient_phone = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        help_text='Phone number for SMS invitations (E.164 format)',
    )
    recipient_name = models.CharField(
        max_length=100,
        blank=True,
        help_text='Name of SMS recipient (for display purposes)',
    )

    # Invitation type
    invitation_type = models.CharField(
        max_length=20,
        choices=InvitationType.choices,
        default=InvitationType.PLATFORM,
        db_index=True,
    )

    # Unique token for SMS invitation links
    invite_token = models.CharField(
        max_length=64,
        blank=True,
        unique=True,
        null=True,
        help_text='Unique token for SMS invitation links',
    )

    message = models.TextField(blank=True, help_text='Optional message from the challenger')

    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, default=InvitationStatus.PENDING, db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    responded_at = models.DateTimeField(null=True, blank=True, help_text='When the invitation was responded to')

    expires_at = models.DateTimeField(db_index=True, help_text='When the invitation expires (24 hours from creation)')

    # SMS tracking
    sms_sent_at = models.DateTimeField(null=True, blank=True, help_text='When SMS was sent')
    sms_log_id = models.IntegerField(null=True, blank=True, help_text='ID of SMSLog record')

    class Meta:
        db_table = 'core_battleinvitation'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'status', '-created_at']),
            models.Index(fields=['sender', '-created_at']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['recipient_phone', 'status']),
            models.Index(fields=['invitation_type', 'status']),
        ]

    def __str__(self):
        if self.invitation_type == InvitationType.SMS:
            return f'SMS Invitation from {self.sender.username} to {self.recipient_phone} ({self.status})'
        elif self.recipient:
            return f'Invitation from {self.sender.username} to {self.recipient.username} ({self.status})'
        return f'Invitation from {self.sender.username} ({self.status})'

    def save(self, *args, **kwargs):
        """Set expiration time and generate token on creation."""
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        # Generate invite token for SMS and LINK invitations
        if self.invitation_type in (InvitationType.SMS, InvitationType.LINK) and not self.invite_token:
            import secrets

            self.invite_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def accept(self, accepting_user: 'User' = None):
        """Accept the invitation and start the battle.

        This method uses database-level locking to prevent race conditions
        when multiple users try to accept the same invitation simultaneously.

        Args:
            accepting_user: For SMS/LINK invitations, the user accepting via the link.
                           For platform invitations, must match self.recipient.

        Raises:
            ValidationError: If invitation is not pending, expired, or user is invalid.
        """
        from django.db import transaction

        # Use atomic transaction to ensure all-or-nothing updates
        with transaction.atomic():
            # Re-fetch with lock to prevent race conditions
            # The select_for_update() locks the row until transaction completes
            locked_invitation = (
                BattleInvitation.objects.select_for_update().select_related('battle', 'sender').get(pk=self.pk)
            )

            if locked_invitation.status != InvitationStatus.PENDING:
                raise ValidationError('Can only accept pending invitations.')

            if locked_invitation.is_expired:
                raise ValidationError('Invitation has expired.')

            # Handle SMS and LINK invitations - set the recipient to the accepting user
            if locked_invitation.invitation_type in (InvitationType.SMS, InvitationType.LINK):
                if not accepting_user:
                    raise ValidationError('Accepting user required for SMS/link invitations.')
                if accepting_user == locked_invitation.sender:
                    raise ValidationError('Cannot accept your own invitation.')
                # Set the recipient now that we know who accepted
                locked_invitation.recipient = accepting_user

            locked_invitation.status = InvitationStatus.ACCEPTED
            locked_invitation.responded_at = timezone.now()
            locked_invitation.save(update_fields=['status', 'responded_at', 'recipient'])

            # Update battle with opponent and start it - all within same transaction
            battle = locked_invitation.battle
            if locked_invitation.invitation_type in (InvitationType.SMS, InvitationType.LINK) and accepting_user:
                battle.opponent = accepting_user

            # Start the battle with proper state machine transition
            if battle.status != BattleStatus.PENDING:
                raise ValidationError('Battle is no longer pending.')

            battle.status = BattleStatus.ACTIVE
            battle.phase = BattlePhase.COUNTDOWN  # Set phase explicitly for consistency
            battle.started_at = timezone.now()
            battle.expires_at = battle.started_at + timezone.timedelta(minutes=battle.duration_minutes)
            battle.phase_changed_at = battle.started_at
            battle.save(update_fields=['opponent', 'status', 'phase', 'started_at', 'expires_at', 'phase_changed_at'])

            # Update self to reflect the locked invitation's state
            self.status = locked_invitation.status
            self.responded_at = locked_invitation.responded_at
            self.recipient = locked_invitation.recipient

    def decline(self):
        """Decline the invitation.

        Uses database-level locking to prevent race conditions.
        """
        from django.db import transaction

        with transaction.atomic():
            # Re-fetch with lock to prevent race conditions
            locked_invitation = BattleInvitation.objects.select_for_update().select_related('battle').get(pk=self.pk)

            if locked_invitation.status != InvitationStatus.PENDING:
                raise ValidationError('Can only decline pending invitations.')

            locked_invitation.status = InvitationStatus.DECLINED
            locked_invitation.responded_at = timezone.now()
            locked_invitation.save(update_fields=['status', 'responded_at'])

            # Cancel the battle
            battle = locked_invitation.battle
            if battle.status in [BattleStatus.PENDING, BattleStatus.ACTIVE]:
                battle.status = BattleStatus.CANCELLED
                battle.save(update_fields=['status'])

            # Update self to reflect the locked invitation's state
            self.status = locked_invitation.status
            self.responded_at = locked_invitation.responded_at

    @property
    def is_expired(self):
        """Check if invitation has expired."""
        return timezone.now() > self.expires_at

    @property
    def invite_url(self) -> str:
        """Get the full invite URL for SMS invitations."""
        if not self.invite_token:
            return ''
        from django.conf import settings

        frontend_url = settings.FRONTEND_URL
        return f'{frontend_url}/battle/invite/{self.invite_token}'

    def send_sms_invitation(self) -> bool:
        """Send SMS invitation to recipient_phone.

        Returns:
            True if SMS was queued successfully
        """
        if self.invitation_type != InvitationType.SMS:
            raise ValidationError('Can only send SMS for SMS-type invitations.')

        if not self.recipient_phone:
            raise ValidationError('No recipient phone number.')

        if self.sms_sent_at:
            raise ValidationError('SMS already sent.')

        from core.sms.services import SMSService

        sms_log = SMSService.send_battle_invitation(
            to_phone=self.recipient_phone,
            inviter_name=self.sender.username,
            battle_topic=self.battle.challenge_text[:50],  # First 50 chars of challenge
            invitation_link=self.invite_url,
            user=self.sender,
            invitation_id=self.id,
        )

        self.sms_sent_at = timezone.now()
        self.sms_log_id = sms_log.id
        self.save(update_fields=['sms_sent_at', 'sms_log_id'])

        return sms_log.status != 'failed'


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
        db_table = 'core_battlevote'
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
        db_table = 'core_battlematchmakingqueue'
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
