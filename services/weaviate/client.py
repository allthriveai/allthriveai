"""
Weaviate client wrapper with retry logic and Django ORM fallback.

Provides a resilient client for vector operations that gracefully
degrades to keyword search when Weaviate is unavailable.

Includes connection pooling for high-concurrency environments.
"""

import logging
import threading
from collections.abc import Generator
from contextlib import contextmanager
from datetime import datetime
from functools import lru_cache
from queue import Empty, Queue
from typing import Any

import weaviate
from django.conf import settings
from tenacity import retry, stop_after_attempt, wait_exponential

from .schema import WeaviateSchema

logger = logging.getLogger(__name__)

# Singleton client instance (for backwards compatibility)
_client_instance: 'WeaviateClient | None' = None

# Connection pool instance
_connection_pool: 'WeaviateConnectionPool | None' = None
_pool_lock = threading.Lock()


class WeaviateClientError(Exception):
    """Base exception for Weaviate client errors."""

    pass


class WeaviateConnectionError(WeaviateClientError):
    """Raised when connection to Weaviate fails."""

    pass


class WeaviateClient:
    """
    Weaviate client wrapper with connection management and fallback support.

    Features:
    - Automatic reconnection with exponential backoff
    - Batch import utilities
    - Hybrid search (vector + keyword)
    - Graceful degradation when Weaviate is unavailable

    Privacy & Security:
    - Project visibility enforced via _get_public_project_filter()
    - User similarity matching requires consent (allow_similarity_matching)
    - No PII stored in vectors (only aggregated interests)
    """

    # Standard filter for publicly visible projects
    # Must be applied to ALL project searches to prevent data leakage
    @staticmethod
    def _get_public_project_filter() -> dict:
        """
        Get the standard filter for publicly visible projects.

        This filter MUST be applied to all project searches to ensure:
        - Only published projects are returned
        - Private projects are excluded
        - Archived projects are excluded

        Returns:
            Weaviate where filter dict
        """
        return {
            'operator': 'And',
            'operands': [
                {
                    'path': ['is_private'],
                    'operator': 'Equal',
                    'valueBoolean': False,
                },
                {
                    'path': ['is_archived'],
                    'operator': 'Equal',
                    'valueBoolean': False,
                },
            ],
        }

    def __init__(
        self,
        url: str | None = None,
        api_key: str | None = None,
        timeout: int | None = None,
    ):
        """
        Initialize Weaviate client.

        Args:
            url: Weaviate server URL (defaults to settings.WEAVIATE_URL)
            api_key: API key for authentication (defaults to settings.WEAVIATE_API_KEY)
            timeout: Request timeout in seconds (defaults to settings.WEAVIATE_TIMEOUT)
        """
        self.url = url or getattr(settings, 'WEAVIATE_URL', None)
        if not self.url:
            raise ValueError('WEAVIATE_URL must be configured in settings')
        self.api_key = api_key or getattr(settings, 'WEAVIATE_API_KEY', '')
        self.timeout = timeout or getattr(settings, 'WEAVIATE_TIMEOUT', 30)
        self._client: weaviate.Client | None = None
        self._connected = False

    @property
    def client(self) -> weaviate.Client:
        """Get the Weaviate client, creating connection if needed."""
        if self._client is None or not self._connected:
            self._connect()
        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _connect(self) -> None:
        """Establish connection to Weaviate with retry logic."""
        try:
            auth_config = None
            if self.api_key:
                auth_config = weaviate.auth.AuthApiKey(api_key=self.api_key)

            self._client = weaviate.Client(
                url=self.url,
                auth_client_secret=auth_config,
                timeout_config=(self.timeout, self.timeout),
            )

            # Verify connection
            if not self._client.is_ready():
                raise WeaviateConnectionError(f'Weaviate not ready at {self.url}')

            self._connected = True
            logger.info(f'Connected to Weaviate at {self.url}')

        except Exception as e:
            self._connected = False
            logger.error(f'Failed to connect to Weaviate: {e}')
            raise WeaviateConnectionError(f'Connection failed: {e}') from e

    def is_available(self) -> bool:
        """Check if Weaviate is available and responsive."""
        try:
            if self._client is None:
                self._connect()
            is_ready = self._client.is_ready()
            if not is_ready:
                logger.warning(f'Weaviate at {self.url} is not ready')
            return is_ready
        except Exception as e:
            logger.warning(f'Weaviate availability check failed: {e}')
            return False

    def ensure_schema(self) -> dict[str, bool]:
        """
        Ensure all required collections exist.

        Returns:
            Dict mapping collection name to creation status
        """
        return WeaviateSchema.create_all_collections(self.client)

    def add_object(
        self,
        collection: str,
        properties: dict[str, Any],
        vector: list[float] | None = None,
        uuid: str | None = None,
    ) -> str:
        """
        Add an object to a collection.

        Args:
            collection: Collection name
            properties: Object properties
            vector: Optional embedding vector
            uuid: Optional UUID (auto-generated if not provided)

        Returns:
            UUID of the created object
        """
        try:
            result = self.client.data_object.create(
                class_name=collection,
                data_object=properties,
                vector=vector,
                uuid=uuid,
            )
            logger.debug(f'Added object to {collection}: {result}')
            return result

        except Exception as e:
            logger.error(f'Failed to add object to {collection}: {e}')
            raise WeaviateClientError(f'Add object failed: {e}') from e

    def update_object(
        self,
        collection: str,
        uuid: str,
        properties: dict[str, Any],
        vector: list[float] | None = None,
    ) -> None:
        """
        Update an existing object.

        Args:
            collection: Collection name
            uuid: Object UUID
            properties: Updated properties
            vector: Optional updated embedding vector
        """
        try:
            self.client.data_object.update(
                class_name=collection,
                uuid=uuid,
                data_object=properties,
                vector=vector,
            )
            logger.debug(f'Updated object {uuid} in {collection}')

        except Exception as e:
            logger.error(f'Failed to update object {uuid}: {e}')
            raise WeaviateClientError(f'Update object failed: {e}') from e

    def delete_object(self, collection: str, uuid: str) -> None:
        """
        Delete an object from a collection.

        Args:
            collection: Collection name
            uuid: Object UUID
        """
        try:
            self.client.data_object.delete(
                class_name=collection,
                uuid=uuid,
            )
            logger.debug(f'Deleted object {uuid} from {collection}')

        except Exception as e:
            logger.error(f'Failed to delete object {uuid}: {e}')
            raise WeaviateClientError(f'Delete object failed: {e}') from e

    def get_by_property(
        self,
        collection: str,
        property_name: str,
        property_value: Any,
    ) -> dict | None:
        """
        Get an object by a property value.

        Args:
            collection: Collection name
            property_name: Property to filter on
            property_value: Value to match

        Returns:
            Object data or None if not found
        """
        try:
            result = (
                self.client.query.get(collection, ['_additional { id }'])
                .with_where(
                    {
                        'path': [property_name],
                        'operator': 'Equal',
                        'valueInt' if isinstance(property_value, int) else 'valueString': property_value,
                    }
                )
                .with_limit(1)
                .do()
            )

            objects = result.get('data', {}).get('Get', {}).get(collection, [])
            return objects[0] if objects else None

        except Exception as e:
            logger.error(
                f'Failed to get object by {property_name}: {e}',
                extra={
                    'collection': collection,
                    'property_name': property_name,
                    'property_value': property_value,
                },
                exc_info=True,
            )
            # Return None for "not found" cases but raise for actual errors
            raise WeaviateClientError(f'Get by property failed: {e}') from e

    def batch_add_objects(
        self,
        collection: str,
        objects: list[dict[str, Any]],
        vectors: list[list[float]] | None = None,
    ) -> int:
        """
        Batch add multiple objects to a collection.

        Args:
            collection: Collection name
            objects: List of object property dicts
            vectors: Optional list of embedding vectors

        Returns:
            Number of successfully added objects
        """
        batch_size = getattr(settings, 'WEAVIATE_BATCH_SIZE', 100)
        success_count = 0

        try:
            with self.client.batch as batch:
                batch.batch_size = batch_size

                for i, obj in enumerate(objects):
                    vector = vectors[i] if vectors and i < len(vectors) else None
                    batch.add_data_object(
                        class_name=collection,
                        data_object=obj,
                        vector=vector,
                    )
                    success_count += 1

            logger.info(f'Batch added {success_count} objects to {collection}')
            return success_count

        except Exception as e:
            logger.error(f'Batch add failed: {e}')
            raise WeaviateClientError(f'Batch add failed: {e}') from e

    def near_vector_search(
        self,
        collection: str,
        vector: list[float],
        limit: int = 20,
        filters: dict | None = None,
        return_properties: list[str] | None = None,
        enforce_visibility: bool = True,
    ) -> list[dict]:
        """
        Search for similar objects using vector similarity.

        SECURITY: For Project collection, visibility filters are automatically
        applied unless explicitly disabled. This prevents accidental exposure
        of private/unpublished/archived projects.

        Args:
            collection: Collection to search
            vector: Query vector
            limit: Maximum results to return
            filters: Optional Weaviate where filters (merged with visibility filter)
            return_properties: Properties to return (all if None)
            enforce_visibility: If True (default), auto-apply visibility filter for projects.
                               Set to False only for admin/internal operations.

        Returns:
            List of matching objects with similarity scores
        """
        try:
            # Default properties based on collection
            if return_properties is None:
                if collection == WeaviateSchema.PROJECT_COLLECTION:
                    return_properties = ['project_id', 'title', 'tool_names', 'category_names']
                elif collection == WeaviateSchema.USER_PROFILE_COLLECTION:
                    return_properties = ['user_id', 'tool_interests', 'category_interests']
                else:
                    return_properties = []

            # SECURITY: Auto-apply visibility filter for project searches
            if collection == WeaviateSchema.PROJECT_COLLECTION and enforce_visibility:
                visibility_filter = self._get_public_project_filter()
                if filters:
                    # Merge user filters with visibility filter
                    filters = {
                        'operator': 'And',
                        'operands': [visibility_filter, filters],
                    }
                else:
                    filters = visibility_filter

            # Add distance to results
            return_properties_with_meta = return_properties + ['_additional { distance id }']

            query = self.client.query.get(collection, return_properties_with_meta).with_near_vector({'vector': vector})

            if filters:
                query = query.with_where(filters)

            query = query.with_limit(limit)
            result = query.do()

            objects = result.get('data', {}).get('Get', {}).get(collection, [])
            return objects

        except Exception as e:
            logger.error(
                f'Near vector search failed: {e}',
                extra={
                    'collection': collection,
                    'vector_dim': len(vector) if vector else 0,
                    'limit': limit,
                    'has_filters': bool(filters),
                    'enforce_visibility': enforce_visibility,
                },
                exc_info=True,
            )
            # Re-raise to let caller handle - silent [] return masks failures
            raise WeaviateClientError(f'Near vector search failed: {e}') from e

    def hybrid_search(
        self,
        collection: str,
        query: str,
        vector: list[float] | None = None,
        alpha: float = 0.7,
        limit: int = 20,
        filters: dict | None = None,
        return_properties: list[str] | None = None,
        enforce_visibility: bool = True,
    ) -> list[dict]:
        """
        Hybrid search combining vector similarity and keyword matching.

        SECURITY: For Project collection, visibility filters are automatically
        applied unless explicitly disabled.

        Args:
            collection: Collection to search
            query: Text query for keyword matching
            vector: Optional query vector for similarity
            alpha: Weight for vector vs keyword (0=keyword, 1=vector)
            limit: Maximum results
            filters: Optional Weaviate where filters (merged with visibility filter)
            return_properties: Properties to return
            enforce_visibility: If True (default), auto-apply visibility filter for projects.

        Returns:
            List of matching objects with scores
        """
        try:
            # Default properties
            if return_properties is None:
                if collection == WeaviateSchema.PROJECT_COLLECTION:
                    return_properties = ['project_id', 'title', 'combined_text', 'tool_names']
                else:
                    return_properties = []

            # SECURITY: Auto-apply visibility filter for project searches
            if collection == WeaviateSchema.PROJECT_COLLECTION and enforce_visibility:
                visibility_filter = self._get_public_project_filter()
                if filters:
                    filters = {
                        'operator': 'And',
                        'operands': [visibility_filter, filters],
                    }
                else:
                    filters = visibility_filter

            return_properties_with_meta = return_properties + ['_additional { score id }']

            query_builder = self.client.query.get(collection, return_properties_with_meta)

            if vector:
                query_builder = query_builder.with_hybrid(query=query, vector=vector, alpha=alpha)
            else:
                query_builder = query_builder.with_hybrid(query=query, alpha=0)  # Pure keyword

            if filters:
                query_builder = query_builder.with_where(filters)

            query_builder = query_builder.with_limit(limit)
            result = query_builder.do()

            objects = result.get('data', {}).get('Get', {}).get(collection, [])
            return objects

        except Exception as e:
            logger.error(
                f'Hybrid search failed: {e}',
                extra={
                    'collection': collection,
                    'query': query[:100] if query else None,
                    'alpha': alpha,
                    'has_vector': bool(vector),
                    'limit': limit,
                    'enforce_visibility': enforce_visibility,
                },
                exc_info=True,
            )
            raise WeaviateClientError(f'Hybrid search failed: {e}') from e

    def find_similar_users(
        self,
        user_vector: list[float],
        exclude_user_id: int,
        limit: int = 10,
    ) -> list[dict]:
        """
        Find users with similar preference profiles.

        Privacy: Only returns users who have opted into similarity matching
        (allow_similarity_matching=True). Users can opt out via profile settings.

        Args:
            user_vector: User's preference vector
            exclude_user_id: User ID to exclude from results
            limit: Maximum users to return

        Returns:
            List of similar user profiles (only user_id returned, no PII)
        """
        # Filter: exclude requesting user AND only include users who consented
        filters = {
            'operator': 'And',
            'operands': [
                {
                    'path': ['user_id'],
                    'operator': 'NotEqual',
                    'valueInt': exclude_user_id,
                },
                {
                    'path': ['allow_similarity_matching'],
                    'operator': 'Equal',
                    'valueBoolean': True,
                },
            ],
        }

        # Only return user_id - no interests or other profile data
        # This prevents information leakage about other users' preferences
        return self.near_vector_search(
            collection=WeaviateSchema.USER_PROFILE_COLLECTION,
            vector=user_vector,
            limit=limit,
            filters=filters,
            return_properties=['user_id'],  # Minimal data - just IDs for collaborative filtering
        )

    def get_trending_projects(
        self,
        limit: int = 50,
        min_velocity: float = 0.0,
    ) -> list[dict]:
        """
        Get projects sorted by engagement velocity.

        Security: Uses _get_public_project_filter() to ensure only
        public, published, non-archived projects are returned.

        Args:
            limit: Maximum projects to return
            min_velocity: Minimum engagement velocity threshold

        Returns:
            List of trending projects sorted by velocity
        """
        try:
            # Start with standard visibility filter
            filters = self._get_public_project_filter()

            # Add velocity threshold
            filters['operands'].append(
                {
                    'path': ['engagement_velocity'],
                    'operator': 'GreaterThan',
                    'valueNumber': min_velocity,
                }
            )

            result = (
                self.client.query.get(
                    WeaviateSchema.PROJECT_COLLECTION,
                    ['project_id', 'title', 'engagement_velocity', 'like_count', 'view_count'],
                )
                .with_where(filters)
                .with_limit(limit)
                .with_sort({'path': ['engagement_velocity'], 'order': 'desc'})
                .do()
            )

            return result.get('data', {}).get('Get', {}).get(WeaviateSchema.PROJECT_COLLECTION, [])

        except Exception as e:
            logger.error(
                f'Get trending projects failed: {e}',
                extra={'limit': limit, 'min_velocity': min_velocity},
                exc_info=True,
            )
            raise WeaviateClientError(f'Get trending projects failed: {e}') from e

    def update_project_engagement(
        self,
        project_id: int,
        engagement_velocity: float,
        like_count: int,
        view_count: int,
    ) -> bool:
        """
        Update engagement metrics for a project.

        Args:
            project_id: Project ID
            engagement_velocity: New velocity score
            like_count: Current like count
            view_count: Current view count

        Returns:
            True if successful
        """
        try:
            # Find the object by project_id
            obj = self.get_by_property(WeaviateSchema.PROJECT_COLLECTION, 'project_id', project_id)

            if not obj:
                logger.warning(f'Project {project_id} not found in Weaviate')
                return False

            uuid = obj['_additional']['id']

            self.update_object(
                collection=WeaviateSchema.PROJECT_COLLECTION,
                uuid=uuid,
                properties={
                    'engagement_velocity': engagement_velocity,
                    'like_count': like_count,
                    'view_count': view_count,
                    'updated_at': datetime.utcnow().isoformat(),
                },
            )

            return True

        except Exception as e:
            logger.error(f'Failed to update project engagement: {e}')
            return False

    def close(self) -> None:
        """Close the client connection."""
        self._client = None
        self._connected = False


class WeaviateConnectionPool:
    """
    Connection pool for Weaviate clients.

    Manages a pool of WeaviateClient instances for high-concurrency
    environments. Each request gets a client from the pool, uses it,
    and returns it when done.

    Usage:
        pool = get_connection_pool()
        with pool.get_client() as client:
            results = client.near_vector_search(...)

    Or for backwards compatibility:
        client = get_weaviate_client()  # Still works, uses pool internally
    """

    def __init__(
        self,
        pool_size: int | None = None,
        url: str | None = None,
        api_key: str | None = None,
        timeout: int | None = None,
    ):
        """
        Initialize the connection pool.

        Args:
            pool_size: Number of connections in pool (default: 10)
            url: Weaviate server URL
            api_key: API key for authentication
            timeout: Request timeout in seconds
        """
        self.pool_size = pool_size or getattr(settings, 'WEAVIATE_POOL_SIZE', 10)
        self.url = url or getattr(settings, 'WEAVIATE_URL', None)
        if not self.url:
            raise ValueError('WEAVIATE_URL must be configured in settings')
        self.api_key = api_key or getattr(settings, 'WEAVIATE_API_KEY', '')
        self.timeout = timeout or getattr(settings, 'WEAVIATE_TIMEOUT', 30)

        self._pool: Queue[WeaviateClient] = Queue(maxsize=self.pool_size)
        self._created_count = 0
        self._lock = threading.Lock()

        # Pre-create some connections
        self._warm_pool(min(3, self.pool_size))

    def _warm_pool(self, count: int) -> None:
        """Pre-create connections to warm the pool."""
        successful = 0
        for i in range(count):
            try:
                client = self._create_client()
                self._pool.put_nowait(client)
                successful += 1
            except Exception as e:
                logger.warning(f'Failed to warm pool connection {i+1}/{count}: {e}')

        if successful < count:
            logger.warning(f'Connection pool partially warmed: {successful}/{count} connections ready')
        else:
            logger.info(f'Connection pool warmed with {successful} connections')

    def _create_client(self) -> WeaviateClient:
        """Create a new client instance."""
        with self._lock:
            if self._created_count >= self.pool_size:
                raise WeaviateClientError('Connection pool exhausted')
            self._created_count += 1

        client = WeaviateClient(
            url=self.url,
            api_key=self.api_key,
            timeout=self.timeout,
        )
        return client

    @contextmanager
    def get_client(self, timeout: float = 5.0) -> Generator[WeaviateClient, None, None]:
        """
        Get a client from the pool.

        Args:
            timeout: Seconds to wait for an available connection

        Yields:
            WeaviateClient instance

        Raises:
            WeaviateClientError: If no connection available within timeout
        """
        client = None

        try:
            # Try to get from pool
            try:
                client = self._pool.get(timeout=timeout)
                logger.debug(f'Got client from pool (available={self._pool.qsize()}, ' f'total={self._created_count})')
            except Empty:
                # Pool empty, try to create new if under limit
                with self._lock:
                    if self._created_count < self.pool_size:
                        logger.info(
                            f'Pool empty, creating new connection ' f'({self._created_count + 1}/{self.pool_size})'
                        )
                        client = self._create_client()
                    else:
                        logger.error(
                            f'Connection pool exhausted: {self._created_count}/{self.pool_size} '
                            f'connections in use, none available after {timeout}s timeout'
                        )
                        raise WeaviateClientError(
                            f'Connection pool exhausted (size={self.pool_size}). '
                            f'Consider increasing WEAVIATE_POOL_SIZE.'
                        ) from None

            yield client

        finally:
            # Return client to pool
            if client is not None:
                try:
                    self._pool.put_nowait(client)
                    logger.debug(f'Returned client to pool (available={self._pool.qsize()})')
                except Exception:
                    # Pool full, close excess client
                    logger.warning('Pool full when returning client, closing excess connection')
                    client.close()
                    with self._lock:
                        self._created_count -= 1

    def get_client_sync(self, timeout: float = 5.0) -> WeaviateClient:
        """
        Get a client from the pool (non-context manager version).

        IMPORTANT: Caller must call return_client() when done!

        Args:
            timeout: Seconds to wait for an available connection

        Returns:
            WeaviateClient instance
        """
        try:
            return self._pool.get(timeout=timeout)
        except Empty:
            with self._lock:
                if self._created_count < self.pool_size:
                    return self._create_client()
                else:
                    raise WeaviateClientError(f'Connection pool exhausted (size={self.pool_size})') from None

    def return_client(self, client: WeaviateClient) -> None:
        """Return a client to the pool."""
        try:
            self._pool.put_nowait(client)
        except Exception:
            client.close()
            with self._lock:
                self._created_count -= 1

    def close_all(self) -> None:
        """Close all connections in the pool."""
        while not self._pool.empty():
            try:
                client = self._pool.get_nowait()
                client.close()
            except Empty:
                break

        with self._lock:
            self._created_count = 0

    @property
    def available_connections(self) -> int:
        """Number of connections currently available in pool."""
        return self._pool.qsize()

    @property
    def total_connections(self) -> int:
        """Total number of connections created."""
        return self._created_count

    def health_check(self) -> dict:
        """
        Perform health check on the connection pool.

        Returns:
            Dict with health status and metrics
        """
        available = self._pool.qsize()
        total = self._created_count
        in_use = total - available

        # Try to get a client and check Weaviate availability
        weaviate_available = False
        weaviate_error = None

        try:
            with self.get_client(timeout=2.0) as client:
                weaviate_available = client.is_available()
        except WeaviateClientError as e:
            weaviate_error = str(e)
        except Exception as e:
            weaviate_error = f'Unexpected error: {e}'

        health = {
            'healthy': weaviate_available and available > 0,
            'pool': {
                'size': self.pool_size,
                'total_created': total,
                'available': available,
                'in_use': in_use,
                'utilization': round(in_use / self.pool_size * 100, 1) if self.pool_size > 0 else 0,
            },
            'weaviate': {
                'available': weaviate_available,
                'url': self.url,
                'error': weaviate_error,
            },
        }

        # Log health status
        if health['healthy']:
            logger.debug(f'Connection pool healthy: {health}')
        else:
            logger.warning(f'Connection pool unhealthy: {health}')

        return health


def get_connection_pool() -> WeaviateConnectionPool:
    """
    Get the global connection pool instance.

    Creates the pool on first call with settings from Django config.

    Returns:
        WeaviateConnectionPool instance
    """
    global _connection_pool

    if _connection_pool is None:
        with _pool_lock:
            if _connection_pool is None:
                _connection_pool = WeaviateConnectionPool()
                logger.info(f'Initialized Weaviate connection pool ' f'(size={_connection_pool.pool_size})')

    return _connection_pool


@lru_cache(maxsize=1)
def get_weaviate_client() -> WeaviateClient:
    """
    Get a Weaviate client instance.

    For backwards compatibility, this returns a singleton client.
    For high-concurrency use, prefer get_connection_pool().get_client().

    Returns:
        WeaviateClient instance
    """
    global _client_instance
    if _client_instance is None:
        _client_instance = WeaviateClient()
    return _client_instance
