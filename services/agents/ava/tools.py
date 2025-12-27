"""
Unified tool registry for Ava agent.

Combines all tools from specialized agents into a single registry,
with unified state injection tracking.

Tool consolidation (12 → 5 discovery/learning tools):
- find_content: ONE tool for all discovery (replaces 6 discovery + 1 learning tool)
- create_learning_path: Generate personalized learning paths
- update_learner_profile: Update user preferences
- get_current_challenge: Weekly challenge info
- find_people_to_connect: Community connections
"""

import logging

# Import the unified find_content tool (replaces 7 overlapping tools)
from services.agents.discovery.find_content import (
    FIND_CONTENT_TOOLS,
)
from services.agents.discovery.find_content import (
    TOOLS_NEEDING_STATE as FIND_CONTENT_TOOLS_NEEDING_STATE,
)

# Import remaining discovery tools (kept)
from services.agents.discovery.tools import (
    find_people_to_connect,
    get_current_challenge,
)

# Import remaining learning tools (kept, minus find_learning_content)
from services.agents.learning.tools import (
    create_learning_path,
    update_learner_profile,
)
from services.agents.orchestration.tools import ORCHESTRATION_TOOLS
from services.agents.profile.tools import PROFILE_TOOLS
from services.agents.profile.tools import TOOLS_NEEDING_STATE as PROFILE_TOOLS_NEEDING_STATE
from services.agents.profile_questions.tools import (
    PROFILE_QUESTION_TOOLS,
)
from services.agents.profile_questions.tools import (
    TOOLS_NEEDING_STATE as PROFILE_QUESTION_TOOLS_NEEDING_STATE,
)
from services.agents.project.tools import PROJECT_TOOLS

logger = logging.getLogger(__name__)

# =============================================================================
# Unified Tool Registry
# =============================================================================

# Discovery + Learning tools (consolidated)
# - find_content: ONE tool for all discovery/learning (replaces 7 overlapping tools)
# - create_learning_path, update_learner_profile: Learning path tools
# - get_current_challenge, find_people_to_connect: Community tools
DISCOVERY_LEARNING_TOOLS = [
    *FIND_CONTENT_TOOLS,  # find_content
    create_learning_path,
    update_learner_profile,
    get_current_challenge,
    find_people_to_connect,
]

# All tools available to Ava
AVA_TOOLS = [
    # Discovery + Learning (5 tools) - Unified find_content + learning paths + community
    *DISCOVERY_LEARNING_TOOLS,
    # Project (10+ tools) - Create, import, media, scrape, architecture
    *PROJECT_TOOLS,
    # Orchestration (7 tools) - Navigate, highlight, toast, tray, trigger, fun activities, inline games
    *ORCHESTRATION_TOOLS,
    # Profile (3 tools) - Gather data, generate sections, save sections
    *PROFILE_TOOLS,
    # Profile Questions (1 tool) - Interactive profile-building questions
    *PROFILE_QUESTION_TOOLS,
]

# Lookup by tool name
AVA_TOOLS_BY_NAME = {tool.name: tool for tool in AVA_TOOLS}

# =============================================================================
# State Injection Tracking
# =============================================================================

# Tools that need state injection (user_id, username, session_id)
# Combined from all agent modules
TOOLS_NEEDING_STATE = (
    # Unified find_content tool
    FIND_CONTENT_TOOLS_NEEDING_STATE
    # Remaining learning tools
    | {'create_learning_path', 'update_learner_profile'}
    # Remaining discovery tools
    | {'get_current_challenge', 'find_people_to_connect'}
    # Profile tools needing state
    | PROFILE_TOOLS_NEEDING_STATE
    # Project tools needing state (all need user context)
    | {
        'create_project',
        'create_prompt',
        'import_github_project',
        'import_from_url',
        'scrape_webpage_for_project',
        'create_media_project',
        'import_video_project',
        'create_product',
        'regenerate_architecture_diagram',
        'create_project_from_screenshot',
    }
    # Orchestration tools (none need state currently, but ready for future)
    # Profile question tools needing state
    | PROFILE_QUESTION_TOOLS_NEEDING_STATE
)

# Tool count summary for logging/debugging
TOOL_COUNTS = {
    'discovery_learning': len(DISCOVERY_LEARNING_TOOLS),  # Consolidated: 5 tools
    'project': len(PROJECT_TOOLS),
    'orchestration': len(ORCHESTRATION_TOOLS),
    'profile': len(PROFILE_TOOLS),
    'total': len(AVA_TOOLS),
    'needing_state': len(TOOLS_NEEDING_STATE),
}


def get_tool_stats() -> dict:
    """Get tool statistics (call this instead of logging at module load)."""
    return TOOL_COUNTS.copy()


# =============================================================================
# Validation
# =============================================================================


def _validate_no_duplicate_tools():
    """Validate that no tools have duplicate names (would silently override)."""
    seen_names = set()
    duplicates = []
    for tool in AVA_TOOLS:
        if tool.name in seen_names:
            duplicates.append(tool.name)
        seen_names.add(tool.name)
    if duplicates:
        raise ValueError(f'Duplicate tool names detected: {duplicates}. This would cause silent overrides.')


# Run validation at import time (fails fast if misconfigured)
_validate_no_duplicate_tools()
