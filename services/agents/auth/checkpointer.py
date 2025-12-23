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
from contextlib import asynccontextmanager
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


def get_checkpointer(use_postgres: bool = True, allow_fallback: bool | None = None):
    """
    Get checkpointer for auth/project chat sessions.
    Uses PostgreSQL for persistent storage across server restarts.

    IMPORTANT: This function does NOT silently fall back to MemorySaver by default.
    At 100k users, silent fallback would cause widespread data loss without alerting
    operators. Set allow_fallback=True only for non-critical paths or testing.

    Args:
        use_postgres: Use PostgreSQL checkpointer (default: True)
        allow_fallback: If True, falls back to MemorySaver on error.
                       If None (default), reads from EMBER_ALLOW_MEMORY_FALLBACK setting
                       (defaults to False in production).

    Returns:
        PostgresSaver instance or MemorySaver

    Raises:
        CheckpointerError: If PostgreSQL connection fails and allow_fallback=False
    """
    global _checkpointer

    if _checkpointer is not None:
        return _checkpointer

    # Determine fallback behavior from settings if not explicitly provided
    if allow_fallback is None:
        allow_fallback = getattr(settings, 'EMBER_ALLOW_MEMORY_FALLBACK', False)

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
            # autocommit=True is required for setup() to work with CREATE INDEX CONCURRENTLY
            pool = ConnectionPool(
                conninfo=conn_string, min_size=1, max_size=10, timeout=30, open=True, kwargs={'autocommit': True}
            )

            # Create checkpointer with the pool
            _checkpointer = PostgresSaver(pool)

            # Setup tables (creates if not exist)
            _checkpointer.setup()

            logger.info('PostgreSQL checkpointer initialized successfully')
            logger.info('Tables: checkpoints, checkpoint_writes, checkpoint_blobs')

        except ImportError as e:
            error_msg = f'psycopg or psycopg_pool not installed: {e}'
            logger.critical(error_msg)

            if allow_fallback:
                logger.warning('FALLBACK ENABLED: Using MemorySaver - Install: pip install psycopg psycopg-pool')
                from langgraph.checkpoint.memory import MemorySaver

                _checkpointer = MemorySaver()
            else:
                raise CheckpointerError(error_msg) from e

        except ValueError as e:
            # Configuration error - this is critical in production
            error_msg = f'Database configuration error: {e}'
            logger.critical(error_msg)

            if allow_fallback:
                logger.warning('FALLBACK ENABLED: Using MemorySaver - conversation state will not persist!')
                from langgraph.checkpoint.memory import MemorySaver

                _checkpointer = MemorySaver()
            else:
                raise CheckpointerError(error_msg) from e

        except Exception as e:
            error_msg = f'Failed to initialize PostgreSQL checkpointer: {e}'
            logger.critical(error_msg, exc_info=True)

            if allow_fallback:
                logger.warning('FALLBACK ENABLED: Using MemorySaver')
                from langgraph.checkpoint.memory import MemorySaver

                _checkpointer = MemorySaver()
            else:
                raise CheckpointerError(error_msg) from e
    else:
        logger.info('Using MemorySaver for LangGraph state persistence (testing mode)')
        from langgraph.checkpoint.memory import MemorySaver

        _checkpointer = MemorySaver()

    return _checkpointer


class CheckpointerError(Exception):
    """Raised when checkpointer initialization fails."""

    pass


# Flag to track if tables have been set up (set once per worker process)
_tables_initialized = False


@asynccontextmanager
async def get_async_checkpointer(allow_fallback: bool = False):
    """
    Get async checkpointer for use with async LangGraph operations.
    Uses AsyncPostgresSaver for persistent conversation memory.

    This is a context manager that ensures proper cleanup of the connection pool.

    IMPORTANT: This function does NOT silently fall back to MemorySaver by default.
    At 100k users, silent fallback would cause widespread data loss without alerting
    operators. Set allow_fallback=True only for non-critical paths.

    NOTE: We create a fresh connection pool each time because Celery
    creates a new event loop per task, and connection pools are bound
    to the event loop they were created in.

    Args:
        allow_fallback: If True, falls back to MemorySaver on error (NOT recommended
                       for production). If False (default), raises CheckpointerError.

    Usage:
        async with get_async_checkpointer() as checkpointer:
            agent = workflow.compile(checkpointer=checkpointer)
            # Use agent...
        # Pool automatically closed after context exits

    Yields:
        AsyncPostgresSaver instance

    Raises:
        CheckpointerError: If PostgreSQL connection fails and allow_fallback=False
    """
    global _tables_initialized
    pool = None

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool

        conn_string = get_postgres_connection_string()

        # Create async connection pool for this event loop
        # autocommit=True is required for setup() to work with CREATE INDEX CONCURRENTLY
        pool = AsyncConnectionPool(
            conninfo=conn_string,
            min_size=1,
            max_size=5,
            timeout=30,  # Connection timeout
            kwargs={'autocommit': True},
        )
        await pool.open()

        # Create async checkpointer
        checkpointer = AsyncPostgresSaver(pool)

        # Setup tables only once per worker process (not every request)
        # This significantly reduces DB load at scale
        # Uses distributed lock to prevent concurrent setup() across workers
        if not _tables_initialized:
            setup_lock_key = 'langgraph:checkpointer:setup_lock'
            try:
                # Acquire distributed lock for cross-worker safety
                # cache.add is atomic and returns True only if key didn't exist
                if cache.add(setup_lock_key, '1', timeout=60):
                    try:
                        await checkpointer.setup()
                        logger.info('LangGraph checkpoint tables initialized (with distributed lock)')
                    finally:
                        cache.delete(setup_lock_key)
                else:
                    # Another worker is running setup, wait briefly and continue
                    # Tables should exist by the time we need them
                    logger.debug('Another worker is initializing tables, waiting...')
                    import asyncio

                    await asyncio.sleep(1)
            except Exception as e:
                logger.warning(f'Error during table setup (may be concurrent setup): {e}')
                # Continue anyway - tables may already exist from another worker
            _tables_initialized = True
        else:
            logger.debug('AsyncPostgresSaver ready (tables already initialized)')

        yield checkpointer

    except ValueError as e:
        # Configuration error - this is critical in production
        error_msg = f'Database configuration error for async checkpointer: {e}'
        logger.error(error_msg)

        if allow_fallback:
            logger.warning('FALLBACK ENABLED: Using MemorySaver - conversation state will not persist!')
            from langgraph.checkpoint.memory import MemorySaver

            yield MemorySaver()
        else:
            raise CheckpointerError(error_msg) from e

    except Exception as e:
        error_msg = f'Failed to initialize AsyncPostgresSaver: {e}'
        logger.error(error_msg, exc_info=True)

        if allow_fallback:
            logger.warning('FALLBACK ENABLED: Using MemorySaver - conversation state will not persist!')
            from langgraph.checkpoint.memory import MemorySaver

            yield MemorySaver()
        else:
            raise CheckpointerError(error_msg) from e

    finally:
        # Always close the pool if it was created
        if pool is not None:
            try:
                await pool.close()
                logger.debug('AsyncConnectionPool closed successfully')
            except Exception as e:
                logger.warning(f'Error closing AsyncConnectionPool: {e}')


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
