"""
Agent Memory Client for Redis Agent Memory Server.

Provides a Django-friendly async client for storing and retrieving
AI agent memories, enabling persistent conversations and semantic search.
"""

import logging
import threading
import time
from datetime import UTC, datetime
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_MEMORY_SERVER_URL = 'http://agent-memory:8000'
DEFAULT_TIMEOUT = 30.0
HEALTH_CHECK_TTL_SECONDS = 30  # Cache health check results for 30 seconds


class AgentMemoryClient:
    """
    Async client for Redis Agent Memory Server.

    Handles:
    - Working memory (session-scoped messages)
    - Long-term memory (persistent, searchable)
    - Memory extraction and preference learning
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        """
        Initialize the agent memory client.

        Args:
            base_url: URL of the agent memory server
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or getattr(settings, 'AGENT_MEMORY_SERVER_URL', DEFAULT_MEMORY_SERVER_URL)
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None
        # Health check cache
        self._health_check_result: bool | None = None
        self._health_check_timestamp: float = 0.0

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def health_check(self, force: bool = False) -> bool:
        """
        Check if the memory server is healthy.

        Uses caching to avoid excessive HTTP calls. Results are cached
        for HEALTH_CHECK_TTL_SECONDS (default 30s).

        Args:
            force: If True, bypass cache and perform fresh health check

        Returns:
            True if server is healthy, False otherwise
        """
        # Check cache unless force refresh requested
        if not force and self._health_check_result is not None:
            cache_age = time.monotonic() - self._health_check_timestamp
            if cache_age < HEALTH_CHECK_TTL_SECONDS:
                return self._health_check_result

        try:
            client = await self._get_client()
            response = await client.get('/health')
            result = response.status_code == 200
        except Exception as e:
            logger.warning(f'Agent memory server health check failed: {e}')
            result = False

        # Update cache
        self._health_check_result = result
        self._health_check_timestamp = time.monotonic()
        return result

    # -------------------------------------------------------------------------
    # Working Memory (Session-Scoped)
    # -------------------------------------------------------------------------

    async def add_to_working_memory(
        self,
        session_id: str,
        user_id: str,
        content: str,
        role: str = 'user',
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Add a message to working memory for a session.

        Working memory is session-scoped and used for immediate context.

        Args:
            session_id: Unique session identifier
            user_id: User identifier
            content: Message content
            role: Message role ('user' or 'assistant')
            metadata: Optional metadata

        Returns:
            Response from memory server or None on error
        """
        try:
            client = await self._get_client()
            response = await client.post(
                '/v1/working-memory/messages',
                json={
                    'session_id': session_id,
                    'user_id': user_id,
                    'content': content,
                    'role': role,
                    'metadata': metadata or {},
                    'timestamp': datetime.now(UTC).isoformat(),
                },
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f'Failed to add to working memory: {e}')
            return None

    async def get_working_memory(
        self,
        session_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get working memory messages for a session.

        Args:
            session_id: Session identifier
            limit: Maximum messages to return

        Returns:
            List of messages
        """
        try:
            client = await self._get_client()
            response = await client.get(
                f'/v1/working-memory/{session_id}',
                params={'limit': limit},
            )
            response.raise_for_status()
            return response.json().get('messages', [])
        except Exception as e:
            logger.error(f'Failed to get working memory: {e}')
            return []

    async def clear_working_memory(self, session_id: str) -> bool:
        """
        Clear working memory for a session.

        Args:
            session_id: Session identifier

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()
            response = await client.delete(f'/v1/working-memory/{session_id}')
            return response.status_code in (200, 204)
        except Exception as e:
            logger.error(f'Failed to clear working memory: {e}')
            return False

    # -------------------------------------------------------------------------
    # Long-Term Memory (Persistent, Searchable)
    # -------------------------------------------------------------------------

    async def create_long_term_memory(
        self,
        user_id: str,
        text: str,
        memory_type: str = 'episodic',
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """
        Create a long-term memory entry.

        Memory types:
        - 'episodic': Conversation events
        - 'semantic': Facts and knowledge
        - 'preference': User preferences
        - 'skill': Learned skills/capabilities

        Args:
            user_id: User identifier
            text: Memory content
            memory_type: Type of memory
            metadata: Optional metadata

        Returns:
            Created memory object or None on error
        """
        try:
            client = await self._get_client()
            response = await client.post(
                '/v1/long-term-memory',
                json={
                    'memories': [
                        {
                            'text': text,
                            'user_id': user_id,
                            'memory_type': memory_type,
                            'metadata': metadata or {},
                        }
                    ]
                },
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f'Failed to create long-term memory: {e}')
            return None

    async def search_long_term_memory(
        self,
        user_id: str,
        query: str,
        memory_types: list[str] | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Search long-term memory using semantic similarity.

        Args:
            user_id: User identifier
            query: Search query
            memory_types: Filter by memory types
            limit: Maximum results

        Returns:
            List of matching memories with similarity scores
        """
        try:
            client = await self._get_client()
            params: dict[str, Any] = {
                'text': query,
                'user_id': user_id,
                'limit': limit,
            }
            if memory_types:
                params['memory_types'] = ','.join(memory_types)

            response = await client.get('/v1/long-term-memory/search', params=params)
            response.raise_for_status()
            return response.json().get('memories', [])
        except Exception as e:
            logger.error(f'Failed to search long-term memory: {e}')
            return []

    async def get_user_preferences(
        self,
        user_id: str,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Get user preferences from long-term memory.

        Args:
            user_id: User identifier
            limit: Maximum preferences to return

        Returns:
            List of preference memories
        """
        return await self.search_long_term_memory(
            user_id=user_id,
            query='user preferences',
            memory_types=['preference'],
            limit=limit,
        )

    # -------------------------------------------------------------------------
    # Conversation Management
    # -------------------------------------------------------------------------

    async def store_conversation_message(
        self,
        user_id: str,
        session_id: str,
        content: str,
        role: str = 'user',
        extract_memories: bool = True,
    ) -> dict[str, Any]:
        """
        Store a conversation message with optional memory extraction.

        This is the main method for storing chat messages. It:
        1. Adds to working memory (session context)
        2. Optionally triggers memory extraction for long-term storage

        Args:
            user_id: User identifier
            session_id: Session identifier
            content: Message content
            role: 'user' or 'assistant'
            extract_memories: Whether to extract long-term memories

        Returns:
            Result with working memory and extraction status
        """
        result: dict[str, Any] = {
            'working_memory': None,
            'extraction_triggered': False,
        }

        # Add to working memory
        result['working_memory'] = await self.add_to_working_memory(
            session_id=session_id,
            user_id=user_id,
            content=content,
            role=role,
        )

        # Trigger memory extraction for significant messages
        if extract_memories and len(content) > 50:
            # Memory extraction happens async in the background worker
            # The server handles this automatically when configured
            result['extraction_triggered'] = True
            logger.debug(f'Memory extraction triggered for user {user_id}')

        return result

    async def get_conversation_context(
        self,
        user_id: str,
        session_id: str,
        query: str | None = None,
        include_preferences: bool = True,
    ) -> dict[str, Any]:
        """
        Get full conversation context for an AI agent.

        Combines:
        - Recent working memory (current session)
        - Relevant long-term memories (if query provided)
        - User preferences

        Args:
            user_id: User identifier
            session_id: Current session ID
            query: Optional query for semantic search
            include_preferences: Whether to include user preferences

        Returns:
            Combined context for agent prompting
        """
        context: dict[str, Any] = {
            'working_memory': [],
            'relevant_memories': [],
            'preferences': [],
        }

        # Get working memory
        context['working_memory'] = await self.get_working_memory(session_id)

        # Search relevant long-term memories
        if query:
            context['relevant_memories'] = await self.search_long_term_memory(
                user_id=user_id,
                query=query,
                limit=5,
            )

        # Get user preferences
        if include_preferences:
            context['preferences'] = await self.get_user_preferences(
                user_id=user_id,
                limit=10,
            )

        return context


# Thread-safe singleton instance
_memory_client: AgentMemoryClient | None = None
_client_lock = threading.Lock()


def get_memory_client() -> AgentMemoryClient:
    """
    Get the singleton memory client instance.

    Thread-safe using double-checked locking pattern.

    Returns:
        AgentMemoryClient instance
    """
    global _memory_client
    if _memory_client is None:
        with _client_lock:
            # Double-check after acquiring lock
            if _memory_client is None:
                _memory_client = AgentMemoryClient()
    return _memory_client
