"""
Unit tests for hallucination tracking system.
"""

from datetime import datetime
from unittest.mock import patch

import pytest
from django.core.cache import cache

from services.agents.hallucination_tracker import ConfidenceLevel, FastHallucinationTracker, QuickCheck


@pytest.fixture
def tracker():
    """Create a fresh tracker instance for each test."""
    tracker = FastHallucinationTracker()
    # Clear cache before each test
    cache.clear()
    return tracker


class TestQuickCheck:
    """Test the fast confidence checking logic."""

    def test_high_confidence_with_tool_data(self, tracker):
        """Test that responses citing tool data get high confidence."""
        response = 'The project has 5 tasks and is 60% complete.'
        tool_outputs = [{'task_count': 5, 'completion': 0.6}]

        result = tracker.quick_check(response, tool_outputs)

        assert isinstance(result, QuickCheck)
        assert result.level == ConfidenceLevel.HIGH
        assert result.score >= 0.8
        assert len(result.flags) == 0

    def test_overconfident_language_penalty(self, tracker):
        """Test that overconfident language reduces score."""
        response = 'I definitely found 100% of the files and they are guaranteed to work perfectly.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert result.score < 0.8
        assert 'overconfident' in result.flags

    def test_fabricated_data_detection(self, tracker):
        """Test detection of potentially fabricated data patterns."""
        response = 'According to my analysis, I found 347 critical issues in the codebase.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert result.score < 0.8
        assert 'possible_fabrication' in result.flags

    def test_empty_response_handling(self, tracker):
        """Test that empty responses are flagged."""
        response = ''
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.UNCERTAIN
        assert 'empty_response' in result.flags
        assert result.score < 0.5

    def test_no_tool_citation_penalty(self, tracker):
        """Test penalty for long responses without tool data."""
        response = 'The project contains many files and has numerous features implemented.'
        tool_outputs = [{'file_count': 25}]  # Tool output doesn't match response content

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tool_citation' in result.flags

    def test_no_tools_used_warning(self, tracker):
        """Test warning when detailed response has no tool support."""
        response = 'The system has 10 components, 25 modules, and 150 functions with comprehensive error handling.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tools_used' in result.flags
        assert result.score < 1.0


class TestCacheMetrics:
    """Test Redis cache integration for metrics."""

    def test_cache_stores_session_result(self, tracker):
        """Test that session results are cached."""
        session_id = 'test-session-123'
        check = QuickCheck(level=ConfidenceLevel.HIGH, score=0.95, flags=[], timestamp=datetime.now())

        tracker._cache_metrics(session_id, check, 'project_agent')

        # Verify cache entry exists
        cache_key = f'hallucination:session:{session_id}'
        cached_data = cache.get(cache_key)
        assert cached_data is not None
        assert cached_data['level'] == ConfidenceLevel.HIGH.value
        assert cached_data['score'] == 0.95

    def test_cache_increments_daily_counters(self, tracker):
        """Test that daily metrics counters are incremented."""
        session_id = 'test-session-456'
        check = QuickCheck(level=ConfidenceLevel.MEDIUM, score=0.75, flags=['overconfident'], timestamp=datetime.now())

        tracker._cache_metrics(session_id, check, 'auth_chat')

        # Check daily counters
        today = datetime.now().strftime('%Y-%m-%d')
        total_key = f'hallucination:daily:{today}:total'
        level_key = f'hallucination:daily:{today}:level:{ConfidenceLevel.MEDIUM.value}'
        feature_key = f'hallucination:daily:{today}:feature:auth_chat'
        flag_key = f'hallucination:daily:{today}:flag:overconfident'

        assert cache.get(total_key) >= 1
        assert cache.get(level_key) >= 1
        assert cache.get(feature_key) >= 1
        assert cache.get(flag_key) >= 1


class TestTrackingIntegration:
    """Test the full tracking flow."""

    @patch('services.agents.hallucination_tracker.save_hallucination_metrics')
    def test_track_response_async_queues_task(self, mock_task, tracker):
        """Test that tracking queues a Celery task."""
        response = 'Created project successfully with 3 tasks.'
        tool_outputs = [{'project_id': 123, 'task_count': 3}]

        tracker.track_response_async(
            response=response,
            tool_outputs=tool_outputs,
            session_id='test-789',
            user_id=42,
            feature='project_agent',
            metadata={'project_id': 123},
        )

        # Verify Celery task was queued
        assert mock_task.delay.called
        call_args = mock_task.delay.call_args[1]
        assert call_args['session_id'] == 'test-789'
        assert call_args['user_id'] == 42
        assert call_args['feature'] == 'project_agent'
        assert call_args['response_text'] == response[:1000]

    @patch('services.agents.hallucination_tracker.save_hallucination_metrics')
    def test_tracking_failure_doesnt_raise(self, mock_task, tracker):
        """Test that tracking failures are silently logged."""
        mock_task.delay.side_effect = Exception('Celery connection failed')

        # Should not raise
        tracker.track_response_async(
            response='Test response',
            tool_outputs=[],
            session_id='test-error',
            user_id=1,
            feature='test',
        )


class TestDashboardMetrics:
    """Test dashboard metrics aggregation."""

    def test_get_dashboard_metrics_empty(self, tracker):
        """Test dashboard metrics with no data."""
        metrics = tracker.get_dashboard_metrics(days=1)

        assert metrics['total_responses'] == 0
        assert metrics['hallucination_rate'] == 0.0
        assert all(count == 0 for count in metrics['by_level'].values())

    def test_get_dashboard_metrics_with_data(self, tracker):
        """Test dashboard metrics with sample data."""
        # Create sample cache data
        today = datetime.now().strftime('%Y-%m-%d')
        cache.set(f'hallucination:daily:{today}:total', 100)
        cache.set(f'hallucination:daily:{today}:level:high', 80)
        cache.set(f'hallucination:daily:{today}:level:medium', 15)
        cache.set(f'hallucination:daily:{today}:level:low', 3)
        cache.set(f'hallucination:daily:{today}:level:uncertain', 2)

        metrics = tracker.get_dashboard_metrics(days=1)

        assert metrics['total_responses'] == 100
        assert metrics['by_level']['high'] == 80
        assert metrics['by_level']['uncertain'] == 2
        assert metrics['hallucination_rate'] == 0.02  # 2/100


class TestConfidenceLevelThresholds:
    """Test confidence level boundary conditions."""

    def test_confidence_level_boundaries(self, tracker):
        """Test that confidence levels are assigned correctly."""
        # High: 80-100%
        result_high = tracker.quick_check('Valid response with good data', [{'valid': True}])
        assert result_high.level == ConfidenceLevel.HIGH

        # Medium: 60-79%
        response_medium = 'Definitely correct but I found some issues'
        result_medium = tracker.quick_check(response_medium, [])
        assert result_medium.level in [ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW]

        # Uncertain: <40%
        response_uncertain = ''
        result_uncertain = tracker.quick_check(response_uncertain, [])
        assert result_uncertain.level == ConfidenceLevel.UNCERTAIN
