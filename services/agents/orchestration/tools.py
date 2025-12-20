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
import secrets

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


class GetFunActivitiesInput(BaseModel):
    """Input for get_fun_activities tool."""

    surprise_me: bool = Field(
        default=False, description='If true, returns a single random activity recommendation instead of all options'
    )


class LaunchInlineGameInput(BaseModel):
    """Input for launch_inline_game tool."""

    game_type: str = Field(
        default='random',
        description='Type of game to launch: snake, quiz, ethics, prompt_battle, or random (picks one for user)',
    )
    difficulty: str = Field(default='medium', description='Difficulty level for quiz games: easy, medium, or hard')


# =============================================================================
# Navigation Tools
# =============================================================================

# Allowed navigation paths (static paths only - user profiles handled separately)
ALLOWED_NAVIGATION_PATHS = {
    '/explore',
    '/battles',
    '/play/prompt-battles',
    '/challenges',
    '/play/side-quests',
    '/play/context-snake',
    '/play/ethics-defender',
    '/quizzes',
    '/tools',
    '/thrive-circle',
    '/onboarding',
    '/account/settings',
    '/home',
    '/learn',
}

# Paths that can have dynamic segments (prefixes)
ALLOWED_PATH_PREFIXES = (
    '/quizzes/',
    '/tools/',
    '/challenges/',
    '/play/prompt-battles/',
    '/explore?',
)


def _is_valid_navigation_path(path: str) -> bool:
    """Validate that a navigation path is allowed.

    Prevents navigation to admin routes, internal paths, or arbitrary URLs.
    """
    if not path or not path.startswith('/'):
        return False

    # Normalize path
    path_lower = path.lower().strip()

    # Block obviously dangerous paths
    blocked_patterns = ['/admin', '/api/', '/internal/', '..', '<', '>', 'javascript:', 'data:']
    if any(pattern in path_lower for pattern in blocked_patterns):
        return False

    # Check exact matches
    if path in ALLOWED_NAVIGATION_PATHS:
        return True

    # Check prefix matches (for dynamic routes like /quizzes/slug)
    for prefix in ALLOWED_PATH_PREFIXES:
        if path_lower.startswith(prefix):
            return True

    # Allow user profile paths (single segment after /)
    # e.g., /username but not /username/something (except known patterns)
    path_parts = path.strip('/').split('/')
    if len(path_parts) == 1 and path_parts[0]:
        # Single segment - treat as username (frontend will validate)
        return True

    # Allow project paths: /{username}/{project}
    if len(path_parts) == 2 and all(part and not part.startswith('_') for part in path_parts):
        return True

    return False


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

    # Validate path to prevent navigation to unauthorized pages
    if not _is_valid_navigation_path(path):
        logger.warning(f'Blocked navigation to unauthorized path: {path}')
        return {
            'action': 'error',
            'message': 'Navigation to that page is not allowed.',
            'auto_execute': False,
        }

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
# Fun Activities Tool
# =============================================================================


@tool(args_schema=GetFunActivitiesInput)
def get_fun_activities(surprise_me: bool = False, state: dict = None) -> dict:
    """
    Get a list of fun activities available on AllThrive, or a surprise recommendation.

    Use this when users say things like:
    - "I want to do something fun"
    - "Surprise me!"
    - "What can we do together?"
    - "I'm bored, what should I do?"
    - "Show me something cool"

    Activities include games, battles, quests, quizzes, and creative tools.

    Args:
        surprise_me: If True, returns a single random activity recommendation.
                    If False, returns all available activities for user to choose.

    Returns:
        Dictionary with activities or a single surprise recommendation.
    """
    logger.info(f'Get fun activities tool called: surprise_me={surprise_me}')

    # Define all fun activities with their details
    activities = [
        {
            'name': 'Prompt Battle',
            'description': 'Challenge Pip (our AI bot) or another user to a creative prompt battle!',
            'path': '/battles',
            'action': 'start_battle',
            'emoji': '⚔️',
            'fun_factor': 'Competitive & creative',
        },
        {
            'name': 'Context Snake',
            'description': 'Play a fun snake game where you collect AI concepts while avoiding obstacles!',
            'path': '/play/context-snake',
            'action': 'navigate',
            'emoji': '🐍',
            'fun_factor': 'Quick arcade fun',
        },
        {
            'name': 'Side Quests',
            'description': 'Complete mini-adventures to earn rewards and discover new features!',
            'path': '/play/side-quests',
            'action': 'navigate',
            'emoji': '🗺️',
            'fun_factor': 'Exploration & rewards',
        },
        {
            'name': 'AI Quiz',
            'description': 'Test your AI knowledge with interactive quizzes and learn something new!',
            'path': '/quizzes',
            'action': 'start_quiz',
            'emoji': '🧠',
            'fun_factor': 'Learn while playing',
        },
        {
            'name': 'Create an Infographic',
            'description': 'Use Nano Banana to create a fun infographic about any topic!',
            'path': None,  # Handled in chat
            'action': 'create_infographic',
            'emoji': '🍌',
            'fun_factor': 'Creative & visual',
        },
        {
            'name': 'Weekly Challenge',
            'description': 'Join the current weekly challenge and compete with the community!',
            'path': '/challenges',
            'action': 'navigate',
            'emoji': '🏆',
            'fun_factor': 'Community competition',
        },
        {
            'name': 'Explore Trending',
            'description': "Discover what's hot - trending projects, battles, and creators!",
            'path': '/explore?sort=trending',
            'action': 'navigate',
            'emoji': '🔥',
            'fun_factor': 'Discovery & inspiration',
        },
    ]

    if surprise_me:
        # Pick a random activity for "surprise me" mode (non-cryptographic, just for fun)
        choice = activities[secrets.randbelow(len(activities))]
        return {
            'surprise': True,
            'recommendation': choice,
            'message': f"How about {choice['emoji']} {choice['name']}? {choice['description']}",
        }
    else:
        return {
            'surprise': False,
            'activities': activities,
            'message': 'Here are some fun things we can do together! Pick one that sounds exciting:',
        }


# =============================================================================
# Inline Game Tools
# =============================================================================


INLINE_GAME_TYPES = ['snake', 'quiz', 'ethics', 'prompt_battle']


@tool(args_schema=LaunchInlineGameInput)
def launch_inline_game(game_type: str = 'random', difficulty: str = 'medium', state: dict = None) -> dict:
    """
    EMBED a playable mini-game directly in the chat interface.

    ⚠️ CRITICAL: This tool EMBEDS an interactive game widget. You MUST call this tool
    to embed the game - outputting a markdown link does NOT embed it!

    ❌ WRONG: Outputting "[Context Snake](/play/context-snake)" as text
    ✅ CORRECT: Calling this tool: launch_inline_game(game_type="snake")

    WHEN TO USE:
    - User asks "what is a context window?" → CALL launch_inline_game(game_type="snake")
    - User says "surprise me" or "I'm bored" → CALL launch_inline_game(game_type="random")
    - User says "quiz me" → CALL launch_inline_game(game_type="quiz")
    - User asks about AI ethics → CALL launch_inline_game(game_type="ethics")
    - User wants to practice prompts → CALL launch_inline_game(game_type="prompt_battle")
    - User says "Play snake/ethics/quiz/prompt battle game" → Use the specified game type

    HOW IT WORKS:
    1. You write your explanation text first
    2. You call this tool
    3. The game appears as an interactive widget in the chat
    4. User can play without leaving the conversation

    Available game_type values:
    - "snake": Context Snake - teaches context windows & tokens through gameplay
    - "quiz": Quick AI trivia question with instant feedback
    - "ethics": Ethics Defender - shoot correct answers about AI ethics
    - "prompt_battle": Prompt Battle - practice prompt writing skills
    - "random": Pick one randomly (for "surprise me" requests)

    Args:
        game_type: Type of game to launch (snake, quiz, ethics, prompt_battle, or random)
        difficulty: Difficulty level for quiz (easy, medium, hard)

    Returns:
        Action command that embeds the game in chat.
    """
    logger.info(f'Launch inline game tool called: game_type={game_type}, difficulty={difficulty}')

    # Validate game type
    actual_game_type = game_type
    if game_type == 'random' or game_type not in INLINE_GAME_TYPES:
        actual_game_type = INLINE_GAME_TYPES[secrets.randbelow(len(INLINE_GAME_TYPES))]

    # Validate difficulty
    valid_difficulties = ['easy', 'medium', 'hard']
    if difficulty not in valid_difficulties:
        difficulty = 'medium'

    return {
        'success': True,
        'game_type': actual_game_type,
        'game_config': {
            'difficulty': difficulty,
        },
        'message': f"Let's play! Here's a quick {actual_game_type} game for you:",
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
    get_fun_activities,
    launch_inline_game,
]

ORCHESTRATION_TOOLS_BY_NAME = {tool.name: tool for tool in ORCHESTRATION_TOOLS}
