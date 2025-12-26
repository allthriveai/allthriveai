"""
AI Lesson Generator for Learning Paths.

Generates personalized learning content when curated content is unavailable.
Uses member_context to adapt content format based on learning style and difficulty.

The generated content is designed to provide immediate value - not placeholders,
but real learning material that can be supplemented or replaced with community
projects and curated content over time.
"""

import logging

from django.db.models import F
from django.utils.text import slugify

# Import prompts from the prompts module
from .lesson_prompts import (
    DIFFICULTY_INSTRUCTIONS,
    EXERCISE_REGENERATION_PROMPT,
    LESSON_SYSTEM_PROMPT,
    STYLE_INSTRUCTIONS,
    TOPIC_ANALYSIS_PROMPT,
    get_exercise_type_guidance,
)

# Import parsers
from .parsers import (
    get_fallback_topic_analysis,
    parse_exercise_response,
    parse_lesson_response,
    parse_topic_analysis,
)

# Import types from the types module
from .types import (
    AILessonContent,
    CurriculumItem,
    ExerciseContentByLevel,
    LessonExercise,
    LessonQuiz,
    QuizQuestion,
    TopicAnalysis,
)

# Import validators
from .validators import (
    validate_exercise,
    validate_mermaid_syntax,
    validate_quiz,
)

logger = logging.getLogger(__name__)

# Re-export types for backwards compatibility
__all__ = [
    'AILessonContent',
    'AILessonGenerator',
    'CurriculumItem',
    'ExerciseContentByLevel',
    'LessonExercise',
    'LessonQuiz',
    'QuizQuestion',
    'TopicAnalysis',
    'validate_mermaid_syntax',
]


class AILessonGenerator:
    """
    Generates personalized learning content when curated content is unavailable.

    Uses the AIProvider to generate structured lesson content that adapts to
    the user's learning style and difficulty level from member_context.
    """

    # System prompts - imported from lesson_prompts
    SYSTEM_PROMPT = LESSON_SYSTEM_PROMPT
    EXERCISE_REGENERATION_PROMPT = EXERCISE_REGENERATION_PROMPT

    @classmethod
    def analyze_topic(cls, query: str, user_id: int | None = None) -> TopicAnalysis | None:
        """
        Analyze a learning query to extract subjects, relationship, and generate concepts.

        Uses AI to intelligently parse multi-subject queries like:
        - "playwright with claude" → Integration learning path
        - "react vs vue" → Comparison learning path
        - "python for data science" → Workflow learning path

        Args:
            query: The raw learning query from the user
            user_id: User ID for AI usage tracking

        Returns:
            TopicAnalysis with title, slug, subjects, relationship, and concepts,
            or None if analysis fails (falls back to simple parsing)
        """
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        try:
            ai = AIProvider(user_id=user_id)

            prompt = f"""Analyze this learning request and create a structured learning path:

"{query}"

Remember:
- Detect if this involves multiple subjects (tools, frameworks, concepts)
- Create a meaningful title that describes the RELATIONSHIP, not just concatenation
- Generate lesson concepts that build logically from basics to application
- For integration queries, ensure lessons cover both subjects AND how they work together"""

            response = ai.complete(
                prompt=prompt,
                system_message=TOPIC_ANALYSIS_PROMPT,
                temperature=0.3,  # Lower temperature for more consistent structure
                max_tokens=800,
            )

            # Track AI usage
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='topic_analysis',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={'query': query},
                        gateway_metadata={
                            'gateway_provider': ai.last_usage.get('gateway_provider'),
                            'gateway_model': ai.last_usage.get('gateway_model'),
                            'requested_model': ai.last_usage.get('requested_model'),
                        }
                        if ai.last_usage.get('gateway_provider')
                        else None,
                    )
                except User.DoesNotExist:
                    logger.warning(f'User {user_id} not found for AI usage tracking')
                except Exception as e:
                    logger.error(f'Failed to track AI usage: {e}', exc_info=True)

            # Parse the response
            analysis = cls._parse_topic_analysis(response, query)

            if analysis:
                logger.info(
                    'Topic analysis complete',
                    extra={
                        'query': query,
                        'title': analysis['title'],
                        'subjects': analysis['subjects'],
                        'relationship': analysis['relationship'],
                        'concept_count': len(analysis['concepts']),
                    },
                )

            return analysis

        except Exception as e:
            logger.error(
                'Topic analysis failed, will use fallback',
                extra={'query': query, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _parse_topic_analysis(cls, response: str, original_query: str) -> TopicAnalysis | None:
        """Parse AI response into TopicAnalysis structure."""
        return parse_topic_analysis(response, original_query)

    @classmethod
    def get_fallback_analysis(cls, query: str) -> TopicAnalysis:
        """Generate a fallback TopicAnalysis when AI analysis fails."""
        return get_fallback_topic_analysis(query)

    @classmethod
    def generate_curriculum(
        cls,
        topic: str,
        member_context: dict | None,
        existing_content: dict,
        user_id: int | None = None,
        topic_analysis: TopicAnalysis | None = None,
    ) -> list[CurriculumItem]:
        """
        Generate a complete curriculum mixing existing content with AI-generated lessons.

        Args:
            topic: The topic/query for the learning path
            member_context: User's learning preferences and context
            existing_content: Content found by ContentFinder
            user_id: User ID for logging and gap tracking
            topic_analysis: Optional pre-analyzed topic with AI-generated concepts

        Returns:
            List of curriculum items (existing content + AI lessons)
        """
        curriculum: list[CurriculumItem] = []
        order = 1

        # Extract learning preferences from member_context
        learning_prefs = cls._extract_learning_preferences(member_context)

        # Add existing content first (prioritized by type)
        order = cls._add_existing_content(curriculum, existing_content, order)

        # Check if we need AI-generated content
        has_content_gap = cls._has_content_gap(existing_content)

        if has_content_gap:
            # Log the content gap for strategic content development
            cls._log_content_gap(topic, user_id, existing_content, member_context)

            # Get pre-analyzed concepts if available
            analyzed_concepts = topic_analysis['concepts'] if topic_analysis else None

            # Generate AI lessons to fill the gap
            ai_lessons = cls._generate_ai_lessons(
                topic=topic,
                learning_style=learning_prefs['style'],
                difficulty=learning_prefs['difficulty'],
                session_length=learning_prefs['session_length'],
                existing_count=len(curriculum),
                user_id=user_id,
                analyzed_concepts=analyzed_concepts,
            )

            for lesson in ai_lessons:
                lesson['order'] = order
                curriculum.append(lesson)
                order += 1

        # Add related projects section at the end
        order = cls._add_related_projects_section(curriculum, existing_content, order)

        return curriculum

    @classmethod
    def _extract_learning_preferences(cls, member_context: dict | None) -> dict:
        """Extract learning preferences from member_context."""
        defaults = {
            'style': 'mixed',
            'difficulty': 'beginner',
            'session_length': 15,
            'goal': 'exploring',
        }

        if not member_context:
            return defaults

        learning = member_context.get('learning', {})

        # Check top-level skill_level first (set from user profile settings),
        # then fall back to learning.difficulty_level, then default
        skill_level = member_context.get('skill_level') or learning.get('difficulty_level') or defaults['difficulty']

        return {
            'style': learning.get('learning_style', defaults['style']),
            'difficulty': skill_level,
            'session_length': learning.get('session_length', defaults['session_length']),
            'goal': learning.get('learning_goal', defaults['goal']),
        }

    @classmethod
    def _add_existing_content(
        cls,
        curriculum: list[CurriculumItem],
        existing_content: dict,
        start_order: int,
    ) -> int:
        """Add existing content to curriculum in priority order. Returns next order number."""
        order = start_order

        # Add tool overview if found
        if existing_content.get('tool'):
            tool = existing_content['tool']
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='tool',
                    title=f"Understanding {tool['name']}",
                    tool_slug=tool['slug'],
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Categorize projects by content type - ONLY include lesson projects
        # Use 'in' matching to handle variants like 'content-video', 'content-article'
        # Non-lesson projects only appear in the "See what others are doing" section
        projects = existing_content.get('projects', [])
        lesson_projects = [p for p in projects if p.get('is_lesson', False)]
        video_projects = [p for p in lesson_projects if 'video' in (p.get('content_type') or '').lower()]
        article_projects = [p for p in lesson_projects if 'article' in (p.get('content_type') or '').lower()]
        code_projects = [p for p in lesson_projects if 'code-repo' in (p.get('content_type') or '').lower()]

        # Add videos (introduction) - max 2
        for project in video_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='video',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=15,
                    generated=False,
                )
            )
            order += 1

        # Add first quiz for knowledge check
        for quiz in existing_content.get('quizzes', [])[:1]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='quiz',
                    title=quiz['title'],
                    quiz_id=quiz['id'],
                    url=quiz.get('url'),
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Add articles - max 2
        for project in article_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='article',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Add games - max 1
        for game in existing_content.get('games', [])[:1]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='game',
                    title=game['title'],
                    game_slug=game['slug'],
                    estimated_minutes=15,
                    generated=False,
                )
            )
            order += 1

        # Add code repos - max 2
        for project in code_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='code-repo',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=20,
                    generated=False,
                )
            )
            order += 1

        return order

    @classmethod
    def _add_related_projects_section(
        cls,
        curriculum: list[CurriculumItem],
        existing_content: dict,
        order: int,
    ) -> int:
        """Add 'See what others are doing' section with related projects at the end.

        Always adds this section to encourage community engagement.
        Shows available projects if any, otherwise shows an empty section
        that the frontend can render with a "be the first" message.
        """
        projects = existing_content.get('projects', [])

        # Take up to 5 projects (dynamic based on availability)
        project_count = min(5, len(projects))
        selected_projects = projects[:project_count] if projects else []

        curriculum.append(
            CurriculumItem(
                order=order,
                type='related_projects',
                title='See what others are doing',
                projects=selected_projects,
                estimated_minutes=5 if selected_projects else 2,
                generated=False,
            )
        )
        return order + 1

    @classmethod
    def _has_content_gap(cls, existing_content: dict) -> bool:
        """Determine if there's a content gap requiring AI generation.

        Only counts LESSON content (is_lesson=True) that would be added as curriculum items:
        - Videos, articles, code-repos (from projects with is_lesson=True and matching content_type)
        - Quizzes and games
        - Tool overview

        Regular community projects (is_lesson=False) only appear in related_projects section
        and do NOT count toward filling the content gap.
        """
        projects = existing_content.get('projects', [])
        quizzes = existing_content.get('quizzes', [])
        games = existing_content.get('games', [])
        tool = existing_content.get('tool')

        # Only count LESSON projects (is_lesson=True)
        lesson_projects = [p for p in projects if p.get('is_lesson', False)]

        # Count lesson projects that would be added as curriculum items
        # Match content-video, video, content-article, article, etc.
        curriculum_content_types = {'video', 'article', 'code-repo'}
        curriculum_lesson_projects = [
            p
            for p in lesson_projects
            if any(ct in (p.get('content_type') or '').lower() for ct in curriculum_content_types)
        ]

        # Total = tool (if exists) + lesson projects + quizzes + games
        total_curriculum_items = (1 if tool else 0) + len(curriculum_lesson_projects) + len(quizzes) + len(games)

        # Consider it a gap if we have fewer than 3 curriculum items
        # This ensures AI lessons are generated when we only have related projects
        return total_curriculum_items < 3

    @classmethod
    def _log_content_gap(
        cls,
        topic: str,
        user_id: int | None,
        existing_content: dict,
        member_context: dict | None,
    ) -> None:
        """Log content gap to ContentGap model for strategic content development."""
        try:
            from core.learning_paths.models import ContentGap

            topic_normalized = slugify(topic)

            # Calculate how many results we found
            results_count = (
                len(existing_content.get('projects', []))
                + len(existing_content.get('quizzes', []))
                + len(existing_content.get('games', []))
            )

            # Build context metadata
            context = {}
            if member_context:
                learning = member_context.get('learning', {})
                context['difficulty_level'] = learning.get('difficulty_level')
                context['learning_style'] = learning.get('learning_style')

            # Update or create the gap record
            gap, created = ContentGap.objects.update_or_create(
                topic_normalized=topic_normalized,
                modality='learning_path',
                defaults={
                    'topic': topic,
                    'gap_type': ContentGap.GapType.MISSING_TOPIC,
                    'results_returned': results_count,
                    'context': context,
                },
            )

            if not created:
                # Increment counters for existing gap
                ContentGap.objects.filter(pk=gap.pk).update(
                    request_count=F('request_count') + 1,
                )

            # Track first requester if not set
            if created and user_id:
                gap.first_requested_by_id = user_id
                gap.save(update_fields=['first_requested_by_id'])

            logger.info(
                f"Content gap logged: topic='{topic}', results={results_count}",
                extra={
                    'topic': topic,
                    'topic_normalized': topic_normalized,
                    'user_id': user_id,
                    'results_count': results_count,
                    'created': created,
                },
            )

        except Exception as e:
            # Don't let gap logging failures break the flow
            logger.error(f'Failed to log content gap: {e}', exc_info=True)

    @classmethod
    def _generate_ai_lessons(
        cls,
        topic: str,
        learning_style: str,
        difficulty: str,
        session_length: int,
        existing_count: int,
        user_id: int | None = None,
        analyzed_concepts: list[str] | None = None,
    ) -> list[CurriculumItem]:
        """Generate AI lessons to fill content gaps.

        Args:
            topic: The topic/query for the learning path
            learning_style: User's preferred learning style
            difficulty: Difficulty level (beginner, intermediate, advanced)
            session_length: Preferred session length in minutes
            existing_count: Number of existing curriculum items
            user_id: User ID for AI usage tracking
            analyzed_concepts: Pre-analyzed lesson concepts from TopicAnalysis
        """

        lessons = []

        # Determine how many lessons to generate based on existing content
        # If we have some content, generate fewer AI lessons
        lessons_to_generate = max(1, 5 - existing_count)

        # Use pre-analyzed concepts if available, otherwise fall back to heuristics
        if analyzed_concepts:
            # Use AI-generated concepts, limited to how many we need
            concepts = analyzed_concepts[:lessons_to_generate]
            logger.info(
                f'Using {len(concepts)} pre-analyzed concepts for lessons',
                extra={'topic': topic, 'concepts': concepts},
            )
        else:
            # Fall back to simple heuristic breakdown
            concepts = cls._break_down_topic(topic, lessons_to_generate)

        for _i, concept in enumerate(concepts):
            try:
                lesson_content = cls._generate_single_lesson(
                    concept=concept,
                    topic=topic,
                    learning_style=learning_style,
                    difficulty=difficulty,
                    user_id=user_id,
                )

                if lesson_content:
                    # Estimate time based on content length
                    explanation_length = len(lesson_content.get('explanation', ''))
                    estimated_minutes = max(5, min(20, explanation_length // 200))

                    lessons.append(
                        CurriculumItem(
                            order=0,  # Will be set by caller
                            type='ai_lesson',
                            title=concept,
                            content=lesson_content,
                            estimated_minutes=estimated_minutes,
                            difficulty=difficulty,
                            generated=True,
                        )
                    )

            except Exception as e:
                logger.error(
                    f'Failed to generate lesson for concept: {concept}',
                    extra={'concept': concept, 'topic': topic, 'error': str(e)},
                    exc_info=True,
                )

        return lessons

    @classmethod
    def _break_down_topic(cls, topic: str, num_concepts: int) -> list[str]:
        """Break down a topic into learnable concepts."""
        # For now, use simple heuristics. Could be AI-powered in future.
        topic_clean = topic.replace('-', ' ').replace('_', ' ').title()

        # Common concept patterns for learning paths
        concept_templates = [
            f'What is {topic_clean}?',
            f'Core Concepts of {topic_clean}',
            f'How {topic_clean} Works',
            f'Getting Started with {topic_clean}',
            f'Best Practices for {topic_clean}',
            f'Common Patterns in {topic_clean}',
            f'Advanced {topic_clean} Techniques',
        ]

        return concept_templates[:num_concepts]

    @classmethod
    def _generate_single_lesson(
        cls,
        concept: str,
        topic: str,
        learning_style: str,
        difficulty: str,
        user_id: int | None = None,
    ) -> AILessonContent | None:
        """Generate a single AI lesson for a concept."""
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        # Build the personalized prompt
        style_instruction = STYLE_INSTRUCTIONS.get(learning_style, STYLE_INSTRUCTIONS['mixed'])
        difficulty_instruction = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS['beginner'])

        prompt = f"""Generate a lesson about: {concept}
Topic context: {topic}

{style_instruction}

{difficulty_instruction}

Remember to return valid JSON matching the required structure."""

        try:
            ai = AIProvider(user_id=user_id)

            response = ai.complete(
                prompt=prompt,
                system_message=cls.SYSTEM_PROMPT,
                temperature=0.7,
                max_tokens=2000,
            )

            # Track AI usage for billing and analytics
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='lesson_generation',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={
                            'concept': concept,
                            'topic': topic,
                            'learning_style': learning_style,
                            'difficulty': difficulty,
                        },
                        gateway_metadata={
                            'gateway_provider': ai.last_usage.get('gateway_provider'),
                            'gateway_model': ai.last_usage.get('gateway_model'),
                            'requested_model': ai.last_usage.get('requested_model'),
                        }
                        if ai.last_usage.get('gateway_provider')
                        else None,
                    )
                except User.DoesNotExist:
                    logger.warning(f'User {user_id} not found for AI usage tracking')
                except Exception as e:
                    logger.error(f'Failed to track AI usage: {e}', exc_info=True)

            # Parse JSON response
            lesson_content = cls._parse_lesson_response(response)

            if lesson_content:
                logger.info(
                    f'Generated AI lesson: {concept}',
                    extra={
                        'concept': concept,
                        'topic': topic,
                        'learning_style': learning_style,
                        'difficulty': difficulty,
                        'user_id': user_id,
                    },
                )

            return lesson_content

        except Exception as e:
            logger.error(
                f'AI lesson generation failed: {e}',
                extra={'concept': concept, 'topic': topic, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _parse_lesson_response(cls, response: str) -> AILessonContent | None:
        """Parse AI response into structured lesson content."""
        return parse_lesson_response(response)

    @classmethod
    def _validate_exercise(cls, exercise_data: dict) -> LessonExercise | None:
        """Validate and normalize exercise data from AI response."""
        return validate_exercise(exercise_data)

    @classmethod
    def _validate_quiz(cls, quiz_data: dict) -> LessonQuiz | None:
        """Validate and normalize quiz data from AI response."""
        return validate_quiz(quiz_data)

    # =============================================================================
    # REGENERATION METHODS
    # =============================================================================

    @classmethod
    def regenerate_single_lesson(
        cls,
        saved_path,  # SavedLearningPath model instance
        lesson_order: int,
        focus: str | None = None,
        reason: str | None = None,
        user_id: int | None = None,
    ) -> AILessonContent | None:
        """
        Regenerate a single AI lesson with optional user guidance.

        Args:
            saved_path: The SavedLearningPath model instance containing the lesson
            lesson_order: The order/index of the lesson in the curriculum
            focus: User's requested focus (e.g., "more hands-on examples")
            reason: User's reason for regenerating (e.g., "too abstract")
            user_id: User ID for AI usage tracking

        Returns:
            New AILessonContent dict, or None if generation fails
        """
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        # Find the lesson in the curriculum
        curriculum = saved_path.path_data.get('curriculum', [])
        lesson_item = None

        for item in curriculum:
            if item.get('order') == lesson_order and item.get('type') == 'ai_lesson':
                lesson_item = item
                break

        if not lesson_item:
            logger.error(f'Lesson not found at order {lesson_order} in path {saved_path.slug}')
            return None

        lesson_title = lesson_item.get('title', 'Untitled Lesson')
        lesson_difficulty = lesson_item.get('difficulty', 'beginner')

        # Get learning style from user profile if available
        learning_style = 'mixed'
        if saved_path.user:
            profile = getattr(saved_path.user, 'learnerprofile', None)
            if profile:
                learning_style = profile.preferred_learning_style or 'mixed'

        # Build regeneration prompt with user guidance
        style_instruction = STYLE_INSTRUCTIONS.get(learning_style, STYLE_INSTRUCTIONS['mixed'])
        difficulty_instruction = DIFFICULTY_INSTRUCTIONS.get(lesson_difficulty, DIFFICULTY_INSTRUCTIONS['beginner'])

        # Build the guidance section based on user input
        guidance_section = ''
        if focus or reason:
            guidance_parts = []
            if focus:
                guidance_parts.append(f'- Focus on: {focus}')
            if reason:
                guidance_parts.append(f'- Reason for regeneration: {reason}')
            guidance_section = f"""
USER FEEDBACK FOR REGENERATION:
The user has requested a new version of this lesson with the following guidance:
{chr(10).join(guidance_parts)}

Please incorporate this feedback into the new lesson while maintaining educational quality.
"""

        # Extract topic from path title
        topic = saved_path.path_data.get('title', saved_path.title) or 'General Topic'

        prompt = f"""Regenerate a lesson about: {lesson_title}
Topic context: {topic}

{guidance_section}

{style_instruction}

{difficulty_instruction}

IMPORTANT: This is a REGENERATION. Create fresh, different content while covering the same core concept.
- Generate a NEW "title" field with a fresh, engaging lesson title (different from "{lesson_title}")
- Use different examples and analogies than a typical lesson
- Approach the explanation from a new angle
- If user requested specific focus, prioritize that

Remember to return valid JSON matching the required structure. Include a "title" field at the top level."""

        try:
            ai = AIProvider(user_id=user_id)

            response = ai.complete(
                prompt=prompt,
                system_message=cls.SYSTEM_PROMPT,
                temperature=0.8,  # Slightly higher for more variation
                max_tokens=2000,
            )

            # Track AI usage
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='lesson_regeneration',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={
                            'lesson_title': lesson_title,
                            'topic': topic,
                            'focus': focus,
                            'reason': reason,
                            'difficulty': lesson_difficulty,
                        },
                        gateway_metadata={
                            'gateway_provider': ai.last_usage.get('gateway_provider'),
                            'gateway_model': ai.last_usage.get('gateway_model'),
                            'requested_model': ai.last_usage.get('requested_model'),
                        }
                        if ai.last_usage.get('gateway_provider')
                        else None,
                    )
                except User.DoesNotExist:
                    logger.warning(f'User {user_id} not found for AI usage tracking')
                except Exception as e:
                    logger.error(f'Failed to track AI usage: {e}', exc_info=True)

            # Parse JSON response
            lesson_content = cls._parse_lesson_response(response)

            if lesson_content:
                logger.info(
                    f'Regenerated AI lesson: {lesson_title}',
                    extra={
                        'lesson_title': lesson_title,
                        'topic': topic,
                        'focus': focus,
                        'reason': reason,
                        'user_id': user_id,
                    },
                )

            return lesson_content

        except Exception as e:
            logger.error(
                f'AI lesson regeneration failed: {e}',
                extra={'lesson_title': lesson_title, 'topic': topic, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _get_exercise_type_guidance(cls, exercise_type: str) -> str:
        """Get exercise type-specific guidance for the AI."""
        return get_exercise_type_guidance(exercise_type)

    @classmethod
    def regenerate_exercise(
        cls,
        lesson_content: dict,
        lesson_title: str,
        exercise_type: str,
        user_id: int | None = None,
    ) -> LessonExercise | None:
        """
        Regenerate just the exercise for a lesson with a different exercise type.

        Args:
            lesson_content: The current AILessonContent dict from the lesson
            lesson_title: Title of the lesson for context
            exercise_type: The new exercise type to generate
            user_id: User ID for AI usage tracking

        Returns:
            New LessonExercise dict, or None if generation fails
        """
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        # Validate exercise type
        valid_types = {
            'terminal',
            'code',
            'ai_prompt',  # Legacy types
            'drag_sort',
            'connect_nodes',
            'code_walkthrough',
            'timed_challenge',  # Interactive types
        }
        if exercise_type not in valid_types:
            logger.error(f'Invalid exercise type: {exercise_type}')
            return None

        # Extract key concepts for context
        key_concepts = lesson_content.get('key_concepts', [])
        summary = lesson_content.get('summary', '')

        # Build the prompt
        prompt = f"""Generate a {exercise_type} exercise for this lesson:

LESSON TITLE: {lesson_title}

LESSON SUMMARY: {summary}

KEY CONCEPTS: {', '.join(key_concepts) if key_concepts else 'N/A'}

REQUESTED EXERCISE TYPE: {exercise_type}

Create an engaging {exercise_type} exercise that helps the learner practice the concepts from this lesson.

{cls._get_exercise_type_guidance(exercise_type)}

Make the exercise practical and directly related to the lesson content."""

        try:
            ai = AIProvider(user_id=user_id)

            response = ai.complete(
                prompt=prompt,
                system_message=cls.EXERCISE_REGENERATION_PROMPT,
                temperature=0.7,
                max_tokens=1000,
            )

            # Track AI usage
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='exercise_regeneration',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={
                            'lesson_title': lesson_title,
                            'exercise_type': exercise_type,
                        },
                        gateway_metadata={
                            'gateway_provider': ai.last_usage.get('gateway_provider'),
                            'gateway_model': ai.last_usage.get('gateway_model'),
                            'requested_model': ai.last_usage.get('requested_model'),
                        }
                        if ai.last_usage.get('gateway_provider')
                        else None,
                    )
                except User.DoesNotExist:
                    logger.warning(f'User {user_id} not found for AI usage tracking')
                except Exception as e:
                    logger.error(f'Failed to track AI usage: {e}', exc_info=True)

            # Parse JSON response
            exercise = cls._parse_exercise_response(response)

            if exercise:
                logger.info(
                    f'Regenerated exercise for lesson: {lesson_title}',
                    extra={
                        'lesson_title': lesson_title,
                        'exercise_type': exercise_type,
                        'user_id': user_id,
                    },
                )

            return exercise

        except Exception as e:
            logger.error(
                f'Exercise regeneration failed: {e}',
                extra={'lesson_title': lesson_title, 'exercise_type': exercise_type, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _parse_exercise_response(cls, response: str) -> LessonExercise | None:
        """Parse AI response into exercise structure."""
        return parse_exercise_response(response)
