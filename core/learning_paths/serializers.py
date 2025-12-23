"""Serializers for Learning Paths."""

from rest_framework import serializers

from core.taxonomy.serializers import TaxonomySerializer

from .models import (
    Concept,
    ContentHelpfulness,
    ConversationFeedback,
    GoalCheckIn,
    LearnerProfile,
    LearningEvent,
    LessonRating,
    MicroLesson,
    ProactiveOfferResponse,
    ProjectLearningMetadata,
    SavedLearningPath,
    UserConceptMastery,
    UserLearningPath,
)


class UserLearningPathSerializer(serializers.ModelSerializer):
    """Serializer for UserLearningPath model."""

    topic_display = serializers.SerializerMethodField()
    topic_data = TaxonomySerializer(source='topic_taxonomy', read_only=True)
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
            'topic_data',
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

    def get_topic_display(self, obj):
        """Get topic display name from topic_taxonomy FK or TOPIC_CHOICES."""
        # Prefer the FK relationship if populated
        if obj.topic_taxonomy:
            return obj.topic_taxonomy.name
        # Fallback to choices display for the CharField
        return obj.get_topic_display()


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


class SavedLearningPathSerializer(serializers.ModelSerializer):
    """Serializer for SavedLearningPath model (user's saved learning paths)."""

    curriculum = serializers.SerializerMethodField()
    curriculum_count = serializers.SerializerMethodField()
    ai_lesson_count = serializers.SerializerMethodField()
    curated_count = serializers.SerializerMethodField()
    topics_covered = serializers.SerializerMethodField()

    class Meta:
        model = SavedLearningPath
        fields = [
            'id',
            'slug',
            'title',
            'difficulty',
            'estimated_hours',
            'cover_image',
            'is_active',
            'is_archived',
            'is_published',
            'published_at',
            'curriculum',
            'curriculum_count',
            'ai_lesson_count',
            'curated_count',
            'topics_covered',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_curriculum(self, obj):
        """Get curriculum from path_data."""
        return obj.path_data.get('curriculum', []) if obj.path_data else []

    def get_curriculum_count(self, obj):
        """Get total curriculum item count."""
        curriculum = obj.path_data.get('curriculum', []) if obj.path_data else []
        return len(curriculum)

    def get_ai_lesson_count(self, obj):
        """Get AI-generated lesson count."""
        return obj.path_data.get('ai_lesson_count', 0) if obj.path_data else 0

    def get_curated_count(self, obj):
        """Get curated content count."""
        return obj.path_data.get('curated_count', 0) if obj.path_data else 0

    def get_topics_covered(self, obj):
        """Get topics covered from path_data."""
        return obj.path_data.get('topics_covered', []) if obj.path_data else []


class SavedLearningPathListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for SavedLearningPath list views."""

    curriculum_count = serializers.SerializerMethodField()

    class Meta:
        model = SavedLearningPath
        fields = [
            'id',
            'slug',
            'title',
            'difficulty',
            'estimated_hours',
            'cover_image',
            'is_active',
            'is_published',
            'curriculum_count',
            'created_at',
        ]
        read_only_fields = fields

    def get_curriculum_count(self, obj):
        """Get total curriculum item count."""
        curriculum = obj.path_data.get('curriculum', []) if obj.path_data else []
        return len(curriculum)


class PublicLearningPathSerializer(serializers.ModelSerializer):
    """Serializer for learning paths in the explore feed (public view)."""

    username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_avatar_url = serializers.CharField(source='user.avatar_url', read_only=True)
    curriculum_count = serializers.SerializerMethodField()
    topics_covered = serializers.SerializerMethodField()

    class Meta:
        model = SavedLearningPath
        fields = [
            'id',
            'slug',
            'title',
            'difficulty',
            'estimated_hours',
            'cover_image',
            'curriculum_count',
            'topics_covered',
            'username',
            'user_full_name',
            'user_avatar_url',
            'published_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_user_full_name(self, obj):
        """Get user display name."""
        return obj.user.get_full_name() or obj.user.username

    def get_curriculum_count(self, obj):
        """Get total curriculum item count."""
        curriculum = obj.path_data.get('curriculum', []) if obj.path_data else []
        return len(curriculum)

    def get_topics_covered(self, obj):
        """Get topics covered from path_data (limit to 5 for display)."""
        topics = obj.path_data.get('topics_covered', []) if obj.path_data else []
        return topics[:5]


class ConceptSerializer(serializers.ModelSerializer):
    """Serializer for Concept model."""

    tool_name = serializers.CharField(source='tool.name', read_only=True, allow_null=True)
    tool_slug = serializers.CharField(source='tool.slug', read_only=True, allow_null=True)
    topic_data = TaxonomySerializer(source='topic_taxonomy', read_only=True)
    topic_display = serializers.SerializerMethodField()

    class Meta:
        model = Concept
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'topic',
            'topic_display',
            'topic_data',
            'tool_name',
            'tool_slug',
            'base_difficulty',
            'estimated_minutes',
            'keywords',
        ]
        read_only_fields = fields

    def get_topic_display(self, obj):
        """Get topic display name from taxonomy FK or string field."""
        if obj.topic_taxonomy:
            return obj.topic_taxonomy.name
        return obj.topic if obj.topic else None


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
    rating_quality_score = serializers.FloatField(read_only=True)

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
            'is_lesson',
            'learning_quality_score',
            'key_techniques',
            'complexity_level',
            'learning_summary',
            'times_used_for_learning',
            'positive_ratings',
            'negative_ratings',
            'rating_quality_score',
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


# ============================================================================
# FEEDBACK SERIALIZERS - Human feedback loop models
# ============================================================================


class ConversationFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for ConversationFeedback model."""

    concept_slug = serializers.SlugRelatedField(
        source='concept',
        slug_field='slug',
        queryset=Concept.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ConversationFeedback
        fields = [
            'id',
            'session_id',
            'message_id',
            'feedback',
            'context_type',
            'topic_slug',
            'concept_slug',
            'comment',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CreateConversationFeedbackSerializer(serializers.Serializer):
    """Serializer for creating conversation feedback."""

    session_id = serializers.CharField(max_length=255)
    message_id = serializers.CharField(max_length=255)
    feedback = serializers.ChoiceField(choices=ConversationFeedback.FEEDBACK_CHOICES)
    context_type = serializers.ChoiceField(
        choices=ConversationFeedback.CONTEXT_TYPE_CHOICES,
        default='general',
    )
    topic_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    concept_slug = serializers.SlugField(required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class ProactiveOfferResponseSerializer(serializers.ModelSerializer):
    """Serializer for ProactiveOfferResponse model."""

    class Meta:
        model = ProactiveOfferResponse
        fields = [
            'id',
            'intervention_type',
            'response',
            'struggle_confidence',
            'topic_slug',
            'concept_slug',
            'session_id',
            'offered_at',
            'responded_at',
        ]
        read_only_fields = ['id', 'offered_at']


class CreateProactiveOfferResponseSerializer(serializers.Serializer):
    """Serializer for recording a proactive offer response."""

    intervention_type = serializers.CharField(max_length=30)
    response = serializers.ChoiceField(choices=ProactiveOfferResponse.RESPONSE_CHOICES)
    struggle_confidence = serializers.FloatField(min_value=0.0, max_value=1.0)
    topic_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    concept_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    session_id = serializers.CharField(max_length=255, required=False, allow_blank=True)


class ContentHelpfulnessSerializer(serializers.ModelSerializer):
    """Serializer for ContentHelpfulness model."""

    class Meta:
        model = ContentHelpfulness
        fields = [
            'id',
            'content_type',
            'content_id',
            'helpfulness',
            'topic_slug',
            'concept_slug',
            'difficulty_perception',
            'comment',
            'time_spent_seconds',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CreateContentHelpfulnessSerializer(serializers.Serializer):
    """Serializer for submitting content helpfulness feedback."""

    content_type = serializers.ChoiceField(choices=ContentHelpfulness.CONTENT_TYPE_CHOICES)
    content_id = serializers.CharField(max_length=255)
    helpfulness = serializers.ChoiceField(choices=ContentHelpfulness.HELPFULNESS_CHOICES)
    topic_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    concept_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    difficulty_perception = serializers.ChoiceField(
        choices=ContentHelpfulness.DIFFICULTY_PERCEPTION_CHOICES,
        required=False,
        allow_null=True,
    )
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    time_spent_seconds = serializers.IntegerField(required=False, min_value=0, allow_null=True)


class GoalCheckInSerializer(serializers.ModelSerializer):
    """Serializer for GoalCheckIn model."""

    class Meta:
        model = GoalCheckIn
        fields = [
            'id',
            'goal_description',
            'progress',
            'satisfaction',
            'whats_working',
            'whats_not_working',
            'blockers',
            'new_goal',
            'xp_at_checkin',
            'concepts_mastered_at_checkin',
            'streak_days_at_checkin',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CreateGoalCheckInSerializer(serializers.Serializer):
    """Serializer for submitting a goal check-in."""

    goal_description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    progress = serializers.ChoiceField(choices=GoalCheckIn.PROGRESS_CHOICES)
    satisfaction = serializers.ChoiceField(choices=GoalCheckIn.SATISFACTION_CHOICES)
    whats_working = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    whats_not_working = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    blockers = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    new_goal = serializers.CharField(required=False, allow_blank=True, max_length=500)


class FeedbackSummarySerializer(serializers.Serializer):
    """Serializer for aggregated feedback summary."""

    total_feedback_count = serializers.IntegerField()
    helpful_percentage = serializers.FloatField()
    proactive_acceptance_rate = serializers.FloatField()
    content_helpfulness_score = serializers.FloatField()
    last_goal_checkin = GoalCheckInSerializer(allow_null=True)
    recent_feedback = ConversationFeedbackSerializer(many=True)


# ============================================================================
# LESSON RATING SERIALIZERS
# ============================================================================


class LessonRatingSerializer(serializers.ModelSerializer):
    """Serializer for LessonRating model."""

    class Meta:
        model = LessonRating
        fields = [
            'id',
            'project',
            'rating',
            'feedback',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project', 'created_at', 'updated_at']


class CreateLessonRatingSerializer(serializers.Serializer):
    """Serializer for creating/updating a lesson rating."""

    rating = serializers.ChoiceField(choices=LessonRating.Rating.choices)
    feedback = serializers.CharField(required=False, allow_blank=True, max_length=2000)
