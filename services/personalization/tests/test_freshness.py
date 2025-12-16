"""
Unit tests for FreshnessService.

Tests content freshness tracking, deprioritization, exploration scoring,
and soft shuffling for the explore feed.
"""

import time
from dataclasses import dataclass
from unittest.mock import patch

import pytest

from services.personalization.freshness import FreshnessService

# =============================================================================
# Test Fixtures and Helpers
# =============================================================================


@dataclass
class MockScoredProject:
    """Mock scored project for testing."""

    project_id: int
    total_score: float


def create_scored_projects(scores: list[tuple[int, float]]) -> list[MockScoredProject]:
    """Create list of mock scored projects from (id, score) tuples."""
    return [MockScoredProject(project_id=pid, total_score=score) for pid, score in scores]


# =============================================================================
# Redis Key Tests
# =============================================================================


class TestRedisKey:
    """Test cache key generation."""

    def test_key_format(self):
        """Key should use correct format."""
        key = FreshnessService._get_key(123)
        assert key == 'freshness:served:123'

    def test_key_with_different_user_ids(self):
        """Different users should have different keys."""
        key1 = FreshnessService._get_key(1)
        key2 = FreshnessService._get_key(2)
        assert key1 != key2
        assert '1' in key1
        assert '2' in key2


# =============================================================================
# Record Served Projects Tests
# =============================================================================


class TestRecordServedProjects:
    """Test recording served projects to cache."""

    @patch('services.personalization.freshness.cache')
    def test_records_projects_with_timestamp(self, mock_cache):
        """Projects should be recorded with current timestamp."""
        mock_cache.get.return_value = {}

        FreshnessService.record_served_projects(user_id=1, project_ids=[10, 20, 30])

        # Verify cache.set was called
        mock_cache.set.assert_called_once()
        call_args = mock_cache.set.call_args
        key, data, ttl = call_args[0]

        assert key == 'freshness:served:1'
        assert '10' in data
        assert '20' in data
        assert '30' in data
        assert ttl == FreshnessService.TTL_SECONDS

    @patch('services.personalization.freshness.cache')
    def test_merges_with_existing_data(self, mock_cache):
        """New projects should merge with existing tracked projects."""
        existing_data = {'5': time.time() - 100, '6': time.time() - 200}
        mock_cache.get.return_value = existing_data

        FreshnessService.record_served_projects(user_id=1, project_ids=[10, 20])

        call_args = mock_cache.set.call_args
        _, data, _ = call_args[0]

        # Should have both old and new projects
        assert '5' in data
        assert '6' in data
        assert '10' in data
        assert '20' in data

    @patch('services.personalization.freshness.cache')
    def test_trims_to_max_tracked(self, mock_cache):
        """Should keep only MAX_TRACKED most recent projects."""
        # Create existing data with MAX_TRACKED projects
        old_time = time.time() - 3600
        existing_data = {str(i): old_time for i in range(FreshnessService.MAX_TRACKED)}
        mock_cache.get.return_value = existing_data

        # Add new projects
        FreshnessService.record_served_projects(user_id=1, project_ids=[9999, 9998])

        call_args = mock_cache.set.call_args
        _, data, _ = call_args[0]

        # Should be trimmed to MAX_TRACKED
        assert len(data) == FreshnessService.MAX_TRACKED
        # New projects should be kept (they have newer timestamps)
        assert '9999' in data
        assert '9998' in data

    @patch('services.personalization.freshness.cache')
    def test_no_op_with_empty_project_ids(self, mock_cache):
        """Should not call cache with empty project list."""
        FreshnessService.record_served_projects(user_id=1, project_ids=[])
        mock_cache.get.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch('services.personalization.freshness.cache')
    def test_no_op_with_no_user_id(self, mock_cache):
        """Should not call cache without user ID."""
        FreshnessService.record_served_projects(user_id=None, project_ids=[1, 2, 3])
        mock_cache.get.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch('services.personalization.freshness.cache')
    def test_handles_cache_exception(self, mock_cache):
        """Should handle cache exceptions gracefully."""
        mock_cache.get.side_effect = Exception('Redis connection error')

        # Should not raise
        FreshnessService.record_served_projects(user_id=1, project_ids=[10])


# =============================================================================
# Get Recently Served Tests
# =============================================================================


class TestGetRecentlyServed:
    """Test retrieving recently served projects."""

    @patch('services.personalization.freshness.cache')
    def test_returns_projects_within_time_window(self, mock_cache):
        """Should return projects served within max_age_seconds."""
        now = time.time()
        mock_cache.get.return_value = {
            '10': now - 100,  # 100 seconds ago - within default 30 min
            '20': now - 1000,  # ~16 min ago - within default 30 min
            '30': now - 2000,  # ~33 min ago - outside default 30 min
        }

        result = FreshnessService.get_recently_served(user_id=1)

        assert 10 in result
        assert 20 in result
        assert 30 not in result

    @patch('services.personalization.freshness.cache')
    def test_custom_max_age(self, mock_cache):
        """Should respect custom max_age_seconds."""
        now = time.time()
        mock_cache.get.return_value = {
            '10': now - 100,  # 100 seconds ago
            '20': now - 500,  # 500 seconds ago
        }

        # Only 200 seconds window
        result = FreshnessService.get_recently_served(user_id=1, max_age_seconds=200)

        assert 10 in result
        assert 20 not in result

    @patch('services.personalization.freshness.cache')
    def test_returns_empty_set_for_no_user(self, mock_cache):
        """Should return empty set when no user ID."""
        result = FreshnessService.get_recently_served(user_id=None)
        assert result == set()
        mock_cache.get.assert_not_called()

    @patch('services.personalization.freshness.cache')
    def test_returns_empty_set_on_cache_miss(self, mock_cache):
        """Should return empty set when cache has no data."""
        mock_cache.get.return_value = None

        result = FreshnessService.get_recently_served(user_id=1)

        assert result == set()

    @patch('services.personalization.freshness.cache')
    def test_handles_cache_exception(self, mock_cache):
        """Should return empty set on cache exception."""
        mock_cache.get.side_effect = Exception('Redis error')

        result = FreshnessService.get_recently_served(user_id=1)

        assert result == set()


# =============================================================================
# Calculate Deprioritization Tests
# =============================================================================


class TestCalculateDeprioritization:
    """Test deprioritization penalty calculation."""

    @patch('services.personalization.freshness.cache')
    def test_full_penalty_for_very_recent(self, mock_cache):
        """Projects served < 30 min ago get full penalty."""
        mock_cache.get.return_value = {'10': time.time() - 60}  # 1 minute ago

        penalty = FreshnessService.calculate_deprioritization(user_id=1, project_id=10)

        assert penalty == FreshnessService.DEPRIORITIZATION_PENALTY

    @patch('services.personalization.freshness.cache')
    def test_reduced_penalty_for_1_hour_ago(self, mock_cache):
        """Projects served 30min-2hrs ago get 60% penalty."""
        mock_cache.get.return_value = {'10': time.time() - 3600}  # 1 hour ago

        penalty = FreshnessService.calculate_deprioritization(user_id=1, project_id=10)

        expected = FreshnessService.DEPRIORITIZATION_PENALTY * 0.6
        assert penalty == expected

    @patch('services.personalization.freshness.cache')
    def test_minimal_penalty_for_3_hours_ago(self, mock_cache):
        """Projects served 2-4hrs ago get 30% penalty."""
        mock_cache.get.return_value = {'10': time.time() - 10800}  # 3 hours ago

        penalty = FreshnessService.calculate_deprioritization(user_id=1, project_id=10)

        expected = FreshnessService.DEPRIORITIZATION_PENALTY * 0.3
        assert penalty == expected

    @patch('services.personalization.freshness.cache')
    def test_no_penalty_for_old_projects(self, mock_cache):
        """Projects served > 4hrs ago get no penalty."""
        mock_cache.get.return_value = {'10': time.time() - 18000}  # 5 hours ago

        penalty = FreshnessService.calculate_deprioritization(user_id=1, project_id=10)

        assert penalty == 0.0

    @patch('services.personalization.freshness.cache')
    def test_no_penalty_for_unserved_project(self, mock_cache):
        """Projects not in cache get no penalty."""
        mock_cache.get.return_value = {'20': time.time()}  # Different project

        penalty = FreshnessService.calculate_deprioritization(user_id=1, project_id=10)

        assert penalty == 0.0

    @patch('services.personalization.freshness.cache')
    def test_no_penalty_without_user(self, mock_cache):
        """Should return 0 without user ID."""
        penalty = FreshnessService.calculate_deprioritization(user_id=None, project_id=10)
        assert penalty == 0.0
        mock_cache.get.assert_not_called()


# =============================================================================
# Exploration Score Tests
# =============================================================================


class TestCalculateExplorationScore:
    """Test deterministic exploration scoring."""

    def test_returns_float_between_0_and_1(self):
        """Score should be in [0, 1] range."""
        for pid in range(1, 100):
            score = FreshnessService.calculate_exploration_score(pid, 'test-token')
            assert 0.0 <= score <= 1.0

    def test_deterministic_same_inputs(self):
        """Same project + token should always return same score."""
        score1 = FreshnessService.calculate_exploration_score(123, 'token-abc')
        score2 = FreshnessService.calculate_exploration_score(123, 'token-abc')

        assert score1 == score2

    def test_different_tokens_different_scores(self):
        """Different tokens should produce different scores for same project."""
        score1 = FreshnessService.calculate_exploration_score(123, 'token-1')
        score2 = FreshnessService.calculate_exploration_score(123, 'token-2')

        # Very unlikely to be exactly equal with different tokens
        assert score1 != score2

    def test_different_projects_different_scores(self):
        """Different projects should have different scores with same token."""
        score1 = FreshnessService.calculate_exploration_score(1, 'same-token')
        score2 = FreshnessService.calculate_exploration_score(2, 'same-token')

        assert score1 != score2

    def test_neutral_score_without_token(self):
        """Should return 0.5 (neutral) without token."""
        score = FreshnessService.calculate_exploration_score(123, None)
        assert score == 0.5

        score = FreshnessService.calculate_exploration_score(123, '')
        assert score == 0.5

    def test_distribution_is_reasonably_uniform(self):
        """Scores should be roughly uniformly distributed."""
        scores = [FreshnessService.calculate_exploration_score(i, 'test-token') for i in range(1000)]

        # Check distribution across quartiles
        q1 = sum(1 for s in scores if s < 0.25)
        q2 = sum(1 for s in scores if 0.25 <= s < 0.5)
        q3 = sum(1 for s in scores if 0.5 <= s < 0.75)
        q4 = sum(1 for s in scores if s >= 0.75)

        # Each quartile should have roughly 25% (allow ±10%)
        for count in [q1, q2, q3, q4]:
            assert 150 < count < 350  # 15%-35% tolerance


# =============================================================================
# Soft Shuffle Tests
# =============================================================================


class TestApplySoftShuffle:
    """Test soft shuffling of similarly-scored projects."""

    def test_maintains_order_for_different_scores(self):
        """Projects with different scores should maintain relative order."""
        projects = create_scored_projects(
            [
                (1, 1.0),
                (2, 0.7),
                (3, 0.4),
                (4, 0.1),
            ]
        )

        result = FreshnessService.apply_soft_shuffle(projects, 'token', score_attr='total_score', tolerance=0.10)

        # First should still be first, last should still be last
        assert result[0].project_id == 1
        assert result[-1].project_id == 4

    def test_shuffles_similar_scores(self):
        """Projects within tolerance should be shuffled."""
        # All projects have score 1.0 - should be shuffled
        projects = create_scored_projects(
            [
                (1, 1.0),
                (2, 1.0),
                (3, 1.0),
                (4, 1.0),
            ]
        )

        # Try multiple tokens to see if order changes
        results = []
        for i in range(10):
            result = FreshnessService.apply_soft_shuffle(
                projects.copy(), f'token-{i}', score_attr='total_score', tolerance=0.10
            )
            results.append([p.project_id for p in result])

        # With same scores, different tokens should produce different orders
        unique_orders = len(set(tuple(r) for r in results))
        assert unique_orders > 1  # Should have at least 2 different orders

    def test_deterministic_with_same_token(self):
        """Same token should produce same shuffle order."""
        projects = create_scored_projects(
            [
                (1, 1.0),
                (2, 1.0),
                (3, 1.0),
            ]
        )

        result1 = FreshnessService.apply_soft_shuffle(
            projects.copy(), 'fixed-token', score_attr='total_score', tolerance=0.10
        )
        result2 = FreshnessService.apply_soft_shuffle(
            projects.copy(), 'fixed-token', score_attr='total_score', tolerance=0.10
        )

        order1 = [p.project_id for p in result1]
        order2 = [p.project_id for p in result2]
        assert order1 == order2

    def test_returns_empty_for_empty_list(self):
        """Should handle empty list."""
        result = FreshnessService.apply_soft_shuffle([], 'token')
        assert result == []

    def test_returns_original_without_token(self):
        """Should return original list without token."""
        projects = create_scored_projects([(1, 1.0), (2, 0.9)])

        result = FreshnessService.apply_soft_shuffle(projects, None)

        assert result == projects

    def test_respects_tolerance_parameter(self):
        """Tolerance should control grouping window."""
        # Projects with 10% score difference
        projects = create_scored_projects(
            [
                (1, 1.0),
                (2, 0.95),  # 5% diff from 1.0
                (3, 0.85),  # 15% diff from 1.0
            ]
        )

        # With 10% tolerance, 1 and 2 should group, but not 3
        result = FreshnessService.apply_soft_shuffle(projects, 'token', score_attr='total_score', tolerance=0.10)

        # Project 3 should remain in position 3 (not grouped with 1,2)
        assert result[2].project_id == 3


# =============================================================================
# Apply Freshness to Scores Tests
# =============================================================================


class TestApplyFreshnessToScores:
    """Test combined freshness application."""

    @patch('services.personalization.freshness.FreshnessService.get_recently_served')
    @patch('services.personalization.freshness.FreshnessService.calculate_deprioritization')
    def test_applies_exploration_adjustment(self, mock_deprioritization, mock_recently_served):
        """Should add exploration adjustment to scores."""
        mock_recently_served.return_value = set()
        mock_deprioritization.return_value = 0

        projects = create_scored_projects([(1, 0.5), (2, 0.5)])

        result = FreshnessService.apply_freshness_to_scores(projects, user_id=1, freshness_token='token')

        # Scores should be modified (exploration adds +/- EXPLORATION_WEIGHT)
        for p in result:
            assert p.total_score != 0.5  # Should be adjusted

    @patch('services.personalization.freshness.FreshnessService.get_recently_served')
    @patch('services.personalization.freshness.FreshnessService.calculate_deprioritization')
    def test_applies_deprioritization(self, mock_deprioritization, mock_recently_served):
        """Should subtract deprioritization penalty."""
        mock_recently_served.return_value = {1}  # Project 1 was recently served
        mock_deprioritization.return_value = 0.25

        projects = create_scored_projects([(1, 1.0)])

        result = FreshnessService.apply_freshness_to_scores(projects, user_id=1, freshness_token='token')

        # Score should be reduced by penalty (plus/minus exploration adjustment)
        assert result[0].total_score < 1.0

    def test_handles_empty_list(self):
        """Should handle empty project list."""
        result = FreshnessService.apply_freshness_to_scores([], user_id=1, freshness_token='token')
        assert result == []

    @patch('services.personalization.freshness.FreshnessService.get_recently_served')
    def test_anonymous_user_no_deprioritization(self, mock_recently_served):
        """Anonymous users should get exploration but not deprioritization."""
        projects = create_scored_projects([(1, 0.5)])

        FreshnessService.apply_freshness_to_scores(projects, user_id=None, freshness_token='token')

        # Should not call get_recently_served for anonymous users
        mock_recently_served.assert_not_called()

    def test_no_changes_without_token(self):
        """Without token, scores should remain unchanged."""
        projects = create_scored_projects([(1, 0.5), (2, 0.7)])
        original_scores = [(p.project_id, p.total_score) for p in projects]

        result = FreshnessService.apply_freshness_to_scores(projects, user_id=1, freshness_token=None)

        for i, p in enumerate(result):
            assert p.total_score == original_scores[i][1]


# =============================================================================
# Integration Tests
# =============================================================================


@pytest.mark.django_db
class TestFreshnessIntegration:
    """Integration tests with Django cache."""

    def test_full_workflow(self, settings):
        """Test full record -> retrieve -> deprioritize workflow."""
        # Use locmem cache for testing
        settings.CACHES = {
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            }
        }

        from django.core.cache import cache

        cache.clear()

        user_id = 999
        project_ids = [100, 200, 300]

        # Record served projects
        FreshnessService.record_served_projects(user_id, project_ids)

        # Retrieve recently served
        recently_served = FreshnessService.get_recently_served(user_id)
        assert 100 in recently_served
        assert 200 in recently_served
        assert 300 in recently_served

        # Check deprioritization
        penalty = FreshnessService.calculate_deprioritization(user_id, 100)
        assert penalty == FreshnessService.DEPRIORITIZATION_PENALTY  # Full penalty (just served)

        # Unknown project should have no penalty
        penalty_unknown = FreshnessService.calculate_deprioritization(user_id, 999)
        assert penalty_unknown == 0.0

    def test_pagination_consistency(self):
        """Same token should give consistent ordering across pagination."""
        # Simulate page 1 and page 2 with same token
        all_projects = create_scored_projects([(i, 1.0) for i in range(20)])
        token = 'pagination-test-token'

        # Apply freshness to all
        FreshnessService.apply_freshness_to_scores(all_projects, user_id=None, freshness_token=token)
        all_projects.sort(key=lambda x: x.total_score, reverse=True)

        page1 = all_projects[:10]
        page2 = all_projects[10:]

        # Repeat with fresh objects but same token
        all_projects_2 = create_scored_projects([(i, 1.0) for i in range(20)])
        FreshnessService.apply_freshness_to_scores(all_projects_2, user_id=None, freshness_token=token)
        all_projects_2.sort(key=lambda x: x.total_score, reverse=True)

        page1_repeat = all_projects_2[:10]
        page2_repeat = all_projects_2[10:]

        # Same token should give same order
        assert [p.project_id for p in page1] == [p.project_id for p in page1_repeat]
        assert [p.project_id for p in page2] == [p.project_id for p in page2_repeat]
