"""Serializers for Learning Paths."""

from rest_framework import serializers

from core.taxonomy.serializers import TaxonomySerializer

from .models import (
    Concept,
    LearnerProfile,
    LearningEvent,
    MicroLesson,
    ProjectLearningMetadata,
    UserConceptMastery,
    UserLearningPath,
)


class UserLearningPathSerializer(serializers.ModelSerializer):
    """Serializer for UserLearningPath model."""

    topic_display = serializers.CharField(source='get_topic_display', read_only=True)
    topic_taxonomy = TaxonomySerializer(read_only=True)
    skill_level_display = serializers.CharField(source='get_current_skill_level_display', read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)
    points_to_next_level = serializers.IntegerField(read_only=True)
    next_skill_level = serializers.CharField(read_only=True)

    class Meta:
        model = UserLearningPath
        fields = [
            'id',
            'topic',
            'topic_display',
            'topic_taxonomy',
            'current_skill_level',
            'skill_level_display',
            'quizzes_completed',
            'quizzes_total',
            'side_quests_completed',
            'side_quests_total',
            'topic_points',
            'progress_percentage',
            'points_to_next_level',
            'next_skill_level',
            'started_at',
            'last_activity_at',
        ]
        read_only_fields = fields


class LearningPathDetailSerializer(serializers.Serializer):
    """Serializer for detailed learning path view."""

    path = UserLearningPathSerializer()
    completed_quizzes = serializers.SerializerMethodField()
    available_quizzes = serializers.SerializerMethodField()
    completed_sidequests = serializers.SerializerMethodField()
    active_sidequests = serializers.SerializerMethodField()
    recommended_next = serializers.DictField(allow_null=True)

    def get_completed_quizzes(self, obj):
        """Get completed quiz attempts with scores."""
        attempts = obj.get('completed_quizzes', [])
        return [
            {
                'id': str(attempt.id),
                'quiz_id': str(attempt.quiz.id),
                'quiz_title': attempt.quiz.title,
                'quiz_slug': attempt.quiz.slug,
                'score': attempt.score,
                'total_questions': attempt.total_questions,
                'percentage_score': attempt.percentage_score,
                'completed_at': attempt.completed_at,
            }
            for attempt in attempts
        ]

    def get_available_quizzes(self, obj):
        """Get available quizzes not yet taken."""
        quizzes = obj.get('available_quizzes', [])
        return [
            {
                'id': str(quiz.id),
                'title': quiz.title,
                'slug': quiz.slug,
                'description': quiz.description[:200] if quiz.description else '',
                'difficulty': quiz.difficulty,
                'estimated_time': quiz.estimated_time,
                'question_count': quiz.question_count,
            }
            for quiz in quizzes
        ]

    def get_completed_sidequests(self, obj):
        """Get completed side quests."""
        user_sidequests = obj.get('completed_sidequests', [])
        return [
            {
                'id': str(usq.id),
                'side_quest_id': str(usq.side_quest.id),
                'title': usq.side_quest.title,
                'difficulty': usq.side_quest.difficulty,
                'points_awarded': usq.points_awarded,
                'completed_at': usq.completed_at,
            }
            for usq in user_sidequests
        ]

    def get_active_sidequests(self, obj):
        """Get active (in-progress) side quests."""
        user_sidequests = obj.get('active_sidequests', [])
        return [
            {
                'id': str(usq.id),
                'side_quest_id': str(usq.side_quest.id),
                'title': usq.side_quest.title,
                'difficulty': usq.side_quest.difficulty,
                'progress_percentage': usq.progress_percentage,
                'current_progress': usq.current_progress,
                'target_progress': usq.target_progress,
            }
            for usq in user_sidequests
        ]


class TopicRecommendationSerializer(serializers.Serializer):
    """Serializer for topic recommendations."""

    topic = serializers.CharField()
    topic_display = serializers.CharField()
    quiz_count = serializers.IntegerField()
    sidequest_count = serializers.IntegerField()
    score = serializers.IntegerField()


# ============================================================================
# NEW LEARNING MODELS SERIALIZERS
# ============================================================================


class LearnerProfileSerializer(serializers.ModelSerializer):
    """Serializer for LearnerProfile model."""

    class Meta:
        model = LearnerProfile
        fields = [
            'preferred_learning_style',
            'current_difficulty_level',
            'preferred_session_length',
            'allow_proactive_suggestions',
            'proactive_cooldown_minutes',
            'learning_streak_days',
            'longest_streak_days',
            'total_lessons_completed',
            'total_concepts_completed',
            'total_learning_minutes',
            'total_quizzes_completed',
            'last_learning_activity',
        ]
        read_only_fields = [
            'learning_streak_days',
            'longest_streak_days',
            'total_lessons_completed',
            'total_concepts_completed',
            'total_learning_minutes',
            'total_quizzes_completed',
            'last_learning_activity',
        ]


class ConceptSerializer(serializers.ModelSerializer):
    """Serializer for Concept model."""

    tool_name = serializers.CharField(source='tool.name', read_only=True, allow_null=True)
    tool_slug = serializers.CharField(source='tool.slug', read_only=True, allow_null=True)
    topic_taxonomy = TaxonomySerializer(read_only=True)

    class Meta:
        model = Concept
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'topic',
            'topic_taxonomy',
            'tool_name',
            'tool_slug',
            'base_difficulty',
            'estimated_minutes',
            'keywords',
        ]
        read_only_fields = fields


class UserConceptMasterySerializer(serializers.ModelSerializer):
    """Serializer for UserConceptMastery model."""

    concept = ConceptSerializer(read_only=True)
    accuracy_percentage = serializers.SerializerMethodField()

    class Meta:
        model = UserConceptMastery
        fields = [
            'id',
            'concept',
            'mastery_level',
            'mastery_score',
            'times_practiced',
            'times_correct',
            'times_incorrect',
            'accuracy_percentage',
            'consecutive_correct',
            'last_practiced',
            'next_review_at',
        ]
        read_only_fields = fields

    def get_accuracy_percentage(self, obj) -> float:
        if obj.times_practiced == 0:
            return 0.0
        return round((obj.times_correct / obj.times_practiced) * 100, 1)


class MicroLessonSerializer(serializers.ModelSerializer):
    """Serializer for MicroLesson model."""

    concept_name = serializers.CharField(source='concept.name', read_only=True)
    concept_slug = serializers.CharField(source='concept.slug', read_only=True)

    class Meta:
        model = MicroLesson
        fields = [
            'id',
            'title',
            'slug',
            'concept_name',
            'concept_slug',
            'lesson_type',
            'content_template',
            'follow_up_prompts',
            'difficulty',
            'estimated_minutes',
            'is_ai_generated',
        ]
        read_only_fields = fields


class ProjectLearningMetadataSerializer(serializers.ModelSerializer):
    """Serializer for ProjectLearningMetadata model."""

    project_id = serializers.IntegerField(source='project.id', read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    author_username = serializers.CharField(source='project.user.username', read_only=True)
    concepts = ConceptSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectLearningMetadata
        fields = [
            'id',
            'project_id',
            'project_title',
            'project_slug',
            'author_username',
            'concepts',
            'is_learning_eligible',
            'learning_quality_score',
            'key_techniques',
            'complexity_level',
            'learning_summary',
            'times_used_for_learning',
        ]
        read_only_fields = fields


class LearningEventSerializer(serializers.ModelSerializer):
    """Serializer for LearningEvent model."""

    concept_name = serializers.CharField(source='concept.name', read_only=True, allow_null=True)

    class Meta:
        model = LearningEvent
        fields = [
            'id',
            'event_type',
            'concept_name',
            'was_successful',
            'payload',
            'xp_earned',
            'created_at',
        ]
        read_only_fields = fields


class CreateLearningEventSerializer(serializers.Serializer):
    """Serializer for creating a learning event."""

    event_type = serializers.ChoiceField(choices=LearningEvent.EVENT_TYPE_CHOICES)
    concept_slug = serializers.SlugField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    was_successful = serializers.BooleanField(required=False, allow_null=True)
    payload = serializers.DictField(required=False, default=dict)


class LearningStatsSerializer(serializers.Serializer):
    """Serializer for learning statistics."""

    total_events = serializers.IntegerField()
    total_xp = serializers.IntegerField()
    events_by_type = serializers.DictField()
    period_days = serializers.IntegerField()


# ============================================================================
# STRUCTURED LEARNING PATH SERIALIZERS
# ============================================================================


class ConceptNodeSerializer(serializers.Serializer):
    """Serializer for a concept node in the structured learning path."""

    id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    status = serializers.CharField()  # locked, available, in_progress, completed
    mastery_score = serializers.FloatField()
    has_quiz = serializers.BooleanField()
    estimated_minutes = serializers.IntegerField()


class TopicSectionSerializer(serializers.Serializer):
    """Serializer for a topic section in the structured learning path."""

    slug = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    progress = serializers.FloatField()
    concept_count = serializers.IntegerField()
    completed_count = serializers.IntegerField()
    concepts = ConceptNodeSerializer(many=True)


class CurrentFocusSerializer(serializers.Serializer):
    """Serializer for the user's current focus in the learning path."""

    concept = ConceptNodeSerializer(allow_null=True)
    topic_slug = serializers.CharField(allow_blank=True)
    topic_name = serializers.CharField(allow_blank=True)


class StructuredPathSerializer(serializers.Serializer):
    """Serializer for the complete structured learning path with progress."""

    has_completed_path_setup = serializers.BooleanField()
    learning_goal = serializers.CharField(allow_null=True, allow_blank=True)
    current_focus = CurrentFocusSerializer()
    overall_progress = serializers.FloatField()
    total_concepts = serializers.IntegerField()
    completed_concepts = serializers.IntegerField()
    topics = TopicSectionSerializer(many=True)
