"""
Agent Memory Service for AI chat persistence.

Provides integration with Redis Agent Memory Server for:
- Long-term memory storage and retrieval
- Semantic search across conversation history
- User preference extraction and storage
- Cross-device conversation sync

Usage:
    from services.memory import AgentMemoryClient

    client = AgentMemoryClient()
    await client.store_message(user_id, session_id, message, role)
    memories = await client.search_memory(user_id, "What did we discuss about images?")

LangGraph Integration:
    from services.memory import (
        get_memory_context,
        store_agent_message,
        format_memory_for_prompt,
    )

    # Before agent processing
    memory_ctx = await get_memory_context(user_id, session_id, query)

    # Add to prompt
    system_prompt += format_memory_for_prompt(memory_ctx)

    # After agent response
    await store_agent_message(user_id, session_id, response.content, 'assistant')
"""

from .client import AgentMemoryClient, get_memory_client
from .langgraph_integration import (
    MemoryContext,
    enhance_state_with_memory,
    format_memory_for_prompt,
    get_memory_context,
    store_agent_message,
    store_user_preference,
)

__all__ = [
    # Client
    'AgentMemoryClient',
    'get_memory_client',
    # LangGraph integration
    'MemoryContext',
    'get_memory_context',
    'store_agent_message',
    'store_user_preference',
    'format_memory_for_prompt',
    'enhance_state_with_memory',
]
