"""Quizzes domain - Interactive quiz system.

This domain handles quiz creation, questions, user attempts,
and scoring functionality.
"""
from .models import Quiz, QuizAttempt, QuizQuestion
from .serializers import QuizAttemptSerializer, QuizQuestionSerializer, QuizSerializer
from .views import QuizAttemptViewSet, QuizViewSet

__all__ = [
    # Models
    "Quiz",
    "QuizQuestion",
    "QuizAttempt",
    # Views
    "QuizViewSet",
    "QuizAttemptViewSet",
    # Serializers
    "QuizSerializer",
    "QuizQuestionSerializer",
    "QuizAttemptSerializer",
]
