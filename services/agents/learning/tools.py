"""
Simplified learning tools for Ember agent.

Reduces 14 tools to 3 tools + injected state + backend middleware.
See: /docs/learning-tool-simplification.md

Tools:
1. find_learning_content - Discover Tools + Projects + Quizzes + Games
2. create_learning_path - Generate rich structured curriculum
3. update_learner_profile - Save preferences/interests/skills

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
# Tool 1: find_learning_content
# =============================================================================


class FindLearningContentInput(BaseModel):
    """Input for find_learning_content tool."""

    model_config = {'extra': 'allow'}

    query: str = Field(
        description='Tool slug, topic slug, or search term (e.g., "langchain", "rag", "ai-agents")',
    )
    content_type: str = Field(
        default='',
        description='Optional filter: "video", "article", "quiz", "game", "code-repo", etc.',
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=50,
        description='Maximum results per category (1-50, default 5)',
    )
    state: dict | None = Field(
        default=None,
        description='Internal - injected by agent with user context and member_context',
    )


@tool(args_schema=FindLearningContentInput)
def find_learning_content(
    query: str,
    content_type: str = '',
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Find and return learning content about a tool or topic.

    Use this when the user wants to:
    - Learn about a specific tool (LangChain, Claude, React)
    - Explore a topic (RAG, AI Agents, Prompt Engineering)
    - Find specific content types (videos, quizzes, articles)
    - Understand a concept (context windows, tokens, LLMs)

    Returns RENDERABLE CONTENT that the frontend will display:
    - inline_game: Interactive game widget embedded in chat
    - project_card: Project cards with thumbnails
    - quiz_card: Quiz cards with difficulty
    - tool_info: Tool information panel

    IMPORTANT: When games are found, they are returned as `inline_game` content
    that the frontend automatically renders as playable widgets. You do NOT
    need to call any other tool to embed games.

    Examples:
    - "What is a context window?" → Returns inline_game (Context Snake)
    - "I want to learn about LangChain" → Returns tool_info + projects
    - "Show me videos about RAG" → Returns project_cards
    - "What quizzes are there about AI agents?" → Returns quiz_cards
    """
    logger.info(
        'find_learning_content called',
        extra={'query': query, 'content_type': content_type, 'user_id': state.get('user_id') if state else None},
    )

    user_id = state.get('user_id') if state else None
    member_context = state.get('member_context') if state else None

    try:
        result = ContentFinder.find(
            query=query,
            content_type=content_type,
            limit=limit,
            user_id=user_id,
            member_context=member_context,
        )

        # Build response with renderable content
        response = {
            'success': True,
            'query': query,
            'content': [],  # Renderable content items for frontend
        }

        # Add inline games FIRST (highest priority for learning)
        # These are rendered as playable widgets in chat
        if result['games']:
            for game in result['games']:
                # Map game slug to inline game type
                game_type_map = {
                    'context-snake': 'snake',
                    'ethics-defender': 'ethics',  # Not yet inline
                    'prompt-battle': 'battle',  # Not yet inline
                }
                inline_type = game_type_map.get(game['slug'], 'snake')

                # Only add if it's an inline-capable game
                if inline_type in ('snake', 'quiz'):
                    response['content'].append(
                        {
                            'type': 'inline_game',
                            'game_type': inline_type,
                            'title': game['title'],
                            'description': game['description'],
                            'explanation': game.get('topic_explanation', ''),
                            'url': game['url'],
                        }
                    )

            response['games'] = result['games']
            response['game_count'] = len(result['games'])

        # Add tool info if found
        if result['tool']:
            response['content'].append(
                {
                    'type': 'tool_info',
                    'name': result['tool']['name'],
                    'slug': result['tool']['slug'],
                    'description': result['tool']['description'],
                    'key_features': result['tool'].get('key_features', []),
                    'url': f"/tools/{result['tool']['slug']}",
                }
            )
            response['tool'] = result['tool']

        # Add projects as cards
        if result['projects']:
            for project in result['projects'][:3]:  # Limit to 3 cards in chat
                response['content'].append(
                    {
                        'type': 'project_card',
                        'id': project['id'],
                        'title': project['title'],
                        'description': project.get('description', ''),
                        'thumbnail': project.get('thumbnail', ''),
                        'url': project['url'],
                        'content_type': project.get('content_type', ''),
                        'difficulty': project.get('difficulty', ''),
                    }
                )
            response['projects'] = result['projects']
            response['project_count'] = len(result['projects'])
        else:
            response['projects'] = []
            response['project_count'] = 0

        # Add quizzes as cards
        if result['quizzes']:
            for quiz in result['quizzes'][:2]:  # Limit to 2 quiz cards
                response['content'].append(
                    {
                        'type': 'quiz_card',
                        'id': quiz['id'],
                        'title': quiz['title'],
                        'description': quiz.get('description', ''),
                        'difficulty': quiz.get('difficulty', 'beginner'),
                        'question_count': quiz.get('question_count', 0),
                        'url': quiz['url'],
                    }
                )
            response['quizzes'] = result['quizzes']
            response['quiz_count'] = len(result['quizzes'])
        else:
            response['quizzes'] = []
            response['quiz_count'] = 0

        # Add helpful message based on results
        content_count = len(response['content'])
        if content_count == 0:
            response['message'] = (
                f"I couldn't find specific content about '{query}'. Let me explain what I know about it."
            )
        elif response.get('game_count', 0) > 0:
            response['message'] = f"Here's an interactive way to learn about {query}!"
        elif response.get('tool'):
            response['message'] = f"Found information about {result['tool']['name']} and related content."
        else:
            response['message'] = f"Found {content_count} learning resources about '{query}'."

        return response

    except Exception as e:
        logger.error('find_learning_content error', extra={'query': query, 'error': str(e)}, exc_info=True)
        return {'success': False, 'error': str(e)}


# =============================================================================
# Tool 2: create_learning_path
# =============================================================================


class CreateLearningPathInput(BaseModel):
    """Input for create_learning_path tool."""

    model_config = {'extra': 'allow'}

    query: str = Field(
        description='Topic for the learning path (e.g., "ai-architecture", "langchain", "rag")',
    )
    difficulty: str = Field(
        default='',
        description='Difficulty level: "beginner", "intermediate", "advanced" (or auto from profile)',
    )
    time_commitment: str = Field(
        default='',
        description='Time commitment: "quick" (< 1 hr), "short" (1-2 hrs), "medium" (2-4 hrs), "deep-dive" (4+ hrs)',
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
    state: dict | None = None,
) -> dict:
    """
    Generate a structured learning path for a topic.

    Use this when the user wants:
    - A structured curriculum to follow
    - A personalized learning journey
    - Step-by-step guidance on mastering a topic

    Creates a curriculum mixing videos, articles, quizzes, games, and code repos.
    The path is saved to the user's profile and can be accessed at the returned URL.

    Examples:
    - "Create a learning path for RAG"
    - "I want to master AI architecture"
    - "Give me a beginner path for LangChain"
    """
    logger.info(
        'create_learning_path called',
        extra={'query': query, 'difficulty': difficulty, 'user_id': state.get('user_id') if state else None},
    )

    user_id = state.get('user_id') if state else None
    member_context = state.get('member_context') if state else None

    if not user_id:
        return {'success': False, 'error': 'You need to be logged in to create a learning path.'}

    try:
        from uuid import uuid4

        from django.utils.text import slugify

        from core.learning_paths.models import LearnerProfile

        # Get user's difficulty preference from profile or member context
        actual_difficulty = difficulty
        if not actual_difficulty and member_context:
            actual_difficulty = member_context.get('learning', {}).get('difficulty_level', 'beginner')
        if not actual_difficulty:
            actual_difficulty = 'beginner'

        # Find content for the path
        content_result = ContentFinder.find(
            query=query,
            content_type='',  # Get all types
            limit=10,
            user_id=user_id,
            member_context=member_context,
        )

        # Build curriculum from found content
        curriculum = []
        order = 1

        # Add tool overview if found
        if content_result['tool']:
            curriculum.append(
                {
                    'order': order,
                    'type': 'tool',
                    'title': f"Understanding {content_result['tool']['name']}",
                    'tool_slug': content_result['tool']['slug'],
                }
            )
            order += 1

        # Add projects by content type priority
        video_projects = [p for p in content_result['projects'] if p.get('content_type') == 'video']
        article_projects = [p for p in content_result['projects'] if p.get('content_type') == 'article']
        code_projects = [p for p in content_result['projects'] if p.get('content_type') == 'code-repo']
        other_projects = [
            p for p in content_result['projects'] if p.get('content_type') not in ('video', 'article', 'code-repo')
        ]

        # Add videos first (introduction)
        for project in video_projects[:2]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'video',
                    'title': project['title'],
                    'project_id': project['id'],
                    'url': project['url'],
                }
            )
            order += 1

        # Add a quiz for knowledge check
        for quiz in content_result['quizzes'][:1]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'quiz',
                    'title': quiz['title'],
                    'quiz_id': quiz['id'],
                    'url': quiz['url'],
                }
            )
            order += 1

        # Add articles for deeper understanding
        for project in article_projects[:2]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'article',
                    'title': project['title'],
                    'project_id': project['id'],
                    'url': project['url'],
                }
            )
            order += 1

        # Add games for practice
        for game in content_result['games'][:1]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'game',
                    'title': game['title'],
                    'game_slug': game['slug'],
                }
            )
            order += 1

        # Add code repos for hands-on learning
        for project in code_projects[:2]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'code-repo',
                    'title': project['title'],
                    'project_id': project['id'],
                    'url': project['url'],
                }
            )
            order += 1

        # Add remaining quizzes
        for quiz in content_result['quizzes'][1:2]:
            curriculum.append(
                {
                    'order': order,
                    'type': 'quiz',
                    'title': quiz['title'],
                    'quiz_id': quiz['id'],
                    'url': quiz['url'],
                }
            )
            order += 1

        # Add other projects
        for project in other_projects[:2]:
            curriculum.append(
                {
                    'order': order,
                    'type': project.get('content_type') or 'other',
                    'title': project['title'],
                    'project_id': project['id'],
                    'url': project['url'],
                }
            )
            order += 1

        # Estimate total time
        estimated_minutes = len(curriculum) * 15  # Rough estimate
        if time_commitment == 'quick':
            curriculum = curriculum[:3]
            estimated_minutes = 45
        elif time_commitment == 'short':
            curriculum = curriculum[:5]
            estimated_minutes = 90
        elif time_commitment == 'medium':
            curriculum = curriculum[:8]
            estimated_minutes = 180

        estimated_hours = round(estimated_minutes / 60, 1)

        # Generate path ID and slug
        path_id = str(uuid4())[:8]
        path_slug = f'{slugify(query)}-{path_id}'

        # Get tools and topics covered
        tools_covered = [content_result['tool']['slug']] if content_result['tool'] else []
        topics_covered = [query]

        # Save to user's learner profile
        profile, _ = LearnerProfile.objects.get_or_create(user_id=user_id)
        profile.generated_path = {
            'id': path_id,
            'slug': path_slug,
            'title': f"{query.replace('-', ' ').title()} Learning Path",
            'curriculum': curriculum,
            'tools_covered': tools_covered,
            'topics_covered': topics_covered,
            'difficulty': actual_difficulty,
            'estimated_hours': estimated_hours,
        }
        profile.current_focus_topic = query
        profile.save(update_fields=['generated_path', 'current_focus_topic', 'updated_at'])

        # Invalidate member context cache
        from services.agents.context import MemberContextService

        MemberContextService.invalidate_cache(user_id)

        return {
            'success': True,
            'path': {
                'id': path_id,
                'title': f"{query.replace('-', ' ').title()} Learning Path",
                'description': f"A structured path to learn {query.replace('-', ' ')}",
                'url': f'/learn/{path_slug}',
                'estimated_time': f'{estimated_hours} hours',
                'difficulty': actual_difficulty,
            },
            'curriculum': curriculum,
            'curriculum_count': len(curriculum),
            'tools_covered': tools_covered,
            'topics_covered': topics_covered,
            'message': (
                f'Created a {actual_difficulty} learning path with {len(curriculum)} items. '
                f'Access it at /learn/{path_slug}'
            ),
        }

    except Exception as e:
        logger.error('create_learning_path error', extra={'query': query, 'error': str(e)}, exc_info=True)
        return {'success': False, 'error': str(e)}


# =============================================================================
# Tool 3: update_learner_profile
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
    'find_learning_content',
    'create_learning_path',
    'update_learner_profile',
}

# All learning tools (simplified from 14 to 3)
LEARNING_TOOLS = [
    find_learning_content,
    create_learning_path,
    update_learner_profile,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in LEARNING_TOOLS}
