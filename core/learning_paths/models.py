"""
Learning Paths models.

This module provides auto-generated learning paths that aggregate user's
learning progress across topics, quizzes, and side quests.
"""

from django.conf import settings
from django.db import models


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
        ('master', 'Master'),
    ]

    # Skill level thresholds (topic points required)
    SKILL_THRESHOLDS = {
        'beginner': 0,
        'intermediate': 200,
        'advanced': 500,
        'master': 1000,
    }

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='learning_paths')
    topic = models.CharField(max_length=50, choices=TOPIC_CHOICES)

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
        levels = ['beginner', 'intermediate', 'advanced', 'master']
        current_idx = levels.index(self.current_skill_level)

        if current_idx >= len(levels) - 1:
            return 0  # Already at master

        next_level = levels[current_idx + 1]
        threshold = self.SKILL_THRESHOLDS[next_level]
        return max(0, threshold - self.topic_points)

    @property
    def next_skill_level(self) -> str | None:
        """Get the next skill level, or None if at master."""
        levels = ['beginner', 'intermediate', 'advanced', 'master']
        current_idx = levels.index(self.current_skill_level)

        if current_idx >= len(levels) - 1:
            return None
        return levels[current_idx + 1]

    def calculate_skill_level(self) -> str:
        """Calculate skill level based on topic points."""
        if self.topic_points >= self.SKILL_THRESHOLDS['master']:
            return 'master'
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
