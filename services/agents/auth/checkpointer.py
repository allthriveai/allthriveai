"""
Two-tier checkpointer for LangGraph state persistence

Architecture:
- Hot cache (Redis): Fast access for active conversations (< 1 hour old)
- Cold storage (PostgreSQL): Persistent storage across server restarts

Uses LangGraph's PostgresSaver for conversation history persistence.
Database tables created automatically: checkpoints, checkpoint_writes, checkpoint_blobs

Auto-cleanup via Celery task removes expired conversations from Redis.
"""

import logging
from urllib.parse import quote_plus

from django.conf import settings
from django.core.cache import cache
from langgraph.checkpoint.postgres import PostgresSaver

logger = logging.getLogger(__name__)

# Global checkpointer instances
_checkpointer = None
_async_checkpointer = None


def get_postgres_connection_string() -> str:
    """
    Build PostgreSQL connection string from Django settings.

    Returns:
        PostgreSQL connection string (psycopg2 format)

    Raises:
        ValueError: If no valid PostgreSQL configuration is found
    """
    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')

    # Only proceed if PostgreSQL is configured
    if 'postgresql' not in engine and 'postgres' not in engine:
        raise ValueError(
            f'PostgreSQL checkpointer requires PostgreSQL database, got: {engine}. '
            'Ensure DB_HOST or DATABASE_URL environment variables are set.'
        )

    user = db_config.get('USER', '')
    password = db_config.get('PASSWORD', '')
    host = db_config.get('HOST', '')
    port = db_config.get('PORT', '5432')
    database = db_config.get('NAME', '')

    # Validate required fields
    if not host:
        raise ValueError(
            'PostgreSQL HOST is not configured. ' 'Ensure DB_HOST or DATABASE_URL environment variables are set.'
        )

    if not database:
        raise ValueError(
            'PostgreSQL database NAME is not configured. '
            'Ensure DB_NAME or DATABASE_URL environment variables are set.'
        )

    if user and password:
        # URL-encode user and password to handle special characters like %, ', @, etc.
        encoded_user = quote_plus(user)
        encoded_password = quote_plus(password)
        return f'postgresql://{encoded_user}:{encoded_password}@{host}:{port}/{database}'
    elif user:
        encoded_user = quote_plus(user)
        return f'postgresql://{encoded_user}@{host}:{port}/{database}'
    else:
        return f'postgresql://{host}:{port}/{database}'


def get_checkpointer(use_postgres: bool = True):
    """
    Get checkpointer for auth/project chat sessions.
    Uses PostgreSQL for persistent storage across server restarts.

    Args:
        use_postgres: Use PostgreSQL checkpointer (default: True)

    Returns:
        PostgresSaver instance or MemorySaver
    """
    global _checkpointer

    if _checkpointer is not None:
        return _checkpointer

    if use_postgres:
        try:
            # import psycopg
            from psycopg_pool import ConnectionPool

            conn_string = get_postgres_connection_string()
            # Log connection string with password masked
            masked_conn = conn_string
            if '@' in conn_string and ':' in conn_string.split('@')[0]:
                # Mask password in postgresql://user:password@host format
                parts = conn_string.split('@')
                user_pass = parts[0].split(':')
                if len(user_pass) >= 3:  # postgresql://user:pass
                    masked_conn = f'{user_pass[0]}:{user_pass[1]}:****@{parts[1]}'
            logger.info(f'Initializing PostgreSQL checkpointer: {masked_conn}')

            # Create connection pool for production use
            pool = ConnectionPool(conninfo=conn_string, min_size=1, max_size=10, timeout=30)

            # Create checkpointer with the pool
            _checkpointer = PostgresSaver(pool)

            # Setup tables (creates if not exist)
            with pool.connection():
                _checkpointer.setup()

            logger.info('PostgreSQL checkpointer initialized successfully')
            logger.info('Tables: checkpoints, checkpoint_writes, checkpoint_blobs')

        except ImportError as e:
            logger.error(f'psycopg or psycopg_pool not installed: {e}')
            logger.warning('Falling back to MemorySaver - Install: pip install psycopg psycopg-pool')
            from langgraph.checkpoint.memory import MemorySaver

            _checkpointer = MemorySaver()
        except ValueError as e:
            # Configuration error - this is critical in production
            logger.error(f'Database configuration error: {e}')
            logger.warning('Falling back to MemorySaver - conversation state will not persist!')
            from langgraph.checkpoint.memory import MemorySaver

            _checkpointer = MemorySaver()
        except Exception as e:
            logger.error(f'Failed to initialize PostgreSQL checkpointer: {e}')
            logger.warning('Falling back to MemorySaver')
            from langgraph.checkpoint.memory import MemorySaver

            _checkpointer = MemorySaver()
    else:
        logger.info('Using MemorySaver for LangGraph state persistence (testing mode)')
        from langgraph.checkpoint.memory import MemorySaver

        _checkpointer = MemorySaver()

    return _checkpointer


async def get_async_checkpointer():
    """
    Get async checkpointer for use with async LangGraph operations.
    Uses AsyncPostgresSaver for persistent conversation memory.

    NOTE: We create a fresh connection pool each time because Celery
    creates a new event loop per task, and connection pools are bound
    to the event loop they were created in.

    Returns:
        AsyncPostgresSaver instance or MemorySaver fallback
    """
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool

        conn_string = get_postgres_connection_string()

        # Create async connection pool for this event loop
        pool = AsyncConnectionPool(conninfo=conn_string, min_size=1, max_size=5)
        await pool.open()

        # Create async checkpointer
        checkpointer = AsyncPostgresSaver(pool)

        # Setup tables (creates if not exist) - safe to call multiple times
        await checkpointer.setup()

        logger.debug('AsyncPostgresSaver ready for this request')
        return checkpointer

    except ValueError as e:
        # Configuration error - this is critical in production
        logger.error(f'Database configuration error for async checkpointer: {e}')
        logger.warning('Falling back to MemorySaver - conversation state will not persist!')
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()
    except Exception as e:
        logger.error(f'Failed to initialize AsyncPostgresSaver: {e}', exc_info=True)
        logger.warning('Falling back to MemorySaver')
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


def get_redis_cache_key(thread_id: str) -> str:
    """
    Generate Redis cache key for a conversation thread.

    Args:
        thread_id: Unique conversation thread identifier

    Returns:
        Redis cache key
    """
    return f'langgraph:checkpoint:{thread_id}'


def cache_checkpoint(thread_id: str, checkpoint_data: dict, ttl: int = 3600):
    """
    Cache checkpoint in Redis for fast access.

    Args:
        thread_id: Conversation thread ID
        checkpoint_data: Checkpoint state to cache
        ttl: Time-to-live in seconds (default: 1 hour)
    """
    try:
        key = get_redis_cache_key(thread_id)
        cache.set(key, checkpoint_data, timeout=ttl)
        logger.debug(f'Cached checkpoint for thread {thread_id} (TTL: {ttl}s)')
    except Exception as e:
        logger.warning(f'Failed to cache checkpoint: {e}')


def get_cached_checkpoint(thread_id: str) -> dict | None:
    """
    Retrieve checkpoint from Redis cache.

    Args:
        thread_id: Conversation thread ID

    Returns:
        Cached checkpoint data or None if not found/expired
    """
    try:
        key = get_redis_cache_key(thread_id)
        data = cache.get(key)
        if data:
            logger.debug(f'Cache hit for thread {thread_id}')
        return data
    except Exception as e:
        logger.warning(f'Failed to retrieve cached checkpoint: {e}')
        return None
