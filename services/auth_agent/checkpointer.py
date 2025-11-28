"""
Checkpointer for LangGraph state persistence

NOTE: Currently using MemorySaver. Redis integration requires additional setup:
- Redis Stack with RedisJSON module
- Pre-created search indexes (checkpoint_writes, checkpoints)
- Proper async initialization

To enable Redis:
1. Ensure redis/redis-stack-server is running
2. Initialize indexes on startup
3. Update get_checkpointer() to use RedisSaver
"""

import logging

from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)


def get_checkpointer():
    """
    Get checkpointer for auth/project chat sessions.
    Currently using MemorySaver for simplicity.

    Returns:
        MemorySaver instance for in-memory state persistence
    """
    # Using MemorySaver for now - Redis requires index initialization
    logger.info('Using MemorySaver for LangGraph state persistence')
    return MemorySaver()

    # TODO: Uncomment and configure when Redis indexes are initialized
    # try:
    #     import redis
    #     from langgraph.checkpoint.redis import RedisSaver
    #
    #     redis_url = getattr(settings, 'REDIS_URL', 'redis://redis:6379/1')
    #     redis_client = redis.from_url(redis_url, decode_responses=False)
    #     redis_client.ping()
    #     logger.info(f"Connected to Redis: {redis_url}")
    #     return RedisSaver(redis_url)
    # except Exception as e:
    #     logger.warning(f"Redis unavailable: {e}, using MemorySaver")
    #     return MemorySaver()
