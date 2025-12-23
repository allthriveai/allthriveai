"""
Tests for AI prompts and content building functions.

Tests cover:
- Taxonomy context building
- Content preview extraction
- Additional context building
- Edge cases (null fields, empty content)
"""

from unittest.mock import MagicMock

from django.test import TestCase

from services.tagging.prompts import (
    build_additional_context,
    build_content_preview,
    build_taxonomy_context,
)


class BuildTaxonomyContextTests(TestCase):
    """Tests for taxonomy context building."""

    def test_build_empty_context(self):
        """Empty taxonomy dict produces empty string."""
        result = build_taxonomy_context({})

        self.assertEqual(result, '')

    def test_build_single_type(self):
        """Single taxonomy type formats correctly."""
        taxonomies = {
            'topic': [
                {'slug': 'machine-learning', 'name': 'Machine Learning'},
                {'slug': 'ai-agents', 'name': 'AI Agents'},
            ]
        }

        result = build_taxonomy_context(taxonomies)

        self.assertIn('topic:', result)
        self.assertIn('"machine-learning"', result)
        self.assertIn('"ai-agents"', result)

    def test_build_multiple_types(self):
        """Multiple taxonomy types format correctly."""
        taxonomies = {
            'topic': [{'slug': 'ml', 'name': 'ML'}],
            'difficulty': [{'slug': 'beginner', 'name': 'Beginner'}],
        }

        result = build_taxonomy_context(taxonomies)

        self.assertIn('topic:', result)
        self.assertIn('difficulty:', result)

    def test_truncate_long_list(self):
        """Long taxonomy lists are truncated."""
        taxonomies = {'topic': [{'slug': f'topic-{i}', 'name': f'Topic {i}'} for i in range(30)]}

        result = build_taxonomy_context(taxonomies)

        # Should show "and X more"
        self.assertIn('and 10 more', result)

    def test_skip_empty_type(self):
        """Empty taxonomy types are skipped."""
        taxonomies = {
            'topic': [],
            'difficulty': [{'slug': 'beginner', 'name': 'Beginner'}],
        }

        result = build_taxonomy_context(taxonomies)

        self.assertNotIn('topic:', result)
        self.assertIn('difficulty:', result)


class BuildContentPreviewTests(TestCase):
    """Tests for content preview building."""

    def test_preview_with_text_content(self):
        """Text content is extracted correctly."""
        content = MagicMock()
        content.content = [
            {'type': 'text', 'content': 'This is some text content.'},
            {'type': 'code', 'language': 'python'},
        ]
        content.overview = None
        content.content_template = None

        # Mock hasattr to not find 'questions'
        del content.questions

        result = build_content_preview(content)

        self.assertIn('This is some text content', result)
        self.assertIn('[Code: python]', result)

    def test_preview_with_string_content(self):
        """String content is extracted correctly."""
        content = MagicMock()
        content.content = 'This is string content that should be extracted.'
        content.overview = None
        content.content_template = None
        del content.questions

        result = build_content_preview(content)

        self.assertIn('This is string content', result)

    def test_preview_with_overview(self):
        """Overview is included in preview."""
        content = MagicMock()
        content.content = None
        content.overview = 'This is the project overview.'
        content.content_template = None
        del content.questions

        result = build_content_preview(content)

        self.assertIn('This is the project overview', result)

    def test_preview_with_questions(self):
        """Quiz questions are included in preview."""
        content = MagicMock()
        content.content = None
        content.overview = None
        content.content_template = None

        # Mock quiz questions
        q1 = MagicMock()
        q1.question = 'What is machine learning?'
        q2 = MagicMock()
        q2.question = 'How do neural networks work?'

        content.questions.only.return_value.__getitem__ = lambda self, key: [q1, q2][key]
        content.questions.only.return_value.__iter__ = lambda self: iter([q1, q2])

        result = build_content_preview(content)

        self.assertIn('Q: What is machine learning?', result)
        self.assertIn('Q: How do neural networks work?', result)

    def test_preview_with_null_question(self):
        """Null question text is handled gracefully."""
        content = MagicMock()
        content.content = None
        content.overview = None
        content.content_template = None

        q1 = MagicMock()
        q1.question = None  # Null question
        q2 = MagicMock()
        q2.question = 'Valid question?'

        # Setup the mock queryset to properly slice and iterate
        mock_qs = MagicMock()
        mock_qs.__iter__ = lambda self: iter([q1, q2])
        mock_qs.__getitem__ = lambda self, key: [q1, q2][:3] if isinstance(key, slice) else [q1, q2][key]
        content.questions.only.return_value = mock_qs

        result = build_content_preview(content)

        # Should not raise, should include valid question
        self.assertIn('Q: Valid question?', result)

    def test_preview_truncation(self):
        """Long preview is truncated."""
        content = MagicMock()
        content.content = 'x' * 3000  # Very long content
        content.overview = None
        content.content_template = None
        del content.questions

        result = build_content_preview(content, max_length=100)

        self.assertEqual(len(result), 103)  # 100 + '...'
        self.assertTrue(result.endswith('...'))

    def test_preview_empty_content(self):
        """Empty content produces empty preview."""
        content = MagicMock()
        content.content = None
        content.overview = None
        content.content_template = None
        del content.questions

        result = build_content_preview(content)

        self.assertEqual(result, '')


class BuildAdditionalContextTests(TestCase):
    """Tests for additional context building."""

    def test_context_with_tools(self):
        """Tools are included in context."""
        content = MagicMock()
        content.tools.values_list.return_value.__getitem__ = lambda self, key: ['ChatGPT', 'Claude'][:key]
        content.tools.values_list.return_value = ['ChatGPT', 'Claude']

        # Remove other attributes
        del content.categories
        del content.topics_taxonomy
        del content.difficulty
        del content.estimated_time
        del content.question_count

        result = build_additional_context(content)

        self.assertIn('Tools:', result)
        self.assertIn('ChatGPT', result)

    def test_context_with_difficulty(self):
        """Difficulty is included in context."""
        content = MagicMock()
        content.difficulty = 'intermediate'

        del content.tools
        del content.categories
        del content.topics_taxonomy
        del content.estimated_time
        del content.question_count

        result = build_additional_context(content)

        self.assertIn('Stated difficulty: intermediate', result)

    def test_context_with_estimated_time(self):
        """Estimated time is included in context."""
        content = MagicMock()
        content.estimated_time = 30

        del content.tools
        del content.categories
        del content.topics_taxonomy
        del content.difficulty
        del content.question_count

        result = build_additional_context(content)

        self.assertIn('Estimated time: 30 minutes', result)

    def test_context_with_question_count(self):
        """Question count is included in context."""
        content = MagicMock()
        content.question_count = 10

        del content.tools
        del content.categories
        del content.topics_taxonomy
        del content.difficulty
        del content.estimated_time

        result = build_additional_context(content)

        self.assertIn('Question count: 10', result)

    def test_context_empty(self):
        """No additional context produces empty string."""
        content = MagicMock()

        del content.tools
        del content.categories
        del content.topics_taxonomy
        del content.difficulty
        del content.estimated_time
        del content.question_count

        result = build_additional_context(content)

        self.assertEqual(result, '')
