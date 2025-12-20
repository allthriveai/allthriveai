from rest_framework import serializers

from core.auth.serializers import UserSerializer
from core.taxonomy.models import Taxonomy
from core.taxonomy.serializers import TaxonomySerializer
from core.tools.serializers import ToolListSerializer

from .models import Quiz, QuizAttempt, QuizQuestion


class QuizQuestionSerializer(serializers.ModelSerializer):
    """Serializer for quiz questions (admin view with correct answers)"""

    class Meta:
        model = QuizQuestion
        fields = [
            'id',
            'quiz_id',
            'question',
            'type',
            'correct_answer',
            'options',
            'explanation',
            'hint',
            'order',
            'image_url',
        ]
        read_only_fields = ['id']


class QuizQuestionPublicSerializer(serializers.ModelSerializer):
    """Serializer for quiz questions without correct answers (for quiz taking)"""

    class Meta:
        model = QuizQuestion
        fields = ['id', 'quiz_id', 'question', 'type', 'options', 'hint', 'order', 'image_url']
        read_only_fields = ['id']


class QuizSerializer(serializers.ModelSerializer):
    """Serializer for quiz list and detail views"""

    question_count = serializers.IntegerField(read_only=True)
    created_by = UserSerializer(read_only=True)
    tools = ToolListSerializer(many=True, read_only=True)
    categories = TaxonomySerializer(many=True, read_only=True)
    topics_taxonomy = TaxonomySerializer(many=True, read_only=True)
    user_has_attempted = serializers.SerializerMethodField()
    user_best_score = serializers.SerializerMethodField()
    user_attempt_count = serializers.SerializerMethodField()
    user_completed = serializers.SerializerMethodField()
    user_latest_score = serializers.SerializerMethodField()

    # Content metadata taxonomy fields - read-only nested representation
    content_type_details = serializers.SerializerMethodField()
    time_investment_details = serializers.SerializerMethodField()
    difficulty_details = serializers.SerializerMethodField()
    pricing_details = serializers.SerializerMethodField()

    # Write validation for taxonomy FK fields
    content_type_taxonomy = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='content_type', is_active=True),
        required=False,
        allow_null=True,
    )
    time_investment = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='time_investment', is_active=True),
        required=False,
        allow_null=True,
    )
    difficulty_taxonomy = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='difficulty', is_active=True),
        required=False,
        allow_null=True,
    )
    pricing_taxonomy = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='pricing', is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Quiz
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'topics',
            'topics_taxonomy',
            'tools',
            'categories',
            'difficulty',
            'estimated_time',
            'question_count',
            'thumbnail_url',
            'is_published',
            'created_at',
            'updated_at',
            'created_by',
            'user_has_attempted',
            'user_best_score',
            'user_attempt_count',
            'user_completed',
            'user_latest_score',
            # Content metadata taxonomy fields
            'content_type_taxonomy',
            'content_type_details',
            'time_investment',
            'time_investment_details',
            'difficulty_taxonomy',
            'difficulty_details',
            'pricing_taxonomy',
            'pricing_details',
            'ai_tag_metadata',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'question_count',
            'content_type_details',
            'time_investment_details',
            'difficulty_details',
            'pricing_details',
        ]

    def get_user_has_attempted(self, obj):
        """Check if the current user has attempted this quiz.

        Uses annotated _user_has_attempted if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, '_user_has_attempted'):
            return obj._user_has_attempted
        # Fallback to query (for single-object serialization)
        return QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False).exists()

    def get_user_best_score(self, obj):
        """Get the user's best score percentage for this quiz.

        Uses annotated _user_best_score if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, '_user_best_score') and obj._user_best_score is not None:
            return round(obj._user_best_score, 1)
        # Fallback to query (for single-object serialization)
        attempts = QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False)
        if attempts.exists():
            best_attempt = max(attempts, key=lambda x: x.percentage_score)
            return round(best_attempt.percentage_score, 1)
        return None

    def get_user_attempt_count(self, obj):
        """Get the number of times the user has completed this quiz.

        Uses annotated _user_attempt_count if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, '_user_attempt_count'):
            return obj._user_attempt_count
        # Fallback to query (for single-object serialization)
        return QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False).count()

    def get_user_completed(self, obj):
        """Check if the user has completed this quiz.

        Uses annotated _user_has_attempted if available (same as has_attempted).
        """
        # This is functionally identical to get_user_has_attempted
        return self.get_user_has_attempted(obj)

    def get_user_latest_score(self, obj):
        """Get the user's most recent score percentage for this quiz.

        Uses annotated _user_latest_score if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, '_user_latest_score') and obj._user_latest_score is not None:
            return round(obj._user_latest_score, 1)
        # Fallback to query (for single-object serialization)
        latest_attempt = (
            QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False)
            .order_by('-completed_at')
            .first()
        )
        if latest_attempt:
            return round(latest_attempt.percentage_score, 1)
        return None

    def get_content_type_details(self, obj):
        """Get content type taxonomy details."""
        if obj.content_type_taxonomy:
            return TaxonomySerializer(obj.content_type_taxonomy).data
        return None

    def get_time_investment_details(self, obj):
        """Get time investment taxonomy details."""
        if obj.time_investment:
            return TaxonomySerializer(obj.time_investment).data
        return None

    def get_difficulty_details(self, obj):
        """Get difficulty taxonomy details."""
        if obj.difficulty_taxonomy:
            return TaxonomySerializer(obj.difficulty_taxonomy).data
        return None

    def get_pricing_details(self, obj):
        """Get pricing taxonomy details."""
        if obj.pricing_taxonomy:
            return TaxonomySerializer(obj.pricing_taxonomy).data
        return None


class QuizDetailSerializer(QuizSerializer):
    """Detailed quiz serializer with questions (for admins)"""

    questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta(QuizSerializer.Meta):
        fields = QuizSerializer.Meta.fields + ['questions']


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Serializer for quiz attempts"""

    quiz = QuizSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    percentage_score = serializers.FloatField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            'id',
            'quiz',
            'user',
            'answers',
            'score',
            'total_questions',
            'percentage_score',
            'is_completed',
            'started_at',
            'completed_at',
        ]
        read_only_fields = ['id', 'started_at']


class StartQuizSerializer(serializers.Serializer):
    """Serializer for starting a quiz"""

    quiz_id = serializers.UUIDField()


class SubmitAnswerSerializer(serializers.Serializer):
    """Serializer for submitting an answer"""

    question_id = serializers.UUIDField()
    answer = serializers.CharField()
    time_spent = serializers.IntegerField(min_value=0, help_text='Time spent in seconds')


class CompleteQuizSerializer(serializers.Serializer):
    """Serializer for completing a quiz"""

    pass  # No input needed, just marks the attempt as complete
