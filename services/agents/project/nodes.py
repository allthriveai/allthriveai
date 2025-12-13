"""LangGraph nodes for project creation flow."""

from typing import Literal, TypedDict

from .prompts import (
    ASK_DESCRIPTION,
    ASK_TYPE,
    CONFIRM_PROJECT,
    ERROR_MESSAGE,
    SUCCESS_MESSAGE,
    WELCOME_MESSAGE,
)


class ProjectState(TypedDict):
    """State for project creation conversation."""

    messages: list[dict]
    step: Literal['welcome', 'title', 'description', 'type', 'confirm', 'create', 'done', 'error']
    title: str | None
    description: str | None
    project_type: str | None
    user_id: int | None
    username: str | None
    error: str | None
    project_id: int | None
    project_slug: str | None


def welcome_node(state: ProjectState) -> ProjectState:
    """Welcome user and ask for project title."""
    state['step'] = 'title'
    state['messages'].append({'role': 'assistant', 'content': WELCOME_MESSAGE})
    return state


def process_title_node(state: ProjectState) -> ProjectState:
    """Process the title and ask for description."""
    # Get last user message as title
    last_msg = next((m for m in reversed(state['messages']) if m['role'] == 'user'), None)
    if last_msg:
        state['title'] = last_msg['content'].strip()

    state['step'] = 'description'
    state['messages'].append({'role': 'assistant', 'content': ASK_DESCRIPTION})
    return state


def process_description_node(state: ProjectState) -> ProjectState:
    """Process description and ask for project type."""
    last_msg = next((m for m in reversed(state['messages']) if m['role'] == 'user'), None)
    if last_msg:
        content = last_msg['content'].strip().lower()
        if content not in ['skip', 'no', 'none', '']:
            state['description'] = last_msg['content'].strip()
        else:
            state['description'] = ''

    state['step'] = 'type'
    state['messages'].append({'role': 'assistant', 'content': ASK_TYPE})
    return state


def process_type_node(state: ProjectState) -> ProjectState:
    """Process project type and show confirmation."""
    last_msg = next((m for m in reversed(state['messages']) if m['role'] == 'user'), None)
    if last_msg:
        content = last_msg['content'].strip().lower()

        # Map user input to project types
        type_mapping = {
            '1': 'github_repo',
            'github': 'github_repo',
            'github repository': 'github_repo',
            'code': 'github_repo',
            'repo': 'github_repo',
            '2': 'image_collection',
            'image': 'image_collection',
            'images': 'image_collection',
            'image collection': 'image_collection',
            'art': 'image_collection',
            'design': 'image_collection',
            '3': 'prompt',
            'prompt': 'prompt',
            'prompts': 'prompt',
            'conversation': 'prompt',
            'ai': 'prompt',
            '4': 'other',
            'other': 'other',
        }

        state['project_type'] = type_mapping.get(content, 'other')

    # Build confirmation message
    type_labels = {
        'github_repo': 'GitHub Repository',
        'image_collection': 'Image Collection',
        'prompt': 'Prompt',
        'other': 'Other',
    }

    confirmation = CONFIRM_PROJECT.format(
        title=state.get('title', 'Untitled'),
        description=state.get('description') or '(No description)',
        type_label=type_labels.get(state.get('project_type', 'other'), 'Other'),
    )

    state['step'] = 'confirm'
    state['messages'].append({'role': 'assistant', 'content': confirmation})
    return state


def create_project_node(state: ProjectState) -> ProjectState:
    """Create the project via API."""
    from core.projects.models import Project
    from core.users.models import User

    try:
        # Get user
        if not state.get('user_id'):
            raise ValueError('User not authenticated')

        user = User.objects.get(id=state['user_id'])
        state['username'] = user.username

        # Create project
        project = Project.objects.create(
            user=user,
            title=state.get('title', 'Untitled Project'),
            description=state.get('description', ''),
            type=state.get('project_type', 'other'),
            tools_order=[],  # Initialize empty tools order (required field)
        )

        state['project_id'] = project.id
        state['project_slug'] = project.slug
        state['step'] = 'done'

        # Success message
        success_msg = SUCCESS_MESSAGE.format(
            title=project.title,
            username=user.username,
            slug=project.slug,
        )

        state['messages'].append({'role': 'assistant', 'content': success_msg})

    except Exception as e:
        state['step'] = 'error'
        state['error'] = str(e)
        state['messages'].append({'role': 'assistant', 'content': ERROR_MESSAGE.format(error=str(e))})

    return state
