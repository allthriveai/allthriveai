"""
LangChain tools for the Echo agent.

These tools help creators capture ideas and manage their content strategy.

Tools:
- save_idea: Create ContentIdea with pillar, hook, session link
- strategy: Get or update user's content strategy
- manage_task: Create/update/complete tasks via AsanaService
- manage_idea: Save/update/archive ContentIdea
- get_context: Return tasks summary, ideas, profile, brand voice
- sync_asana: Trigger immediate Asana sync
- save_onboarding_response: Update EchoProfile with goals, platforms, pillars
"""

import logging
from datetime import date
from typing import Literal

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


class ManageTaskInput(BaseModel):
    """Input for manage_task tool."""

    model_config = {'extra': 'allow'}

    action: Literal['create', 'update', 'complete', 'delete'] = Field(
        description='Action to perform: create, update, complete, or delete'
    )
    title: str | None = Field(default=None, description='Task title (required for create)')
    task_id: int | None = Field(default=None, description='Task ID (required for update/complete/delete)')
    notes: str | None = Field(default=None, description='Task notes/description')
    due_date: str | None = Field(default=None, description='Due date in YYYY-MM-DD format')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class ManageIdeaInput(BaseModel):
    """Input for manage_idea tool."""

    model_config = {'extra': 'allow'}

    action: Literal['save', 'update', 'archive'] = Field(
        description='Action to perform: save, update, or archive'
    )
    title: str | None = Field(default=None, description='Idea title (required for save)')
    idea_id: int | None = Field(default=None, description='Idea ID (required for update/archive)')
    description: str | None = Field(default=None, description='Idea description')
    hook: str | None = Field(default=None, description='Attention-grabbing opener')
    pillar_id: int | None = Field(default=None, description='Content pillar taxonomy ID')
    platforms: list[str] | None = Field(default=None, description='Target platforms')
    status: str | None = Field(default=None, description='Status: saved, planned, in_progress, archived')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetContextInput(BaseModel):
    """Input for get_context tool."""

    model_config = {'extra': 'allow'}

    include_tasks: bool = Field(default=True, description='Include task summary')
    include_ideas: bool = Field(default=True, description='Include recent ideas')
    include_profile: bool = Field(default=True, description='Include Echo profile')
    include_brand_voice: bool = Field(default=True, description='Include brand voice settings')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class SyncAsanaInput(BaseModel):
    """Input for sync_asana tool."""

    model_config = {'extra': 'allow'}

    state: dict | None = Field(default=None, description='Internal - injected by agent')


class SaveOnboardingResponseInput(BaseModel):
    """Input for save_onboarding_response tool."""

    model_config = {'extra': 'allow'}

    goals: list[str] | None = Field(default=None, description='User goals')
    platforms: list[str] | None = Field(default=None, description='Target platforms')
    pillars: list[str] | None = Field(default=None, description='Content pillars/topics')
    audience_description: str | None = Field(default=None, description='Description of target audience')
    advance_phase: bool = Field(default=False, description='Whether to advance to next onboarding phase')
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


@tool(args_schema=ManageTaskInput)
def manage_task(
    action: str,
    title: str | None = None,
    task_id: int | None = None,
    notes: str | None = None,
    due_date: str | None = None,
    state: dict | None = None,
) -> dict:
    """
    Create, update, complete, or delete a task via Asana.

    Actions:
    - create: Create a new task (requires title)
    - update: Update an existing task (requires task_id)
    - complete: Mark a task as complete (requires task_id)
    - delete: Delete a task (requires task_id)

    Returns:
        Dictionary with success status and task data or error message
    """
    from django.contrib.auth import get_user_model

    from core.integrations.asana_models import TaskCache
    from core.integrations.asana_service import (
        AsanaNotConnectedError,
        AsanaService,
    )

    if not state or 'user_id' not in state:
        return {'success': False, 'user_message': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'user_message': 'User not found'}

    # Try to get Asana service
    try:
        asana_service = AsanaService(user)
    except AsanaNotConnectedError:
        return {
            'success': False,
            'user_message': 'Connect your Asana account in Settings to manage tasks.',
        }

    # Parse due_date if provided
    parsed_due_date = None
    if due_date:
        try:
            parsed_due_date = date.fromisoformat(due_date)
        except ValueError:
            return {'success': False, 'user_message': f'Invalid due date format: {due_date}. Use YYYY-MM-DD.'}

    try:
        if action == 'create':
            if not title:
                return {'success': False, 'user_message': 'Title is required for creating a task.'}

            task = asana_service.create_task(
                title=title,
                notes=notes or '',
                due_date=parsed_due_date,
            )
            logger.info(f'Created task "{title}" for user {user.username}')
            return {
                'success': True,
                'data': {
                    'id': task.id,
                    'title': task.title,
                    'notes': task.notes,
                    'due_date': task.due_date.isoformat() if task.due_date else None,
                    'completed': task.completed,
                },
                'user_message': f'Task "{title}" created successfully.',
            }

        elif action == 'update':
            if not task_id:
                return {'success': False, 'user_message': 'Task ID is required for updating a task.'}

            try:
                task = TaskCache.objects.get(id=task_id, user=user, is_deleted=False)
            except TaskCache.DoesNotExist:
                return {'success': False, 'user_message': f'Task {task_id} not found.'}

            task = asana_service.update_task(
                task=task,
                title=title,
                notes=notes,
                due_date=parsed_due_date,
            )
            logger.info(f'Updated task "{task.title}" for user {user.username}')
            return {
                'success': True,
                'data': {
                    'id': task.id,
                    'title': task.title,
                    'notes': task.notes,
                    'due_date': task.due_date.isoformat() if task.due_date else None,
                    'completed': task.completed,
                },
                'user_message': f'Task "{task.title}" updated.',
            }

        elif action == 'complete':
            if not task_id:
                return {'success': False, 'user_message': 'Task ID is required for completing a task.'}

            try:
                task = TaskCache.objects.get(id=task_id, user=user, is_deleted=False)
            except TaskCache.DoesNotExist:
                return {'success': False, 'user_message': f'Task {task_id} not found.'}

            task = asana_service.complete_task(task)
            logger.info(f'Completed task "{task.title}" for user {user.username}')
            return {
                'success': True,
                'data': {'id': task.id, 'title': task.title, 'completed': True},
                'user_message': f'Task "{task.title}" marked as complete.',
            }

        elif action == 'delete':
            if not task_id:
                return {'success': False, 'user_message': 'Task ID is required for deleting a task.'}

            try:
                task = TaskCache.objects.get(id=task_id, user=user, is_deleted=False)
            except TaskCache.DoesNotExist:
                return {'success': False, 'user_message': f'Task {task_id} not found.'}

            task_title = task.title
            asana_service.delete_task(task)
            logger.info(f'Deleted task "{task_title}" for user {user.username}')
            return {
                'success': True,
                'user_message': f'Task "{task_title}" deleted.',
            }

        else:
            return {'success': False, 'user_message': f'Invalid action: {action}'}

    except Exception as e:
        logger.error(f'manage_task error for user {user.username}: {e}')
        return {'success': False, 'user_message': f'Failed to {action} task: {e}'}


@tool(args_schema=ManageIdeaInput)
def manage_idea(
    action: str,
    title: str | None = None,
    idea_id: int | None = None,
    description: str | None = None,
    hook: str | None = None,
    pillar_id: int | None = None,
    platforms: list[str] | None = None,
    status: str | None = None,
    state: dict | None = None,
) -> dict:
    """
    Save, update, or archive a content idea.

    Actions:
    - save: Create a new idea (requires title)
    - update: Update an existing idea (requires idea_id)
    - archive: Archive an idea (requires idea_id)

    Returns:
        Dictionary with success status and idea data or error message
    """
    from django.contrib.auth import get_user_model

    from core.content_engine.models import ContentIdea
    from core.taxonomy.models import Taxonomy

    if not state or 'user_id' not in state:
        return {'success': False, 'user_message': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'user_message': 'User not found'}

    # Validate pillar if provided
    pillar = None
    if pillar_id:
        try:
            pillar = Taxonomy.objects.get(id=pillar_id, taxonomy_type='content_pillar')
        except Taxonomy.DoesNotExist:
            return {'success': False, 'user_message': f'Invalid content pillar ID: {pillar_id}'}

    try:
        if action == 'save':
            if not title:
                return {'success': False, 'user_message': 'Title is required for saving an idea.'}

            idea = ContentIdea.objects.create(
                user=user,
                title=title,
                description=description or '',
                hook=hook or '',
                pillar=pillar,
                platforms=platforms or [],
                source=ContentIdea.Source.BRAINSTORM,
                status=ContentIdea.Status.SAVED,
            )
            logger.info(f'Saved idea "{title}" for user {user.username}')
            return {
                'success': True,
                'data': {
                    'id': idea.id,
                    'title': idea.title,
                    'description': idea.description,
                    'hook': idea.hook,
                    'pillar_id': idea.pillar_id,
                    'platforms': idea.platforms,
                    'status': idea.status,
                },
                'user_message': f'Idea "{title}" saved successfully.',
            }

        elif action == 'update':
            if not idea_id:
                return {'success': False, 'user_message': 'Idea ID is required for updating.'}

            try:
                idea = ContentIdea.objects.get(id=idea_id, user=user)
            except ContentIdea.DoesNotExist:
                return {'success': False, 'user_message': f'Idea {idea_id} not found.'}

            # Update fields if provided
            if title is not None:
                idea.title = title
            if description is not None:
                idea.description = description
            if hook is not None:
                idea.hook = hook
            if pillar is not None:
                idea.pillar = pillar
            if platforms is not None:
                idea.platforms = platforms
            if status is not None:
                valid_statuses = [s.value for s in ContentIdea.Status]
                if status not in valid_statuses:
                    return {'success': False, 'user_message': f'Invalid status: {status}. Valid: {valid_statuses}'}
                idea.status = status

            idea.save()
            logger.info(f'Updated idea "{idea.title}" for user {user.username}')
            return {
                'success': True,
                'data': {
                    'id': idea.id,
                    'title': idea.title,
                    'description': idea.description,
                    'hook': idea.hook,
                    'pillar_id': idea.pillar_id,
                    'platforms': idea.platforms,
                    'status': idea.status,
                },
                'user_message': f'Idea "{idea.title}" updated.',
            }

        elif action == 'archive':
            if not idea_id:
                return {'success': False, 'user_message': 'Idea ID is required for archiving.'}

            try:
                idea = ContentIdea.objects.get(id=idea_id, user=user)
            except ContentIdea.DoesNotExist:
                return {'success': False, 'user_message': f'Idea {idea_id} not found.'}

            idea.status = ContentIdea.Status.ARCHIVED
            idea.save()
            logger.info(f'Archived idea "{idea.title}" for user {user.username}')
            return {
                'success': True,
                'data': {'id': idea.id, 'title': idea.title, 'status': 'archived'},
                'user_message': f'Idea "{idea.title}" archived.',
            }

        else:
            return {'success': False, 'user_message': f'Invalid action: {action}'}

    except Exception as e:
        logger.error(f'manage_idea error for user {user.username}: {e}')
        return {'success': False, 'user_message': f'Failed to {action} idea: {e}'}


@tool(args_schema=GetContextInput)
def get_context(
    include_tasks: bool = True,
    include_ideas: bool = True,
    include_profile: bool = True,
    include_brand_voice: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Get user context including tasks, ideas, profile, and brand voice.

    Returns a summary of the user's current state to help Echo provide
    contextual assistance.

    Returns:
        Dictionary with context data or error message
    """
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    if not state or 'user_id' not in state:
        return {'success': False, 'user_message': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'user_message': 'User not found'}

    context = {'success': True, 'data': {}}

    # Tasks summary
    if include_tasks:
        from core.integrations.asana_models import TaskCache

        tasks = TaskCache.objects.filter(user=user, is_deleted=False).order_by('due_date', '-synced_at')[:20]
        today = timezone.now().date()

        pending_tasks = []
        overdue_tasks = []
        completed_today = []

        for task in tasks:
            task_data = {
                'id': task.id,
                'title': task.title,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'completed': task.completed,
            }
            if task.completed:
                if task.synced_at.date() == today:
                    completed_today.append(task_data)
            elif task.due_date and task.due_date < today:
                overdue_tasks.append(task_data)
            else:
                pending_tasks.append(task_data)

        context['data']['tasks'] = {
            'pending': pending_tasks[:10],
            'overdue': overdue_tasks[:5],
            'completed_today': completed_today[:5],
            'total_pending': len(pending_tasks),
            'total_overdue': len(overdue_tasks),
        }

    # Recent ideas
    if include_ideas:
        from core.content_engine.models import ContentIdea

        ideas = ContentIdea.objects.filter(user=user).exclude(status='archived').order_by('-created_at')[:10]

        context['data']['ideas'] = [
            {
                'id': idea.id,
                'title': idea.title,
                'hook': idea.hook[:100] if idea.hook else '',
                'status': idea.status,
                'pillar_id': idea.pillar_id,
                'platforms': idea.platforms,
            }
            for idea in ideas
        ]

    # Echo profile
    if include_profile:
        from core.echo.models import EchoProfile

        try:
            profile = EchoProfile.objects.get(user=user)
            context['data']['profile'] = {
                'onboarding_phase': profile.onboarding_phase,
                'is_onboarded': profile.is_onboarded,
                'goals': profile.goals,
                'target_platforms': profile.target_platforms,
                'content_pillars': profile.content_pillars,
                'asana_enabled': profile.asana_enabled,
                'audience_description': profile.audience_description,
            }
        except EchoProfile.DoesNotExist:
            context['data']['profile'] = {
                'onboarding_phase': 'intro',
                'is_onboarded': False,
                'goals': [],
                'target_platforms': [],
                'content_pillars': [],
                'asana_enabled': False,
            }

    # Brand voice
    if include_brand_voice:
        from core.content_engine.models import BrandVoice

        try:
            brand_voice = BrandVoice.objects.get(user=user)
            context['data']['brand_voice'] = {
                'tone': brand_voice.tone,
                'personality_traits': brand_voice.personality_traits,
                'topics': brand_voice.topics,
                'signature_phrases': brand_voice.signature_phrases,
                'default_cta': brand_voice.default_cta,
            }
        except BrandVoice.DoesNotExist:
            context['data']['brand_voice'] = None

    return context


@tool(args_schema=SyncAsanaInput)
def sync_asana(state: dict | None = None) -> dict:
    """
    Trigger an immediate sync of tasks from Asana.

    Fetches the latest tasks from the user's connected Asana account
    and updates the local cache.

    Returns:
        Dictionary with sync result or error message
    """
    from django.contrib.auth import get_user_model

    from core.integrations.asana_service import (
        AsanaNotConnectedError,
        AsanaRateLimitError,
        AsanaService,
    )

    if not state or 'user_id' not in state:
        return {'success': False, 'user_message': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'user_message': 'User not found'}

    try:
        asana_service = AsanaService(user)
        tasks = asana_service.sync_tasks()
        logger.info(f'Synced {len(tasks)} tasks from Asana for user {user.username}')
        return {
            'success': True,
            'data': {
                'synced_count': len(tasks),
                'tasks': [
                    {
                        'id': t.id,
                        'title': t.title,
                        'completed': t.completed,
                        'due_date': t.due_date.isoformat() if t.due_date else None,
                    }
                    for t in tasks[:10]  # Return first 10 for preview
                ],
            },
            'user_message': f'Synced {len(tasks)} tasks from Asana.',
        }

    except AsanaNotConnectedError:
        return {
            'success': False,
            'user_message': 'Connect your Asana account in Settings to sync tasks.',
        }
    except AsanaRateLimitError:
        return {
            'success': False,
            'user_message': 'Asana is rate-limiting requests. Please try again in a few minutes.',
        }
    except Exception as e:
        logger.error(f'sync_asana error for user {user.username}: {e}')
        return {'success': False, 'user_message': f'Failed to sync tasks: {e}'}


@tool(args_schema=SaveOnboardingResponseInput)
def save_onboarding_response(
    goals: list[str] | None = None,
    platforms: list[str] | None = None,
    pillars: list[str] | None = None,
    audience_description: str | None = None,
    advance_phase: bool = False,
    state: dict | None = None,
) -> dict:
    """
    Save onboarding responses and optionally advance to next phase.

    Updates the user's EchoProfile with goals, platforms, and content pillars
    gathered during the onboarding flow.

    Returns:
        Dictionary with updated profile or error message
    """
    from django.contrib.auth import get_user_model

    from core.echo.models import EchoProfile

    if not state or 'user_id' not in state:
        return {'success': False, 'user_message': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'user_message': 'User not found'}

    # Get or create profile
    profile, created = EchoProfile.objects.get_or_create(user=user)

    # Update fields if provided
    updated_fields = []
    if goals is not None:
        profile.goals = goals
        updated_fields.append('goals')
    if platforms is not None:
        # Validate platforms
        valid_platforms = ['twitter', 'linkedin', 'youtube', 'newsletter', 'blog', 'tiktok', 'instagram']
        invalid = [p for p in platforms if p.lower() not in valid_platforms]
        if invalid:
            return {
                'success': False,
                'user_message': f'Invalid platforms: {invalid}. Valid: {valid_platforms}',
            }
        profile.target_platforms = [p.lower() for p in platforms]
        updated_fields.append('target_platforms')
    if pillars is not None:
        profile.content_pillars = pillars
        updated_fields.append('content_pillars')
    if audience_description is not None:
        profile.audience_description = audience_description
        updated_fields.append('audience_description')

    profile.save()

    # Advance to next phase if requested
    phase_advanced = False
    if advance_phase:
        phase_advanced = profile.advance_onboarding()

    logger.info(
        f'Updated onboarding for user {user.username}: {updated_fields}, '
        f'phase={profile.onboarding_phase}, advanced={phase_advanced}'
    )

    return {
        'success': True,
        'data': {
            'onboarding_phase': profile.onboarding_phase,
            'is_onboarded': profile.is_onboarded,
            'goals': profile.goals,
            'target_platforms': profile.target_platforms,
            'content_pillars': profile.content_pillars,
            'audience_description': profile.audience_description,
            'phase_advanced': phase_advanced,
        },
        'user_message': 'Onboarding responses saved.' + (' Moving to next step.' if phase_advanced else ''),
    }


# =============================================================================
# Tool Registry
# =============================================================================

# All tools available to Echo agent
ECHO_TOOLS = [
    save_idea,
    strategy,
    manage_task,
    manage_idea,
    get_context,
    sync_asana,
    save_onboarding_response,
]

# Lookup by tool name
ECHO_TOOLS_BY_NAME = {tool.name: tool for tool in ECHO_TOOLS}

# Tools that need state injection (user_id, session_id)
TOOLS_NEEDING_STATE = {
    'save_idea',  # Needs user_id, session_id
    'strategy',  # Needs user_id
    'manage_task',  # Needs user_id
    'manage_idea',  # Needs user_id
    'get_context',  # Needs user_id
    'sync_asana',  # Needs user_id
    'save_onboarding_response',  # Needs user_id
}
