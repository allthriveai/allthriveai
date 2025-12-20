"""
Tests for the unified search service.

Tests cover:
- SearchResult and SearchResponse dataclasses
- Intent detection routing
- Content type filtering
- Sync wrapper event loop handling
"""

from unittest.mock import AsyncMock, MagicMock, patch

from django.test import TestCase

from services.search.intent_router import ContentType
from services.search.unified_search import (
    SearchResponse,
    SearchResult,
    UnifiedSearchService,
)


class SearchResultTests(TestCase):
    """Tests for SearchResult dataclass."""

    def test_to_dict(self):
        """SearchResult converts to dict correctly."""
        result = SearchResult(
            content_type=ContentType.PROJECT,
            content_id=123,
            title='Test Project',
            score=0.95,
            weaviate_uuid='abc-123',
            metadata={'author': 'test'},
        )

        data = result.to_dict()

        self.assertEqual(data['content_type'], ContentType.PROJECT)
        self.assertEqual(data['content_id'], 123)
        self.assertEqual(data['title'], 'Test Project')
        self.assertEqual(data['score'], 0.95)
        self.assertEqual(data['weaviate_uuid'], 'abc-123')
        self.assertEqual(data['author'], 'test')

    def test_to_dict_minimal(self):
        """SearchResult with minimal fields."""
        result = SearchResult(
            content_type=ContentType.QUIZ,
            content_id='uuid-456',
            title='Test Quiz',
            score=0.80,
        )

        data = result.to_dict()

        self.assertEqual(data['content_type'], ContentType.QUIZ)
        self.assertEqual(data['content_id'], 'uuid-456')
        self.assertIsNone(data['weaviate_uuid'])


class SearchResponseTests(TestCase):
    """Tests for SearchResponse dataclass."""

    def test_to_dict(self):
        """SearchResponse converts to dict correctly."""
        results = [
            SearchResult(ContentType.PROJECT, 1, 'Project 1', 0.9),
            SearchResult(ContentType.TOOL, 2, 'Tool 1', 0.8),
        ]

        response = SearchResponse(
            results=results,
            total_count=2,
            query='test query',
            detected_intent='general',
            searched_types=[ContentType.PROJECT, ContentType.TOOL],
            search_time_ms=123.456,
        )

        data = response.to_dict()

        self.assertEqual(len(data['results']), 2)
        self.assertEqual(data['total_count'], 2)
        self.assertEqual(data['query'], 'test query')
        self.assertEqual(data['detected_intent'], 'general')
        self.assertEqual(len(data['searched_types']), 2)
        self.assertEqual(data['search_time_ms'], 123.46)

    def test_empty_response(self):
        """Empty search response."""
        response = SearchResponse(
            results=[],
            total_count=0,
            query='no results',
            detected_intent='project',
            searched_types=[ContentType.PROJECT],
        )

        data = response.to_dict()

        self.assertEqual(len(data['results']), 0)
        self.assertEqual(data['total_count'], 0)


class UnifiedSearchServiceTests(TestCase):
    """Tests for UnifiedSearchService."""

    def test_weight_constants(self):
        """Verify scoring weight constants."""
        service = UnifiedSearchService()

        # Weights should sum to 1.0
        total = (
            service.WEIGHT_SEMANTIC
            + service.WEIGHT_TAXONOMY
            + service.WEIGHT_SOCIAL
            + service.WEIGHT_COLLABORATIVE
            + service.WEIGHT_POPULARITY
        )
        self.assertAlmostEqual(total, 1.0, places=2)

    def test_get_collection_for_content_type(self):
        """Collection names map correctly to content types."""
        service = UnifiedSearchService()

        self.assertEqual(service._get_collection_for_type(ContentType.PROJECT), 'Project')
        self.assertEqual(service._get_collection_for_type(ContentType.QUIZ), 'Quiz')
        self.assertEqual(service._get_collection_for_type(ContentType.TOOL), 'Tool')
        self.assertEqual(service._get_collection_for_type(ContentType.LEARNING), 'MicroLesson')

    @patch('services.search.unified_search.get_weaviate_client')
    @patch('services.search.unified_search.IntentRouter')
    async def test_search_with_intent_detection(self, mock_intent_class, mock_get_client):
        """Search routes to correct content types based on intent."""
        # Setup mocks
        mock_intent = MagicMock()
        mock_intent.detect_intent.return_value = {
            'intent': 'project_browse',
            'content_types': [ContentType.PROJECT],
            'confidence': 0.9,
        }
        mock_intent_class.return_value = mock_intent

        mock_client = MagicMock()
        mock_client.hybrid_search.return_value = [
            {
                '_additional': {'id': 'uuid-1'},
                'project_id': 1,
                'title': 'Test Project',
            }
        ]
        mock_get_client.return_value = mock_client

        service = UnifiedSearchService()
        # Override weaviate to use mock
        service.weaviate = mock_client
        service.intent_router = mock_intent

        response = await service.search(query='show me projects')

        self.assertEqual(response.detected_intent, 'project_browse')
        self.assertEqual(response.searched_types, [ContentType.PROJECT])

    @patch('services.search.unified_search.get_weaviate_client')
    async def test_search_with_explicit_content_types(self, mock_get_client):
        """Explicit content types override intent detection."""
        mock_client = MagicMock()
        mock_client.hybrid_search.return_value = []
        mock_get_client.return_value = mock_client

        service = UnifiedSearchService()
        service.weaviate = mock_client

        response = await service.search(
            query='anything',
            content_types=[ContentType.TOOL],
        )

        # Should use the explicit types
        self.assertIn(ContentType.TOOL, response.searched_types)

    @patch('services.search.unified_search.get_weaviate_client')
    def test_search_sync_wrapper(self, mock_get_client):
        """Sync wrapper handles event loop correctly."""
        mock_client = MagicMock()
        mock_client.hybrid_search.return_value = []
        mock_get_client.return_value = mock_client

        service = UnifiedSearchService()
        service.weaviate = mock_client

        # Mock the search method to avoid async complexity
        with patch.object(service, 'search', new_callable=AsyncMock) as mock_search:
            mock_search.return_value = SearchResponse(
                results=[],
                total_count=0,
                query='test',
                detected_intent='general',
                searched_types=[ContentType.PROJECT],
            )

            # This should work without RuntimeError
            response = service.search_sync(query='test')

            self.assertEqual(response.total_count, 0)


class RelatedContentTests(TestCase):
    """Tests for get_related_content method."""

    @patch('services.search.unified_search.get_weaviate_client')
    async def test_get_related_content_by_project(self, mock_get_client):
        """Get related content for a project."""
        mock_client = MagicMock()
        mock_client.get_by_property.return_value = {
            '_additional': {'id': 'source-uuid', 'vector': [0.1, 0.2, 0.3]},
            'project_id': 1,
            'title': 'Source Project',
        }
        mock_client.near_vector_search.return_value = [
            {
                '_additional': {'id': 'related-uuid'},
                'project_id': 2,
                'title': 'Related Project',
            }
        ]
        mock_get_client.return_value = mock_client

        service = UnifiedSearchService()
        service.weaviate = mock_client

        results = await service.get_related_content(
            content_type=ContentType.PROJECT,
            content_id=1,
            limit=5,
        )

        # Should call near_vector_search with the source vector
        mock_client.near_vector_search.assert_called()

    @patch('services.search.unified_search.get_weaviate_client')
    async def test_get_related_content_not_found(self, mock_get_client):
        """Handle missing source content gracefully."""
        mock_client = MagicMock()
        mock_client.get_by_property.return_value = None
        mock_get_client.return_value = mock_client

        service = UnifiedSearchService()
        service.weaviate = mock_client

        results = await service.get_related_content(
            content_type=ContentType.PROJECT,
            content_id=999,
        )

        self.assertEqual(results, [])
