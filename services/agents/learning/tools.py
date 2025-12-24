"""
Learning tools for Ember agent.

Tools for creating learning paths and updating learner profiles.

NOTE: find_learning_content has been consolidated into find_content.py
in the discovery module. This file only contains path/profile tools.

Tools:
1. create_learning_path - Generate rich structured curriculum
2. update_learner_profile - Save preferences/interests/skills

Member context (profile, stats, progress, suggestions, personalization)
is injected at conversation start via MemberContextService - no tool call needed.
"""

import logging

from django.utils import timezone
from langchain.tools import tool
from pydantic import BaseModel, Field

from .components import ContentFinder

logger = logging.getLogger(__name__)


# =============================================================================
# Tool 1: create_learning_path
# =============================================================================


class CreateLearningPathInput(BaseModel):
    """Input for create_learning_path tool."""

    model_config = {'extra': 'allow'}

    query: str = Field(
        description=(
            'Topic or learning goal for the path. ALWAYS pass the COMPLETE user request as ONE query. '
            'NEVER split multi-topic requests into separate calls. '
            'Examples: "git and claude cli" (ONE call), "using playwright with claude" (ONE call), '
            '"python for data science" (ONE call), "react vs vue" (ONE call). '
            'The system intelligently parses multi-subject queries and creates ONE unified learning path.'
        ),
    )
    difficulty: str = Field(
        default='',
        description='Difficulty level: "beginner", "intermediate", "advanced" (or auto from profile)',
    )
    time_commitment: str = Field(
        default='',
        description='Time commitment: "quick" (< 1 hr), "short" (1-2 hrs), "medium" (2-4 hrs), "deep-dive" (4+ hrs)',
    )
    replace_existing: bool = Field(
        default=False,
        description='If True, replace an existing learning path for this topic instead of creating a duplicate',
    )
    state: dict | None = Field(
        default=None,
        description='Internal - injected by agent with user context and member_context',
    )


@tool(args_schema=CreateLearningPathInput)
def create_learning_path(
    query: str,
    difficulty: str = '',
    time_commitment: str = '',
    replace_existing: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Generate a structured learning path for a topic.

    ⚠️ CRITICAL: ALWAYS ASK CLARIFYING QUESTIONS BEFORE CALLING THIS TOOL! ⚠️

    NEVER call this tool immediately when a user asks for a learning path.

    **ALWAYS ask about their GOAL** - what they want to build or accomplish.

    **For EXPERIENCE level:**
    - Check the member context first (injected as "About This Member")
    - If you see their difficulty_level, USE IT - don't ask again
    - Only ask about experience if member context is missing

    Examples:
    - "I want to learn RAG" → "Are you building a chatbot, search system, or understanding concepts?"
    - "teach me python" → "What's your goal - data science, web apps, or automation?"

    Only call this tool AFTER the user answers your question(s).
    Then pass their specific goal as the query AND set difficulty from context or their answer.

    CORRECT flow:
    1. User: "Make me a learning path about RAG"
    2. You: Ask about their goal (use member context for difficulty if available)
    3. User: "I want to build a chatbot for my company docs"
    4. You: Call create_learning_path(query="building a RAG chatbot for docs", difficulty="intermediate")

    WRONG flow:
    1. User: "Make me a learning path about RAG"
    2. You: Call create_learning_path(query="RAG")  ← WRONG! No clarifying question asked!

    Use this when the user wants:
    - A structured curriculum to follow
    - A personalized learning journey
    - Step-by-step guidance on mastering a topic

    CRITICAL: This tool handles multi-topic requests automatically.
    NEVER call this tool multiple times for one user request.
    Pass the COMPLETE query as-is: "git and claude cli" creates ONE unified path.

    Creates a curriculum mixing videos, articles, quizzes, games, code repos,
    and AI-generated lessons when curated content is unavailable.
    The path is personalized based on user's learning style and difficulty level.
    The path is saved to the user's profile and can be accessed at the returned URL.

    IMPORTANT: This tool checks the CURRENT database state for existing paths.
    Users can delete paths via the UI, so NEVER assume a path still exists based on
    conversation history. ALWAYS call this tool to verify current state.

    REPLACING EXISTING PATHS:
    When this tool returns `existing_path_found: true`, it means the user already has
    a path for this topic. You should ask if they want to replace it.

    If the user says "yes", "replace it", "make a new one", or similar affirmative:
    → Call this tool AGAIN with the SAME query AND replace_existing=True
    """
    logger.info(
        'create_learning_path called',
        extra={'query': query, 'difficulty': difficulty, 'user_id': state.get('user_id') if state else None},
    )

    user_id = state.get('user_id') if state else None
    username = state.get('username') if state else None
    member_context = state.get('member_context') if state else None

    if not user_id or not username:
        return {'success': False, 'error': 'You need to be logged in to create a learning path.'}

    try:
        from django.utils.text import slugify

        from core.learning_paths.models import LearnerProfile, SavedLearningPath
        from core.learning_paths.tasks import generate_learning_path_cover, generate_lesson_images_for_path

        from .lesson_generator import AILessonGenerator

        # Analyze the topic using AI for intelligent title/concept generation
        # This handles multi-subject queries like "playwright with claude" properly
        topic_analysis = AILessonGenerator.analyze_topic(query, user_id=user_id)

        # Use analyzed slug if available, otherwise fall back to simple slugify
        if topic_analysis:
            base_slug = topic_analysis['slug']
            logger.info(
                'Topic analysis complete',
                extra={
                    'query': query,
                    'title': topic_analysis['title'],
                    'slug': base_slug,
                    'subjects': topic_analysis['subjects'],
                    'relationship': topic_analysis['relationship'],
                },
            )
        else:
            # Fallback to simple slug if AI analysis fails
            base_slug = slugify(query)
            topic_analysis = AILessonGenerator.get_fallback_analysis(query)
            logger.info(f'Using fallback topic analysis for: {query}')

        # Check for existing learning path with the same topic
        existing_path = SavedLearningPath.objects.filter(
            user_id=user_id,
            slug=base_slug,
            is_archived=False,
        ).first()

        if existing_path and not replace_existing:
            # Return a prompt to ask the user if they want to replace
            return {
                'success': False,
                'existing_path_found': True,
                'existing_path': {
                    'slug': existing_path.slug,
                    'title': existing_path.title,
                    'url': f'/{username}/learn/{existing_path.slug}',
                    'created_at': existing_path.created_at.isoformat(),
                    'curriculum_count': len(existing_path.path_data.get('curriculum', []))
                    if existing_path.path_data
                    else 0,
                },
                'message': (
                    f'You already have a learning path for "{query}" at /{username}/learn/{existing_path.slug}. '
                    f'Would you like me to replace it with a fresh one, or would you prefer to keep it?'
                ),
            }

        # Get user's difficulty preference from profile or member context
        actual_difficulty = difficulty
        if not actual_difficulty and member_context:
            actual_difficulty = member_context.get('learning', {}).get('difficulty_level', 'beginner')
        if not actual_difficulty:
            actual_difficulty = 'beginner'

        # Find existing content for the path
        # Pass analyzed subjects for better multi-subject matching
        # e.g., for "playwright with claude", also search for "Playwright" and "Claude AI" separately
        content_result = ContentFinder.find(
            query=query,
            content_type='',  # Get all types
            limit=10,
            user_id=user_id,
            member_context=member_context,
            additional_subjects=topic_analysis.get('subjects', []),
        )

        # Generate curriculum with AI lessons to fill gaps
        # This uses the AILessonGenerator which:
        # 1. Adds existing curated content (videos, articles, quizzes, etc.)
        # 2. Supplements with AI-generated lessons when content is sparse
        # 3. Logs content gaps to ContentGap model for strategic development
        # 4. Personalizes AI lessons based on member_context (learning style, difficulty)
        # 5. Uses pre-analyzed concepts for better multi-subject handling
        curriculum = AILessonGenerator.generate_curriculum(
            topic=query,
            member_context=member_context,
            existing_content=content_result,
            user_id=user_id,
            topic_analysis=topic_analysis,
        )

        # Apply time commitment limits
        if time_commitment == 'quick':
            curriculum = curriculum[:3]
        elif time_commitment == 'short':
            curriculum = curriculum[:5]
        elif time_commitment == 'medium':
            curriculum = curriculum[:8]

        # Renumber curriculum after any truncation
        for i, item in enumerate(curriculum):
            item['order'] = i + 1

        # Calculate estimated time from curriculum items
        estimated_minutes = sum(item.get('estimated_minutes', 15) for item in curriculum)
        estimated_hours = round(estimated_minutes / 60, 1)

        # Use AI-analyzed title and slug (already computed above)
        path_title = topic_analysis['title']
        # base_slug already defined above from topic_analysis

        # Handle replace_existing: archive old path and reuse slug
        if replace_existing and existing_path:
            existing_path.is_archived = True
            existing_path.save(update_fields=['is_archived', 'updated_at'])
            path_slug = base_slug  # Reuse the same slug
            logger.info(f'Archived existing path {existing_path.id} for replacement')
        else:
            # Create unique slug for this user (only if not replacing)
            existing_slugs = set(
                SavedLearningPath.objects.filter(
                    user_id=user_id,
                    slug__startswith=base_slug,
                    is_archived=False,
                ).values_list('slug', flat=True)
            )
            path_slug = base_slug
            counter = 1
            while path_slug in existing_slugs:
                path_slug = f'{base_slug}-{counter}'
                counter += 1

        # Get tools and topics covered - use analyzed subjects for better accuracy
        tools_covered = [content_result['tool']['slug']] if content_result.get('tool') else []
        topics_covered = topic_analysis['subjects']  # Use analyzed subjects instead of raw query

        # Count AI-generated vs curated content
        ai_lesson_count = sum(1 for item in curriculum if item.get('generated'))
        curated_count = len(curriculum) - ai_lesson_count

        # Build path_data for SavedLearningPath
        path_data = {
            'curriculum': curriculum,
            'tools_covered': tools_covered,
            'topics_covered': topics_covered,
            'ai_lesson_count': ai_lesson_count,
            'curated_count': curated_count,
            # Store topic analysis metadata for future reference
            'topic_relationship': topic_analysis['relationship'],
            'topic_description': topic_analysis.get('description', ''),
            'original_query': query,
            # Store related projects for "See what others are doing" section
            'related_projects': content_result.get('projects', []),
        }

        # Create SavedLearningPath (this is the new multi-path model)
        saved_path = SavedLearningPath.objects.create(
            user_id=user_id,
            slug=path_slug,
            title=path_title,
            path_data=path_data,
            difficulty=actual_difficulty,
            estimated_hours=estimated_hours,
            is_active=False,  # Don't auto-activate, let user choose
        )

        # Activate this path (deactivates others)
        saved_path.activate()

        # Trigger async image generation for cover and all lessons
        generate_learning_path_cover.delay(saved_path.id, user_id)
        generate_lesson_images_for_path.delay(saved_path.id, user_id)

        # Also update LearnerProfile for backwards compatibility
        profile, _ = LearnerProfile.objects.get_or_create(user_id=user_id)
        profile.generated_path = {
            'id': str(saved_path.id),
            'slug': path_slug,
            'title': path_title,
            'curriculum': curriculum,
            'tools_covered': tools_covered,
            'topics_covered': topics_covered,
            'difficulty': actual_difficulty,
            'estimated_hours': estimated_hours,
            'ai_lesson_count': ai_lesson_count,
            'curated_count': curated_count,
        }
        profile.current_focus_topic = query
        profile.save(update_fields=['generated_path', 'current_focus_topic', 'updated_at'])

        # Invalidate member context cache
        from services.agents.context import MemberContextService

        MemberContextService.invalidate_cache(user_id)

        logger.info(
            f'Learning path created: {len(curriculum)} items ({curated_count} curated, {ai_lesson_count} AI-generated)',
            extra={
                'query': query,
                'user_id': user_id,
                'saved_path_id': saved_path.id,
                'curriculum_count': len(curriculum),
                'ai_lesson_count': ai_lesson_count,
                'curated_count': curated_count,
                'difficulty': actual_difficulty,
            },
        )

        return {
            'success': True,
            'path': {
                'id': str(saved_path.id),
                'slug': path_slug,
                'title': path_title,
                'description': f"A structured path to learn {query.replace('-', ' ')}",
                'url': f'/{username}/learn/{path_slug}',
                'estimated_time': f'{estimated_hours} hours',
                'difficulty': actual_difficulty,
            },
            'curriculum': curriculum,
            'curriculum_count': len(curriculum),
            'ai_lesson_count': ai_lesson_count,
            'curated_count': curated_count,
            'tools_covered': tools_covered,
            'topics_covered': topics_covered,
            'message': (
                f'Created a {actual_difficulty} learning path with {len(curriculum)} items '
                f'({curated_count} curated, {ai_lesson_count} personalized lessons). '
                f'Access it at /{username}/learn/{path_slug}'
            ),
        }

    except Exception as e:
        logger.error('create_learning_path error', extra={'query': query, 'error': str(e)}, exc_info=True)
        return {'success': False, 'error': str(e)}


# =============================================================================
# Tool 2: update_learner_profile
# =============================================================================


class UpdateLearnerProfileInput(BaseModel):
    """Input for update_learner_profile tool."""

    model_config = {'extra': 'allow'}

    preferences: dict = Field(
        default_factory=dict,
        description=(
            'Preferences to update: ' '{"learning_style": "video", "difficulty": "intermediate", "session_length": 15}'
        ),
    )
    interests: list[str] = Field(
        default_factory=list,
        description='Interests to add: ["langchain", "rag", "ai-agents"]',
    )
    skills: dict = Field(
        default_factory=dict,
        description='Skills to update: {"prompt-engineering": "advanced", "rag": "beginner"}',
    )
    notes: str = Field(
        default='',
        description='Free-form observation about the learner',
    )
    state: dict | None = Field(
        default=None,
        description='Internal - injected by agent with user context',
    )


@tool(args_schema=UpdateLearnerProfileInput)
def update_learner_profile(
    preferences: dict | None = None,
    interests: list[str] | None = None,
    skills: dict | None = None,
    notes: str = '',
    state: dict | None = None,
) -> dict:
    """
    Save learner preferences, interests, and skills discovered during conversation.

    Use this when:
    - User expresses a learning preference ("I prefer videos", "I learn better hands-on")
    - User shows interest in a topic ("I'm interested in RAG", "I want to learn about agents")
    - Ember infers user skill level ("You seem advanced at prompt engineering")
    - Ember observes something worth remembering about the learner

    This updates the user's profile for future personalization.

    Examples:
    - User says "I prefer videos" -> preferences={"learning_style": "video"}
    - User interested in RAG -> interests=["rag"]
    - User shows expertise -> skills={"ai-agents": "advanced"}
    """
    logger.info(
        'update_learner_profile called',
        extra={
            'preferences': preferences,
            'interests': interests,
            'skills': skills,
            'user_id': state.get('user_id') if state else None,
        },
    )

    user_id = state.get('user_id') if state else None
    if not user_id:
        return {'success': False, 'error': 'User not authenticated'}

    preferences = preferences or {}
    interests = interests or []
    skills = skills or {}

    try:
        from core.learning_paths.models import LearnerProfile, UserSkillProficiency
        from core.taxonomy.models import Taxonomy

        profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)
        updated_fields = []

        # Update preferences
        if preferences:
            if 'learning_style' in preferences:
                valid_styles = ['visual', 'hands_on', 'conceptual', 'mixed']
                style = preferences['learning_style'].lower().replace('-', '_').replace(' ', '_')
                # Map common variations
                style_map = {
                    'video': 'visual',
                    'videos': 'visual',
                    'watch': 'visual',
                    'reading': 'conceptual',
                    'read': 'conceptual',
                    'articles': 'conceptual',
                    'hands_on': 'hands_on',
                    'hands-on': 'hands_on',
                    'practice': 'hands_on',
                    'doing': 'hands_on',
                    'code': 'hands_on',
                }
                style = style_map.get(style, style)
                if style in valid_styles:
                    profile.preferred_learning_style = style
                    updated_fields.append('preferences.learning_style')

            if 'difficulty' in preferences:
                valid_difficulties = ['beginner', 'intermediate', 'advanced']
                diff = preferences['difficulty'].lower()
                if diff in valid_difficulties:
                    profile.current_difficulty_level = diff
                    updated_fields.append('preferences.difficulty')

            if 'session_length' in preferences:
                try:
                    length = int(preferences['session_length'])
                    if 1 <= length <= 120:
                        profile.preferred_session_length = length
                        updated_fields.append('preferences.session_length')
                except (ValueError, TypeError):
                    pass

            if 'learning_goal' in preferences:
                valid_goals = ['build_projects', 'understand_concepts', 'career', 'exploring']
                goal = preferences['learning_goal'].lower().replace('-', '_').replace(' ', '_')
                if goal in valid_goals:
                    profile.learning_goal = goal
                    updated_fields.append('preferences.learning_goal')

        # Update interests (add to existing)
        if interests:
            existing_interests = profile.generated_path.get('interests', []) if profile.generated_path else []
            new_interests = list(set(existing_interests + interests))[:20]  # Cap at 20
            if not profile.generated_path:
                profile.generated_path = {}
            profile.generated_path['interests'] = new_interests
            updated_fields.append('interests')

        # Update skills
        if skills:
            proficiency_map = {
                'none': 'none',
                'beginner': 'beginner',
                'intermediate': 'intermediate',
                'advanced': 'advanced',
                'expert': 'expert',
            }
            for skill_slug, level in skills.items():
                level_normalized = proficiency_map.get(level.lower(), 'beginner')
                # Try to find skill in taxonomy
                skill_taxonomy = Taxonomy.objects.filter(
                    slug=skill_slug,
                    taxonomy_type='skill',
                    is_active=True,
                ).first()
                if skill_taxonomy:
                    UserSkillProficiency.objects.update_or_create(
                        user_id=user_id,
                        skill=skill_taxonomy,
                        defaults={
                            'proficiency_level': level_normalized,
                            'is_self_assessed': False,  # Inferred by Ember
                        },
                    )
                    updated_fields.append(f'skills.{skill_slug}')

        # Add notes if provided
        if notes:
            # Store notes in generated_path metadata
            if not profile.generated_path:
                profile.generated_path = {}
            existing_notes = profile.generated_path.get('ember_notes', [])
            existing_notes.append(
                {
                    'note': notes,
                    'timestamp': timezone.now().isoformat(),
                }
            )
            profile.generated_path['ember_notes'] = existing_notes[-10:]  # Keep last 10
            updated_fields.append('notes')

        # Save profile
        profile.save()

        # Invalidate member context cache
        from services.agents.context import MemberContextService

        MemberContextService.invalidate_cache(user_id)

        return {
            'success': True,
            'updated_fields': updated_fields,
            'message': f'Updated {len(updated_fields)} field(s) in your learning profile.'
            if updated_fields
            else 'No changes made.',
        }

    except Exception as e:
        logger.error('update_learner_profile error', extra={'error': str(e)}, exc_info=True)
        return {'success': False, 'error': str(e)}


# =============================================================================
# Tool Registry
# =============================================================================

# Tools that need state injection (user_id, username, session_id, member_context)
TOOLS_NEEDING_STATE = {
    'create_learning_path',
    'update_learner_profile',
}

# All learning tools (find_learning_content moved to find_content.py)
LEARNING_TOOLS = [
    create_learning_path,
    update_learner_profile,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in LEARNING_TOOLS}
