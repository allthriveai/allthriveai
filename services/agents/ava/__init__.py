"""
Unified Ava Agent - Single conversational interface with all tools.

Ava is the primary AI assistant for AllThrive AI, combining all specialized
agent capabilities into one unified interface. Instead of routing between
multiple agents, Ava has direct access to all tools and uses LLM intelligence
to select the right ones.

This module provides:
- Unified tool registry combining Discovery, Learning, Project, Orchestration, and Profile tools
- Single LangGraph agent with comprehensive system prompt
- Simplified state management with unified state injection

Usage:
    from services.agents.ava import create_ava_agent, AVA_TOOLS

    # Create agent with state
    agent = create_ava_agent()

    # Invoke with state injection
    result = agent.invoke({
        "messages": messages,
        "user_id": user.id,
        "username": user.username,
    })
"""

from .agent import create_ava_agent, stream_ava_response
from .prompts import AVA_SYSTEM_PROMPT
from .tools import AVA_TOOLS, AVA_TOOLS_BY_NAME, TOOLS_NEEDING_STATE

__all__ = [
    'create_ava_agent',
    'stream_ava_response',
    'AVA_TOOLS',
    'AVA_TOOLS_BY_NAME',
    'TOOLS_NEEDING_STATE',
    'AVA_SYSTEM_PROMPT',
]
