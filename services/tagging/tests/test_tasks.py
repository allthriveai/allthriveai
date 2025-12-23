"""
Tests for Celery tagging tasks.

Tests cover:
- tag_content_task behavior
- batch_tag_content queuing
- backfill_tags discovery
- retag_stale_content selection
- Error handling and retry logic
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase

from services.tagging.tasks import (
    _get_content_model,
    backfill_tags,
    batch_tag_content,
    tag_content_task,
)


class GetContentModelTests(TestCase):
    """Tests for _get_content_model helper."""

    def test_get_project_model(self):
        """Returns Project model for 'project' type."""
        from core.projects.models import Project

        model = _get_content_model('project')

        self.assertEqual(model, Project)

    def test_get_quiz_model(self):
        """Returns Quiz model for 'quiz' type."""
        from core.quizzes.models import Quiz

        model = _get_content_model('quiz')

        self.assertEqual(model, Quiz)

    def test_get_tool_model(self):
        """Returns Tool model for 'tool' type."""
        from core.tools.models import Tool

        model = _get_content_model('tool')

        self.assertEqual(model, Tool)

    def test_get_micro_lesson_model(self):
        """Returns MicroLesson model for 'micro_lesson' type."""
        from core.learning_paths.models import MicroLesson

        model = _get_content_model('micro_lesson')

        self.assertEqual(model, MicroLesson)

    def test_invalid_content_type(self):
        """Raises ValueError for unknown type."""
        with self.assertRaises(ValueError) as ctx:
            _get_content_model('unknown')

        self.assertIn('Unknown content type', str(ctx.exception))


class TagContentTaskTests(TestCase):
    """Tests for tag_content_task Celery task."""

    def test_invalid_content_type_returns_error(self):
        """Invalid content type returns error dict."""
        result = tag_content_task('invalid_type', 123)

        self.assertEqual(result['status'], 'error')
        self.assertIn('Unknown content type', result['error'])

    @patch('services.tagging.tasks._get_content_model')
    def test_not_found_returns_skipped(self, mock_get_model):
        """Non-existent content returns skipped."""
        from core.projects.models import Project

        mock_model = MagicMock()
        mock_model.DoesNotExist = Project.DoesNotExist
        mock_model.objects.get.side_effect = Project.DoesNotExist()
        mock_get_model.return_value = mock_model

        result = tag_content_task('project', 999999)

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'not_found')

    @patch('services.tagging.tasks.AITaggingService')
    @patch('services.tagging.tasks._get_content_model')
    def test_already_tagged_returns_skipped(self, mock_get_model, mock_service_class):
        """Already tagged content returns skipped."""
        mock_content = MagicMock()
        mock_model = MagicMock()
        mock_model.objects.get.return_value = mock_content
        mock_get_model.return_value = mock_model

        mock_service = MagicMock()
        mock_service.should_retag.return_value = False
        mock_service_class.return_value = mock_service

        result = tag_content_task('project', 123)

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'already_tagged')

    @patch('services.tagging.tasks.AITaggingService')
    @patch('services.tagging.tasks._get_content_model')
    def test_successful_tagging(self, mock_get_model, mock_service_class):
        """Successful tagging returns success with metadata."""
        mock_content = MagicMock()
        mock_content.last_indexed_at = None  # No Weaviate sync
        mock_model = MagicMock()
        mock_model.objects.get.return_value = mock_content
        mock_get_model.return_value = mock_model

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.average_confidence = 0.85
        mock_result.model_used = 'gpt-4'
        mock_result.tokens_used = 150

        mock_service = MagicMock()
        mock_service.should_retag.return_value = True
        mock_service.tag_content.return_value = mock_result
        mock_service.apply_tags.return_value = True
        mock_service_class.return_value = mock_service

        result = tag_content_task('project', 123, tier='premium')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['confidence'], 0.85)
        self.assertEqual(result['model'], 'gpt-4')
        self.assertEqual(result['tokens'], 150)

    @patch('services.tagging.tasks.AITaggingService')
    @patch('services.tagging.tasks._get_content_model')
    def test_tagging_failure_returns_error(self, mock_get_model, mock_service_class):
        """Failed tagging returns error."""
        mock_content = MagicMock()
        mock_model = MagicMock()
        mock_model.objects.get.return_value = mock_content
        mock_get_model.return_value = mock_model

        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = 'AI parsing failed'

        mock_service = MagicMock()
        mock_service.should_retag.return_value = True
        mock_service.tag_content.return_value = mock_result
        mock_service_class.return_value = mock_service

        result = tag_content_task('project', 123)

        self.assertEqual(result['status'], 'error')
        self.assertIn('AI parsing failed', result['error'])

    @patch('services.tagging.tasks.AITaggingService')
    @patch('services.tagging.tasks._get_content_model')
    def test_apply_tags_failure(self, mock_get_model, mock_service_class):
        """Failed tag application returns error."""
        mock_content = MagicMock()
        mock_content.last_indexed_at = None
        mock_model = MagicMock()
        mock_model.objects.get.return_value = mock_content
        mock_get_model.return_value = mock_model

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.average_confidence = 0.9
        mock_result.model_used = 'gpt-4'
        mock_result.tokens_used = 100

        mock_service = MagicMock()
        mock_service.should_retag.return_value = True
        mock_service.tag_content.return_value = mock_result
        mock_service.apply_tags.return_value = False
        mock_service_class.return_value = mock_service

        result = tag_content_task('project', 123)

        self.assertEqual(result['status'], 'error')
        self.assertIn('Failed to apply tags', result['error'])


class BatchTagContentTests(TestCase):
    """Tests for batch_tag_content task."""

    @patch('services.tagging.tasks.tag_content_task')
    def test_batch_queues_individual_tasks(self, mock_tag_task):
        """Batch task queues individual tasks."""
        content_ids = [1, 2, 3, 4, 5]

        result = batch_tag_content('project', content_ids, tier='bulk')

        self.assertEqual(result['status'], 'queued')
        self.assertEqual(result['count'], 5)
        self.assertEqual(result['content_type'], 'project')
        self.assertEqual(result['tier'], 'bulk')

        # Verify apply_async was called for each
        self.assertEqual(mock_tag_task.apply_async.call_count, 5)

    @patch('services.tagging.tasks.tag_content_task')
    def test_batch_staggers_tasks(self, mock_tag_task):
        """Tasks are staggered with countdown."""
        content_ids = [1, 2, 3]

        batch_tag_content('project', content_ids)

        calls = mock_tag_task.apply_async.call_args_list

        # First task: countdown=0
        self.assertEqual(calls[0][1]['countdown'], 0)
        # Second task: countdown=2
        self.assertEqual(calls[1][1]['countdown'], 2)
        # Third task: countdown=4
        self.assertEqual(calls[2][1]['countdown'], 4)


class BackfillTagsTests(TestCase):
    """Tests for backfill_tags task."""

    @patch('services.tagging.tasks.batch_tag_content')
    def test_backfill_returns_queued_status(self, mock_batch):
        """Backfill returns proper status."""
        result = backfill_tags(content_type='project', limit=10)

        self.assertEqual(result['status'], 'queued')
        self.assertIn('counts', result)
        self.assertIn('project', result['counts'])

    @patch('services.tagging.tasks.batch_tag_content')
    def test_backfill_all_types(self, mock_batch):
        """Backfill processes all content types when none specified."""
        result = backfill_tags(limit=5)

        self.assertEqual(result['status'], 'queued')
        # Should attempt all types
        self.assertIn('project', result['counts'])
        self.assertIn('quiz', result['counts'])
        self.assertIn('tool', result['counts'])
        self.assertIn('micro_lesson', result['counts'])

    @patch('services.tagging.tasks.batch_tag_content')
    def test_backfill_with_tier(self, mock_batch):
        """Backfill passes tier parameter."""
        result = backfill_tags(content_type='project', tier='premium', limit=5)

        self.assertEqual(result['tier'], 'premium')
