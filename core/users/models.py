import logging
from datetime import timedelta
from urllib.parse import urlparse

import bleach
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


class UserRole(models.TextChoices):
    EXPLORER = 'explorer', 'Explorer'
    LEARNER = 'learner', 'Learner'
    EXPERT = 'expert', 'Expert'
    CREATOR = 'creator', 'Creator'
    MENTOR = 'mentor', 'Mentor'
    PATRON = 'patron', 'Patron'
    ADMIN = 'admin', 'Admin'
    BOT = 'bot', 'Bot'


class User(AbstractUser):
    """Custom user model with role-based permissions."""

    # Override email to make it unique
    email = models.EmailField(unique=True, blank=False)

    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EXPLORER,
        help_text='User role determines access level and permissions',
    )

    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    tagline = models.CharField(max_length=150, blank=True, help_text='Short headline or professional title')
    location = models.CharField(max_length=100, blank=True, help_text='City, state/country or "Remote"')
    pronouns = models.CharField(max_length=50, blank=True, help_text='e.g. she/her, he/him, they/them')
    current_status = models.CharField(
        max_length=200, blank=True, help_text="Current availability or what you're working on"
    )
    website_url = models.URLField(blank=True, null=True, help_text='Personal website or portfolio URL')
    calendar_url = models.URLField(blank=True, null=True, help_text='Public calendar URL for scheduling')

    # Social media links for public profile
    linkedin_url = models.URLField(blank=True, null=True, help_text='LinkedIn profile URL')
    twitter_url = models.URLField(blank=True, null=True, help_text='Twitter/X profile URL')
    github_url = models.URLField(blank=True, null=True, help_text='GitHub profile URL')
    youtube_url = models.URLField(blank=True, null=True, help_text='YouTube channel URL')
    instagram_url = models.URLField(blank=True, null=True, help_text='Instagram profile URL')

    # Privacy settings
    playground_is_public = models.BooleanField(default=True, help_text='Allow others to view your Playground projects')
    is_profile_public = models.BooleanField(
        default=True,
        db_index=True,  # Index for sitemap queries
        help_text='Allow profile to appear in search engines and sitemaps. Opt-out for privacy.',
    )
    gamification_is_public = models.BooleanField(
        default=True, help_text='Show points, level, tier, and achievements on public profile'
    )
    allow_llm_training = models.BooleanField(
        default=False,  # Opt-in by default for privacy
        help_text='Allow AI models (like ChatGPT) to use profile data for training',
    )
    allow_similarity_matching = models.BooleanField(
        default=True,  # Opt-out: default to enabled for better recommendations
        help_text=(
            'Allow your preferences to be used for finding users with similar interests '
            '(collaborative filtering). Your specific interests are never shared, only used '
            'anonymously for recommendations.'
        ),
    )

    # Gamification System - Single Source of Truth
    # Tier choices and thresholds
    TIER_CHOICES = [
        ('seedling', 'Seedling'),
        ('sprout', 'Sprout'),
        ('blossom', 'Blossom'),
        ('bloom', 'Bloom'),
        ('evergreen', 'Evergreen'),
    ]

    TIER_THRESHOLDS = {
        'seedling': 0,
        'sprout': 1000,
        'blossom': 2500,
        'bloom': 5000,
        'evergreen': 10000,
    }

    # Level thresholds (points required to reach each level)
    LEVEL_THRESHOLDS = [
        0,  # Level 1
        100,  # Level 2
        250,  # Level 3
        500,  # Level 4
        800,  # Level 5
        1200,  # Level 6
        1700,  # Level 7
        2300,  # Level 8
        3000,  # Level 9
        3800,  # Level 10
        4800,  # Level 11
        6000,  # Level 12
        7500,  # Level 13
        9300,  # Level 14
        11500,  # Level 15
        14100,  # Level 16
        17200,  # Level 17
        21000,  # Level 18
        25600,  # Level 19
        31000,  # Level 20
        41000,  # Level 21 (+10,000 per level after 20)
        51000,  # Level 22
        61000,  # Level 23
    ]

    # Points and progression (indexed for performance at scale)
    total_points = models.IntegerField(default=0, help_text='Total points earned by user')
    level = models.IntegerField(default=1, help_text='User level calculated from points')
    tier = models.CharField(
        max_length=20, choices=TIER_CHOICES, default='seedling', help_text='User tier based on total points'
    )

    # Streak tracking
    current_streak_days = models.IntegerField(default=0, help_text='Current consecutive day streak')
    longest_streak_days = models.IntegerField(default=0, help_text='Longest streak ever achieved')
    last_activity_date = models.DateField(
        null=True, blank=True, help_text='Last date user earned points (for streak tracking)'
    )

    # Lifetime achievement stats
    lifetime_quizzes_completed = models.IntegerField(default=0, help_text='Total quizzes completed')
    lifetime_projects_created = models.IntegerField(default=0, help_text='Total projects created')
    lifetime_side_quests_completed = models.IntegerField(default=0, help_text='Total side quests completed')
    lifetime_comments_posted = models.IntegerField(default=0, help_text='Total comments posted')

    # Achievement tracking
    total_achievements_unlocked = models.IntegerField(default=0, help_text='Total achievements unlocked')
    last_achievement_earned_at = models.DateTimeField(
        null=True, blank=True, help_text='Timestamp of most recently earned achievement'
    )

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            # Performance indexes for community circles (collaboration over competition)
            models.Index(fields=['tier'], name='user_tier_idx'),  # Query users in same tier circle
            models.Index(fields=['tier', '-date_joined'], name='user_tier_recent_idx'),  # Recent members in tier
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(total_points__gte=0), name='user_points_non_negative'),
        ]

    def clean(self):
        """Validate and sanitize user input fields."""
        super().clean()

        # Sanitize bio to prevent XSS attacks
        if self.bio:
            allowed_tags = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li']
            allowed_attrs = {'a': ['href', 'title']}
            self.bio = bleach.clean(self.bio, tags=allowed_tags, attributes=allowed_attrs, strip=True)
            # Limit bio length
            if len(self.bio) > 5000:
                raise ValidationError('Bio must be less than 5000 characters.')

        # Validate avatar_url is from allowed domains (skip for bots)
        if self.avatar_url and self.role != UserRole.BOT:
            from django.conf import settings

            # Get MinIO endpoints from settings
            minio_endpoint = getattr(settings, 'MINIO_ENDPOINT', '')
            minio_endpoint_public = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', '')

            allowed_domains = [
                'githubusercontent.com',
                'gravatar.com',
                'googleusercontent.com',
                'github.com',
                'avatars.githubusercontent.com',
                minio_endpoint,
                minio_endpoint_public,
            ]
            # Remove empty strings from allowed_domains
            allowed_domains = [d for d in allowed_domains if d]

            try:
                parsed = urlparse(self.avatar_url)
                domain = parsed.netloc
                if not any(allowed in domain for allowed in allowed_domains):
                    raise ValidationError(f'Avatar URL must be from an allowed domain: {", ".join(allowed_domains)}')
            except Exception as e:
                raise ValidationError(f'Invalid avatar URL: {str(e)}') from e

    def save(self, *args, **kwargs):
        """Normalize username to lowercase for case-insensitivity."""
        if self.username:
            self.username = self.username.lower()
        # Run validation before saving
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_explorer(self):
        return self.role == UserRole.EXPLORER

    @property
    def is_learner(self):
        return self.role == UserRole.LEARNER

    @property
    def is_expert(self):
        return self.role == UserRole.EXPERT

    @property
    def is_creator(self):
        return self.role == UserRole.CREATOR

    @property
    def is_mentor(self):
        return self.role == UserRole.MENTOR

    @property
    def is_patron(self):
        return self.role == UserRole.PATRON

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_bot(self):
        return self.role == UserRole.BOT

    def has_role_permission(self, required_role: str) -> bool:
        """Check if user has at least the required role level."""
        role_hierarchy = {
            UserRole.EXPLORER: 1,
            UserRole.LEARNER: 2,
            UserRole.EXPERT: 3,
            UserRole.CREATOR: 4,
            UserRole.MENTOR: 5,
            UserRole.PATRON: 6,
            UserRole.ADMIN: 7,
        }

        if self.is_superuser:
            return True

        user_level = role_hierarchy.get(self.role, 0)
        required_level = role_hierarchy.get(required_role, 0)

        return user_level >= required_level

    # ============================================================================
    # GAMIFICATION METHODS - Production-Ready Points System
    # ============================================================================

    @transaction.atomic
    def add_points(self, amount, activity_type, description=''):
        """
        Award points to user with atomic transaction and race condition protection.

        This is the ONLY method that should be used to award points.
        Handles tier/level upgrades, streak tracking, and activity logging automatically.

        Args:
            amount (int): Points to award (must be positive)
            activity_type (str): Type of activity (quiz_complete, project_create, etc.)
            description (str): Optional human-readable description

        Returns:
            int: User's new total_points value

        Raises:
            ValueError: If amount is not positive

        Example:
            user.add_points(25, 'project_create', 'Created: My First Project')
        """
        if amount <= 0:
            raise ValueError(f'Points amount must be positive, got {amount}')

        if amount > 10000:
            logger.warning(
                f'Large points award: {amount} points to user {self.username}',
                extra={'user_id': self.id, 'activity_type': activity_type},
            )

        # Store old values for upgrade detection
        old_tier = self.tier
        old_level = self.level

        # Atomic points update using F() expression (prevents race conditions)
        User.objects.filter(pk=self.pk).update(total_points=F('total_points') + amount)

        # Refresh to get actual value after F() expression
        self.refresh_from_db()

        # Calculate and update tier and level
        new_tier = self._calculate_tier()
        new_level = self._calculate_level()

        if new_tier != self.tier or new_level != self.level:
            self.tier = new_tier
            self.level = new_level
            self.save(update_fields=['tier', 'level'])

        # Update daily streak
        self._update_streak()

        # Log activity for history/audit trail
        from core.thrive_circle.models import PointActivity

        PointActivity.objects.create(
            user=self, amount=amount, activity_type=activity_type, description=description, tier_at_time=old_tier
        )

        # Check for tier/level upgrades and log
        tier_upgraded = old_tier != self.tier
        level_upgraded = old_level != self.level

        if tier_upgraded:
            logger.info(
                f'User {self.username} tier upgraded from {old_tier} to {self.tier}',
                extra={
                    'user_id': self.id,
                    'old_tier': old_tier,
                    'new_tier': self.tier,
                    'total_points': self.total_points,
                },
            )

        if level_upgraded:
            logger.info(
                f'User {self.username} level upgraded from {old_level} to {self.level}',
                extra={
                    'user_id': self.id,
                    'old_level': old_level,
                    'new_level': self.level,
                    'total_points': self.total_points,
                },
            )

        return self.total_points

    def _calculate_tier(self):
        """Calculate tier from total_points using threshold mapping."""
        if self.total_points >= self.TIER_THRESHOLDS['evergreen']:
            return 'evergreen'
        elif self.total_points >= self.TIER_THRESHOLDS['bloom']:
            return 'bloom'
        elif self.total_points >= self.TIER_THRESHOLDS['blossom']:
            return 'blossom'
        elif self.total_points >= self.TIER_THRESHOLDS['sprout']:
            return 'sprout'
        return 'seedling'

    def _calculate_level(self):
        """
        Calculate level from total_points.

        Levels 1-23 use predefined thresholds.
        After level 20, it's +10,000 points per additional level.
        """
        # Check predefined levels (1-23)
        for level_num, threshold in enumerate(self.LEVEL_THRESHOLDS, start=1):
            if self.total_points < threshold:
                return level_num - 1 if level_num > 1 else 1

        # After level 23 (61,000 points), calculate based on pattern
        level_20_threshold = self.LEVEL_THRESHOLDS[19]  # 31,000 points
        points_above_20 = self.total_points - level_20_threshold
        additional_levels = points_above_20 // 10000
        return 20 + additional_levels

    def _update_streak(self):
        """
        Update daily activity streak based on last_activity_date.

        Streak increases if user earned points on consecutive days.
        Resets to 1 if there's a gap of more than 1 day.
        """
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        if self.last_activity_date is None:
            # First activity ever
            User.objects.filter(pk=self.pk).update(
                current_streak_days=1,
                longest_streak_days=F('longest_streak_days') if self.longest_streak_days >= 1 else 1,
                last_activity_date=today,
            )
        elif self.last_activity_date == today:
            # Already earned points today, no streak update needed
            pass
        elif self.last_activity_date == yesterday:
            # Consecutive day! Increment streak atomically
            User.objects.filter(pk=self.pk).update(
                current_streak_days=F('current_streak_days') + 1, last_activity_date=today
            )
            # Refresh and update longest streak if current exceeds it
            self.refresh_from_db()
            if self.current_streak_days > self.longest_streak_days:
                User.objects.filter(pk=self.pk).update(longest_streak_days=F('current_streak_days'))
        else:
            # Streak broken (gap > 1 day), reset to 1
            User.objects.filter(pk=self.pk).update(current_streak_days=1, last_activity_date=today)

        # Refresh to get updated values
        self.refresh_from_db()

    @property
    def points_to_next_level(self):
        """Calculate points needed to reach next level."""
        next_level = self.level + 1
        if next_level <= len(self.LEVEL_THRESHOLDS):
            next_level_points = self.LEVEL_THRESHOLDS[next_level - 1]
        else:
            # After defined thresholds, +10,000 per level
            level_20_threshold = self.LEVEL_THRESHOLDS[19]
            additional_levels = next_level - 20
            next_level_points = level_20_threshold + (additional_levels * 10000)

        return max(0, next_level_points - self.total_points)

    @property
    def points_to_next_tier(self):
        """Calculate points needed to reach next tier."""
        tier_order = ['seedling', 'sprout', 'blossom', 'bloom', 'evergreen']
        current_index = tier_order.index(self.tier)

        if current_index >= len(tier_order) - 1:
            return 0  # Already at max tier

        next_tier = tier_order[current_index + 1]
        next_tier_points = self.TIER_THRESHOLDS[next_tier]

        return max(0, next_tier_points - self.total_points)

    @property
    def tier_display(self):
        """Get human-readable tier name."""
        return dict(self.TIER_CHOICES).get(self.tier, 'Seedling')
