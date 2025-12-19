import uuid

from django.conf import settings
from django.db import models

from core.taxonomy.models import Taxonomy
from core.tools.models import Tool


class Quiz(models.Model):
    """A collection of quiz questions on a specific topic"""

    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(
        max_length=200, unique=True, null=True, blank=True, help_text='URL-friendly version of title'
    )
    description = models.TextField()
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='beginner')
    estimated_time = models.IntegerField(help_text='Estimated time in minutes')
    thumbnail_url = models.URLField(blank=True, null=True)
    is_published = models.BooleanField(default=False)
    # Tools mentioned/covered in this quiz
    tools = models.ManyToManyField(
        Tool, blank=True, related_name='quizzes', help_text='AI tools/technologies covered in this quiz'
    )
    # Categories for filtering and organization (predefined taxonomy)
    categories = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='quizzes',
        limit_choices_to={'taxonomy_type': 'category', 'is_active': True},
        help_text='Categories that organize this quiz (from predefined Taxonomy)',
    )
    # Topic taxonomies (proper FK relationships)
    topics = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='topic_quizzes',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomies for this quiz',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_quizzes')

    class Meta:
        verbose_name_plural = 'quizzes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_published', '-created_at']),
        ]

    def __str__(self):
        return self.title

    @property
    def question_count(self):
        """Return the number of questions in this quiz"""
        return self.questions.count()


class QuizQuestion(models.Model):
    """Individual question within a quiz"""

    QUESTION_TYPE_CHOICES = [
        ('true_false', 'True/False'),
        ('multiple_choice', 'Multiple Choice'),
        ('swipe', 'Swipe'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    question = models.TextField()
    type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, default='true_false')
    correct_answer = models.JSONField(help_text='String or list of strings for correct answer(s)')
    options = models.JSONField(blank=True, null=True, help_text='Options for multiple choice questions')
    explanation = models.TextField()
    hint = models.TextField(blank=True, null=True)
    order = models.IntegerField(default=0)
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        unique_together = ['quiz', 'order']

    def __str__(self):
        return f'{self.quiz.title} - Q{self.order}: {self.question[:50]}'


class QuizAttempt(models.Model):
    """User's attempt at a quiz"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quiz_attempts')
    answers = models.JSONField(
        default=dict, help_text='Store all answers with metadata: {question_id: {answer, correct, timeSpent}}'
    )
    score = models.IntegerField(default=0)
    total_questions = models.IntegerField()
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at']),
            models.Index(fields=['quiz', '-started_at']),
        ]

    def __str__(self):
        status = 'Completed' if self.completed_at else 'In Progress'
        return f'{self.user.username} - {self.quiz.title} ({status})'

    @property
    def percentage_score(self):
        """Return score as percentage"""
        if self.total_questions == 0:
            return 0
        return round((self.score / self.total_questions) * 100, 1)

    @property
    def is_completed(self):
        """Check if attempt is completed"""
        return self.completed_at is not None
