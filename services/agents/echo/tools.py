"""
LangChain tools for the Echo agent.

These tools help creators capture ideas and manage their content strategy.

Tools:
- save_idea: Create ContentIdea with pillar, hook, session link
- strategy: Get or update user's content strategy
"""

import logging

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Input Schemas
# =============================================================================


class SaveIdeaInput(BaseModel):
    """Input for save_idea tool."""

    model_config = {'extra': 'allow'}

    title: str = Field(description='Title for the content idea')
    description: str = Field(default='', description='Description or body of the idea')
    hook: str = Field(default='', description='Attention-grabbing opener')
    pillar_id: int | None = Field(default=None, description='Content pillar taxonomy ID')
    platforms: list[str] = Field(default=[], description='Target platforms: twitter, linkedin, youtube')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class StrategyInput(BaseModel):
    """Input for strategy tool."""

    model_config = {'extra': 'allow'}

    goals: list[str] | None = Field(
        default=None, description='Content goals, e.g., ["grow audience", "get clients"]'
    )
    platforms: list[str] | None = Field(default=None, description='Platforms: linkedin, twitter, youtube')
    posts_per_week: int | None = Field(default=None, description='Total posts per week across all platforms')
    schedule: dict | None = Field(default=None, description='Posting schedule, e.g., {"linkedin": ["Mon", "Wed"]}')
    pillars: list[str] | None = Field(default=None, description='Content pillars/themes')
    voice: str | None = Field(default=None, description='Voice description')
    recommendations: dict | None = Field(default=None, description='Echo coaching recommendations')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


# =============================================================================
# Tools
# =============================================================================


@tool(args_schema=SaveIdeaInput)
def save_idea(
    title: str,
    description: str = '',
    hook: str = '',
    pillar_id: int | None = None,
    platforms: list[str] | None = None,
    state: dict | None = None,
) -> dict:
    """
    Save a content idea to the user's idea bank.

    Creates a ContentIdea with the given title, hook, and pillar.
    Links it to the current brainstorm session if one is active.

    Returns:
        Dictionary with success status and idea ID
    """
    from django.contrib.auth import get_user_model

    from core.content_engine.models import BrainstormSession, ContentIdea
    from core.taxonomy.models import Taxonomy

    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    session_id = state.get('session_id')
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Validate pillar if provided
    pillar = None
    if pillar_id:
        try:
            pillar = Taxonomy.objects.get(id=pillar_id, taxonomy_type='content_pillar')
        except Taxonomy.DoesNotExist:
            return {'success': False, 'error': f'Invalid content pillar ID: {pillar_id}'}

    # Find or create brainstorm session
    brainstorm_session = None
    if session_id:
        try:
            brainstorm_session = BrainstormSession.objects.get(
                user=user,
                id=session_id,
                is_active=True,
            )
        except (BrainstormSession.DoesNotExist, ValueError):
            # Session ID might be a UUID string, not an integer
            pass

    # Create the idea
    idea = ContentIdea.objects.create(
        user=user,
        title=title,
        description=description,
        hook=hook,
        pillar=pillar,
        brainstorm_session=brainstorm_session,
        platforms=platforms or [],
        source=ContentIdea.Source.BRAINSTORM,
        status=ContentIdea.Status.SAVED,
    )

    # Link idea to brainstorm session
    if brainstorm_session:
        brainstorm_session.generated_ideas.add(idea)

    logger.info(f'Saved idea "{title}" for user {user.username} (pillar={pillar})')

    return {
        'success': True,
        'idea_id': idea.id,
        'title': idea.title,
        'message': f'Idea "{title}" saved successfully',
    }


@tool(args_schema=StrategyInput)
def strategy(
    goals: list[str] | None = None,
    platforms: list[str] | None = None,
    posts_per_week: int | None = None,
    schedule: dict | None = None,
    pillars: list[str] | None = None,
    voice: str | None = None,
    recommendations: dict | None = None,
    state: dict | None = None,
) -> dict:
    """
    Get or update the user's content strategy.

    Called with no args: Returns the current strategy.
    Called with args: Updates strategy fields (partial updates supported).
    Creates a new strategy if none exists.

    Returns:
        Dictionary with strategy data or error
    """
    from django.contrib.auth import get_user_model

    from core.content_engine.models import Strategy

    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Get or create strategy
    user_strategy, created = Strategy.objects.get_or_create(user=user)

    # Check if any update args provided
    update_fields = {}
    if goals is not None:
        update_fields['goals'] = goals
    if platforms is not None:
        # Validate platforms
        valid_platforms = ['linkedin', 'twitter', 'youtube']
        invalid = [p for p in platforms if p.lower() not in valid_platforms]
        if invalid:
            return {'success': False, 'error': f'Invalid platforms: {invalid}. Valid: {valid_platforms}'}
        update_fields['platforms'] = [p.lower() for p in platforms]
    if posts_per_week is not None:
        if posts_per_week < 0:
            return {'success': False, 'error': 'posts_per_week must be positive'}
        update_fields['posts_per_week'] = posts_per_week
    if schedule is not None:
        update_fields['schedule'] = schedule
    if pillars is not None:
        update_fields['pillars'] = pillars
    if voice is not None:
        update_fields['voice'] = voice
    if recommendations is not None:
        update_fields['recommendations'] = recommendations

    # Apply updates if any
    if update_fields:
        for field, value in update_fields.items():
            setattr(user_strategy, field, value)
        user_strategy.save()
        action = 'created' if created else 'updated'
        logger.info(f'Strategy {action} for user {user.username}: {list(update_fields.keys())}')
    else:
        action = 'retrieved'

    # Return strategy data
    return {
        'success': True,
        'action': action,
        'strategy': {
            'goals': user_strategy.goals,
            'platforms': user_strategy.platforms,
            'posts_per_week': user_strategy.posts_per_week,
            'schedule': user_strategy.schedule,
            'pillars': user_strategy.pillars,
            'voice': user_strategy.voice,
            'recommendations': user_strategy.recommendations,
        },
    }


# =============================================================================
# Tool Registry
# =============================================================================

# All tools available to Echo agent
ECHO_TOOLS = [
    save_idea,
    strategy,
]

# Lookup by tool name
ECHO_TOOLS_BY_NAME = {tool.name: tool for tool in ECHO_TOOLS}

# Tools that need state injection (user_id, session_id)
TOOLS_NEEDING_STATE = {
    'save_idea',  # Needs user_id, session_id
    'strategy',  # Needs user_id
}
