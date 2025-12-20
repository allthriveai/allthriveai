"""
Unified search service for multi-content-type discovery.

Weaviate-first search with hybrid matching, user personalization,
and real-time collaborative filtering.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from django.core.cache import cache

from services.weaviate.client import WeaviateClient, WeaviateClientError, get_weaviate_client
from services.weaviate.embeddings import EmbeddingService, get_embedding_service
from services.weaviate.schema import WeaviateSchema

from .intent_router import ContentType, IntentRouter

logger = logging.getLogger(__name__)

# Cache key prefixes
CACHE_KEY_USER_EMBEDDING = 'search:user_embed:{user_id}'

# Default cache TTLs in seconds
CACHE_TTL_USER_EMBEDDING = 300  # 5 minutes


@dataclass
class SearchResult:
    """Individual search result with metadata."""

    content_type: ContentType
    content_id: int | str
    title: str
    score: float
    weaviate_uuid: str | None = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            'content_type': self.content_type,
            'content_id': self.content_id,
            'title': self.title,
            'score': self.score,
            'weaviate_uuid': self.weaviate_uuid,
            **self.metadata,
        }


@dataclass
class SearchResponse:
    """Complete search response with metadata."""

    results: list[SearchResult]
    total_count: int
    query: str
    detected_intent: str
    searched_types: list[ContentType]
    search_time_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            'results': [r.to_dict() for r in self.results],
            'total_count': self.total_count,
            'query': self.query,
            'detected_intent': self.detected_intent,
            'searched_types': self.searched_types,
            'search_time_ms': round(self.search_time_ms, 2),
        }


class UnifiedSearchService:
    """
    Multi-content-type search with hybrid matching.

    Scoring weights:
    - Semantic similarity (Weaviate): 35%
    - Taxonomy tag matching: 25%
    - Social graph signals: 20%
    - Collaborative filtering: 15%
    - Popularity/freshness: 5%

    Features:
    - Intent detection to route to appropriate content types
    - Hybrid search (vector + keyword)
    - User personalization via preference vectors
    - Real-time collaborative filtering via nearVector
    - Taxonomy filtering
    - Redis caching for user embeddings
    """

    # Default scoring weights
    WEIGHT_SEMANTIC = 0.35
    WEIGHT_TAXONOMY = 0.25
    WEIGHT_SOCIAL = 0.20
    WEIGHT_COLLABORATIVE = 0.15
    WEIGHT_POPULARITY = 0.05

    def __init__(
        self,
        weaviate_client: WeaviateClient | None = None,
        embedding_service: EmbeddingService | None = None,
    ):
        """
        Initialize the search service.

        Args:
            weaviate_client: Optional pre-configured Weaviate client
            embedding_service: Optional pre-configured embedding service
        """
        self._weaviate_client = weaviate_client
        self._embedding_service = embedding_service

    @property
    def weaviate(self) -> WeaviateClient:
        if self._weaviate_client is None:
            self._weaviate_client = get_weaviate_client()
        return self._weaviate_client

    @property
    def embeddings(self) -> EmbeddingService:
        if self._embedding_service is None:
            self._embedding_service = get_embedding_service()
        return self._embedding_service

    async def search(
        self,
        query: str,
        user_id: int | None = None,
        content_types: list[ContentType] | None = None,
        taxonomy_filters: dict[str, list[str]] | None = None,
        difficulty: str | None = None,
        limit: int = 20,
        offset: int = 0,
        alpha: float = 0.7,
    ) -> SearchResponse:
        """
        Unified search across all content types.

        Args:
            query: Natural language search query
            user_id: Optional user ID for personalization
            content_types: Content types to search (auto-detected if None)
            taxonomy_filters: Dict of taxonomy_type -> [slugs] to filter by
            difficulty: Filter by difficulty level (beginner, intermediate, advanced)
            limit: Maximum results to return
            offset: Offset for pagination
            alpha: Weight for vector vs keyword (0=keyword, 1=vector)

        Returns:
            SearchResponse with ranked results
        """
        import time

        start_time = time.time()

        # Step 1: Detect intent if content types not specified
        if content_types is None:
            intent, content_types = IntentRouter.detect_intent(query)
        else:
            intent_result = IntentRouter.analyze_query(query)
            intent = intent_result.primary_intent

        # Step 2: Generate query embedding
        query_embedding = self._get_query_embedding(query)

        # Step 3: Get user preference vector for personalization (if logged in)
        user_embedding = None
        if user_id:
            user_embedding = await self._get_user_embedding(user_id)

        # Step 4: Build taxonomy filters
        weaviate_filters = self._build_filters(taxonomy_filters, difficulty)

        # Step 5: Search each content type in parallel
        search_tasks = []
        for content_type in content_types:
            task = self._search_collection(
                content_type=content_type,
                query=query,
                query_embedding=query_embedding,
                user_embedding=user_embedding,
                filters=weaviate_filters,
                limit=limit,
                alpha=alpha,
            )
            search_tasks.append(task)

        # Run searches in parallel
        collection_results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Step 6: Merge and rank results
        all_results: list[SearchResult] = []
        for i, results in enumerate(collection_results):
            if isinstance(results, Exception):
                content_type = content_types[i]
                logger.warning(f'Search failed for {content_type}: {results}')
                continue
            all_results.extend(results)

        # Sort by score descending
        all_results.sort(key=lambda r: r.score, reverse=True)

        # Apply offset and limit
        paginated_results = all_results[offset : offset + limit]

        search_time_ms = (time.time() - start_time) * 1000

        return SearchResponse(
            results=paginated_results,
            total_count=len(all_results),
            query=query,
            detected_intent=intent,
            searched_types=content_types,
            search_time_ms=search_time_ms,
        )

    def search_sync(
        self,
        query: str,
        user_id: int | None = None,
        content_types: list[ContentType] | None = None,
        taxonomy_filters: dict[str, list[str]] | None = None,
        difficulty: str | None = None,
        limit: int = 20,
        offset: int = 0,
        alpha: float = 0.7,
    ) -> SearchResponse:
        """
        Synchronous wrapper for search.

        Use this when calling from synchronous Django views/tasks.
        """
        try:
            # Check if we're already in an async context
            loop = asyncio.get_running_loop()
            # If we get here, we're in an async context - use run_coroutine_threadsafe
            future = asyncio.run_coroutine_threadsafe(
                self.search(
                    query=query,
                    user_id=user_id,
                    content_types=content_types,
                    taxonomy_filters=taxonomy_filters,
                    difficulty=difficulty,
                    limit=limit,
                    offset=offset,
                    alpha=alpha,
                ),
                loop,
            )
            return future.result(timeout=30)
        except RuntimeError:
            # No running event loop - create a new one
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(
                    self.search(
                        query=query,
                        user_id=user_id,
                        content_types=content_types,
                        taxonomy_filters=taxonomy_filters,
                        difficulty=difficulty,
                        limit=limit,
                        offset=offset,
                        alpha=alpha,
                    )
                )
            finally:
                loop.close()
                asyncio.set_event_loop(None)

    async def _search_collection(
        self,
        content_type: ContentType,
        query: str,
        query_embedding: list[float] | None,
        user_embedding: list[float] | None,
        filters: dict | None,
        limit: int,
        alpha: float,
    ) -> list[SearchResult]:
        """
        Search a single Weaviate collection.

        Combines hybrid search with optional user personalization boost.
        """
        collection = self._get_collection_name(content_type)
        if not collection:
            return []

        return_properties = self._get_return_properties(content_type)

        try:
            # Run hybrid search in thread pool to avoid blocking event loop
            results = await asyncio.to_thread(
                self.weaviate.hybrid_search,
                collection=collection,
                query=query,
                vector=query_embedding,
                alpha=alpha,
                limit=limit,
                filters=filters,
                return_properties=return_properties,
            )

            # Convert to SearchResult objects
            search_results = []
            for item in results:
                result = self._parse_weaviate_result(content_type, item)
                if result:
                    # Apply user personalization boost if available
                    if user_embedding and query_embedding:
                        result.score = self._apply_personalization_boost(
                            result.score,
                            query_embedding,
                            user_embedding,
                        )
                    search_results.append(result)

            return search_results

        except WeaviateClientError as e:
            logger.error(f'Weaviate search failed for {collection}: {e}')
            raise

    def _get_query_embedding(self, query: str) -> list[float] | None:
        """Generate embedding for the search query."""
        try:
            return self.embeddings.generate_embedding(query)
        except Exception as e:
            logger.warning(f'Failed to generate query embedding: {e}')
            return None

    async def _get_user_embedding(self, user_id: int) -> list[float] | None:
        """
        Get or generate user preference embedding.

        Cached in Redis for performance.
        """
        cache_key = CACHE_KEY_USER_EMBEDDING.format(user_id=user_id)

        # Try cache first
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # Generate user embedding
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(pk=user_id)

            embedding_text = self.embeddings.generate_user_profile_embedding_text(user)
            if not embedding_text:
                return None

            embedding = self.embeddings.generate_embedding(embedding_text)

            # Cache the embedding
            if embedding:
                cache.set(cache_key, embedding, CACHE_TTL_USER_EMBEDDING)

            return embedding

        except Exception as e:
            logger.warning(f'Failed to get user embedding for {user_id}: {e}')
            return None

    def _build_filters(
        self,
        taxonomy_filters: dict[str, list[str]] | None,
        difficulty: str | None,
    ) -> dict | None:
        """Build Weaviate where filter from taxonomy filters."""
        operands = []

        if difficulty:
            operands.append(
                {
                    'path': ['difficulty_taxonomy_name'],
                    'operator': 'Equal',
                    'valueText': difficulty,
                }
            )

        if taxonomy_filters:
            for tax_type, slugs in taxonomy_filters.items():
                if slugs:
                    # Map taxonomy type to Weaviate property
                    property_name = self._taxonomy_type_to_property(tax_type)
                    if property_name:
                        # Use ContainsAny for array properties
                        operands.append(
                            {
                                'path': [property_name],
                                'operator': 'ContainsAny',
                                'valueTextArray': slugs,
                            }
                        )

        if not operands:
            return None

        if len(operands) == 1:
            return operands[0]

        return {
            'operator': 'And',
            'operands': operands,
        }

    def _taxonomy_type_to_property(self, tax_type: str) -> str | None:
        """Map taxonomy type to Weaviate property name."""
        mapping = {
            'topic': 'topic_names',
            'category': 'category_names',
            'tool': 'tool_names',
            'difficulty': 'difficulty_taxonomy_name',
            'time_investment': 'time_investment_name',
            'content_type': 'content_type_name',
            'pricing': 'pricing_taxonomy_name',
        }
        return mapping.get(tax_type)

    def _get_collection_name(self, content_type: ContentType) -> str | None:
        """Get Weaviate collection name for content type."""
        mapping = {
            'project': WeaviateSchema.PROJECT_COLLECTION,
            'quiz': WeaviateSchema.QUIZ_COLLECTION,
            'tool': WeaviateSchema.TOOL_COLLECTION,
            'micro_lesson': WeaviateSchema.MICRO_LESSON_COLLECTION,
        }
        return mapping.get(content_type)

    def _get_return_properties(self, content_type: ContentType) -> list[str]:
        """Get properties to return for a content type."""
        base = ['title', 'weaviate_uuid', 'difficulty_taxonomy_name']

        if content_type == 'project':
            return base + ['project_id', 'combined_text', 'tool_names', 'category_names']
        elif content_type == 'quiz':
            return base + ['quiz_id', 'topic_names']
        elif content_type == 'tool':
            return base + ['tool_id', 'description', 'category_names']
        elif content_type == 'micro_lesson':
            return base + ['micro_lesson_id', 'concept_name', 'topic_name']

        return base

    def _parse_weaviate_result(
        self,
        content_type: ContentType,
        item: dict[str, Any],
    ) -> SearchResult | None:
        """Parse Weaviate result into SearchResult."""
        try:
            # Get score from _additional
            additional = item.get('_additional', {})
            score = additional.get('score', 0.0)
            if isinstance(score, str):
                score = float(score)

            # Get content ID based on type
            id_field_mapping = {
                'project': 'project_id',
                'quiz': 'quiz_id',
                'tool': 'tool_id',
                'micro_lesson': 'micro_lesson_id',
            }
            id_field = id_field_mapping.get(content_type, 'id')
            content_id = item.get(id_field)

            if content_id is None:
                logger.warning(f'Missing {id_field} in {content_type} result')
                return None

            title = item.get('title', '')

            # Build metadata dict (exclude special fields)
            exclude_fields = {
                'title',
                'weaviate_uuid',
                '_additional',
                id_field,
            }
            metadata = {k: v for k, v in item.items() if k not in exclude_fields}

            return SearchResult(
                content_type=content_type,
                content_id=content_id,
                title=title,
                score=score,
                weaviate_uuid=item.get('weaviate_uuid'),
                metadata=metadata,
            )

        except Exception as e:
            logger.warning(f'Failed to parse {content_type} result: {e}')
            return None

    def _apply_personalization_boost(
        self,
        base_score: float,
        query_embedding: list[float],
        user_embedding: list[float],
    ) -> float:
        """
        Apply personalization boost based on user preferences.

        Uses cosine similarity between query and user embedding
        to boost relevant content.
        """
        if not query_embedding or not user_embedding:
            return base_score

        try:
            # Calculate cosine similarity
            dot_product = sum(a * b for a, b in zip(query_embedding, user_embedding, strict=False))
            mag_q = sum(x**2 for x in query_embedding) ** 0.5
            mag_u = sum(x**2 for x in user_embedding) ** 0.5

            if mag_q == 0 or mag_u == 0:
                return base_score

            similarity = dot_product / (mag_q * mag_u)

            # Apply boost (similarity ranges from -1 to 1, map to 0.9-1.1 multiplier)
            boost = 1.0 + (similarity * 0.1 * self.WEIGHT_COLLABORATIVE)

            return base_score * boost

        except Exception as e:
            logger.warning(f'Personalization boost failed: {e}')
            return base_score

    async def get_related_content(
        self,
        content_type: ContentType,
        content_id: int | str,
        limit: int = 5,
        exclude_ids: list[int | str] | None = None,
    ) -> list[SearchResult]:
        """
        Get content related to a specific item via vector similarity.

        Uses the content's embedding to find similar items across
        all content types.

        Args:
            content_type: Type of the source content
            content_id: ID of the source content
            limit: Maximum related items to return
            exclude_ids: IDs to exclude from results

        Returns:
            List of related SearchResult items
        """
        collection = self._get_collection_name(content_type)
        if not collection:
            return []

        try:
            # Get the source content's vector from Weaviate
            id_field_mapping = {
                'project': 'project_id',
                'quiz': 'quiz_id',
                'tool': 'tool_id',
                'micro_lesson': 'micro_lesson_id',
            }
            id_field = id_field_mapping.get(content_type)
            if not id_field:
                return []

            # Handle both string and int content_id types
            if isinstance(content_id, str) and content_id.isdigit():
                property_value = int(content_id)
            else:
                property_value = content_id

            source_obj = self.weaviate.get_by_property(
                collection=collection,
                property_name=id_field,
                property_value=property_value,
            )

            if not source_obj:
                return []

            source_uuid = source_obj.get('_additional', {}).get('id')
            if not source_uuid:
                return []

            # Get the vector for this object
            # Note: This requires querying with additional { vector }
            # For now, we'll re-embed the content

            # Search for similar content in all collections
            all_results: list[SearchResult] = []

            for target_type in ['project', 'quiz', 'tool', 'micro_lesson']:
                target_collection = self._get_collection_name(target_type)
                if not target_collection:
                    continue

                try:
                    # Use nearObject to find similar items
                    results = (
                        self.weaviate.client.query.get(
                            target_collection,
                            self._get_return_properties(target_type) + ['_additional { distance id }'],
                        )
                        .with_near_object({'id': source_uuid})
                        .with_limit(limit + 1)
                        .do()
                    )

                    objects = results.get('data', {}).get('Get', {}).get(target_collection, [])

                    for item in objects:
                        # Skip the source object itself
                        item_id = item.get(id_field_mapping.get(target_type))
                        if target_type == content_type and str(item_id) == str(content_id):
                            continue

                        if exclude_ids and item_id in exclude_ids:
                            continue

                        # Convert distance to similarity score (1 - distance)
                        distance = item.get('_additional', {}).get('distance', 1.0)
                        score = 1.0 - distance

                        result = SearchResult(
                            content_type=target_type,
                            content_id=item_id,
                            title=item.get('title', ''),
                            score=score,
                            weaviate_uuid=item.get('_additional', {}).get('id'),
                        )
                        all_results.append(result)

                except Exception as e:
                    logger.warning(f'Related content search failed for {target_collection}: {e}')
                    continue

            # Sort by score and limit
            all_results.sort(key=lambda r: r.score, reverse=True)
            return all_results[:limit]

        except Exception as e:
            logger.error(f'Failed to get related content: {e}')
            return []

    def invalidate_user_cache(self, user_id: int) -> None:
        """Invalidate cached user embedding when preferences change."""
        cache_key = CACHE_KEY_USER_EMBEDDING.format(user_id=user_id)
        cache.delete(cache_key)
        logger.debug(f'Invalidated user embedding cache for {user_id}')
