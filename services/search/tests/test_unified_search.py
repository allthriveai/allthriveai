"""
Tests for the unified search service.

Tests cover:
- SearchResult and SearchResponse dataclasses
- Weight constants configuration
- Collection name mapping
"""

from django.test import TestCase

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
            content_type='project',
            content_id=123,
            title='Test Project',
            score=0.95,
            weaviate_uuid='abc-123',
            metadata={'author': 'test'},
        )

        data = result.to_dict()

        self.assertEqual(data['content_type'], 'project')
        self.assertEqual(data['content_id'], 123)
        self.assertEqual(data['title'], 'Test Project')
        self.assertEqual(data['score'], 0.95)
        self.assertEqual(data['weaviate_uuid'], 'abc-123')
        self.assertEqual(data['author'], 'test')

    def test_to_dict_minimal(self):
        """SearchResult with minimal fields."""
        result = SearchResult(
            content_type='quiz',
            content_id='uuid-456',
            title='Test Quiz',
            score=0.80,
        )

        data = result.to_dict()

        self.assertEqual(data['content_type'], 'quiz')
        self.assertEqual(data['content_id'], 'uuid-456')
        self.assertIsNone(data['weaviate_uuid'])


class SearchResponseTests(TestCase):
    """Tests for SearchResponse dataclass."""

    def test_to_dict(self):
        """SearchResponse converts to dict correctly."""
        results = [
            SearchResult('project', 1, 'Project 1', 0.9),
            SearchResult('tool', 2, 'Tool 1', 0.8),
        ]

        response = SearchResponse(
            results=results,
            total_count=2,
            query='test query',
            detected_intent='general',
            searched_types=['project', 'tool'],
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
            searched_types=['project'],
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

        self.assertEqual(service._get_collection_name('project'), 'Project')
        self.assertEqual(service._get_collection_name('quiz'), 'Quiz')
        self.assertEqual(service._get_collection_name('tool'), 'Tool')
        self.assertEqual(service._get_collection_name('micro_lesson'), 'MicroLesson')

    def test_get_collection_for_unknown_type(self):
        """Unknown content types return None."""
        service = UnifiedSearchService()

        self.assertIsNone(service._get_collection_name('unknown'))
        self.assertIsNone(service._get_collection_name(''))
