"""
Shared agent resources - knowledge, prompts, and utilities used by all AI agents.
"""

from services.agents.shared.platform_knowledge import (
    AGENT_CAPABILITIES,
    PLATFORM_FEATURES,
    PLATFORM_HELP,
    PLATFORM_NAVIGATION,
    format_platform_knowledge,
    get_agent_knowledge,
)

__all__ = [
    'AGENT_CAPABILITIES',
    'PLATFORM_FEATURES',
    'PLATFORM_HELP',
    'PLATFORM_NAVIGATION',
    'format_platform_knowledge',
    'get_agent_knowledge',
]
