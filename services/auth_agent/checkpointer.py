"""
Redis checkpointer for LangGraph state persistence
"""
from langgraph.checkpoint.memory import MemorySaver
from django.conf import settings


def get_checkpointer():
    """
    Get checkpointer for auth chat sessions.
    Currently using MemorySaver - TODO: Switch to Redis for production
    
    Returns:
        MemorySaver instance for state persistence
    """
    # TODO: Switch to RedisSaver when langgraph-checkpoint-redis is available
    # redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
    # session_ttl = getattr(settings, 'AUTH_CHAT_SESSION_TTL', 1800)  # 30 min default
    
    return MemorySaver()
