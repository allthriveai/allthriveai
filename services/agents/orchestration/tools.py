"""
Site orchestration tools for Ember.

These tools enable the chat assistant to control the UI:
- Navigate users to different pages
- Highlight UI elements to teach features
- Open trays and panels
- Show toast notifications
- Trigger actions (with optional confirmation)

Tools return action commands that the frontend executes.
The `auto_execute` flag determines if frontend acts immediately.
The `requires_confirmation` flag shows a confirmation dialog first.
"""

import logging

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Input Schemas
# =============================================================================


class NavigateInput(BaseModel):
    """Input for navigate_to_page tool."""

    path: str = Field(description='URL path to navigate to (e.g., "/battles", "/explore", "/username")')
    message: str = Field(default='', description='Optional message to show during navigation')


class HighlightInput(BaseModel):
    """Input for highlight_element tool."""

    target: str = Field(
        description='CSS selector or element ID to highlight (e.g., "#add-project-btn", ".nav-battles")'
    )
    message: str = Field(default='', description='Optional tooltip message to show near the element')
    style: str = Field(default='pulse', description='Highlight style: pulse, glow, spotlight, or arrow')


class OpenTrayInput(BaseModel):
    """Input for open_tray tool."""

    tray: str = Field(description='Tray to open: chat, quest, comments, profile_generator, or about')
    context: dict = Field(default_factory=dict, description='Optional context data to pass to the tray')


class ShowToastInput(BaseModel):
    """Input for show_toast tool."""

    message: str = Field(description='Toast message to display')
    variant: str = Field(default='info', description='Toast type: success, info, warning, error, or celebration')


class TriggerActionInput(BaseModel):
    """Input for trigger_action tool."""

    action: str = Field(
        description='Action to trigger: start_battle, create_project, start_quiz, view_profile, or open_project'
    )
    params: dict = Field(default_factory=dict, description='Parameters for the action (e.g., username, quiz_id)')


# =============================================================================
# Navigation Tools
# =============================================================================


@tool(args_schema=NavigateInput)
def navigate_to_page(path: str, message: str = '', state: dict = None) -> dict:
    """
    Navigate the user to a different page on AllThrive.

    Use this when the user asks to go somewhere, like "take me to battles"
    or "show me my profile" or "go to the quizzes".

    Available pages:
    - /explore - Main content feed with projects
    - /battles - Prompt battle arena
    - /challenges - Weekly challenges
    - /play/side-quests - Side quests with rewards
    - /quizzes - Learning quizzes
    - /tools - AI tool directory
    - /thrive-circle - Community membership
    - /onboarding - Quest board (Ember's adventures)
    - /{username} - User profile (replace with actual username)
    - /account/settings - Account settings

    Args:
        path: URL path to navigate to
        message: Optional message to show during navigation

    Returns:
        Action command for frontend to execute
    """
    logger.info(f'Navigate tool called: path={path}')
    return {
        'action': 'navigate',
        'path': path,
        'message': message,
        'auto_execute': True,
    }


# =============================================================================
# UI Control Tools
# =============================================================================


@tool(args_schema=HighlightInput)
def highlight_element(target: str, message: str = '', style: str = 'pulse', state: dict = None) -> dict:
    """
    Highlight a UI element to draw the user's attention.

    Use this when teaching users where features are, like "where do I create a project?"
    or "show me the battles button".

    Common targets:
    - #add-project-btn - The "Add Project" button
    - #chat-input - The chat input field
    - .nav-explore - Explore navigation item
    - .nav-battles - Battles navigation item
    - .nav-play - Play menu
    - .quest-card - Quest cards
    - .project-card - Project cards

    Highlight styles:
    - pulse: Pulsing orange glow (default, good for buttons)
    - glow: Static orange glow (good for areas)
    - spotlight: Darkens everything except the element (dramatic)
    - arrow: Shows a bouncing arrow pointing at the element

    Args:
        target: CSS selector for the element to highlight
        message: Optional tooltip to show near the element
        style: Animation style (pulse, glow, spotlight, arrow)

    Returns:
        Action command for frontend to execute
    """
    logger.info(f'Highlight tool called: target={target}, style={style}')
    return {
        'action': 'highlight',
        'target': target,
        'message': message,
        'style': style,
        'duration': 3000,
        'auto_execute': True,
    }


@tool(args_schema=OpenTrayInput)
def open_tray(tray: str, context: dict = None, state: dict = None) -> dict:
    """
    Open a slide-out tray or panel.

    Use this when the user wants to see a specific panel, like "show me my quests"
    or "open the comments".

    Available trays:
    - chat - The chat panel (usually already open)
    - quest - Quest/adventure panel showing available quests
    - comments - Comments panel (needs project_id in context)
    - profile_generator - Profile generator wizard
    - about - About panel with platform info

    Args:
        tray: Name of the tray to open
        context: Optional context data (e.g., project_id for comments)

    Returns:
        Action command for frontend to execute
    """
    logger.info(f'Open tray tool called: tray={tray}')
    return {
        'action': 'open_tray',
        'tray': tray,
        'context': context or {},
        'auto_execute': True,
    }


@tool(args_schema=ShowToastInput)
def show_toast(message: str, variant: str = 'info', state: dict = None) -> dict:
    """
    Show a toast notification to the user.

    Use this for quick feedback messages, celebrations, or alerts.

    Variants:
    - success: Green checkmark, for completed actions
    - info: Blue info icon, for neutral information
    - warning: Yellow warning, for caution messages
    - error: Red X, for error messages
    - celebration: Special animated celebration (confetti, etc.)

    Args:
        message: The message to display
        variant: Toast type (success, info, warning, error, celebration)

    Returns:
        Action command for frontend to execute
    """
    logger.info(f'Toast tool called: message={message}, variant={variant}')
    return {
        'action': 'toast',
        'message': message,
        'variant': variant,
        'auto_execute': True,
    }


# =============================================================================
# Action Trigger Tools
# =============================================================================


@tool(args_schema=TriggerActionInput)
def trigger_action(action: str, params: dict = None, state: dict = None) -> dict:
    """
    Trigger a specific action or flow on the site.

    Some actions auto-execute (safe), others require user confirmation first.

    Available actions:
    - start_battle: Start a prompt battle
      - params: {opponent_username: "pip"} - who to battle
      - Requires confirmation

    - create_project: Open the project creation flow
      - params: {} - no params needed
      - Requires confirmation

    - start_quiz: Start a specific quiz
      - params: {quiz_id: "123", quiz_name: "AI Basics"}
      - Requires confirmation

    - view_profile: View a user's profile
      - params: {username: "alice"}
      - Auto-executes (just navigation)

    - open_project: Open a specific project
      - params: {project_slug: "my-project"} or {project_id: "123"}
      - Auto-executes (just navigation)

    Args:
        action: The action to trigger
        params: Parameters for the action

    Returns:
        Action command for frontend to execute
    """
    params = params or {}
    logger.info(f'Trigger action tool called: action={action}, params={params}')

    # Actions that are safe to auto-execute (just viewing/navigation)
    safe_actions = {'view_profile', 'open_project'}

    # Actions that require user confirmation first
    confirmation_actions = {'start_battle', 'create_project', 'start_quiz'}

    return {
        'action': 'trigger',
        'trigger_action': action,
        'params': params,
        'auto_execute': action in safe_actions,
        'requires_confirmation': action in confirmation_actions,
    }


# =============================================================================
# Tool Registration
# =============================================================================

ORCHESTRATION_TOOLS = [
    navigate_to_page,
    highlight_element,
    open_tray,
    show_toast,
    trigger_action,
]

ORCHESTRATION_TOOLS_BY_NAME = {tool.name: tool for tool in ORCHESTRATION_TOOLS}
