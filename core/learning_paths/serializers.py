"""Serializers for Learning Paths."""

from rest_framework import serializers

from .models import UserLearningPath


class UserLearningPathSerializer(serializers.ModelSerializer):
    """Serializer for UserLearningPath model."""

    topic_display = serializers.CharField(source='get_topic_display', read_only=True)
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
