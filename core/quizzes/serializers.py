from rest_framework import serializers

from core.auth.serializers import UserSerializer

from .models import Quiz, QuizAttempt, QuizQuestion


class QuizQuestionSerializer(serializers.ModelSerializer):
    """Serializer for quiz questions (admin view with correct answers)"""

    class Meta:
        model = QuizQuestion
        fields = [
            "id",
            "quiz_id",
            "question",
            "type",
            "correct_answer",
            "options",
            "explanation",
            "hint",
            "order",
            "image_url",
        ]
        read_only_fields = ["id"]


class QuizQuestionPublicSerializer(serializers.ModelSerializer):
    """Serializer for quiz questions without correct answers (for quiz taking)"""

    class Meta:
        model = QuizQuestion
        fields = ["id", "quiz_id", "question", "type", "options", "hint", "order", "image_url"]
        read_only_fields = ["id"]


class QuizSerializer(serializers.ModelSerializer):
    """Serializer for quiz list and detail views"""

    question_count = serializers.IntegerField(read_only=True)
    created_by = UserSerializer(read_only=True)
    user_has_attempted = serializers.SerializerMethodField()
    user_best_score = serializers.SerializerMethodField()
    user_attempt_count = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "topic",
            "difficulty",
            "estimated_time",
            "question_count",
            "thumbnail_url",
            "is_published",
            "created_at",
            "updated_at",
            "created_by",
            "user_has_attempted",
            "user_best_score",
            "user_attempt_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "question_count"]

    def get_user_has_attempted(self, obj):
        """Check if the current user has attempted this quiz"""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False).exists()
        return False

    def get_user_best_score(self, obj):
        """Get the user's best score percentage for this quiz"""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            attempts = QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False)
            if attempts.exists():
                best_attempt = max(attempts, key=lambda x: x.percentage_score)
                return round(best_attempt.percentage_score, 1)
        return None

    def get_user_attempt_count(self, obj):
        """Get the number of times the user has completed this quiz"""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return QuizAttempt.objects.filter(quiz=obj, user=request.user, completed_at__isnull=False).count()
        return 0


class QuizDetailSerializer(QuizSerializer):
    """Detailed quiz serializer with questions (for admins)"""

    questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta(QuizSerializer.Meta):
        fields = QuizSerializer.Meta.fields + ["questions"]


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Serializer for quiz attempts"""

    quiz = QuizSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    percentage_score = serializers.FloatField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "quiz",
            "user",
            "answers",
            "score",
            "total_questions",
            "percentage_score",
            "is_completed",
            "started_at",
            "completed_at",
        ]
        read_only_fields = ["id", "started_at"]


class StartQuizSerializer(serializers.Serializer):
    """Serializer for starting a quiz"""

    quiz_id = serializers.UUIDField()


class SubmitAnswerSerializer(serializers.Serializer):
    """Serializer for submitting an answer"""

    question_id = serializers.UUIDField()
    answer = serializers.CharField()
    time_spent = serializers.IntegerField(min_value=0, help_text="Time spent in seconds")


class CompleteQuizSerializer(serializers.Serializer):
    """Serializer for completing a quiz"""

    pass  # No input needed, just marks the attempt as complete
