"""Models for the Thrive Circle gamification system."""

import logging
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class PointActivity(models.Model):
    """Individual point-earning activities for tracking and analytics."""

    ACTIVITY_TYPE_CHOICES = [
        ('quiz_complete', 'Quiz Completed'),
        ('project_create', 'Project Created'),
        ('project_update', 'Project Updated'),
        ('comment', 'Comment Posted'),
        ('reaction', 'Reaction Given'),
        ('daily_login', 'Daily Login'),
        ('streak_bonus', 'Streak Bonus'),
        ('weekly_goal', 'Weekly Goal Completed'),
        ('side_quest', 'Side Quest Completed'),
        ('special_event', 'Special Event'),
        ('referral', 'Referral Bonus'),
        ('prompt_battle', 'Battle Participation'),
        ('prompt_battle_win', 'Battle Won'),
        ('lesson_complete', 'Lesson Completed'),
        ('exercise_complete', 'Exercise Completed'),
        ('learning_path_complete', 'Learning Path Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='point_activities')

    amount = models.IntegerField(help_text='Points amount awarded')
    activity_type = models.CharField(
        max_length=30, choices=ACTIVITY_TYPE_CHOICES, help_text='Type of activity that earned points'
    )
    description = models.CharField(max_length=255, blank=True, help_text='Human-readable description')

    # Context
    tier_at_time = models.CharField(max_length=20, help_text='User tier when points were earned')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Point Activity'
        verbose_name_plural = 'Point Activities'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
            models.Index(fields=['user', 'activity_type']),  # For filtering by user + type
        ]

    def __str__(self):
        return f'{self.user.username} +{self.amount} points - {self.get_activity_type_display()}'


class WeeklyGoal(models.Model):
    """Track user progress towards weekly bonus goals."""

    GOAL_TYPE_CHOICES = [
        ('activities_3', 'Complete 3 Activities'),
        ('streak_7', 'Maintain 7-Day Streak'),
        ('help_5', 'Help 5 Community Members'),
        ('topics_2', 'Try 2 New Topics'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='weekly_goals')
    goal_type = models.CharField(max_length=30, choices=GOAL_TYPE_CHOICES)

    # Time window
    week_start = models.DateField(help_text='Monday of the week this goal is for')
    week_end = models.DateField(help_text='Sunday of the week this goal is for')

    # Progress tracking
    current_progress = models.IntegerField(
        default=0, validators=[MinValueValidator(0)], help_text='Current progress towards goal'
    )
    target_progress = models.IntegerField(validators=[MinValueValidator(1)], help_text='Target to complete goal')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Reward
    points_reward = models.IntegerField(
        default=30, validators=[MinValueValidator(1)], help_text='Points awarded on completion'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'goal_type', 'week_start']
        ordering = ['-week_start', 'goal_type']
        verbose_name = 'Weekly Goal'
        verbose_name_plural = 'Weekly Goals'
        indexes = [
            models.Index(fields=['user', 'week_start', 'is_completed']),
            models.Index(fields=['week_start', '-created_at']),
        ]

    def __str__(self):
        status = '✓' if self.is_completed else f'{self.current_progress}/{self.target_progress}'
        return f'{self.user.username} - {self.get_goal_type_display()} ({status})'

    @property
    def progress_percentage(self):
        """Calculate percentage progress towards goal."""
        if self.target_progress == 0:
            return 0
        return min(100, int((self.current_progress / self.target_progress) * 100))


class QuestCategory(models.Model):
    """
    Quest Categories/Pathways for organizing side quests.

    Categories provide structure and progression for users, grouping related quests
    into themed pathways like "Community Builder", "Learning Explorer", etc.
    """

    CATEGORY_TYPE_CHOICES = [
        ('community', 'Community'),  # Social engagement quests
        ('learning', 'Learning'),  # Educational/quiz quests
        ('creative', 'Creative'),  # Project creation quests
        ('exploration', 'Exploration'),  # Site discovery/scavenger hunts
        ('daily', 'Daily'),  # Quick daily challenges
        ('special', 'Special'),  # Limited-time events
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Category details
    name = models.CharField(max_length=100, help_text='Category name (e.g., "Community Builder")')
    slug = models.SlugField(max_length=50, unique=True, help_text='URL-friendly identifier')
    description = models.TextField(help_text='What this category is about')
    category_type = models.CharField(max_length=20, choices=CATEGORY_TYPE_CHOICES)

    # Visual styling
    icon = models.CharField(max_length=50, default='faCompass', help_text='FontAwesome icon name')
    color_from = models.CharField(max_length=20, default='blue-500', help_text='Gradient start color')
    color_to = models.CharField(max_length=20, default='purple-500', help_text='Gradient end color')

    # Category completion rewards
    completion_bonus_points = models.IntegerField(
        default=100, help_text='Bonus points for completing all quests in category'
    )

    # Ordering and display
    order = models.IntegerField(default=0, help_text='Display order')
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False, help_text='Show prominently on the page')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Quest Category'
        verbose_name_plural = 'Quest Categories'
        indexes = [
            models.Index(fields=['is_active', 'order']),
            models.Index(fields=['slug']),
            models.Index(fields=['is_featured', 'is_active']),
            models.Index(fields=['category_type', 'is_active']),
        ]

    def __str__(self):
        return self.name

    @property
    def quest_count(self):
        """
        WARNING: This property causes N+1 queries when used in list serialization.
        For list views, use annotate(quest_count=Count('quests', filter=Q(quests__is_active=True)))
        instead of accessing this property.
        """
        return self.quests.filter(is_active=True).count()


class SideQuest(models.Model):
    """
    Side Quest definitions - optional challenges users can complete for points.

    Side Quests are fun, optional challenges that provide bonus point rewards.
    They can be time-limited or permanent, and have varying difficulty levels.
    Quests can be topic-specific (helping users progress from beginner to master)
    or universal (community engagement, streaks, etc.).
    """

    QUEST_TYPE_CHOICES = [
        # Community quests
        ('comment_post', 'Comment on Posts'),  # Leave comments on others' projects
        ('give_feedback', 'Give Feedback'),  # Provide constructive feedback
        ('react_to_projects', 'React to Projects'),  # Like/heart projects
        ('follow_users', 'Follow Users'),  # Follow other creators
        # Learning quests
        ('complete_quiz', 'Complete Quiz'),  # Complete a quiz
        ('quiz_streak', 'Quiz Streak'),  # Complete X quizzes in a row
        ('perfect_quiz', 'Perfect Quiz'),  # Score 100% on a quiz
        ('explore_topics', 'Explore Topics'),  # Try quizzes in different topics
        # Creative quests
        ('create_project', 'Create Project'),  # Create a new project
        ('generate_image', 'Generate Image'),  # Use Nano Banana
        ('import_github', 'Import GitHub'),  # Import from GitHub
        ('add_description', 'Add Description'),  # Add detailed description
        # Exploration quests
        ('visit_pages', 'Visit Pages'),  # Visit specific pages
        ('find_easter_egg', 'Find Easter Egg'),  # Discover hidden features
        ('explore_profiles', 'Explore Profiles'),  # View other users' profiles
        ('use_search', 'Use Search'),  # Use semantic search feature
        # Daily quests (quick tasks)
        ('daily_login', 'Daily Login'),  # Log in today
        ('daily_activity', 'Daily Activity'),  # Complete any activity
        ('daily_engagement', 'Daily Engagement'),  # Engage with community
        # Special/Meta
        ('streak_milestone', 'Streak Milestone'),  # Reach X day streak
        ('level_up', 'Level Up'),  # Reach a new level
        ('category_complete', 'Category Complete'),  # Complete all quests in category
    ]

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
        ('epic', 'Epic'),
    ]

    SKILL_LEVEL_CHOICES = [
        ('beginner', 'Beginner'),  # 0-200 points in topic
        ('intermediate', 'Intermediate'),  # 201-500 points in topic
        ('advanced', 'Advanced'),  # 501-1000 points in topic
        ('master', 'Master'),  # 1000+ points in topic
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Quest details
    title = models.CharField(max_length=200, help_text='Quest title')
    description = models.TextField(help_text='Detailed description of the quest')
    quest_type = models.CharField(max_length=50, choices=QUEST_TYPE_CHOICES, help_text='Type of quest')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')

    # Category/Pathway
    category = models.ForeignKey(
        QuestCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quests',
        help_text='Quest category/pathway',
    )

    # Topic taxonomy (proper FK relationship)
    topic = models.ForeignKey(
        'core.Taxonomy',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='side_quests',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomy this quest belongs to (null = universal quest)',
    )
    skill_level = models.CharField(
        max_length=20,
        choices=SKILL_LEVEL_CHOICES,
        blank=True,
        default='',
        help_text='Required skill level for this quest (empty = any level)',
    )

    # Requirements (stored as JSON for flexibility)
    # Example: {"target": 5, "timeframe": "week", "criteria": "perfect_score"}
    # Auto-tracking: {"action": "comment_created", "target": 3}
    requirements = models.JSONField(default=dict, help_text='JSON object defining quest requirements')

    # Rewards
    points_reward = models.IntegerField(validators=[MinValueValidator(10)], help_text='Points awarded on completion')

    # Quest ordering within category
    order = models.IntegerField(default=0, help_text='Order within category')

    # Daily quest settings
    is_daily = models.BooleanField(default=False, help_text='Is this a rotating daily quest?')
    daily_reset_hour = models.IntegerField(default=0, help_text='Hour (0-23 UTC) when daily quest resets')

    # Repeatable settings
    is_repeatable = models.BooleanField(default=False, help_text='Can this quest be completed multiple times?')
    repeat_cooldown_hours = models.IntegerField(
        default=24, help_text='Hours before quest can be repeated (if repeatable)'
    )

    # Availability
    is_active = models.BooleanField(default=True, help_text='Whether quest is currently available')
    starts_at = models.DateTimeField(null=True, blank=True, help_text='When quest becomes available')
    expires_at = models.DateTimeField(null=True, blank=True, help_text='When quest expires (null = permanent)')

    # Multi-step guided quest support
    is_guided = models.BooleanField(default=False, help_text='True for multi-step guided quests')
    steps = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Ordered list of quest steps. '
            'Example: [{"id": "step_1", "title": "Explore", '
            '"description": "...", "destination_url": "/learn", '
            '"action_trigger": "page_visit", "icon": "book"}]'
        ),
    )
    narrative_intro = models.TextField(
        blank=True, help_text='Welcome/intro text shown when quest starts (encouraging, educational tone)'
    )
    narrative_complete = models.TextField(blank=True, help_text='Celebration text shown when quest is completed')
    estimated_minutes = models.PositiveIntegerField(
        null=True, blank=True, help_text='Estimated time to complete in minutes'
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__order', 'order', '-created_at']
        verbose_name = 'Side Quest'
        verbose_name_plural = 'Side Quests'
        indexes = [
            models.Index(fields=['is_active', '-created_at']),
            models.Index(fields=['quest_type', 'is_active']),
            models.Index(fields=['difficulty', 'is_active']),
            models.Index(fields=['topic', 'skill_level', 'is_active']),  # Topic-based filtering
            models.Index(fields=['topic', 'is_active']),  # Quick topic lookup
            models.Index(fields=['category', 'is_active', 'order']),  # Category listing
            models.Index(fields=['is_daily', 'is_active']),  # Daily quest lookup
        ]

    def __str__(self):
        return f'{self.title} ({self.get_difficulty_display()})'

    def is_available(self):
        """Check if quest is currently available."""
        now = timezone.now()
        if not self.is_active:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        return True

    def get_action_trigger(self):
        """Get the action type that triggers progress on this quest."""
        return self.requirements.get('action', None)


class UserSideQuest(models.Model):
    """
    User's progress on a Side Quest.

    Tracks individual user progress on side quests, including current progress,
    completion status, and XP awarded.
    """

    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Relationships
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='side_quests')
    side_quest = models.ForeignKey(SideQuest, on_delete=models.CASCADE, related_name='user_progresses')

    # Progress tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    current_progress = models.IntegerField(
        default=0, validators=[MinValueValidator(0)], help_text='Current progress value'
    )
    target_progress = models.IntegerField(
        validators=[MinValueValidator(1)], help_text='Target value to complete (cached from requirements)'
    )

    # Progress metadata (JSON for flexibility)
    # Example: {"quiz_ids": [1, 2, 3], "last_activity": "2024-01-15"}
    progress_data = models.JSONField(default=dict, help_text='Additional progress tracking data')

    # Multi-step guided quest progress
    current_step_index = models.PositiveIntegerField(
        default=0, help_text='Index of current step in guided quest (0-based)'
    )
    completed_step_ids = models.JSONField(default=list, help_text='List of completed step IDs: ["step_1", "step_2"]')
    step_completed_at = models.JSONField(
        default=dict, help_text='Timestamps when each step was completed: {"step_1": "2024-01-15T10:00:00Z"}'
    )

    # Completion
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    points_awarded = models.IntegerField(default=0, validators=[MinValueValidator(0)])

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'side_quest']
        ordering = ['-updated_at']
        verbose_name = 'User Side Quest'
        verbose_name_plural = 'User Side Quests'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'is_completed']),
            models.Index(fields=['side_quest', 'is_completed']),
            # Additional indexes for scalability at 100K+ users
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', 'status', '-updated_at']),
            models.Index(fields=['is_completed', '-completed_at']),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.side_quest.title} ({self.status})'

    @property
    def progress_percentage(self):
        """Calculate percentage progress towards quest completion."""
        if self.target_progress == 0:
            return 0
        return min(100, int((self.current_progress / self.target_progress) * 100))

    def complete(self, force: bool = False):
        """
        Mark quest as completed and award points.

        Uses centralized QuestCompletionService for consistent behavior.

        Args:
            force: If True, skip requirement validation (for auto-tracking completion)
        """
        from .services import QuestCompletionService

        QuestCompletionService.complete_quest(self, force=force)

    def get_current_step(self):
        """Get the current step for guided quests."""
        if not self.side_quest.is_guided or not self.side_quest.steps:
            return None
        if self.current_step_index >= len(self.side_quest.steps):
            return None
        return self.side_quest.steps[self.current_step_index]

    def get_next_step_url(self):
        """Get the destination URL for the current step."""
        step = self.get_current_step()
        return step.get('destination_url') if step else None

    def complete_step(self, step_id: str):
        """Mark a step as completed and advance to next step."""
        if step_id in self.completed_step_ids:
            return False  # Already completed

        # Add to completed steps
        completed_ids = list(self.completed_step_ids)
        completed_ids.append(step_id)
        self.completed_step_ids = completed_ids

        # Record completion timestamp
        step_times = dict(self.step_completed_at)
        step_times[step_id] = timezone.now().isoformat()
        self.step_completed_at = step_times

        # Advance to next step
        self.current_step_index += 1

        # Check if all steps completed
        if self.current_step_index >= len(self.side_quest.steps):
            self.complete()
        else:
            self.save()

        return True

    def get_steps_progress(self):
        """Get progress for all steps in the quest."""
        if not self.side_quest.is_guided or not self.side_quest.steps:
            return []

        progress = []
        for i, step in enumerate(self.side_quest.steps):
            step_id = step.get('id', f'step_{i}')
            is_completed = step_id in self.completed_step_ids
            completed_at = self.step_completed_at.get(step_id) if is_completed else None
            progress.append(
                {
                    'step': step,
                    'index': i,
                    'is_completed': is_completed,
                    'is_current': i == self.current_step_index and not self.is_completed,
                    'completed_at': completed_at,
                }
            )
        return progress


# =============================================================================
# Circle Models - Community Micro-Groups
# =============================================================================


class Circle(models.Model):
    """
    A Circle is a small community group of ~20-30 users within a tier.

    Circles are formed weekly, grouping users by their tier for a shared
    community experience. Think of it like Duolingo leagues but for
    community building rather than competition.
    """

    TIER_CHOICES = [
        ('seedling', 'Seedling'),
        ('sprout', 'Sprout'),
        ('blossom', 'Blossom'),
        ('bloom', 'Bloom'),
        ('evergreen', 'Evergreen'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Circle identity
    name = models.CharField(
        max_length=100,
        help_text='Circle name (e.g., "Seedling Circle #472" or fun generated name)',
    )
    tier = models.CharField(
        max_length=20,
        choices=TIER_CHOICES,
        help_text='Which tier this circle belongs to',
    )

    # Time window - circles are weekly
    week_start = models.DateField(help_text='Monday of the week this circle is active')
    week_end = models.DateField(help_text='Sunday of the week this circle is active')

    # Stats (cached for performance)
    member_count = models.PositiveIntegerField(default=0, help_text='Number of members in circle')
    active_member_count = models.PositiveIntegerField(default=0, help_text='Members who were active this week')

    # Metadata
    is_active = models.BooleanField(default=True, help_text='Whether this circle is currently active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-week_start', 'tier', 'name']
        verbose_name = 'Circle'
        verbose_name_plural = 'Circles'
        indexes = [
            models.Index(fields=['tier', 'week_start', 'is_active']),
            models.Index(fields=['week_start', 'week_end']),
            models.Index(fields=['is_active', '-created_at']),
        ]

    def __str__(self):
        return f'{self.name} ({self.get_tier_display()} - Week of {self.week_start})'

    def update_member_counts(self):
        """Update cached member counts."""
        self.member_count = self.memberships.filter(is_active=True).count()
        # Active = had any point activity this week
        from django.db.models import Exists, OuterRef

        active_users = PointActivity.objects.filter(
            user=OuterRef('user'),
            created_at__date__gte=self.week_start,
            created_at__date__lte=self.week_end,
        )
        self.active_member_count = (
            self.memberships.filter(is_active=True)
            .annotate(has_activity=Exists(active_users))
            .filter(has_activity=True)
            .count()
        )
        self.save(update_fields=['member_count', 'active_member_count', 'updated_at'])


class CircleMembership(models.Model):
    """
    Links a user to a Circle for a specific week.

    Users are assigned to one circle per week based on their tier.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='circle_memberships',
    )
    circle = models.ForeignKey(
        Circle,
        on_delete=models.CASCADE,
        related_name='memberships',
    )

    # Membership state
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    # Activity tracking for this membership period
    points_earned_in_circle = models.IntegerField(
        default=0,
        help_text='Points earned while in this circle',
    )
    was_active = models.BooleanField(
        default=False,
        help_text='Whether user was active during this circle period',
    )

    class Meta:
        unique_together = ['user', 'circle']
        ordering = ['-joined_at']
        verbose_name = 'Circle Membership'
        verbose_name_plural = 'Circle Memberships'
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['circle', 'is_active']),
            models.Index(fields=['user', '-joined_at']),
        ]

    def __str__(self):
        return f'{self.user.username} in {self.circle.name}'


class CircleChallenge(models.Model):
    """
    A shared weekly challenge for all members of a Circle.

    Unlike individual goals, Circle Challenges are collaborative -
    everyone in the circle contributes to a shared progress bar.
    When the circle hits the goal, everyone gets bonus points.
    """

    CHALLENGE_TYPE_CHOICES = [
        ('create_projects', 'Create Projects Together'),
        ('give_feedback', 'Give Feedback to Each Other'),
        ('complete_quests', 'Complete Side Quests'),
        ('earn_points', 'Earn Points Together'),
        ('maintain_streaks', 'Maintain Streaks'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    circle = models.ForeignKey(
        Circle,
        on_delete=models.CASCADE,
        related_name='challenges',
    )

    # Challenge details
    challenge_type = models.CharField(
        max_length=30,
        choices=CHALLENGE_TYPE_CHOICES,
        help_text='Type of challenge',
    )
    title = models.CharField(
        max_length=200,
        help_text='Human-readable challenge title',
    )
    description = models.TextField(
        blank=True,
        help_text='Detailed description of the challenge',
    )

    # Progress tracking
    target = models.PositiveIntegerField(help_text='Target value to complete challenge')
    current_progress = models.PositiveIntegerField(default=0, help_text='Current collective progress')

    # Completion
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Rewards
    bonus_points = models.PositiveIntegerField(
        default=50,
        help_text='Points awarded to each member when challenge is completed',
    )
    rewards_distributed = models.BooleanField(
        default=False,
        help_text='Whether bonus points have been distributed to members',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Circle Challenge'
        verbose_name_plural = 'Circle Challenges'
        indexes = [
            models.Index(fields=['circle', 'is_completed']),
            models.Index(fields=['challenge_type', 'is_completed']),
        ]

    def __str__(self):
        status = '✓' if self.is_completed else f'{self.current_progress}/{self.target}'
        return f'{self.circle.name} - {self.title} ({status})'

    @property
    def progress_percentage(self):
        """Calculate percentage progress towards challenge completion."""
        if self.target == 0:
            return 0
        return min(100, int((self.current_progress / self.target) * 100))

    def increment_progress(self, amount: int = 1):
        """
        Increment challenge progress atomically.

        Returns True if this increment caused the challenge to complete.
        """
        from django.db.models import F

        # Atomic increment
        CircleChallenge.objects.filter(pk=self.pk).update(
            current_progress=F('current_progress') + amount,
            updated_at=timezone.now(),
        )

        # Refresh and check completion
        self.refresh_from_db()

        if self.current_progress >= self.target and not self.is_completed:
            self.is_completed = True
            self.completed_at = timezone.now()
            self.save(update_fields=['is_completed', 'completed_at'])
            return True

        return False

    def distribute_rewards(self):
        """
        Distribute bonus points to all active circle members.

        Should only be called once when challenge completes.
        """
        if self.rewards_distributed:
            logger.warning(f'Rewards already distributed for challenge {self.id}')
            return

        active_members = self.circle.memberships.filter(is_active=True).select_related('user')

        for membership in active_members:
            membership.user.add_points(
                amount=self.bonus_points,
                activity_type='weekly_goal',  # Reuse existing activity type
                description=f'Circle Challenge: {self.title}',
            )

        self.rewards_distributed = True
        self.save(update_fields=['rewards_distributed'])

        logger.info(
            f'Distributed {self.bonus_points} points to {active_members.count()} members for challenge {self.id}'
        )


class Kudos(models.Model):
    """
    Peer recognition within a Circle.

    Circle members can give kudos to each other as a lightweight
    way to show appreciation without requiring chat functionality.
    """

    KUDOS_TYPE_CHOICES = [
        ('great_project', '🎨 Great Project'),
        ('helpful', '🤝 Helpful'),
        ('inspiring', '✨ Inspiring'),
        ('creative', '💡 Creative'),
        ('supportive', '💪 Supportive'),
        ('welcome', '👋 Welcome'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Who gave and received
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='kudos_given',
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='kudos_received',
    )

    # Context - which circle this was given in
    circle = models.ForeignKey(
        Circle,
        on_delete=models.CASCADE,
        related_name='kudos',
        help_text='The circle context where kudos was given',
    )

    # Kudos details
    kudos_type = models.CharField(
        max_length=20,
        choices=KUDOS_TYPE_CHOICES,
        default='helpful',
    )
    message = models.CharField(
        max_length=280,
        blank=True,
        help_text='Optional short message (like a tweet)',
    )

    # Optional: link to specific content
    project = models.ForeignKey(
        'core.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='kudos',
        help_text='Optional: kudos for a specific project',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Kudos'
        verbose_name_plural = 'Kudos'
        indexes = [
            models.Index(fields=['to_user', '-created_at']),
            models.Index(fields=['from_user', '-created_at']),
            models.Index(fields=['circle', '-created_at']),
        ]
        # Prevent spam: one kudos type per user pair per circle
        unique_together = ['from_user', 'to_user', 'circle', 'kudos_type']

    def __str__(self):
        return f'{self.from_user.username} → {self.to_user.username}: {self.get_kudos_type_display()}'
