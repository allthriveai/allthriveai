"""
Unified Ember Agent - Single conversational interface with all tools.

Ember is the primary AI assistant for AllThrive AI, combining all specialized
agent capabilities into one unified interface. Instead of routing between
multiple agents, Ember has direct access to all tools and uses LLM intelligence
to select the right ones.

This module provides:
- Unified tool registry combining Discovery, Learning, Project, Orchestration, and Profile tools
- Single LangGraph agent with comprehensive system prompt
- Simplified state management with unified state injection

Usage:
    from services.agents.ember import create_ember_agent, EMBER_TOOLS

    # Create agent with state
    agent = create_ember_agent()

    # Invoke with state injection
    result = agent.invoke({
        "messages": messages,
        "user_id": user.id,
        "username": user.username,
    })
"""

from .agent import create_ember_agent, stream_ember_response
from .prompts import EMBER_SYSTEM_PROMPT
from .tools import EMBER_TOOLS, EMBER_TOOLS_BY_NAME, TOOLS_NEEDING_STATE

__all__ = [
    'create_ember_agent',
    'stream_ember_response',
    'EMBER_TOOLS',
    'EMBER_TOOLS_BY_NAME',
    'TOOLS_NEEDING_STATE',
    'EMBER_SYSTEM_PROMPT',
]
