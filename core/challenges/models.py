"""Models for Weekly Challenges - community-wide creative challenges with leaderboards."""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from core.projects.models import Project
from core.users.models import User


class ChallengeStatus(models.TextChoices):
    """Status choices for weekly challenges."""

    DRAFT = 'draft', 'Draft'
    UPCOMING = 'upcoming', 'Upcoming'
    ACTIVE = 'active', 'Active'
    VOTING = 'voting', 'Voting Period'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class ChallengeSponsor(models.Model):
    """Sponsor/partner for weekly challenges.

    AI tool companies can sponsor challenges with prizes and branding.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Company info
    name = models.CharField(max_length=200, help_text='Company name (e.g., OpenAI, Anthropic)')
    slug = models.SlugField(unique=True, max_length=100)
    logo_url = models.URLField(blank=True, help_text='URL to sponsor logo')
    website_url = models.URLField(blank=True, help_text='Sponsor website')
    description = models.TextField(blank=True, help_text='Brief description of the sponsor')

    # Contact (internal use only)
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)

    # Status
    is_active = models.BooleanField(default=True, help_text='Whether sponsor is currently active')
    is_verified = models.BooleanField(default=False, help_text='Verified partner status')

    # Stats (cached)
    total_challenges_sponsored = models.IntegerField(default=0)
    total_prize_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active', 'is_verified']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class WeeklyChallenge(models.Model):
    """Weekly creative challenge for the community.

    Unlike 1v1 battles, weekly challenges are community-wide events that
    encourage participation through points and prizes for multiple tiers.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identity
    title = models.CharField(max_length=200, help_text='Challenge title (e.g., "AI Art Week: Dreamscapes")')
    slug = models.SlugField(unique=True, max_length=150)
    description = models.TextField(help_text='Full challenge description and rules')
    prompt = models.TextField(help_text='The actual creative prompt for participants')

    # Timing
    week_number = models.IntegerField(help_text='Week of year (1-52)')
    year = models.IntegerField(help_text='Year')
    starts_at = models.DateTimeField(help_text='When the challenge starts')
    submission_deadline = models.DateTimeField(help_text='Deadline for submissions')
    voting_deadline = models.DateTimeField(
        null=True, blank=True, help_text='Deadline for voting (null if no voting period)'
    )
    ends_at = models.DateTimeField(help_text='When the challenge fully ends')

    # Status
    status = models.CharField(
        max_length=20,
        choices=ChallengeStatus.choices,
        default=ChallengeStatus.DRAFT,
        db_index=True,
    )
    is_featured = models.BooleanField(default=True, help_text='Show on homepage')

    # Configuration
    max_submissions_per_user = models.IntegerField(default=3, help_text='Max submissions per user')
    allow_voting = models.BooleanField(default=True, help_text='Enable community voting')
    require_project_link = models.BooleanField(default=False, help_text='Require link to a project')
    allow_external_submissions = models.BooleanField(
        default=True, help_text='Allow submissions with external URLs (not just projects)'
    )

    # Visual
    hero_image_url = models.URLField(blank=True, help_text='Hero image for the challenge page')
    theme_color = models.CharField(max_length=20, default='purple', help_text='Theme color for UI styling')

    # Sponsor (optional)
    sponsor = models.ForeignKey(
        ChallengeSponsor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='challenges',
        help_text='Optional sponsor for this challenge',
    )

    # Prize configuration (flexible JSON structure)
    prizes = models.JSONField(
        default=dict,
        blank=True,
        help_text='Prize configuration: {"1st": {"type": "cash", "amount": 100}, ...}',
    )

    # Points configuration
    points_config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Points config: {"submit": 50, "vote": 5, "early_bird": 25}',
    )

    # Suggested tools for this challenge (list of tool info)
    suggested_tools = models.JSONField(
        default=list,
        blank=True,
        help_text='List of suggested AI tools: [{"name": "Midjourney", "url": "https://...", "icon": "..."}, ...]',
    )

    # Stats (cached for performance)
    submission_count = models.IntegerField(default=0)
    participant_count = models.IntegerField(default=0)
    total_votes = models.IntegerField(default=0)

    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='challenges_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-starts_at']
        indexes = [
            models.Index(fields=['status', '-starts_at']),
            models.Index(fields=['year', 'week_number']),
            models.Index(fields=['-starts_at']),
            models.Index(fields=['is_featured', 'status']),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)

        # Set default points config if not provided
        if not self.points_config:
            self.points_config = {
                'submit': 50,
                'early_bird': 25,
                'vote_cast': 5,
                'vote_received': 2,
                'featured': 100,
                'winner_1st': 500,
                'winner_2nd': 300,
                'winner_3rd': 200,
                'top_10': 100,
            }

        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """Check if challenge is currently active for submissions."""
        return self.status == ChallengeStatus.ACTIVE

    @property
    def is_voting(self):
        """Check if challenge is in voting period."""
        return self.status == ChallengeStatus.VOTING

    @property
    def can_submit(self):
        """Check if submissions are currently allowed."""
        now = timezone.now()
        return (
            self.status in [ChallengeStatus.ACTIVE, ChallengeStatus.UPCOMING]
            and self.starts_at <= now <= self.submission_deadline
        )

    @property
    def can_vote(self):
        """Check if voting is currently allowed."""
        if not self.allow_voting:
            return False
        now = timezone.now()
        if self.voting_deadline:
            return self.submission_deadline <= now <= self.voting_deadline
        return self.status in [ChallengeStatus.ACTIVE, ChallengeStatus.VOTING]

    @property
    def time_remaining(self):
        """Get time remaining for current phase."""
        now = timezone.now()
        if self.status == ChallengeStatus.ACTIVE:
            delta = self.submission_deadline - now
        elif self.status == ChallengeStatus.VOTING and self.voting_deadline:
            delta = self.voting_deadline - now
        else:
            return None

        if delta.total_seconds() <= 0:
            return None
        return delta

    def get_point_value(self, activity: str) -> int:
        """Get points for an activity from config."""
        return self.points_config.get(activity, 0)

    def update_stats(self):
        """Refresh cached stats from submissions."""
        from django.db.models import Count, Sum

        stats = self.submissions.filter(is_disqualified=False).aggregate(
            submission_count=Count('id'),
            participant_count=Count('user', distinct=True),
            total_votes=Sum('vote_count'),
        )
        self.submission_count = stats['submission_count'] or 0
        self.participant_count = stats['participant_count'] or 0
        self.total_votes = stats['total_votes'] or 0
        self.save(update_fields=['submission_count', 'participant_count', 'total_votes'])


class ChallengeSubmission(models.Model):
    """User submission for a weekly challenge."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    challenge = models.ForeignKey(
        WeeklyChallenge,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='challenge_submissions',
    )

    # Submission content
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='challenge_submissions',
        help_text='Link to an existing project (optional)',
    )
    title = models.CharField(max_length=200, help_text='Submission title')
    description = models.TextField(blank=True, help_text='Optional description')
    image_url = models.URLField(blank=True, help_text='Direct image URL (if no project)')
    external_url = models.URLField(blank=True, help_text='External link (portfolio, etc.)')

    # AI tool used (for tracking/filtering)
    ai_tool_used = models.CharField(max_length=100, blank=True, help_text='AI tool used (e.g., Midjourney, DALL-E)')

    # Scoring
    vote_count = models.IntegerField(default=0, db_index=True)
    judge_score = models.FloatField(null=True, blank=True, help_text='Optional judge/AI score (0-100)')
    final_rank = models.IntegerField(null=True, blank=True, db_index=True, help_text='Final rank when challenge ends')

    # Points awarded
    participation_points = models.IntegerField(default=0)
    bonus_points = models.IntegerField(default=0)
    prize_points = models.IntegerField(default=0)

    # Flags
    is_featured = models.BooleanField(default=False, help_text="Editor's pick")
    is_disqualified = models.BooleanField(default=False)
    disqualification_reason = models.TextField(blank=True)

    # Early bird tracking
    is_early_bird = models.BooleanField(default=False, help_text='Submitted within first 24 hours')

    # Timestamps
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-vote_count', '-submitted_at']
        indexes = [
            models.Index(fields=['challenge', '-vote_count']),
            models.Index(fields=['challenge', 'user']),
            models.Index(fields=['user', '-submitted_at']),
            models.Index(fields=['challenge', 'final_rank']),
            models.Index(fields=['is_featured', '-vote_count']),
        ]

    def __str__(self):
        return f'{self.title} by {self.user.username}'

    def get_image_url(self):
        """Get the best available image URL."""
        if self.image_url:
            return self.image_url
        if self.project and self.project.featured_image_url:
            return self.project.featured_image_url
        return ''

    def award_participation_points(self):
        """Award participation points for submitting."""
        if self.participation_points > 0:
            return  # Already awarded

        points = self.challenge.get_point_value('submit')

        # Check for early bird bonus
        early_bird_window = self.challenge.starts_at + timezone.timedelta(hours=24)
        if self.submitted_at <= early_bird_window:
            self.is_early_bird = True
            points += self.challenge.get_point_value('early_bird')

        self.participation_points = points
        self.save(update_fields=['participation_points', 'is_early_bird'])

        # Award points to user via Thrive Circle
        self.user.add_points(
            points,
            'challenge_submit',
            f'Submitted to challenge: {self.challenge.title}',
        )


class ChallengeVote(models.Model):
    """Vote on a challenge submission."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        ChallengeSubmission,
        on_delete=models.CASCADE,
        related_name='votes',
    )
    voter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='challenge_votes',
    )

    # Vote weight (for future expansion - verified users, etc.)
    weight = models.FloatField(default=1.0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['submission', 'voter']]
        indexes = [
            models.Index(fields=['submission', '-created_at']),
            models.Index(fields=['voter', '-created_at']),
        ]

    def __str__(self):
        return f'{self.voter.username} voted for {self.submission.title}'

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)

        if is_new:
            # Update vote count on submission
            self.submission.vote_count = self.submission.votes.aggregate(total=models.Sum('weight'))['total'] or 0
            self.submission.save(update_fields=['vote_count'])

            # Award points for voting
            points = self.submission.challenge.get_point_value('vote_cast')
            if points > 0:
                self.voter.add_points(
                    points,
                    'challenge_vote',
                    f'Voted in challenge: {self.submission.challenge.title}',
                )

            # Award points to submission owner for receiving vote
            points_received = self.submission.challenge.get_point_value('vote_received')
            if points_received > 0:
                self.submission.user.add_points(
                    points_received,
                    'challenge_vote_received',
                    f'Received vote in challenge: {self.submission.challenge.title}',
                )


class ChallengeParticipant(models.Model):
    """Track user participation in challenges for stats and rewards."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    challenge = models.ForeignKey(
        WeeklyChallenge,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='challenge_participations',
    )

    # Participation stats
    submission_count = models.IntegerField(default=0)
    votes_cast = models.IntegerField(default=0)
    votes_received = models.IntegerField(default=0)

    # Points earned in this challenge
    total_points_earned = models.IntegerField(default=0)

    # Best rank achieved
    best_rank = models.IntegerField(null=True, blank=True)

    # Prize received
    prize_awarded = models.JSONField(default=dict, blank=True)

    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['challenge', 'user']]
        indexes = [
            models.Index(fields=['challenge', 'total_points_earned']),
            models.Index(fields=['user', '-joined_at']),
        ]

    def __str__(self):
        return f'{self.user.username} in {self.challenge.title}'

    def update_stats(self):
        """Refresh stats from submissions and votes."""
        # Count submissions
        self.submission_count = ChallengeSubmission.objects.filter(
            challenge=self.challenge, user=self.user, is_disqualified=False
        ).count()

        # Count votes cast
        self.votes_cast = ChallengeVote.objects.filter(submission__challenge=self.challenge, voter=self.user).count()

        # Count votes received
        self.votes_received = ChallengeVote.objects.filter(
            submission__challenge=self.challenge, submission__user=self.user
        ).count()

        # Get best rank
        best_submission = (
            ChallengeSubmission.objects.filter(challenge=self.challenge, user=self.user, final_rank__isnull=False)
            .order_by('final_rank')
            .first()
        )
        self.best_rank = best_submission.final_rank if best_submission else None

        self.save(update_fields=['submission_count', 'votes_cast', 'votes_received', 'best_rank'])
