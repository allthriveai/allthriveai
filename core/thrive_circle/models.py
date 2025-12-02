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

    def __str__(self):
        return self.name

    @property
    def quest_count(self):
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

    TOPIC_CHOICES = [
        ('chatbots-conversation', 'Chatbots & Conversation'),
        ('websites-apps', 'Websites & Apps'),
        ('images-video', 'Images & Video'),
        ('design-ui', 'Design (Mockups & UI)'),
        ('video-creative-media', 'Video & Multimodal Media'),
        ('podcasts-education', 'Podcasts & Educational Series'),
        ('games-interactive', 'Games & Interactive Experiences'),
        ('workflows-automation', 'Workflows & Automation'),
        ('productivity', 'Productivity'),
        ('developer-coding', 'Developer & Coding Projects'),
        ('prompts-templates', 'Prompt Collections & Templates'),
        ('thought-experiments', 'Thought Experiments & Concept Pieces'),
        ('wellness-growth', 'Wellness & Personal Growth'),
        ('ai-agents-multitool', 'AI Agents & Multi-Tool Systems'),
        ('ai-models-research', 'AI Models & Research'),
        ('data-analytics', 'Data & Analytics'),
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

    # Topic-based progression (Phase 2 enhancement)
    topic = models.CharField(
        max_length=50,
        choices=TOPIC_CHOICES,
        blank=True,
        default='',
        help_text='Specific topic this quest belongs to (empty = universal quest)',
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
        ]

    def __str__(self):
        return f'{self.user.username} - {self.side_quest.title} ({self.status})'

    @property
    def progress_percentage(self):
        """Calculate percentage progress towards quest completion."""
        if self.target_progress == 0:
            return 0
        return min(100, int((self.current_progress / self.target_progress) * 100))

    def complete(self):
        """Mark quest as completed and award points."""
        if self.is_completed:
            return

        self.is_completed = True
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.points_awarded = self.side_quest.points_reward
        self.save()

        # Award points to user
        self.user.add_points(self.points_awarded, 'side_quest', f'Completed: {self.side_quest.title}')
