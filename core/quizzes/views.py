import logging

import bleach
from django.db import transaction
from django.db.models import Avg, F, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from core.thrive_circle.models import PointActivity, UserSideQuest
from core.thrive_circle.services import PointsService

from .models import Quiz, QuizAttempt, QuizQuestion
from .serializers import (
    QuizAttemptSerializer,
    QuizDetailSerializer,
    QuizQuestionPublicSerializer,
    QuizSerializer,
    SubmitAnswerSerializer,
)
from .throttles import QuizAnswerThrottle, QuizStartThrottle

logger = logging.getLogger(__name__)


class QuizViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing quizzes.
    List and retrieve published quizzes.
    """

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = QuizSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        queryset = (
            Quiz.objects.filter(is_published=True).select_related('created_by').prefetch_related('tools', 'categories')
        )

        # Filter by tools (OR logic - match quizzes with ANY of the selected tools)
        tools_list = self.request.query_params.getlist('tools')
        if tools_list:
            try:
                # Handle both array params (tools=1&tools=2) and comma-separated (tools=1,2)
                if len(tools_list) > 1:
                    tool_ids = [int(tid) for tid in tools_list if tid]
                elif tools_list[0]:
                    tool_ids = [int(tid) for tid in tools_list[0].split(',') if tid.strip()]
                else:
                    tool_ids = []

                if tool_ids:
                    queryset = queryset.filter(tools__id__in=tool_ids).distinct()
            except (ValueError, IndexError):
                pass  # Invalid tool IDs, ignore

        # Filter by categories (OR logic - match quizzes with ANY of the selected categories)
        categories_list = self.request.query_params.getlist('categories')
        if categories_list:
            try:
                # Handle both array params and comma-separated
                if len(categories_list) > 1:
                    category_ids = [int(cid) for cid in categories_list if cid]
                elif categories_list[0]:
                    category_ids = [int(cid) for cid in categories_list[0].split(',') if cid.strip()]
                else:
                    category_ids = []

                if category_ids:
                    queryset = queryset.filter(categories__id__in=category_ids).distinct()
            except (ValueError, IndexError):
                pass  # Invalid category IDs, ignore

        # Filter by topics array (OR logic - match quizzes with ANY of the selected topics)
        topics_list = self.request.query_params.getlist('topics')
        if topics_list:
            try:
                # Handle both array params and comma-separated
                if len(topics_list) > 1:
                    topic_names = [t for t in topics_list if t]
                elif topics_list[0]:
                    topic_names = [t.strip() for t in topics_list[0].split(',') if t.strip()]
                else:
                    topic_names = []

                if topic_names:
                    # Use __overlap to find quizzes with any matching topic
                    queryset = queryset.filter(topics__overlap=topic_names).distinct()
            except (ValueError, IndexError):
                pass  # Invalid topics, ignore

        # Filter by legacy topic field (kept for backward compatibility)
        topic = self.request.query_params.get('topic')
        if topic:
            queryset = queryset.filter(topic__iexact=topic)

        # Filter by difficulty
        difficulty = self.request.query_params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        # Search by title or description
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search) | Q(topic__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuizDetailSerializer
        return QuizSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], throttle_classes=[QuizStartThrottle])
    def start(self, request, slug=None):
        """Start a new quiz attempt"""
        quiz = self.get_object()

        # Create new attempt
        attempt = QuizAttempt.objects.create(
            quiz=quiz, user=request.user, total_questions=quiz.question_count, answers={}
        )

        # Get questions without correct answers
        questions = quiz.questions.all()
        questions_data = QuizQuestionPublicSerializer(questions, many=True).data

        return Response({'attempt_id': attempt.id, 'questions': questions_data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def questions(self, request, slug=None):
        """Get all questions for a quiz (without correct answers)"""
        quiz = self.get_object()
        questions = quiz.questions.all()
        serializer = QuizQuestionPublicSerializer(questions, many=True)
        return Response({'questions': serializer.data})


class QuizAttemptViewSet(viewsets.GenericViewSet):
    """
    ViewSet for quiz attempts.
    Handle answering questions and completing quizzes.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = QuizAttemptSerializer

    def get_queryset(self):
        return QuizAttempt.objects.filter(user=self.request.user).select_related('quiz', 'user')

    def retrieve(self, request, pk=None):
        """Get a specific quiz attempt"""
        try:
            attempt = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(attempt)
            return Response(serializer.data)
        except QuizAttempt.DoesNotExist:
            return Response({'error': 'Quiz attempt not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], throttle_classes=[QuizAnswerThrottle])
    @transaction.atomic
    def answer(self, request, pk=None):
        """Submit an answer for a question"""
        try:
            # Lock the row to prevent race conditions
            attempt = self.get_queryset().select_for_update().get(pk=pk)
        except QuizAttempt.DoesNotExist:
            return Response(
                {'error': 'Quiz attempt not found or does not belong to you'}, status=status.HTTP_403_FORBIDDEN
            )

        # Check if already completed
        if attempt.is_completed:
            return Response({'error': 'This quiz attempt is already completed'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubmitAnswerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        question_id = str(serializer.validated_data['question_id'])
        # Sanitize user input to prevent injection attacks
        user_answer = bleach.clean(serializer.validated_data['answer'], strip=True)
        time_spent = serializer.validated_data['time_spent']

        # Check if question has already been answered
        if question_id in attempt.answers:
            return Response({'error': 'This question has already been answered'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the question
        try:
            question = QuizQuestion.objects.get(id=question_id, quiz=attempt.quiz)
        except QuizQuestion.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if answer is correct
        correct_answer = question.correct_answer
        if isinstance(correct_answer, list):
            is_correct = user_answer in correct_answer
        else:
            # Case-insensitive for true/false, exact match for multiple choice
            if question.type == 'true_false':
                is_correct = user_answer.lower().strip() == str(correct_answer).lower().strip()
            else:
                is_correct = user_answer.strip() == str(correct_answer).strip()

        # Store the answer
        answers = attempt.answers
        answers[question_id] = {'answer': user_answer, 'correct': is_correct, 'time_spent': time_spent}
        attempt.answers = answers

        # Update score using atomic operation to prevent race conditions
        if is_correct:
            attempt.score = F('score') + 1

        attempt.save()
        attempt.refresh_from_db()  # Get the actual score value

        return Response(
            {
                'correct': is_correct,
                'explanation': question.explanation,
                'correct_answer': correct_answer if not is_correct else None,
            }
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark quiz attempt as completed"""
        try:
            attempt = self.get_queryset().get(pk=pk)
        except QuizAttempt.DoesNotExist:
            return Response({'error': 'Quiz attempt not found'}, status=status.HTTP_404_NOT_FOUND)

        if attempt.is_completed:
            return Response({'error': 'This quiz attempt is already completed'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark as completed
        attempt.completed_at = timezone.now()
        attempt.save()

        # Award points for completing the quiz (with idempotency check)
        # Check if points already awarded for this quiz attempt (idempotency)
        already_awarded = PointActivity.objects.filter(
            user=request.user, activity_type='quiz_complete', description__contains=f'quiz_attempt:{attempt.id}'
        ).exists()

        points_earned = 0
        if not already_awarded:
            try:
                # Calculate points using service layer
                points_amount = PointsService.calculate_quiz_points(attempt.percentage_score)

                # Award points to user (this handles tier/level upgrades automatically)
                description = (
                    f"Completed '{attempt.quiz.title}' ({attempt.percentage_score}% score) quiz_attempt:{attempt.id}"
                )
                request.user.add_points(
                    amount=points_amount,
                    activity_type='quiz_complete',
                    description=description,
                )

                # Update lifetime quiz counter
                request.user.lifetime_quizzes_completed += 1
                request.user.save(update_fields=['lifetime_quizzes_completed'])

                points_earned = points_amount

                logger.info(
                    f'Awarded {points_amount} points for quiz completion',
                    extra={
                        'user_id': request.user.id,
                        'quiz_id': str(attempt.quiz.id),
                        'score': attempt.percentage_score,
                        'points': points_amount,
                    },
                )
            except Exception as e:
                # Log error but don't fail the quiz completion
                logger.error(
                    f'Failed to award points for quiz completion: {e}',
                    exc_info=True,
                    extra={'user_id': request.user.id, 'quiz_attempt_id': str(attempt.id)},
                )

        # Get quests that were completed by this action (completed in last 5 seconds)
        # The signal track_quiz_completed runs when attempt.save() is called above
        recent_completed_quests = UserSideQuest.objects.filter(
            user=request.user,
            status='completed',
            completed_at__gte=timezone.now() - timezone.timedelta(seconds=5),
        ).select_related('side_quest')

        completed_quests_data = [
            {
                'id': str(uq.side_quest.id),
                'title': uq.side_quest.title,
                'description': uq.side_quest.description,
                'pointsAwarded': uq.points_awarded or uq.side_quest.points_reward,
                'categoryName': uq.side_quest.category.name if uq.side_quest.category else None,
            }
            for uq in recent_completed_quests
        ]

        serializer = self.get_serializer(attempt)
        return Response(
            {
                'score': attempt.score,
                'total_questions': attempt.total_questions,
                'percentage_score': attempt.percentage_score,
                'results': serializer.data,
                'points_earned': points_earned,
                'completed_quests': completed_quests_data,
            }
        )

    @action(detail=False, methods=['get'], url_path='history')
    def quiz_history(self, request):
        """Get user's quiz attempt history"""
        attempts = self.get_queryset().filter(completed_at__isnull=False).order_by('-completed_at')
        serializer = self.get_serializer(attempts, many=True)
        return Response({'attempts': serializer.data})

    @action(detail=False, methods=['get'], url_path='stats')
    def quiz_stats(self, request):
        """Get user's quiz statistics"""
        attempts = self.get_queryset().filter(completed_at__isnull=False)

        total_attempts = attempts.count()
        if total_attempts == 0:
            return Response({'total_attempts': 0, 'average_score': 0, 'topic_breakdown': {}})

        # Calculate average score
        avg_score = attempts.aggregate(avg_score=Avg('score'), avg_total=Avg('total_questions'))
        average_percentage = (avg_score['avg_score'] / avg_score['avg_total'] * 100) if avg_score['avg_total'] else 0

        # Topic breakdown
        topic_stats = {}
        topics = attempts.values('quiz__topic').distinct()
        for topic_dict in topics:
            topic = topic_dict['quiz__topic']
            topic_attempts = attempts.filter(quiz__topic=topic)
            topic_avg = topic_attempts.aggregate(avg_score=Avg('score'), avg_total=Avg('total_questions'))
            topic_percentage = (topic_avg['avg_score'] / topic_avg['avg_total'] * 100) if topic_avg['avg_total'] else 0

            topic_stats[topic] = {'attempts': topic_attempts.count(), 'average_score': round(topic_percentage, 1)}

        return Response(
            {
                'total_attempts': total_attempts,
                'average_score': round(average_percentage, 1),
                'topic_breakdown': topic_stats,
            }
        )
