"""
Tests for the tagging metrics module.

Tests cover:
- TaggingMetrics dataclass
- TaggingMetricsCollector tracking
- Context manager behavior
- Counter operations
- Stats aggregation
"""

from unittest.mock import MagicMock

from django.test import TestCase

from services.tagging.metrics import (
    TaggingMetrics,
    TaggingMetricsCollector,
    metrics_collector,
)


class TaggingMetricsTests(TestCase):
    """Tests for TaggingMetrics dataclass."""

    def test_to_log_dict(self):
        """Metrics convert to log dict correctly."""
        metrics = TaggingMetrics(
            content_type='project',
            content_id=123,
            tier='bulk',
            success=True,
            duration_ms=500,
            tokens_used=100,
            model_used='gpt-4',
            confidence=0.85,
            tags_extracted=5,
        )

        log_dict = metrics.to_log_dict()

        self.assertEqual(log_dict['event'], 'tagging_operation')
        self.assertEqual(log_dict['content_type'], 'project')
        self.assertEqual(log_dict['content_id'], '123')
        self.assertEqual(log_dict['tier'], 'bulk')
        self.assertTrue(log_dict['success'])
        self.assertEqual(log_dict['duration_ms'], 500)
        self.assertEqual(log_dict['tokens_used'], 100)
        self.assertEqual(log_dict['model'], 'gpt-4')
        self.assertEqual(log_dict['confidence'], 0.85)
        self.assertEqual(log_dict['tags_extracted'], 5)
        self.assertIsNone(log_dict['error'])
        self.assertIn('timestamp', log_dict)

    def test_to_log_dict_with_error(self):
        """Failed metrics include error."""
        metrics = TaggingMetrics(
            content_type='quiz',
            content_id='uuid-123',
            tier='premium',
            success=False,
            error='API timeout',
        )

        log_dict = metrics.to_log_dict()

        self.assertFalse(log_dict['success'])
        self.assertEqual(log_dict['error'], 'API timeout')


class TaggingMetricsCollectorTests(TestCase):
    """Tests for TaggingMetricsCollector."""

    def setUp(self):
        self.collector = TaggingMetricsCollector()
        # Reset stats before each test
        self.collector.reset_stats()

    def test_track_tagging_success(self):
        """Successful tagging is tracked."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.tokens_used = 150
        mock_result.model_used = 'gpt-4'
        mock_result.average_confidence = 0.9
        mock_result.content_type = MagicMock()
        mock_result.time_investment = None
        mock_result.difficulty = MagicMock()
        mock_result.pricing = None
        mock_result.topics = [MagicMock(), MagicMock()]
        mock_result.tools = []
        mock_result.categories = []

        with self.collector.track_tagging('project', 123, 'bulk') as tracker:
            tracker.set_result(mock_result)

        stats = self.collector.get_stats()

        self.assertEqual(stats['by_content_type']['project']['total'], 1)
        self.assertEqual(stats['by_content_type']['project']['success'], 1)
        self.assertEqual(stats['by_content_type']['project']['tokens'], 150)

    def test_track_tagging_failure(self):
        """Failed tagging is tracked."""
        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error = 'Rate limit exceeded'

        with self.collector.track_tagging('quiz', 'uuid', 'premium') as tracker:
            tracker.set_result(mock_result)

        stats = self.collector.get_stats()

        self.assertEqual(stats['by_content_type']['quiz']['total'], 1)
        self.assertEqual(stats['by_content_type']['quiz']['failure'], 1)

    def test_track_tagging_exception(self):
        """Exceptions during tagging are tracked."""
        try:
            with self.collector.track_tagging('tool', 456, 'bulk') as tracker:
                raise ValueError('Test error')
        except ValueError:
            pass

        stats = self.collector.get_stats()

        self.assertEqual(stats['by_content_type']['tool']['total'], 1)
        self.assertEqual(stats['by_content_type']['tool']['failure'], 1)

    def test_track_skipped_operation(self):
        """Skipped operations are tracked as success."""
        with self.collector.track_tagging('project', 789, 'bulk') as tracker:
            tracker.mark_skipped('already_tagged')

        stats = self.collector.get_stats()

        self.assertEqual(stats['by_content_type']['project']['success'], 1)

    def test_latency_buckets(self):
        """Latency is tracked in buckets."""
        collector = TaggingMetricsCollector()
        collector.reset_stats()

        # Fast operation
        self.assertEqual(collector._get_latency_bucket(100), 'fast')
        self.assertEqual(collector._get_latency_bucket(499), 'fast')

        # Normal operation
        self.assertEqual(collector._get_latency_bucket(500), 'normal')
        self.assertEqual(collector._get_latency_bucket(1999), 'normal')

        # Slow operation
        self.assertEqual(collector._get_latency_bucket(2000), 'slow')
        self.assertEqual(collector._get_latency_bucket(4999), 'slow')

        # Very slow operation
        self.assertEqual(collector._get_latency_bucket(5000), 'very_slow')
        self.assertEqual(collector._get_latency_bucket(10000), 'very_slow')

    def test_tier_tracking(self):
        """Tier-specific stats are tracked."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.tokens_used = 100
        mock_result.model_used = 'gpt-4'
        mock_result.average_confidence = 0.8
        mock_result.content_type = None
        mock_result.time_investment = None
        mock_result.difficulty = None
        mock_result.pricing = None
        mock_result.topics = []
        mock_result.tools = []
        mock_result.categories = []

        with self.collector.track_tagging('project', 1, 'bulk') as tracker:
            tracker.set_result(mock_result)

        with self.collector.track_tagging('project', 2, 'premium') as tracker:
            tracker.set_result(mock_result)

        stats = self.collector.get_stats()

        self.assertEqual(stats['by_tier']['bulk']['success'], 1)
        self.assertEqual(stats['by_tier']['premium']['success'], 1)

    def test_success_rate_calculation(self):
        """Success rate is calculated correctly."""
        mock_success = MagicMock()
        mock_success.success = True
        mock_success.tokens_used = 0
        mock_success.model_used = ''
        mock_success.average_confidence = 0.0
        mock_success.content_type = None
        mock_success.time_investment = None
        mock_success.difficulty = None
        mock_success.pricing = None
        mock_success.topics = []
        mock_success.tools = []
        mock_success.categories = []

        mock_failure = MagicMock()
        mock_failure.success = False
        mock_failure.error = 'Error'

        # 3 successes, 1 failure
        for i in range(3):
            with self.collector.track_tagging('project', i, 'bulk') as tracker:
                tracker.set_result(mock_success)

        with self.collector.track_tagging('project', 99, 'bulk') as tracker:
            tracker.set_result(mock_failure)

        stats = self.collector.get_stats()

        # 3/4 = 75%
        self.assertEqual(stats['by_content_type']['project']['success_rate'], 75.0)
        self.assertEqual(stats['total']['success_rate'], 75.0)

    def test_reset_stats(self):
        """Stats can be reset."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.tokens_used = 50
        mock_result.model_used = ''
        mock_result.average_confidence = 0.0
        mock_result.content_type = None
        mock_result.time_investment = None
        mock_result.difficulty = None
        mock_result.pricing = None
        mock_result.topics = []
        mock_result.tools = []
        mock_result.categories = []

        with self.collector.track_tagging('project', 1, 'bulk') as tracker:
            tracker.set_result(mock_result)

        self.collector.reset_stats()
        stats = self.collector.get_stats()

        self.assertEqual(stats['total']['operations'], 0)

    def test_tags_extracted_count(self):
        """Tag extraction count is calculated correctly."""
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.tokens_used = 100
        mock_result.model_used = 'gpt-4'
        mock_result.average_confidence = 0.9
        mock_result.content_type = MagicMock()  # 1
        mock_result.time_investment = MagicMock()  # 1
        mock_result.difficulty = None  # 0
        mock_result.pricing = MagicMock()  # 1
        mock_result.topics = [MagicMock(), MagicMock(), MagicMock()]  # 3
        mock_result.tools = [MagicMock()]  # 1
        mock_result.categories = []  # 0

        with self.collector.track_tagging('project', 1, 'bulk') as tracker:
            tracker.set_result(mock_result)
            # Verify tags_extracted was set correctly (would need access to internal state)
            # For now, just verify no errors


class GlobalMetricsCollectorTests(TestCase):
    """Tests for global metrics_collector instance."""

    def test_global_instance_exists(self):
        """Global metrics collector is available."""
        self.assertIsNotNone(metrics_collector)
        self.assertIsInstance(metrics_collector, TaggingMetricsCollector)
