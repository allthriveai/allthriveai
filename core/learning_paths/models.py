"""
Learning Paths models.

This module provides:
- Auto-generated learning paths that aggregate user's learning progress
- Concept-level mastery tracking with spaced repetition
- Micro-lessons for conversational learning with Ember
- Project-based learning metadata linking projects to concepts
- Unified learning event stream for analytics and triggers

See: /docs/AGENTIC_LEARNING_PATHS_PLAN.md
"""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from core.taxonomy.mixins import WeaviateSyncMixin


class UserLearningPath(models.Model):
    """
    Auto-generated learning path per user per topic.

    Tracks progress through quizzes and side quests for each topic the user
    is interested in. Skill level is calculated based on activity points.
    """

    # Topic choices - imported from SideQuest to maintain consistency
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
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
        ('expert', 'Expert'),
    ]

    # Skill level thresholds (topic points required)
    SKILL_THRESHOLDS = {
        'beginner': 0,
        'intermediate': 200,
        'advanced': 500,
        'expert': 1000,
    }

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='learning_paths')
    # DEPRECATED: Use topic_taxonomy instead. This field will be removed in a future migration.
    topic = models.CharField(max_length=50, choices=TOPIC_CHOICES)
    # Topic taxonomy (proper FK relationship)
    topic_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='learning_paths',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomy for this learning path',
    )

    # Calculated skill level based on activity
    current_skill_level = models.CharField(max_length=20, choices=SKILL_LEVEL_CHOICES, default='beginner')

    # Progress metrics
    quizzes_completed = models.IntegerField(default=0)
    quizzes_total = models.IntegerField(default=0)  # Available quizzes in this topic
    side_quests_completed = models.IntegerField(default=0)
    side_quests_total = models.IntegerField(default=0)

    # Points earned in this topic
    topic_points = models.IntegerField(default=0)

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'topic']
        ordering = ['-last_activity_at']
        verbose_name = 'User Learning Path'
        verbose_name_plural = 'User Learning Paths'
        indexes = [
            models.Index(fields=['user', 'topic']),
            models.Index(fields=['user', '-last_activity_at']),
            models.Index(fields=['topic', 'current_skill_level']),
        ]

    def __str__(self):
        return f"{self.user.username}'s {self.get_topic_display()} path ({self.get_current_skill_level_display()})"

    @property
    def progress_percentage(self) -> int:
        """Calculate overall progress as percentage (0-100)."""
        total_items = self.quizzes_total + self.side_quests_total
        if total_items == 0:
            return 0
        completed = self.quizzes_completed + self.side_quests_completed
        return min(100, int((completed / total_items) * 100))

    @property
    def points_to_next_level(self) -> int:
        """Calculate points needed to reach next skill level."""
        levels = ['beginner', 'intermediate', 'advanced', 'expert']
        current_idx = levels.index(self.current_skill_level)

        if current_idx >= len(levels) - 1:
            return 0  # Already at expert

        next_level = levels[current_idx + 1]
        threshold = self.SKILL_THRESHOLDS[next_level]
        return max(0, threshold - self.topic_points)

    @property
    def next_skill_level(self) -> str | None:
        """Get the next skill level, or None if at expert."""
        levels = ['beginner', 'intermediate', 'advanced', 'expert']
        current_idx = levels.index(self.current_skill_level)

        if current_idx >= len(levels) - 1:
            return None
        return levels[current_idx + 1]

    def calculate_skill_level(self) -> str:
        """Calculate skill level based on topic points."""
        if self.topic_points >= self.SKILL_THRESHOLDS['expert']:
            return 'expert'
        elif self.topic_points >= self.SKILL_THRESHOLDS['advanced']:
            return 'advanced'
        elif self.topic_points >= self.SKILL_THRESHOLDS['intermediate']:
            return 'intermediate'
        return 'beginner'

    def update_skill_level(self) -> bool:
        """
        Recalculate and update skill level.
        Returns True if level changed.
        """
        new_level = self.calculate_skill_level()
        if new_level != self.current_skill_level:
            self.current_skill_level = new_level
            self.save(update_fields=['current_skill_level'])
            return True
        return False

    @classmethod
    def get_topic_display_name(cls, topic_slug: str) -> str:
        """Get human-readable name for a topic slug."""
        topic_dict = dict(cls.TOPIC_CHOICES)
        return topic_dict.get(topic_slug, topic_slug)


# ============================================================================
# LEARNER PROFILE - Central adaptive learning profile
# ============================================================================


class LearnerProfile(models.Model):
    """
    Central learning profile that adapts over time.

    Stores user preferences, streaks, and aggregate stats.
    Auto-created when user first engages with learning features.
    """

    LEARNING_STYLE_CHOICES = [
        ('visual', 'Visual'),
        ('hands_on', 'Hands-On'),
        ('conceptual', 'Conceptual'),
        ('mixed', 'Mixed'),
    ]

    DIFFICULTY_LEVEL_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    # Learning goal choices for cold-start personalization
    LEARNING_GOAL_CHOICES = [
        ('build_projects', 'Build AI Projects'),
        ('understand_concepts', 'Understand AI Concepts'),
        ('career', 'Get Unstuck'),
        ('exploring', 'Just Exploring'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='learner_profile',
    )

    # Learning preferences (inferred over time or set by user)
    preferred_learning_style = models.CharField(
        max_length=20,
        choices=LEARNING_STYLE_CHOICES,
        default='mixed',
        help_text='Preferred learning style (inferred from behavior)',
    )
    current_difficulty_level = models.CharField(
        max_length=20,
        choices=DIFFICULTY_LEVEL_CHOICES,
        default='beginner',
        help_text='Current adaptive difficulty level',
    )
    preferred_session_length = models.IntegerField(
        default=5,
        help_text='Preferred learning session length in minutes',
    )

    # Notification preferences
    allow_proactive_suggestions = models.BooleanField(
        default=True,
        help_text='Allow Ember to proactively suggest learning',
    )
    proactive_cooldown_minutes = models.IntegerField(
        default=10,
        help_text='Minimum minutes between proactive nudges',
    )

    # Streaks & engagement
    learning_streak_days = models.IntegerField(
        default=0,
        help_text='Current consecutive days of learning activity',
    )
    longest_streak_days = models.IntegerField(
        default=0,
        help_text='Longest streak ever achieved',
    )
    last_learning_activity = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When user last completed a learning activity',
    )
    last_proactive_nudge = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When Ember last sent a proactive nudge',
    )

    # Aggregate stats
    total_lessons_completed = models.IntegerField(default=0)
    total_concepts_completed = models.IntegerField(default=0)
    total_learning_minutes = models.IntegerField(default=0)
    total_quizzes_completed = models.IntegerField(default=0)

    # Structured learning path personalization
    has_completed_path_setup = models.BooleanField(
        default=False,
        help_text='Whether user completed the cold-start learning path setup',
    )
    learning_goal = models.CharField(
        max_length=30,
        choices=LEARNING_GOAL_CHOICES,
        blank=True,
        help_text='User-selected learning goal from cold-start',
    )
    current_focus_topic = models.CharField(
        max_length=50,
        blank=True,
        help_text='Current topic the user is focusing on',
    )
    generated_path = models.JSONField(
        null=True,
        blank=True,
        help_text='AI-generated personalized learning path structure',
    )
    path_generated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the learning path was generated',
    )
    celebration_enabled = models.BooleanField(
        default=True,
        help_text='Whether to show milestone celebrations',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Learner Profile'
        verbose_name_plural = 'Learner Profiles'

    def __str__(self):
        return f"{self.user.username}'s learning profile"

    def update_streak(self):
        """Update learning streak based on last activity."""
        now = timezone.now()
        if self.last_learning_activity:
            days_since = (now.date() - self.last_learning_activity.date()).days
            if days_since == 0:
                # Same day, no change
                pass
            elif days_since == 1:
                # Consecutive day, increment streak
                self.learning_streak_days += 1
                if self.learning_streak_days > self.longest_streak_days:
                    self.longest_streak_days = self.learning_streak_days
            else:
                # Streak broken
                self.learning_streak_days = 1
        else:
            # First activity
            self.learning_streak_days = 1

        self.last_learning_activity = now
        self.save(
            update_fields=[
                'learning_streak_days',
                'longest_streak_days',
                'last_learning_activity',
                'updated_at',
            ]
        )

    def can_receive_nudge(self) -> bool:
        """Check if enough time has passed for another proactive nudge."""
        if not self.allow_proactive_suggestions:
            return False
        if not self.last_proactive_nudge:
            return True
        cooldown = timezone.timedelta(minutes=self.proactive_cooldown_minutes)
        return timezone.now() - self.last_proactive_nudge >= cooldown


# ============================================================================
# CONCEPT - Knowledge graph node
# ============================================================================


class Concept(models.Model):
    """
    A learnable concept in the knowledge graph.

    Concepts are atomic units of learning that can be:
    - Linked to tools (e.g., "RAG" concept linked to LangChain tool)
    - Part of a topic (e.g., "RAG" is part of "ai-agents-multitool" topic)
    - Have prerequisites (e.g., "RAG" requires "embeddings" concept)
    """

    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)

    # Link to topic (matches UserLearningPath.TOPIC_CHOICES)
    # DEPRECATED: Use topic_taxonomy instead. This field will be removed in a future migration.
    topic = models.CharField(
        max_length=50,
        db_index=True,
        help_text='DEPRECATED: Use topic_taxonomy instead.',
    )
    # Topic taxonomy (proper FK relationship)
    topic_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='concepts',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomy this concept belongs to',
    )

    # Optional link to a specific tool
    tool = models.ForeignKey(
        'tools.Tool',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='concepts',
        help_text='Tool this concept is primarily about',
    )

    # Difficulty and time
    base_difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner',
    )
    estimated_minutes = models.IntegerField(
        default=5,
        help_text='Estimated time to learn this concept',
    )

    # Prerequisites (for learning path ordering)
    prerequisites = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='unlocks',
        help_text='Concepts that should be learned before this one',
    )

    # SEO and discovery
    keywords = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        default=list,
        help_text='Keywords for search and matching',
    )

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['topic', 'name']
        indexes = [
            models.Index(fields=['topic', 'is_active']),
            models.Index(fields=['base_difficulty', 'is_active']),
        ]

    def __str__(self):
        return f'{self.name} ({self.topic})'


# ============================================================================
# USER CONCEPT MASTERY - Per-user progress tracking
# ============================================================================


class UserConceptMastery(models.Model):
    """
    Tracks user proficiency of each concept with spaced repetition.

    Proficiency progresses through levels as user engages:
    unknown → aware → learning → practicing → proficient → expert
    """

    MASTERY_LEVEL_CHOICES = [
        ('unknown', 'Unknown'),
        ('aware', 'Aware'),
        ('learning', 'Learning'),
        ('practicing', 'Practicing'),
        ('proficient', 'Proficient'),
        ('expert', 'Expert'),
    ]

    # Mastery score thresholds (0.0-1.0)
    MASTERY_THRESHOLDS = {
        'unknown': 0.0,
        'aware': 0.1,
        'learning': 0.3,
        'practicing': 0.5,
        'proficient': 0.7,
        'expert': 0.9,
    }

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='concept_masteries',
    )
    concept = models.ForeignKey(
        Concept,
        on_delete=models.CASCADE,
        related_name='user_masteries',
    )

    # Current mastery
    mastery_level = models.CharField(
        max_length=20,
        choices=MASTERY_LEVEL_CHOICES,
        default='unknown',
        db_index=True,
    )
    mastery_score = models.FloatField(
        default=0.0,
        help_text='Mastery score 0.0-1.0',
    )

    # Spaced repetition fields
    last_practiced = models.DateTimeField(null=True, blank=True)
    next_review_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When to review for spaced repetition',
    )
    consecutive_correct = models.IntegerField(
        default=0,
        help_text='Consecutive correct answers (for SR interval)',
    )
    consecutive_incorrect = models.IntegerField(
        default=0,
        help_text='Consecutive incorrect answers',
    )

    # Engagement tracking
    times_practiced = models.IntegerField(default=0)
    times_correct = models.IntegerField(default=0)
    times_incorrect = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'concept']
        verbose_name = 'User Concept Mastery'
        verbose_name_plural = 'User Concept Masteries'
        indexes = [
            models.Index(fields=['user', 'mastery_level']),
            models.Index(fields=['user', 'next_review_at']),
            models.Index(fields=['concept', 'mastery_level']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.concept.name} ({self.mastery_level})'

    def calculate_mastery_level(self) -> str:
        """Calculate mastery level from score."""
        for level in reversed(['expert', 'proficient', 'practicing', 'learning', 'aware', 'unknown']):
            if self.mastery_score >= self.MASTERY_THRESHOLDS[level]:
                return level
        return 'unknown'

    def update_after_practice(self, was_correct: bool) -> bool:
        """
        Update mastery after a practice attempt.
        Returns True if mastery level changed.
        """
        self.times_practiced += 1
        self.last_practiced = timezone.now()

        if was_correct:
            self.times_correct += 1
            self.consecutive_correct += 1
            self.consecutive_incorrect = 0
            # Increase mastery score (diminishing returns)
            increase = 0.1 * (1 - self.mastery_score)
            self.mastery_score = min(1.0, self.mastery_score + increase)
            # Extend review interval (spaced repetition)
            days = min(30, 2**self.consecutive_correct)
            self.next_review_at = timezone.now() + timezone.timedelta(days=days)
        else:
            self.times_incorrect += 1
            self.consecutive_incorrect += 1
            self.consecutive_correct = 0
            # Decrease mastery score
            decrease = 0.05 * self.mastery_score
            self.mastery_score = max(0.0, self.mastery_score - decrease)
            # Shorten review interval
            self.next_review_at = timezone.now() + timezone.timedelta(days=1)

        old_level = self.mastery_level
        self.mastery_level = self.calculate_mastery_level()
        self.save()

        return old_level != self.mastery_level


# ============================================================================
# MICRO LESSON - Conversational learning content
# ============================================================================


class MicroLesson(WeaviateSyncMixin, models.Model):
    """
    Template for lessons Ember can deliver conversationally.

    Lessons can be:
    - Pre-authored (curated official content)
    - AI-generated on-the-fly (stored for reuse)

    Content supports markdown and template variables for personalization.

    Inherits from:
        WeaviateSyncMixin: Provides weaviate_uuid and last_indexed_at for vector search
    """

    LESSON_TYPE_CHOICES = [
        ('explanation', 'Explanation'),
        ('example', 'Example'),
        ('practice', 'Practice'),
        ('tip', 'Quick Tip'),
    ]

    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    concept = models.ForeignKey(
        Concept,
        on_delete=models.CASCADE,
        related_name='lessons',
    )

    lesson_type = models.CharField(
        max_length=20,
        choices=LESSON_TYPE_CHOICES,
        default='explanation',
    )

    # Content (supports markdown and template variables like {user_name})
    content_template = models.TextField(
        help_text='Lesson content with markdown support',
    )

    # Follow-up prompts Ember can use to continue conversation
    follow_up_prompts = ArrayField(
        models.CharField(max_length=500),
        blank=True,
        default=list,
        help_text='Suggested follow-up questions/prompts',
    )

    # Metadata
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner',
    )
    estimated_minutes = models.IntegerField(
        default=3,
        help_text='Estimated reading/completion time',
    )
    is_ai_generated = models.BooleanField(
        default=False,
        help_text='Whether this was AI-generated (vs curated)',
    )

    # Quality tracking
    times_delivered = models.IntegerField(default=0)
    positive_feedback_count = models.IntegerField(default=0)
    negative_feedback_count = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['concept', 'lesson_type', 'difficulty']
        indexes = [
            models.Index(fields=['concept', 'is_active']),
            models.Index(fields=['is_ai_generated', 'is_active']),
        ]

    def __str__(self):
        return f'{self.title} ({self.concept.name})'

    @property
    def quality_score(self) -> float:
        """Calculate quality score from feedback."""
        total = self.positive_feedback_count + self.negative_feedback_count
        if total == 0:
            return 0.5
        return self.positive_feedback_count / total


# ============================================================================
# PROJECT LEARNING METADATA - Projects as learning content
# ============================================================================


class ProjectLearningMetadata(models.Model):
    """
    Learning-specific metadata for highly-rated user projects.

    Links projects to concepts they demonstrate, enabling:
    - "Learn from @username's project" recommendations
    - Project-based examples in Ember's teaching
    - Creator XP rewards when their projects help others learn
    """

    COMPLEXITY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    project = models.OneToOneField(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='learning_metadata',
    )

    # Concepts this project demonstrates
    concepts = models.ManyToManyField(
        Concept,
        blank=True,
        related_name='example_projects',
        help_text='Concepts demonstrated by this project',
    )

    # Learning eligibility - defaults to True so all projects are learning content
    # Owners and admins can toggle this off via project card menu
    is_learning_eligible = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this project appears in learning content',
    )
    learning_quality_score = models.FloatField(
        default=0.0,
        db_index=True,
        help_text='Quality score for ranking (0.0-1.0)',
    )

    # What makes this project educational
    key_techniques = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='Key techniques demonstrated (e.g., "RAG", "Streaming")',
    )
    complexity_level = models.CharField(
        max_length=20,
        choices=COMPLEXITY_CHOICES,
        default='intermediate',
    )
    learning_summary = models.TextField(
        blank=True,
        help_text='AI-generated summary of what users can learn',
    )

    # Usage tracking
    times_used_for_learning = models.IntegerField(
        default=0,
        help_text='How many times this project was used for learning',
    )
    last_used_for_learning = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-learning_quality_score']
        verbose_name = 'Project Learning Metadata'
        verbose_name_plural = 'Project Learning Metadata'
        indexes = [
            models.Index(fields=['is_learning_eligible', '-learning_quality_score']),
        ]

    def __str__(self):
        return f'Learning metadata for {self.project.title}'

    def calculate_eligibility(self):
        """
        Check if project qualifies as learning content.

        Criteria:
        - Has meaningful description (100+ chars)
        - Has good engagement (views)
        - Is public and not archived
        """
        project = self.project

        has_description = len(project.description or '') >= 100
        has_views = project.view_count >= 10
        is_visible = not project.is_private and not project.is_archived
        has_architecture = bool(getattr(project.content, 'get', lambda x: None)('architecture_diagram'))

        self.is_learning_eligible = has_description and has_views and is_visible

        # Calculate quality score
        # - Description quality (0.3 weight)
        # - Views normalized (0.3 weight)
        # - Has architecture diagram (0.2 weight)
        # - Has key techniques tagged (0.2 weight)
        desc_score = min(len(project.description or '') / 500, 1.0) * 0.3
        views_score = min(project.view_count / 100, 1.0) * 0.3
        arch_score = (1.0 if has_architecture else 0.0) * 0.2
        tech_score = (1.0 if self.key_techniques else 0.0) * 0.2

        self.learning_quality_score = desc_score + views_score + arch_score + tech_score


# ============================================================================
# LEARNING EVENT - Unified event stream
# ============================================================================


class LearningEvent(models.Model):
    """
    Unified event stream for all learning activities.

    Used for:
    - Analytics and progress tracking
    - Triggering celebrations and nudges
    - Feeding the adaptive difficulty system
    """

    EVENT_TYPE_CHOICES = [
        ('quiz_attempt', 'Quiz Attempt'),
        ('quiz_completed', 'Quiz Completed'),
        ('micro_lesson', 'Micro Lesson Viewed'),
        ('concept_practiced', 'Concept Practiced'),
        ('concept_completed', 'Concept Completed'),
        ('skill_level_up', 'Skill Level Up'),
        ('streak_milestone', 'Streak Milestone'),
        ('project_learned_from', 'Learned from Project'),
        ('tool_explored', 'Tool Explored'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='learning_events',
    )
    event_type = models.CharField(
        max_length=30,
        choices=EVENT_TYPE_CHOICES,
        db_index=True,
    )

    # Optional links to related objects
    concept = models.ForeignKey(
        Concept,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='events',
    )
    lesson = models.ForeignKey(
        MicroLesson,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='events',
    )
    project = models.ForeignKey(
        'core.Project',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='learning_events',
    )

    # Event outcome
    was_successful = models.BooleanField(
        null=True,
        blank=True,
        help_text='Whether the activity was successful (e.g., correct answer)',
    )

    # Flexible payload for event-specific data
    payload = models.JSONField(
        default=dict,
        blank=True,
        help_text='Event-specific data (e.g., quiz_id, score, old_level, new_level)',
    )

    # XP earned from this event
    xp_earned = models.IntegerField(
        default=0,
        help_text='XP points earned from this event',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'event_type', '-created_at']),
            models.Index(fields=['event_type', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.event_type} at {self.created_at}'


# ============================================================================
# CONTENT GAP - Track unmet content requests
# ============================================================================


class ContentGap(models.Model):
    """
    Track when users ask for content that doesn't exist.

    Used to prioritize content creation based on demand.
    When users request topic+modality combinations that have insufficient content,
    we log it here for content strategy decisions.
    """

    class GapType(models.TextChoices):
        MISSING_TOPIC = 'missing_topic', 'Missing Topic'
        MODALITY_GAP = 'modality_gap', 'Modality Gap'
        DEPTH_GAP = 'depth_gap', 'Depth Gap'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        IN_PROGRESS = 'in_progress', 'Content In Progress'
        RESOLVED = 'resolved', 'Resolved'
        DECLINED = 'declined', 'Declined'

    # What was requested
    # DEPRECATED: Use topic_taxonomy instead. This field will be removed in a future migration.
    topic = models.CharField(
        max_length=200,
        db_index=True,
        help_text='DEPRECATED: Original topic text requested by user.',
    )
    # DEPRECATED: Use topic_taxonomy instead. This field will be removed in a future migration.
    topic_normalized = models.CharField(
        max_length=200,
        db_index=True,
        help_text='DEPRECATED: Normalized/slugified version for deduplication.',
    )
    # Topic taxonomy (proper FK relationship)
    topic_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='content_gaps',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomy for this content gap',
    )
    modality = models.CharField(
        max_length=30,
        db_index=True,
        help_text='Learning modality requested (video, quiz, etc.)',
    )
    gap_type = models.CharField(
        max_length=20,
        choices=GapType.choices,
        default=GapType.MISSING_TOPIC,
        db_index=True,
    )

    # Partial matches (if any)
    matched_taxonomy = models.ForeignKey(
        'core.Taxonomy',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='gap_requests',
        help_text='Closest matching taxonomy item (if partial match)',
    )

    # Frequency tracking
    request_count = models.PositiveIntegerField(
        default=1,
        db_index=True,
        help_text='Number of times this has been requested',
    )
    unique_user_count = models.PositiveIntegerField(
        default=1,
        help_text='Number of unique users who requested this',
    )
    results_returned = models.PositiveIntegerField(
        default=0,
        help_text='Number of results returned when gap was detected',
    )

    first_requested_at = models.DateTimeField(auto_now_add=True)
    last_requested_at = models.DateTimeField(auto_now=True, db_index=True)

    # First requester context
    first_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='content_gap_requests',
    )

    # Resolution tracking
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    context = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional context: {conversation_id, user_level, etc.}',
    )

    class Meta:
        unique_together = ['topic_normalized', 'modality']
        ordering = ['-request_count', '-last_requested_at']
        verbose_name = 'Content Gap'
        verbose_name_plural = 'Content Gaps'
        indexes = [
            models.Index(fields=['status', '-request_count']),
            models.Index(fields=['gap_type', '-request_count']),
            models.Index(fields=['modality', '-request_count']),
        ]

    def __str__(self):
        return f'{self.topic} / {self.modality} ({self.request_count} requests)'


# ============================================================================
# LEARNING OUTCOME - What users will achieve
# ============================================================================


class LearningOutcome(models.Model):
    """
    What learners will be able to do after completing learning content.

    Uses Bloom's Taxonomy verbs to ensure measurability.
    """

    class BloomLevel(models.TextChoices):
        REMEMBER = 'remember', 'Remember'
        UNDERSTAND = 'understand', 'Understand'
        APPLY = 'apply', 'Apply'
        ANALYZE = 'analyze', 'Analyze'
        EVALUATE = 'evaluate', 'Evaluate'
        CREATE = 'create', 'Create'

    class ProficiencyLevel(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'
        EXPERT = 'expert', 'Expert'

    # Core outcome definition
    verb = models.CharField(
        max_length=50,
        help_text='Action verb (e.g., "build", "explain", "analyze")',
    )
    description = models.TextField(
        help_text='Full outcome statement (e.g., "Build a RAG pipeline using LangChain")',
    )

    # Bloom's taxonomy classification
    bloom_level = models.CharField(
        max_length=20,
        choices=BloomLevel.choices,
        default=BloomLevel.APPLY,
        db_index=True,
    )

    # Link to skill taxonomy
    skill = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.CASCADE,
        related_name='learning_outcomes',
        limit_choices_to={'taxonomy_type': 'skill'},
        help_text='The skill this outcome develops',
    )

    # Proficiency gained
    proficiency_gained = models.CharField(
        max_length=20,
        choices=ProficiencyLevel.choices,
        default=ProficiencyLevel.BEGINNER,
        help_text='Proficiency level achieved when mastering this outcome',
    )

    # Measurability
    assessment_criteria = models.JSONField(
        default=list,
        blank=True,
        help_text='How to verify mastery: [{criterion, evidence_type}, ...]',
    )

    # Time investment
    estimated_hours = models.FloatField(
        default=1.0,
        help_text='Estimated hours to achieve this outcome',
    )

    # Prerequisites
    prerequisites = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='unlocks',
        help_text='Outcomes that should be achieved first',
    )

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['skill', 'bloom_level', 'verb']
        verbose_name = 'Learning Outcome'
        verbose_name_plural = 'Learning Outcomes'
        indexes = [
            models.Index(fields=['skill', 'is_active']),
            models.Index(fields=['bloom_level', 'proficiency_gained']),
        ]

    def __str__(self):
        return f'{self.verb.title()} - {self.description[:50]}'


# ============================================================================
# USER SKILL PROFICIENCY - Track user skills
# ============================================================================


class UserSkillProficiency(models.Model):
    """
    Track user proficiency in specific skills from the taxonomy.

    Different from UserConceptMastery which tracks atomic concepts.
    Skills are broader categories (e.g., "Python", "Prompt Engineering").
    """

    class ProficiencyLevel(models.TextChoices):
        NONE = 'none', 'None'
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'
        EXPERT = 'expert', 'Expert'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='skill_proficiencies',
    )

    skill = models.ForeignKey(
        'core.Taxonomy',
        on_delete=models.CASCADE,
        related_name='user_proficiencies',
        limit_choices_to={'taxonomy_type': 'skill'},
    )

    proficiency_level = models.CharField(
        max_length=20,
        choices=ProficiencyLevel.choices,
        default=ProficiencyLevel.NONE,
        db_index=True,
    )

    # Learning outcomes achieved for this skill
    outcomes_achieved = models.ManyToManyField(
        LearningOutcome,
        blank=True,
        related_name='users_achieved',
    )

    is_self_assessed = models.BooleanField(
        default=True,
        help_text='Whether this was self-assessed vs system-calculated',
    )
    first_assessed_at = models.DateTimeField(auto_now_add=True)
    last_updated_at = models.DateTimeField(auto_now=True)
    last_practiced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['user', 'skill']
        verbose_name = 'User Skill Proficiency'
        verbose_name_plural = 'User Skill Proficiencies'
        indexes = [
            models.Index(fields=['user', 'proficiency_level']),
            models.Index(fields=['skill', 'proficiency_level']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.skill.name} ({self.proficiency_level})'


# ============================================================================
# HUMAN FEEDBACK LOOP MODELS
# ============================================================================


class ConversationFeedback(models.Model):
    """
    Captures explicit feedback on Ember's responses.

    Enables the system to learn which explanations, recommendations,
    and interactions are helpful vs confusing.
    """

    FEEDBACK_CHOICES = [
        ('helpful', 'Helpful'),
        ('not_helpful', 'Not Helpful'),
        ('confusing', 'Confusing'),
        ('too_basic', 'Too Basic'),
        ('too_advanced', 'Too Advanced'),
        ('incorrect', 'Incorrect Information'),
    ]

    CONTEXT_TYPE_CHOICES = [
        ('explanation', 'Concept Explanation'),
        ('recommendation', 'Content Recommendation'),
        ('answer', 'Question Answer'),
        ('proactive', 'Proactive Suggestion'),
        ('game', 'Game/Quiz'),
        ('general', 'General Response'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversation_feedback',
    )
    session_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text='Conversation session ID for grouping',
    )
    message_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text='Specific message this feedback is for',
    )

    feedback = models.CharField(
        max_length=20,
        choices=FEEDBACK_CHOICES,
    )
    context_type = models.CharField(
        max_length=20,
        choices=CONTEXT_TYPE_CHOICES,
        default='general',
    )

    # Optional topic/concept context for learning from feedback
    topic_slug = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text='Topic being discussed when feedback was given',
    )
    concept = models.ForeignKey(
        Concept,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='conversation_feedback',
        help_text='Concept being explained when feedback was given',
    )

    # Optional text feedback for qualitative analysis
    comment = models.TextField(
        blank=True,
        help_text='Optional user comment explaining the feedback',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'feedback']),
            models.Index(fields=['topic_slug', 'feedback']),
            models.Index(fields=['context_type', 'feedback']),
            models.Index(fields=['session_id', 'created_at']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.feedback} on {self.context_type}'


class ProactiveOfferResponse(models.Model):
    """
    Tracks user responses to proactive intervention offers.

    Records when Ember offers help ("Would you like me to explain differently?")
    and whether the user accepts, declines, or ignores the offer.
    """

    RESPONSE_CHOICES = [
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('ignored', 'Ignored'),  # No response within session
        ('helpful_after', 'Accepted and Found Helpful'),
        ('not_helpful_after', 'Accepted but Not Helpful'),
    ]

    INTERVENTION_TYPE_CHOICES = [
        ('simplify_explanation', 'Simplify Explanation'),
        ('suggest_prerequisite', 'Suggest Prerequisite'),
        ('offer_example', 'Offer Example'),
        ('offer_break', 'Offer Break'),
        ('offer_help', 'General Help Offer'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='proactive_offer_responses',
    )
    session_id = models.CharField(
        max_length=255,
        db_index=True,
    )

    intervention_type = models.CharField(
        max_length=30,
        choices=INTERVENTION_TYPE_CHOICES,
    )
    response = models.CharField(
        max_length=20,
        choices=RESPONSE_CHOICES,
    )

    # Context about why the intervention was triggered
    struggle_confidence = models.FloatField(
        help_text='Confidence score of the struggle detection (0.0-1.0)',
    )
    struggle_type = models.CharField(
        max_length=50,
        blank=True,
        help_text='Type of struggle detected',
    )
    topic_slug = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
    )
    concept = models.ForeignKey(
        Concept,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='proactive_offer_responses',
    )

    # Timing
    offered_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the user responded (null if ignored)',
    )

    class Meta:
        ordering = ['-offered_at']
        indexes = [
            models.Index(fields=['user', 'intervention_type']),
            models.Index(fields=['intervention_type', 'response']),
            models.Index(fields=['struggle_confidence']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.response} to {self.intervention_type}'

    @property
    def was_successful(self) -> bool:
        """Whether the intervention was accepted and found helpful."""
        return self.response in ['accepted', 'helpful_after']

    @property
    def response_time_seconds(self) -> float | None:
        """Time between offer and response in seconds."""
        if self.responded_at:
            return (self.responded_at - self.offered_at).total_seconds()
        return None


class ContentHelpfulness(models.Model):
    """
    Captures helpfulness feedback on learning content.

    Allows users to rate lessons, quiz explanations, and other
    educational content to improve quality over time.
    """

    CONTENT_TYPE_CHOICES = [
        ('micro_lesson', 'Micro Lesson'),
        ('quiz_explanation', 'Quiz Explanation'),
        ('concept_explanation', 'Concept Explanation'),
        ('project_learning', 'Project as Learning Resource'),
        ('tool_info', 'Tool Information'),
    ]

    HELPFULNESS_CHOICES = [
        ('very_helpful', 'Very Helpful'),
        ('helpful', 'Helpful'),
        ('neutral', 'Neutral'),
        ('not_helpful', 'Not Helpful'),
        ('confusing', 'Confusing'),
    ]

    DIFFICULTY_PERCEPTION_CHOICES = [
        ('too_easy', 'Too Easy'),
        ('just_right', 'Just Right'),
        ('too_hard', 'Too Hard'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_helpfulness_feedback',
    )

    content_type = models.CharField(
        max_length=30,
        choices=CONTENT_TYPE_CHOICES,
    )
    content_id = models.CharField(
        max_length=255,
        help_text='ID of the content (lesson ID, quiz ID, etc.)',
    )

    helpfulness = models.CharField(
        max_length=20,
        choices=HELPFULNESS_CHOICES,
    )

    # Link to specific models if available
    micro_lesson = models.ForeignKey(
        MicroLesson,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='helpfulness_feedback',
    )
    concept = models.ForeignKey(
        Concept,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='helpfulness_feedback',
    )

    # Optional comment
    comment = models.TextField(
        blank=True,
        help_text='Optional feedback on how to improve',
    )

    # Context: what was the user trying to learn?
    learning_goal = models.CharField(
        max_length=255,
        blank=True,
        help_text='What the user was trying to learn',
    )
    prior_knowledge = models.CharField(
        max_length=50,
        blank=True,
        help_text='User-stated prior knowledge level',
    )

    # Additional context fields for analytics
    topic_slug = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text='Topic slug for grouping feedback',
    )
    concept_slug = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text='Concept slug for grouping feedback',
    )
    difficulty_perception = models.CharField(
        max_length=20,
        choices=DIFFICULTY_PERCEPTION_CHOICES,
        default='',
        blank=True,
        help_text='How the user perceived the difficulty',
    )
    time_spent_seconds = models.IntegerField(
        null=True,
        blank=True,
        help_text='Approximate time spent on the content',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'content_type', 'content_id']
        indexes = [
            models.Index(fields=['content_type', 'helpfulness']),
            models.Index(fields=['micro_lesson', 'helpfulness']),
            models.Index(fields=['topic_slug', 'helpfulness']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.helpfulness} for {self.content_type}'

    @classmethod
    def get_helpfulness_score(cls, content_type: str, content_id: str) -> float:
        """
        Calculate aggregate helpfulness score for content (0.0-1.0).

        Returns:
            Score from 0.0 (all confusing) to 1.0 (all very helpful)
        """
        from django.db.models import Avg, Case, FloatField, When

        score_mapping = {
            'very_helpful': 1.0,
            'helpful': 0.75,
            'neutral': 0.5,
            'not_helpful': 0.25,
            'confusing': 0.0,
        }

        result = cls.objects.filter(
            content_type=content_type,
            content_id=content_id,
        ).aggregate(
            avg_score=Avg(
                Case(
                    *[When(helpfulness=k, then=v) for k, v in score_mapping.items()],
                    output_field=FloatField(),
                )
            )
        )

        return result['avg_score'] or 0.5  # Default to neutral if no feedback


class GoalCheckIn(models.Model):
    """
    Periodic check-ins to validate learning goal progress.

    Prompts users to reflect on whether the learning content and
    recommendations are helping them reach their stated goals.
    """

    PROGRESS_CHOICES = [
        ('on_track', 'On Track'),
        ('ahead', 'Ahead of Schedule'),
        ('behind', 'Behind Schedule'),
        ('stuck', 'Stuck'),
        ('goal_changed', 'Goal Has Changed'),
        ('goal_achieved', 'Goal Achieved'),
    ]

    SATISFACTION_CHOICES = [
        ('very_satisfied', 'Very Satisfied'),
        ('satisfied', 'Satisfied'),
        ('neutral', 'Neutral'),
        ('unsatisfied', 'Unsatisfied'),
        ('very_unsatisfied', 'Very Unsatisfied'),
    ]

    GOAL_ADJUSTMENT_CHOICES = [
        ('keep_same', 'Keep Same Goal'),
        ('modify', 'Modify Goal'),
        ('new_goal', 'Set New Goal'),
        ('complete', 'Mark as Complete'),
        ('pause', 'Pause Goal'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='goal_check_ins',
    )

    # Which goal is being checked
    learning_path = models.ForeignKey(
        UserLearningPath,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='check_ins',
        help_text='Specific learning path being checked (optional)',
    )
    goal_description = models.CharField(
        max_length=500,
        help_text="User's stated learning goal at check-in time",
    )

    # Check-in responses
    progress = models.CharField(
        max_length=20,
        choices=PROGRESS_CHOICES,
    )
    satisfaction = models.CharField(
        max_length=20,
        choices=SATISFACTION_CHOICES,
    )

    # What's working / not working
    whats_working = models.TextField(
        blank=True,
        help_text='What aspects of learning are working well',
    )
    whats_not_working = models.TextField(
        blank=True,
        help_text='What aspects need improvement',
    )
    blockers = models.TextField(
        blank=True,
        help_text='Any blockers preventing progress',
    )

    # Updated goal if changed
    new_goal = models.CharField(
        max_length=500,
        blank=True,
        help_text='New goal if user changed their goal',
    )

    # Metrics at check-in time (for tracking improvement)
    xp_at_checkin = models.IntegerField(default=0)
    concepts_mastered_at_checkin = models.IntegerField(default=0)
    streak_days_at_checkin = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['progress', 'satisfaction']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.progress} ({self.created_at.date()})'

    @classmethod
    def get_last_checkin(cls, user_id: int):
        """Get user's most recent check-in."""
        return cls.objects.filter(user_id=user_id).first()

    @classmethod
    def is_checkin_due(cls, user_id: int, days_between: int = 7) -> bool:
        """
        Check if user is due for a goal check-in.

        Args:
            user_id: User to check
            days_between: Minimum days between check-ins

        Returns:
            True if check-in is due
        """
        last = cls.get_last_checkin(user_id)
        if not last:
            return True

        days_since = (timezone.now() - last.created_at).days
        return days_since >= days_between


# ============================================================================
# SAVED LEARNING PATH - Multiple paths per user
# ============================================================================


class SavedLearningPath(models.Model):
    """
    Stores generated learning paths that users can save and return to.

    Unlike LearnerProfile.generated_path which stores only one active path,
    this model allows users to have multiple saved paths they can switch between.
    """

    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_learning_paths',
    )
    slug = models.SlugField(
        max_length=200,
        help_text='URL-friendly identifier for this path',
    )
    title = models.CharField(
        max_length=255,
        help_text='Display title for the learning path',
    )

    # Full curriculum structure (same format as LearnerProfile.generated_path)
    path_data = models.JSONField(
        default=dict,
        help_text='Curriculum structure with items, tools, topics',
    )

    # Metadata
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner',
    )
    estimated_hours = models.FloatField(
        default=0.0,
        help_text='Total estimated hours to complete',
    )

    # Gemini-generated cover image
    cover_image = models.URLField(
        blank=True,
        help_text='URL to AI-generated cover image',
    )

    # Status
    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Whether this is the currently active path',
    )
    is_archived = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Soft delete - archived paths are hidden but not deleted',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'slug']
        ordering = ['-is_active', '-updated_at']
        verbose_name = 'Saved Learning Path'
        verbose_name_plural = 'Saved Learning Paths'
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        status = ' (active)' if self.is_active else ''
        return f"{self.user.username}'s path: {self.title}{status}"

    def activate(self):
        """Set this path as active and deactivate others."""
        # Deactivate all other paths for this user
        SavedLearningPath.objects.filter(
            user=self.user,
            is_active=True,
        ).exclude(pk=self.pk).update(is_active=False)
        # Activate this one
        self.is_active = True
        self.save(update_fields=['is_active', 'updated_at'])
