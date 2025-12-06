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

    topic: str = Field(default='', description='Optional topic to filter by (e.g., "ai-agents-multitool")')


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

    topic: str = Field(default='', description='Optional topic preference')


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
            if 'advanced' in skill_levels or 'master' in skill_levels:
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


# Tools that need state injection (for user context)
TOOLS_NEEDING_STATE = {'get_learning_progress', 'suggest_next_activity'}

# All learning tools
LEARNING_TOOLS = [
    get_learning_progress,
    get_quiz_hint,
    explain_concept,
    suggest_next_activity,
    get_quiz_details,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in LEARNING_TOOLS}
