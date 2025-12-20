"""
Unified tool registry for Ember agent.

Combines all tools from specialized agents into a single registry,
with unified state injection tracking.
"""

import logging

# Import tools from specialized agents
from services.agents.discovery.tools import (
    DISCOVERY_TOOLS,
)
from services.agents.discovery.tools import (
    TOOLS_NEEDING_STATE as DISCOVERY_TOOLS_NEEDING_STATE,
)
from services.agents.learning.tools import (
    LEARNING_TOOLS,
)
from services.agents.learning.tools import (
    TOOLS_NEEDING_STATE as LEARNING_TOOLS_NEEDING_STATE,
)
from services.agents.orchestration.tools import ORCHESTRATION_TOOLS
from services.agents.profile.agent import TOOLS_NEEDING_STATE as PROFILE_TOOLS_NEEDING_STATE
from services.agents.profile.tools import PROFILE_TOOLS
from services.agents.project.tools import PROJECT_TOOLS

logger = logging.getLogger(__name__)

# =============================================================================
# Unified Tool Registry
# =============================================================================

# All tools available to Ember
EMBER_TOOLS = [
    # Discovery (5 tools) - Search, recommend, trending, similar, details
    *DISCOVERY_TOOLS,
    # Learning (3 tools) - find_learning_content, create_learning_path, update_learner_profile
    *LEARNING_TOOLS,
    # Project (10+ tools) - Create, import, media, scrape, architecture
    *PROJECT_TOOLS,
    # Orchestration (7 tools) - Navigate, highlight, toast, tray, trigger, fun activities, inline games
    *ORCHESTRATION_TOOLS,
    # Profile (3 tools) - Gather data, generate sections, save sections
    *PROFILE_TOOLS,
]

# Lookup by tool name
EMBER_TOOLS_BY_NAME = {tool.name: tool for tool in EMBER_TOOLS}

# =============================================================================
# State Injection Tracking
# =============================================================================

# Tools that need state injection (user_id, username, session_id)
# Combined from all agent modules
TOOLS_NEEDING_STATE = (
    # Discovery tools needing state
    DISCOVERY_TOOLS_NEEDING_STATE
    # Learning tools needing state
    | LEARNING_TOOLS_NEEDING_STATE
    # Profile tools needing state
    | PROFILE_TOOLS_NEEDING_STATE
    # Project tools needing state (all need user context)
    | {
        'create_project',
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
)

# Tool count summary for logging/debugging
TOOL_COUNTS = {
    'discovery': len(DISCOVERY_TOOLS),
    'learning': len(LEARNING_TOOLS),
    'project': len(PROJECT_TOOLS),
    'orchestration': len(ORCHESTRATION_TOOLS),
    'profile': len(PROFILE_TOOLS),
    'total': len(EMBER_TOOLS),
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
    for tool in EMBER_TOOLS:
        if tool.name in seen_names:
            duplicates.append(tool.name)
        seen_names.add(tool.name)
    if duplicates:
        raise ValueError(f'Duplicate tool names detected: {duplicates}. This would cause silent overrides.')


# Run validation at import time (fails fast if misconfigured)
_validate_no_duplicate_tools()
