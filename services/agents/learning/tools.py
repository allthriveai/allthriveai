"""
LangChain tools for learning tutor agent.

Provides learning progress, quiz hints, concept explanations, and recommendations.
"""

import logging

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# Tool Input Schemas
class GetLearningProgressInput(BaseModel):
    """Input for get_learning_progress tool."""

    model_config = {'extra': 'allow'}

    topic: str = Field(default='', description='Optional topic to filter by (e.g., "ai-agents-multitool")')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetQuizHintInput(BaseModel):
    """Input for get_quiz_hint tool."""

    quiz_id: str = Field(default='', description='Quiz UUID or slug')
    question_number: int = Field(default=1, description='Question number (1-indexed)')
    question_text: str = Field(default='', description='The question text if quiz_id not known')


class ExplainConceptInput(BaseModel):
    """Input for explain_concept tool."""

    concept: str = Field(description='The concept or topic to explain')
    skill_level: str = Field(default='beginner', description='User skill level: beginner, intermediate, or advanced')


class SuggestNextActivityInput(BaseModel):
    """Input for suggest_next_activity tool."""

    model_config = {'extra': 'allow'}

    topic: str = Field(default='', description='Optional topic preference')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetQuizDetailsInput(BaseModel):
    """Input for get_quiz_details tool."""

    quiz_id: str = Field(default='', description='Quiz UUID')
    quiz_slug: str = Field(default='', description='Quiz slug (URL-friendly name)')
    quiz_title: str = Field(default='', description='Quiz title to search for')


@tool(args_schema=GetLearningProgressInput)
def get_learning_progress(
    topic: str = '',
    state: dict | None = None,
) -> dict:
    """
    Get the user's learning progress across topics.

    Use this when the user asks about their progress, skill level, or learning journey.

    Examples:
    - "How am I doing?"
    - "What's my progress in AI agents?"
    - "Show me my learning stats"

    Returns learning paths with skill levels, points, and progress.
    """
    from core.learning_paths.models import UserLearningPath

    logger.info(f'get_learning_progress called: topic={topic}, state={state}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        queryset = UserLearningPath.objects.filter(user_id=user_id)

        if topic:
            queryset = queryset.filter(topic__icontains=topic)

        paths = list(queryset.order_by('-last_activity_at')[:10])

        if not paths:
            return {
                'success': True,
                'count': 0,
                'paths': [],
                'message': "You haven't started any learning paths yet! Try taking a quiz to begin your journey.",
            }

        path_data = []
        for path in paths:
            path_data.append(
                {
                    'topic': path.topic,
                    'topic_display': path.get_topic_display(),
                    'skill_level': path.current_skill_level,
                    'skill_level_display': path.get_current_skill_level_display(),
                    'progress_percentage': path.progress_percentage,
                    'quizzes_completed': path.quizzes_completed,
                    'quizzes_total': path.quizzes_total,
                    'side_quests_completed': path.side_quests_completed,
                    'side_quests_total': path.side_quests_total,
                    'topic_points': path.topic_points,
                    'points_to_next_level': path.points_to_next_level,
                    'next_skill_level': path.next_skill_level,
                }
            )

        # Calculate totals
        total_points = sum(p['topic_points'] for p in path_data)
        total_quizzes = sum(p['quizzes_completed'] for p in path_data)

        return {
            'success': True,
            'count': len(path_data),
            'total_points': total_points,
            'total_quizzes_completed': total_quizzes,
            'paths': path_data,
            'message': f'You have {len(path_data)} active learning path(s) with {total_points} total points!',
        }

    except Exception as e:
        logger.error(f'get_learning_progress error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetQuizHintInput)
def get_quiz_hint(
    quiz_id: str = '',
    question_number: int = 1,
    question_text: str = '',
    state: dict | None = None,
) -> dict:
    """
    Get a hint for a quiz question WITHOUT revealing the answer.

    Use this when users are stuck on a quiz question and need guidance.

    Examples:
    - "I need help with question 3"
    - "Can you give me a hint?"
    - "I'm stuck on this question about LangGraph"

    Returns a hint that guides without giving away the answer.
    """
    from core.quizzes.models import Quiz, QuizQuestion

    logger.info(f'get_quiz_hint called: quiz_id={quiz_id}, question_number={question_number}')

    try:
        question = None

        # Try to find by quiz_id and question number
        if quiz_id:
            try:
                quiz = Quiz.objects.get(id=quiz_id)
                question = quiz.questions.filter(order=question_number - 1).first()
            except (Quiz.DoesNotExist, ValueError):
                # Try as slug
                try:
                    quiz = Quiz.objects.get(slug=quiz_id)
                    question = quiz.questions.filter(order=question_number - 1).first()
                except Quiz.DoesNotExist:
                    pass

        # If still no question and we have question text, search for it
        if not question and question_text:
            question = QuizQuestion.objects.filter(question__icontains=question_text[:100]).first()

        if not question:
            return {
                'success': False,
                'error': "I couldn't find that question. Can you tell me which quiz you're working on?",
            }

        # Get the hint - use the stored hint if available, otherwise generate guidance
        hint = question.hint
        if not hint:
            # Generate a generic hint based on question type
            if question.type == 'true_false':
                hint = (
                    'Think carefully about whether this statement is always true, '
                    'or if there are exceptions that would make it false.'
                )
            elif question.type == 'multiple_choice':
                hint = (
                    'Try to eliminate options that you know are incorrect. '
                    'Look for keywords in the question that might point to the right answer.'
                )
            else:
                hint = 'Break down the question into smaller parts. What do you already know about this topic?'

        return {
            'success': True,
            'quiz_title': question.quiz.title,
            'question_number': question.order + 1,
            'question_preview': question.question[:100] + '...' if len(question.question) > 100 else question.question,
            'hint': hint,
            'question_type': question.type,
            'message': "Here's a hint to help you think through this question!",
        }

    except Exception as e:
        logger.error(f'get_quiz_hint error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=ExplainConceptInput)
def explain_concept(
    concept: str,
    skill_level: str = 'beginner',
    state: dict | None = None,
) -> dict:
    """
    Explain a concept or topic at the user's skill level.

    Use this when users want to understand a topic better or are confused about something.

    Examples:
    - "Explain LangGraph to me"
    - "What are AI agents?"
    - "I don't understand chain of thought"

    Returns context about the concept to help the LLM explain it.
    """
    from core.quizzes.models import Quiz

    logger.info(f'explain_concept called: concept={concept}, skill_level={skill_level}')

    try:
        # Search for related quizzes and questions to gather context
        related_quizzes = list(
            Quiz.objects.filter(
                is_published=True,
            )
            .filter(
                models.Q(title__icontains=concept)
                | models.Q(description__icontains=concept)
                | models.Q(topic__icontains=concept)
            )
            .prefetch_related('questions')[:3]
        )

        # Gather explanations from related questions
        explanations = []
        for quiz in related_quizzes:
            for q in quiz.questions.all()[:2]:
                if q.explanation:
                    explanations.append(
                        {
                            'quiz': quiz.title,
                            'question': q.question[:100],
                            'explanation': q.explanation,
                        }
                    )

        # Difficulty guidance based on skill level
        guidance = {
            'beginner': 'Explain using simple terms, analogies, and real-world examples. Avoid jargon.',
            'intermediate': 'You can use some technical terms but explain them. Include practical examples.',
            'advanced': 'You can be more technical. Focus on nuances and edge cases.',
        }.get(skill_level, 'Explain clearly and concisely.')

        return {
            'success': True,
            'concept': concept,
            'skill_level': skill_level,
            'explanation_guidance': guidance,
            'related_explanations': explanations[:3],
            'related_quizzes': [
                {'title': q.title, 'slug': q.slug, 'difficulty': q.difficulty} for q in related_quizzes
            ],
            'message': f"I found some context about '{concept}' to help explain it!",
        }

    except Exception as e:
        logger.error(f'explain_concept error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


# Need to import models for Q lookups
from django.db import models  # noqa: E402


@tool(args_schema=SuggestNextActivityInput)
def suggest_next_activity(
    topic: str = '',
    state: dict | None = None,
) -> dict:
    """
    Suggest the next quiz or learning activity for the user.

    Use this when users ask what to do next or want recommendations.

    Examples:
    - "What should I learn next?"
    - "Recommend a quiz for me"
    - "What's a good next step?"

    Returns personalized recommendations based on progress.
    """
    from core.learning_paths.models import UserLearningPath
    from core.quizzes.models import Quiz, QuizAttempt

    logger.info(f'suggest_next_activity called: topic={topic}, state={state}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        # Get user's learning paths to understand their level
        paths = list(UserLearningPath.objects.filter(user_id=user_id).order_by('-last_activity_at')[:5])

        # Get quizzes user has already attempted
        attempted_quiz_ids = list(
            QuizAttempt.objects.filter(user_id=user_id).values_list('quiz_id', flat=True).distinct()
        )

        # Find recommended quizzes
        queryset = Quiz.objects.filter(is_published=True).exclude(id__in=attempted_quiz_ids)

        # Filter by topic if specified
        if topic:
            queryset = queryset.filter(
                models.Q(topic__icontains=topic)
                | models.Q(title__icontains=topic)
                | models.Q(description__icontains=topic)
            )

        # Determine recommended difficulty based on user's level
        if paths:
            # Get the most common skill level
            skill_levels = [p.current_skill_level for p in paths]
            if 'advanced' in skill_levels or 'expert' in skill_levels:
                preferred_difficulty = 'advanced'
            elif 'intermediate' in skill_levels:
                preferred_difficulty = 'intermediate'
            else:
                preferred_difficulty = 'beginner'
        else:
            preferred_difficulty = 'beginner'

        # Prioritize quizzes at user's level
        recommended = list(queryset.filter(difficulty=preferred_difficulty)[:3])

        # If not enough, add from other difficulties
        if len(recommended) < 3:
            other_quizzes = list(queryset.exclude(difficulty=preferred_difficulty)[: 3 - len(recommended)])
            recommended.extend(other_quizzes)

        if not recommended:
            # User has done all quizzes or there are none
            return {
                'success': True,
                'recommendations': [],
                'message': "You've completed all available quizzes in this area! Check back soon for new content. 🎉",
            }

        quiz_data = []
        for quiz in recommended:
            quiz_data.append(
                {
                    'id': str(quiz.id),
                    'title': quiz.title,
                    'slug': quiz.slug,
                    'description': quiz.description[:150] + '...' if len(quiz.description) > 150 else quiz.description,
                    'difficulty': quiz.difficulty,
                    'estimated_time': quiz.estimated_time,
                    'question_count': quiz.question_count,
                    'url': f'/quizzes/{quiz.slug}' if quiz.slug else f'/quizzes/{quiz.id}',
                }
            )

        return {
            'success': True,
            'user_skill_level': preferred_difficulty,
            'recommendations': quiz_data,
            'message': f'Based on your {preferred_difficulty} level, here are some great next steps!',
        }

    except Exception as e:
        logger.error(f'suggest_next_activity error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetQuizDetailsInput)
def get_quiz_details(
    quiz_id: str = '',
    quiz_slug: str = '',
    quiz_title: str = '',
    state: dict | None = None,
) -> dict:
    """
    Get detailed information about a specific quiz.

    Use this when users want to know more about a quiz before starting.

    Examples:
    - "Tell me about the AI Agents quiz"
    - "What's in the LangGraph basics quiz?"
    - "How hard is this quiz?"

    Returns quiz details including difficulty, time, and topics covered.
    """
    from core.quizzes.models import Quiz

    logger.info(f'get_quiz_details called: id={quiz_id}, slug={quiz_slug}, title={quiz_title}')

    try:
        quiz = None

        # Try to find by ID
        if quiz_id:
            try:
                quiz = Quiz.objects.prefetch_related('questions', 'tools', 'categories').get(id=quiz_id)
            except (Quiz.DoesNotExist, ValueError):
                pass

        # Try by slug
        if not quiz and quiz_slug:
            try:
                quiz = Quiz.objects.prefetch_related('questions', 'tools', 'categories').get(slug=quiz_slug)
            except Quiz.DoesNotExist:
                pass

        # Try by title search
        if not quiz and quiz_title:
            quiz = (
                Quiz.objects.filter(title__icontains=quiz_title, is_published=True)
                .prefetch_related('questions', 'tools', 'categories')
                .first()
            )

        if not quiz:
            return {
                'success': False,
                'error': "I couldn't find that quiz. Can you tell me more about which quiz you're looking for?",
            }

        return {
            'success': True,
            'quiz': {
                'id': str(quiz.id),
                'title': quiz.title,
                'slug': quiz.slug,
                'description': quiz.description,
                'difficulty': quiz.difficulty,
                'difficulty_display': quiz.get_difficulty_display(),
                'estimated_time': quiz.estimated_time,
                'question_count': quiz.question_count,
                'topic': quiz.topic,
                'tools': [t.name for t in quiz.tools.all()],
                'categories': [c.name for c in quiz.categories.all()],
                'url': f'/quizzes/{quiz.slug}' if quiz.slug else f'/quizzes/{quiz.id}',
            },
            'message': f"Here are the details for '{quiz.title}'!",
        }

    except Exception as e:
        logger.error(f'get_quiz_details error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


# =============================================================================
# NEW ENHANCED LEARNING TOOLS
# =============================================================================


class GetLearnerProfileInput(BaseModel):
    """Input for get_learner_profile tool."""

    model_config = {'extra': 'allow'}

    include_stats: bool = Field(default=True, description='Include learning statistics')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetConceptMasteryInput(BaseModel):
    """Input for get_concept_mastery tool."""

    model_config = {'extra': 'allow'}

    topic: str = Field(default='', description='Filter by topic slug (e.g., "ai-agents-multitool")')
    concept_slug: str = Field(default='', description='Get mastery for a specific concept')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class FindKnowledgeGapsInput(BaseModel):
    """Input for find_knowledge_gaps tool."""

    model_config = {'extra': 'allow'}

    topic: str = Field(default='', description='Optional topic to filter by')
    limit: int = Field(default=5, description='Maximum number of gaps to return')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetDueReviewsInput(BaseModel):
    """Input for get_due_reviews tool."""

    model_config = {'extra': 'allow'}

    limit: int = Field(default=5, description='Maximum number of reviews to return')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class DeliverMicroLessonInput(BaseModel):
    """Input for deliver_micro_lesson tool."""

    model_config = {'extra': 'allow'}

    concept_slug: str = Field(description='The concept to teach (slug from Concept model)')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class RecordLearningEventInput(BaseModel):
    """Input for record_learning_event tool."""

    model_config = {'extra': 'allow'}

    event_type: str = Field(
        description='Type of event: lesson_viewed, concept_practiced, hint_used, explanation_requested, project_studied'
    )
    concept_slug: str = Field(default='', description='The concept this relates to')
    was_successful: bool = Field(default=True, description='Whether the learning activity was successful')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


@tool(args_schema=GetLearnerProfileInput)
def get_learner_profile(
    include_stats: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Get the user's learner profile including preferences and statistics.

    Use this to understand the user's learning style and personalize interactions.

    Examples:
    - "What's my learning style?"
    - "How long is my learning streak?"
    - "Show me my learning stats"

    Returns profile with preferences, streak info, and overall progress.
    """
    from core.learning_paths.models import LearnerProfile

    logger.info(f'get_learner_profile called: include_stats={include_stats}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)

        data = {
            'success': True,
            'is_new_learner': created,
            'preferences': {
                'learning_style': profile.preferred_learning_style,
                'difficulty_level': profile.current_difficulty_level,
                'session_length': profile.preferred_session_length,
                'allow_proactive_suggestions': profile.allow_proactive_suggestions,
            },
        }

        if include_stats:
            data['stats'] = {
                'learning_streak_days': profile.learning_streak_days,
                'longest_streak_days': profile.longest_streak_days,
                'total_lessons_completed': profile.total_lessons_completed,
                'total_concepts_completed': profile.total_concepts_completed,
                'total_learning_minutes': profile.total_learning_minutes,
                'total_quizzes_completed': profile.total_quizzes_completed,
            }

        if created:
            data['message'] = "Welcome! I've created your learner profile. Let me know your preferred learning style!"
        else:
            streak = profile.learning_streak_days
            if streak > 0:
                data['message'] = f'Great to see you! You have a {streak}-day learning streak going! 🔥'
            else:
                data['message'] = 'Welcome back! Ready to continue learning?'

        return data

    except Exception as e:
        logger.error(f'get_learner_profile error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetConceptMasteryInput)
def get_concept_mastery(
    topic: str = '',
    concept_slug: str = '',
    state: dict | None = None,
) -> dict:
    """
    Get the user's mastery level for concepts they've practiced.

    Use this to understand what the user knows well and what needs work.

    Examples:
    - "What do I know best?"
    - "How's my understanding of RAG?"
    - "What AI concepts do I know well?"

    Returns proficiency levels with scores and practice history.
    """
    from core.learning_paths.models import Concept, UserConceptMastery

    logger.info(f'get_concept_mastery called: topic={topic}, concept_slug={concept_slug}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        queryset = UserConceptMastery.objects.filter(user_id=user_id).select_related('concept')

        if concept_slug:
            queryset = queryset.filter(concept__slug=concept_slug)
        if topic:
            queryset = queryset.filter(concept__topic=topic)

        masteries = list(queryset.order_by('-mastery_score')[:10])

        if not masteries:
            # Check if user has practiced any concepts
            if concept_slug:
                try:
                    concept = Concept.objects.get(slug=concept_slug, is_active=True)
                    return {
                        'success': True,
                        'mastery': None,
                        'concept': {
                            'name': concept.name,
                            'slug': concept.slug,
                            'topic': concept.topic,
                            'difficulty': concept.base_difficulty,
                        },
                        'message': f"You haven't practiced '{concept.name}' yet. Would you like to start?",
                    }
                except Concept.DoesNotExist:
                    return {'success': False, 'error': f"Concept '{concept_slug}' not found"}

            return {
                'success': True,
                'masteries': [],
                'message': (
                    "You haven't practiced any concepts yet. " 'Try taking a quiz or asking me to explain something!'
                ),
            }

        mastery_data = []
        for m in masteries:
            accuracy = round((m.times_correct / m.times_practiced) * 100, 1) if m.times_practiced > 0 else 0
            mastery_data.append(
                {
                    'concept': m.concept.name,
                    'concept_slug': m.concept.slug,
                    'topic': m.concept.topic,
                    'mastery_level': m.mastery_level,
                    'mastery_score': round(m.mastery_score * 100, 1),
                    'times_practiced': m.times_practiced,
                    'accuracy_percentage': accuracy,
                    'consecutive_correct': m.consecutive_correct,
                    'due_for_review': m.next_review_at and m.next_review_at <= timezone.now()
                    if hasattr(m, 'next_review_at') and m.next_review_at
                    else False,
                }
            )

        # Summarize
        expert_count = sum(1 for m in mastery_data if m['mastery_level'] in ['expert', 'proficient'])

        return {
            'success': True,
            'expert_count': expert_count,
            'total_concepts': len(mastery_data),
            'masteries': mastery_data,
            'message': f"You've practiced {len(mastery_data)} concepts, with {expert_count} at expert level!",
        }

    except Exception as e:
        logger.error(f'get_concept_mastery error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


# Import timezone for due review checks
from django.utils import timezone  # noqa: E402


@tool(args_schema=FindKnowledgeGapsInput)
def find_knowledge_gaps(
    topic: str = '',
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Find concepts where the user is struggling and needs more practice.

    Use this to identify what the user should focus on improving.

    Examples:
    - "What should I work on?"
    - "Where am I struggling?"
    - "What are my weak areas?"

    Returns concepts with low mastery that need attention.
    """
    from core.learning_paths.models import UserConceptMastery

    logger.info(f'find_knowledge_gaps called: topic={topic}, limit={limit}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        queryset = UserConceptMastery.objects.filter(
            user_id=user_id,
            mastery_level__in=['unknown', 'aware', 'learning'],
            times_practiced__gt=0,  # Only concepts they've tried
        ).select_related('concept')

        if topic:
            queryset = queryset.filter(concept__topic=topic)

        gaps = list(queryset.order_by('mastery_score')[:limit])

        if not gaps:
            return {
                'success': True,
                'gaps': [],
                'message': "No knowledge gaps found! You're doing great, or you haven't practiced enough yet.",
            }

        gap_data = []
        for m in gaps:
            accuracy = round((m.times_correct / m.times_practiced) * 100, 1) if m.times_practiced > 0 else 0
            gap_data.append(
                {
                    'concept': m.concept.name,
                    'concept_slug': m.concept.slug,
                    'topic': m.concept.topic,
                    'mastery_level': m.mastery_level,
                    'mastery_score': round(m.mastery_score * 100, 1),
                    'times_practiced': m.times_practiced,
                    'accuracy_percentage': accuracy,
                    'suggestion': f"Practice '{m.concept.name}' more - your accuracy is {accuracy}%",
                }
            )

        return {
            'success': True,
            'gap_count': len(gap_data),
            'gaps': gap_data,
            'message': f'Found {len(gap_data)} areas that could use more practice. Let me help you improve!',
        }

    except Exception as e:
        logger.error(f'find_knowledge_gaps error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=GetDueReviewsInput)
def get_due_reviews(
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Get concepts that are due for spaced repetition review.

    Use this to help users maintain their knowledge through timely reviews.

    Examples:
    - "What should I review?"
    - "Any concepts due for review?"
    - "Help me maintain my knowledge"

    Returns concepts scheduled for review using spaced repetition.
    """
    from core.learning_paths.models import UserConceptMastery

    logger.info(f'get_due_reviews called: limit={limit}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        now = timezone.now()
        due_reviews = list(
            UserConceptMastery.objects.filter(
                user_id=user_id,
                next_review_at__lte=now,
            )
            .select_related('concept')
            .order_by('next_review_at')[:limit]
        )

        if not due_reviews:
            return {
                'success': True,
                'reviews': [],
                'message': "No reviews due right now! You're all caught up. 🎉",
            }

        review_data = []
        for m in due_reviews:
            days_overdue = (now - m.next_review_at).days if m.next_review_at else 0
            review_data.append(
                {
                    'concept': m.concept.name,
                    'concept_slug': m.concept.slug,
                    'topic': m.concept.topic,
                    'mastery_level': m.mastery_level,
                    'days_overdue': max(0, days_overdue),
                    'last_practiced': m.last_practiced.isoformat() if m.last_practiced else None,
                }
            )

        return {
            'success': True,
            'review_count': len(review_data),
            'reviews': review_data,
            'message': (
                f'You have {len(review_data)} concepts ready for review. ' 'A quick review will help you remember them!'
            ),
        }

    except Exception as e:
        logger.error(f'get_due_reviews error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=DeliverMicroLessonInput)
def deliver_micro_lesson(
    concept_slug: str,
    state: dict | None = None,
) -> dict:
    """
    Deliver a micro-lesson for a specific concept.

    Use this when a user wants to learn about a concept in a structured way.

    Examples:
    - "Teach me about prompt engineering"
    - "Can you explain RAG in a lesson?"
    - "I want to learn about AI agents"

    Returns lesson content with follow-up prompts for engagement.
    """
    from core.learning_paths.models import Concept, LearnerProfile, MicroLesson

    logger.info(f'deliver_micro_lesson called: concept_slug={concept_slug}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    try:
        # Get the concept
        try:
            concept = Concept.objects.get(slug=concept_slug, is_active=True)
        except Concept.DoesNotExist:
            # Try by name (fuzzy match)
            concept = Concept.objects.filter(name__icontains=concept_slug, is_active=True).first()
            if not concept:
                return {
                    'success': False,
                    'error': f"Concept '{concept_slug}' not found. Try asking about a specific AI topic!",
                }

        # Get user's profile for personalization
        profile, _ = LearnerProfile.objects.get_or_create(user_id=user_id)

        # Look for existing micro-lessons
        lesson = (
            MicroLesson.objects.filter(concept=concept, difficulty=profile.current_difficulty_level)
            .order_by('?')
            .first()
        )

        if not lesson:
            # Fall back to any difficulty lesson
            lesson = MicroLesson.objects.filter(concept=concept).order_by('?').first()

        if lesson:
            # Return curated lesson
            return {
                'success': True,
                'lesson_type': 'curated',
                'concept': {
                    'name': concept.name,
                    'slug': concept.slug,
                    'topic': concept.topic,
                    'difficulty': concept.base_difficulty,
                },
                'lesson': {
                    'title': lesson.title,
                    'content': lesson.content_template,
                    'difficulty': lesson.difficulty,
                    'estimated_minutes': lesson.estimated_minutes,
                    'follow_up_prompts': lesson.follow_up_prompts or [],
                },
                'personalization': {
                    'learning_style': profile.preferred_learning_style,
                    'difficulty_level': profile.current_difficulty_level,
                },
                'message': f"Here's a micro-lesson on '{concept.name}'!",
            }

        # No curated lesson - provide concept context for AI-generated lesson
        return {
            'success': True,
            'lesson_type': 'ai_generated',
            'concept': {
                'name': concept.name,
                'slug': concept.slug,
                'topic': concept.topic,
                'description': concept.description,
                'difficulty': concept.base_difficulty,
                'estimated_minutes': concept.estimated_minutes,
                'keywords': concept.keywords or [],
            },
            'personalization': {
                'learning_style': profile.preferred_learning_style,
                'difficulty_level': profile.current_difficulty_level,
            },
            'guidance': {
                'beginner': 'Use simple language, analogies, and real-world examples. Avoid jargon.',
                'intermediate': 'Include some technical terms but explain them. Focus on practical application.',
                'advanced': 'Be technical. Cover edge cases and advanced patterns.',
            }.get(profile.current_difficulty_level, 'Explain clearly and engagingly.'),
            'follow_up_prompts': [
                'Want me to give you an example?',
                'Should we try a quick practice question?',
                f'Would you like to explore how this connects to other {concept.topic} concepts?',
            ],
            'message': f"Let me teach you about '{concept.name}'!",
        }

    except Exception as e:
        logger.error(f'deliver_micro_lesson error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


@tool(args_schema=RecordLearningEventInput)
def record_learning_event(
    event_type: str,
    concept_slug: str = '',
    was_successful: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Record a learning interaction for tracking progress.

    Use this after helping the user learn something to track their progress.

    Valid event types:
    - lesson_viewed: User viewed a micro-lesson
    - concept_practiced: User practiced a concept
    - hint_used: User got a hint on a question
    - explanation_requested: User asked for an explanation
    - project_studied: User studied a project for learning

    Returns confirmation of the recorded event.
    """
    from core.learning_paths.models import Concept, LearningEvent

    logger.info(f'record_learning_event called: type={event_type}, concept={concept_slug}')

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    valid_types = ['lesson_viewed', 'concept_practiced', 'hint_used', 'explanation_requested', 'project_studied']
    if event_type not in valid_types:
        return {'success': False, 'error': f'Invalid event type. Must be one of: {valid_types}'}

    try:
        concept = None
        if concept_slug:
            concept = Concept.objects.filter(slug=concept_slug, is_active=True).first()

        # Calculate XP based on event type
        xp_map = {
            'lesson_viewed': 10,
            'concept_practiced': 15,
            'hint_used': 2,
            'explanation_requested': 5,
            'project_studied': 20,
        }
        xp = xp_map.get(event_type, 5)

        # Adjust XP for unsuccessful attempts
        if not was_successful:
            xp = max(1, xp // 2)

        LearningEvent.objects.create(
            user_id=user_id,
            event_type=event_type,
            concept=concept,
            was_successful=was_successful,
            xp_earned=xp,
            payload={'recorded_by': 'ember_tool'},
        )

        return {
            'success': True,
            'xp_earned': xp,
            'event_type': event_type,
            'concept': concept.name if concept else None,
            'message': f'Recorded! You earned {xp} XP for your learning activity.',
        }

    except Exception as e:
        logger.error(f'record_learning_event error: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}


# Tools that need state injection (for user context)
TOOLS_NEEDING_STATE = {
    'get_learning_progress',
    'suggest_next_activity',
    # New enhanced tools
    'get_learner_profile',
    'get_concept_mastery',
    'find_knowledge_gaps',
    'get_due_reviews',
    'deliver_micro_lesson',
    'record_learning_event',
}

# All learning tools
LEARNING_TOOLS = [
    # Original 5 tools
    get_learning_progress,
    get_quiz_hint,
    explain_concept,
    suggest_next_activity,
    get_quiz_details,
    # New enhanced learning tools (6 additional)
    get_learner_profile,
    get_concept_mastery,
    find_knowledge_gaps,
    get_due_reviews,
    deliver_micro_lesson,
    record_learning_event,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in LEARNING_TOOLS}
