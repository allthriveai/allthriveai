"""
LangGraph integration for Redis Agent Memory Server.

Provides utilities for integrating agent memory with LangGraph-based agents,
enabling persistent memory across conversations and semantic search.

Usage in LangGraph agents:

    from services.memory.langgraph_integration import (
        MemoryEnhancedState,
        with_memory_context,
        store_agent_message,
    )

    # Add memory context before agent processing
    state = await with_memory_context(state, user_id, session_id, query)

    # Store messages after agent response
    await store_agent_message(user_id, session_id, response.content, 'assistant')
"""

import logging
from typing import Any, TypedDict

from .client import get_memory_client

logger = logging.getLogger(__name__)


class MemoryContext(TypedDict):
    """Memory context added to agent state."""

    working_memory: list[dict[str, Any]]
    relevant_memories: list[dict[str, Any]]
    user_preferences: list[dict[str, Any]]
    memory_summary: str


async def get_memory_context(
    user_id: int | str,
    session_id: str,
    query: str | None = None,
    include_preferences: bool = True,
) -> MemoryContext:
    """
    Get memory context for an agent invocation.

    Args:
        user_id: User identifier
        session_id: Session/conversation identifier
        query: Optional query for semantic search
        include_preferences: Whether to include user preferences

    Returns:
        MemoryContext with working memory, relevant memories, and preferences
    """
    client = get_memory_client()

    try:
        # Check if memory server is available
        if not await client.health_check():
            logger.warning('Agent memory server not available')
            return MemoryContext(
                working_memory=[],
                relevant_memories=[],
                user_preferences=[],
                memory_summary='',
            )

        context = await client.get_conversation_context(
            user_id=str(user_id),
            session_id=session_id,
            query=query,
            include_preferences=include_preferences,
        )

        # Build a summary for the agent prompt
        memory_summary = _build_memory_summary(context)

        return MemoryContext(
            working_memory=context.get('working_memory', []),
            relevant_memories=context.get('relevant_memories', []),
            user_preferences=context.get('preferences', []),
            memory_summary=memory_summary,
        )

    except Exception as e:
        logger.error(f'Failed to get memory context: {e}')
        return MemoryContext(
            working_memory=[],
            relevant_memories=[],
            user_preferences=[],
            memory_summary='',
        )


def _build_memory_summary(context: dict[str, Any]) -> str:
    """Build a natural language summary of memory context for agent prompting."""
    parts = []

    # Add relevant memories
    relevant = context.get('relevant_memories', [])
    if relevant:
        memory_texts = [m.get('text', '') for m in relevant[:3]]  # Top 3
        if memory_texts:
            parts.append(f'Relevant context from previous conversations: {"; ".join(memory_texts)}')

    # Add user preferences
    preferences = context.get('preferences', [])
    if preferences:
        pref_texts = [p.get('text', '') for p in preferences[:5]]  # Top 5
        if pref_texts:
            parts.append(f'User preferences: {"; ".join(pref_texts)}')

    return ' | '.join(parts) if parts else ''


async def store_agent_message(
    user_id: int | str,
    session_id: str,
    content: str,
    role: str = 'assistant',
    extract_memories: bool = True,
) -> bool:
    """
    Store an agent message in memory.

    This should be called after the agent generates a response to:
    1. Add to working memory (session context)
    2. Trigger memory extraction for long-term storage

    Args:
        user_id: User identifier
        session_id: Session/conversation identifier
        content: Message content
        role: 'user' or 'assistant'
        extract_memories: Whether to trigger memory extraction

    Returns:
        True if successful
    """
    client = get_memory_client()

    try:
        if not await client.health_check():
            logger.warning('Agent memory server not available, skipping storage')
            return False

        result = await client.store_conversation_message(
            user_id=str(user_id),
            session_id=session_id,
            content=content,
            role=role,
            extract_memories=extract_memories,
        )

        return result.get('working_memory') is not None

    except Exception as e:
        logger.error(f'Failed to store agent message: {e}')
        return False


async def store_user_preference(
    user_id: int | str,
    preference: str,
) -> bool:
    """
    Explicitly store a user preference.

    Call this when the user explicitly states a preference:
    - "I prefer dark mode"
    - "I like minimal designs"
    - "I usually work with React"

    Args:
        user_id: User identifier
        preference: Preference text

    Returns:
        True if successful
    """
    client = get_memory_client()

    try:
        if not await client.health_check():
            return False

        result = await client.create_long_term_memory(
            user_id=str(user_id),
            text=preference,
            memory_type='preference',
        )

        return result is not None

    except Exception as e:
        logger.error(f'Failed to store user preference: {e}')
        return False


def format_memory_for_prompt(memory_context: MemoryContext) -> str:
    """
    Format memory context for inclusion in an agent's system prompt.

    Args:
        memory_context: Memory context from get_memory_context()

    Returns:
        Formatted string for prompt injection
    """
    if not memory_context['memory_summary']:
        return ''

    return f"""
<user_context>
{memory_context['memory_summary']}
</user_context>
"""


# -------------------------------------------------------------------------
# LangGraph State Enhancement
# -------------------------------------------------------------------------


async def enhance_state_with_memory(
    state: dict[str, Any],
    user_id: int | str,
    session_id: str,
    query: str | None = None,
) -> dict[str, Any]:
    """
    Enhance a LangGraph state dictionary with memory context.

    This adds a 'memory_context' key to the state that agents can use.

    Args:
        state: Current LangGraph state
        user_id: User identifier
        session_id: Session identifier
        query: Optional query for semantic search

    Returns:
        State with memory_context added
    """
    memory_context = await get_memory_context(
        user_id=user_id,
        session_id=session_id,
        query=query,
    )

    return {
        **state,
        'memory_context': memory_context,
    }
