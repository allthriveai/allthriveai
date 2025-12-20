"""
Tests for the AI tagging service.

Tests cover:
- TagResult and TaggingResult dataclasses
- Taxonomy resolution and caching
- AI response parsing (edge cases)
- Tag application to content models
- Retag decision logic
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from core.taxonomy.models import Taxonomy
from services.tagging.service import (
    AITaggingService,
    TaggingResult,
    TagResult,
)


class TagResultTests(TestCase):
    """Tests for TagResult dataclass."""

    def test_to_dict(self):
        """TagResult converts to dict correctly."""
        result = TagResult(
            taxonomy_type='topic',
            slug='machine-learning',
            confidence=0.95,
            taxonomy_id=42,
        )

        data = result.to_dict()

        self.assertEqual(data['slug'], 'machine-learning')
        self.assertEqual(data['confidence'], 0.95)
        self.assertEqual(data['taxonomy_id'], 42)

    def test_to_dict_without_taxonomy_id(self):
        """TagResult works without taxonomy_id."""
        result = TagResult(
            taxonomy_type='topic',
            slug='machine-learning',
            confidence=0.85,
        )

        data = result.to_dict()

        self.assertEqual(data['slug'], 'machine-learning')
        self.assertIsNone(data['taxonomy_id'])


class TaggingResultTests(TestCase):
    """Tests for TaggingResult dataclass."""

    def test_to_metadata_empty(self):
        """Empty TaggingResult produces minimal metadata."""
        result = TaggingResult(success=True, model_used='gpt-4', tokens_used=100)

        metadata = result.to_metadata()

        self.assertIn('tagged_at', metadata)
        self.assertEqual(metadata['model'], 'gpt-4')
        self.assertEqual(metadata['tokens'], 100)
        self.assertNotIn('content_type', metadata)
        self.assertNotIn('topics', metadata)

    def test_to_metadata_with_tags(self):
        """TaggingResult with tags produces full metadata."""
        result = TaggingResult(
            success=True,
            model_used='gpt-4',
            tokens_used=150,
            content_type=TagResult('content_type', 'tutorial', 0.9, 1),
            difficulty=TagResult('difficulty', 'intermediate', 0.85, 2),
            topics=[
                TagResult('topic', 'machine-learning', 0.95, 10),
                TagResult('topic', 'python', 0.88, 11),
            ],
        )

        metadata = result.to_metadata()

        self.assertEqual(metadata['content_type']['slug'], 'tutorial')
        self.assertEqual(metadata['difficulty']['slug'], 'intermediate')
        self.assertEqual(len(metadata['topics']), 2)

    def test_average_confidence(self):
        """Average confidence is calculated correctly."""
        result = TaggingResult(
            success=True,
            content_type=TagResult('content_type', 'tutorial', 0.9, 1),
            difficulty=TagResult('difficulty', 'intermediate', 0.8, 2),
            topics=[
                TagResult('topic', 'ml', 0.7, 10),
            ],
        )

        avg = result.average_confidence

        # (0.9 + 0.8 + 0.7) / 3 = 0.8
        self.assertAlmostEqual(avg, 0.8, places=5)

    def test_average_confidence_empty(self):
        """Empty result has zero average confidence."""
        result = TaggingResult(success=True)

        self.assertEqual(result.average_confidence, 0.0)


class TaxonomyResolutionTests(TestCase):
    """Tests for taxonomy slug resolution."""

    def setUp(self):
        """Create test taxonomy entries."""
        self.topic, _ = Taxonomy.objects.get_or_create(
            slug='test-machine-learning',
            defaults={
                'taxonomy_type': Taxonomy.TaxonomyType.TOPIC,
                'name': 'Test Machine Learning',
                'is_active': True,
            },
        )
        self.difficulty, _ = Taxonomy.objects.get_or_create(
            slug='test-intermediate',
            defaults={
                'taxonomy_type': Taxonomy.TaxonomyType.DIFFICULTY,
                'name': 'Test Intermediate',
                'is_active': True,
            },
        )
        self.service = AITaggingService()
        # Clear cache to ensure fresh lookup
        self.service._taxonomy_cache = {}
        self.service._taxonomy_cache_time = None

    def test_resolve_exact_match(self):
        """Exact slug match resolves correctly."""
        tag = self.service._resolve_tag('topic', 'test-machine-learning', 0.9)

        self.assertIsNotNone(tag)
        self.assertEqual(tag.taxonomy_id, self.topic.pk)
        self.assertEqual(tag.confidence, 0.9)

    def test_resolve_fuzzy_match(self):
        """Fuzzy slug match with confidence penalty."""
        # Different case and underscores
        tag = self.service._resolve_tag('topic', 'Test_Machine_Learning', 0.9)

        self.assertIsNotNone(tag)
        self.assertEqual(tag.taxonomy_id, self.topic.pk)
        self.assertEqual(tag.confidence, 0.81)  # 0.9 * 0.9 penalty

    def test_resolve_not_found(self):
        """Non-existent slug returns None."""
        tag = self.service._resolve_tag('topic', 'nonexistent-topic-xyz', 0.9)

        self.assertIsNone(tag)

    def test_resolve_wrong_type(self):
        """Wrong taxonomy type returns None."""
        tag = self.service._resolve_tag('difficulty', 'test-machine-learning', 0.9)

        self.assertIsNone(tag)

    def test_taxonomy_cache(self):
        """Taxonomy lookup is cached."""
        # First call populates cache
        self.service._get_taxonomy_lookup()
        cache_time_1 = self.service._taxonomy_cache_time

        # Second call uses cache
        self.service._get_taxonomy_lookup()
        cache_time_2 = self.service._taxonomy_cache_time

        self.assertEqual(cache_time_1, cache_time_2)


class ParseAIResponseTests(TestCase):
    """Tests for AI response parsing edge cases."""

    def setUp(self):
        self.service = AITaggingService()

    def test_parse_valid_json(self):
        """Valid JSON parses correctly."""
        response = '{"content_type": {"value": "tutorial", "confidence": 0.9}}'

        result = self.service._parse_ai_response(response)

        self.assertEqual(result['content_type']['value'], 'tutorial')

    def test_parse_json_with_markdown(self):
        """JSON wrapped in markdown code blocks."""
        response = """```json
{"content_type": {"value": "tutorial", "confidence": 0.9}}
```"""

        result = self.service._parse_ai_response(response)

        self.assertEqual(result['content_type']['value'], 'tutorial')

    def test_parse_json_with_uppercase_markdown(self):
        """JSON wrapped in uppercase markdown."""
        response = """```JSON
{"content_type": {"value": "guide", "confidence": 0.8}}
```"""

        result = self.service._parse_ai_response(response)

        self.assertEqual(result['content_type']['value'], 'guide')

    def test_parse_json_with_text_wrapper(self):
        """JSON embedded in explanatory text."""
        response = """Here's the analysis:
{"content_type": {"value": "tutorial", "confidence": 0.9}}
That's the result."""

        result = self.service._parse_ai_response(response)

        self.assertEqual(result['content_type']['value'], 'tutorial')

    def test_parse_empty_response(self):
        """Empty response returns empty dict."""
        result = self.service._parse_ai_response('')

        self.assertEqual(result, {})

    def test_parse_none_response(self):
        """None response returns empty dict."""
        result = self.service._parse_ai_response(None)

        self.assertEqual(result, {})

    def test_parse_whitespace_response(self):
        """Whitespace-only response returns empty dict."""
        result = self.service._parse_ai_response('   \n\t  ')

        self.assertEqual(result, {})

    def test_parse_non_string_response(self):
        """Non-string response returns empty dict."""
        result = self.service._parse_ai_response(123)

        self.assertEqual(result, {})

    def test_parse_invalid_json(self):
        """Invalid JSON returns empty dict."""
        result = self.service._parse_ai_response('{invalid json}')

        self.assertEqual(result, {})

    def test_parse_non_dict_json(self):
        """JSON that parses to non-dict returns empty dict."""
        result = self.service._parse_ai_response('[1, 2, 3]')

        self.assertEqual(result, {})


class ShouldRetagTests(TestCase):
    """Tests for retag decision logic."""

    def setUp(self):
        self.service = AITaggingService()

    def test_force_retag(self):
        """Force flag always triggers retag."""
        content = MagicMock()
        content.ai_tag_metadata = {
            'tagged_at': timezone.now().isoformat(),
        }

        should_retag = self.service.should_retag(content, force=True)

        self.assertTrue(should_retag)

    def test_no_metadata(self):
        """No metadata triggers retag."""
        content = MagicMock()
        content.ai_tag_metadata = None

        should_retag = self.service.should_retag(content)

        self.assertTrue(should_retag)

    def test_empty_metadata(self):
        """Empty metadata triggers retag."""
        content = MagicMock()
        content.ai_tag_metadata = {}

        should_retag = self.service.should_retag(content)

        self.assertTrue(should_retag)

    def test_no_tagged_at(self):
        """Missing tagged_at triggers retag."""
        content = MagicMock()
        content.ai_tag_metadata = {'model': 'gpt-4'}

        should_retag = self.service.should_retag(content)

        self.assertTrue(should_retag)

    def test_recent_tag_no_retag(self):
        """Recently tagged content doesn't need retag."""
        content = MagicMock()
        content.ai_tag_metadata = {
            'tagged_at': timezone.now().isoformat(),
        }

        should_retag = self.service.should_retag(content, stale_hours=168)

        self.assertFalse(should_retag)

    def test_stale_tag_triggers_retag(self):
        """Stale tags trigger retag."""
        content = MagicMock()
        stale_time = timezone.now() - timedelta(hours=200)
        content.ai_tag_metadata = {
            'tagged_at': stale_time.isoformat(),
        }

        should_retag = self.service.should_retag(content, stale_hours=168)

        self.assertTrue(should_retag)

    def test_invalid_tagged_at_triggers_retag(self):
        """Invalid tagged_at format triggers retag."""
        content = MagicMock()
        content.ai_tag_metadata = {
            'tagged_at': 'not-a-valid-date',
        }

        should_retag = self.service.should_retag(content)

        self.assertTrue(should_retag)


class TagContentIntegrationTests(TestCase):
    """Integration tests for tag_content method."""

    def setUp(self):
        # Create taxonomy entries using get_or_create to handle existing data
        Taxonomy.objects.get_or_create(
            slug='test-tutorial',
            defaults={
                'taxonomy_type': Taxonomy.TaxonomyType.CONTENT_TYPE,
                'name': 'Test Tutorial',
                'is_active': True,
            },
        )
        Taxonomy.objects.get_or_create(
            slug='test-intermediate-2',
            defaults={
                'taxonomy_type': Taxonomy.TaxonomyType.DIFFICULTY,
                'name': 'Test Intermediate 2',
                'is_active': True,
            },
        )
        Taxonomy.objects.get_or_create(
            slug='test-ml',
            defaults={
                'taxonomy_type': Taxonomy.TaxonomyType.TOPIC,
                'name': 'Test ML',
                'is_active': True,
            },
        )

    @patch('services.tagging.service.AIProvider')
    def test_tag_content_success(self, mock_ai_provider_class):
        """Successful tagging extracts and resolves tags."""
        mock_ai = MagicMock()
        mock_ai_provider_class.return_value = mock_ai
        mock_ai.complete.return_value = {
            'content': """{
                "content_type": {"value": "test-tutorial", "confidence": 0.9},
                "difficulty": {"value": "test-intermediate-2", "confidence": 0.85},
                "topics": [{"value": "test-ml", "confidence": 0.95}]
            }""",
            'model': 'gpt-4',
            'usage': {'total_tokens': 100},
        }

        content = MagicMock()
        content.title = 'Test Tutorial'
        content.description = 'A test tutorial about ML'
        content.content = None  # Explicitly set to None, not MagicMock
        content.overview = None
        content.content_template = None
        # Remove questions attr to avoid iteration issues
        del content.questions

        service = AITaggingService()
        result = service.tag_content(content, tier='bulk')

        self.assertTrue(result.success)
        self.assertIsNotNone(result.content_type)
        self.assertEqual(result.content_type.slug, 'test-tutorial')
        self.assertIsNotNone(result.difficulty)
        self.assertEqual(len(result.topics), 1)
        self.assertEqual(result.model_used, 'gpt-4')
        self.assertEqual(result.tokens_used, 100)

    @patch('services.tagging.service.AIProvider')
    def test_tag_content_empty_response(self, mock_ai_provider_class):
        """Empty AI response returns failed result."""
        mock_ai = MagicMock()
        mock_ai_provider_class.return_value = mock_ai
        mock_ai.complete.return_value = None

        content = MagicMock()
        content.title = 'Test'
        content.description = 'Test'
        content.content = None
        content.overview = None
        content.content_template = None
        del content.questions

        service = AITaggingService()
        result = service.tag_content(content)

        self.assertFalse(result.success)
        self.assertIn('Empty', result.error)

    @patch('services.tagging.service.AIProvider')
    def test_tag_content_filters_low_confidence(self, mock_ai_provider_class):
        """Low confidence tags are filtered out."""
        mock_ai = MagicMock()
        mock_ai_provider_class.return_value = mock_ai
        mock_ai.complete.return_value = {
            'content': """{
                "content_type": {"value": "test-tutorial", "confidence": 0.3},
                "topics": [{"value": "test-ml", "confidence": 0.95}]
            }""",
            'model': 'gpt-4',
            'usage': {'total_tokens': 50},
        }

        content = MagicMock()
        content.title = 'Test'
        content.description = 'Test'
        content.content = None
        content.overview = None
        content.content_template = None
        del content.questions

        service = AITaggingService()
        result = service.tag_content(content, min_confidence=0.5)

        self.assertTrue(result.success)
        self.assertIsNone(result.content_type)  # Filtered out
        self.assertEqual(len(result.topics), 1)  # Kept
