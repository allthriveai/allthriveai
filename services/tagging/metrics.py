"""
Observability and metrics for the tagging service.

Provides structured logging, timing, and counters for monitoring
tagging operations, AI usage, and error rates.
"""

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cache keys for metrics
METRICS_PREFIX = 'tagging:metrics'
COUNTER_TTL = 86400  # 24 hours


@dataclass
class TaggingMetrics:
    """Container for tagging operation metrics."""

    content_type: str
    content_id: str | int
    tier: Literal['bulk', 'premium']
    success: bool
    duration_ms: int = 0
    tokens_used: int = 0
    model_used: str = ''
    confidence: float = 0.0
    tags_extracted: int = 0
    error: str | None = None
    timestamp: datetime = field(default_factory=timezone.now)

    def to_log_dict(self) -> dict[str, Any]:
        """Convert to structured log format."""
        return {
            'event': 'tagging_operation',
            'content_type': self.content_type,
            'content_id': str(self.content_id),
            'tier': self.tier,
            'success': self.success,
            'duration_ms': self.duration_ms,
            'tokens_used': self.tokens_used,
            'model': self.model_used,
            'confidence': round(self.confidence, 3),
            'tags_extracted': self.tags_extracted,
            'error': self.error,
            'timestamp': self.timestamp.isoformat(),
        }


class TaggingMetricsCollector:
    """
    Collects and reports metrics for tagging operations.

    Usage:
        collector = TaggingMetricsCollector()

        # Track a tagging operation
        with collector.track_tagging('project', 123, 'bulk') as tracker:
            result = service.tag_content(content)
            tracker.set_result(result)

        # Get aggregated stats
        stats = collector.get_stats()
    """

    def __init__(self):
        self._cache_prefix = METRICS_PREFIX

    @contextmanager
    def track_tagging(
        self,
        content_type: str,
        content_id: str | int,
        tier: Literal['bulk', 'premium'] = 'bulk',
    ):
        """
        Context manager to track a tagging operation.

        Args:
            content_type: Type of content being tagged
            content_id: ID of the content
            tier: Tagging tier (bulk or premium)

        Yields:
            Tracker object with set_result() method
        """
        start_time = time.time()

        metrics = TaggingMetrics(
            content_type=content_type,
            content_id=content_id,
            tier=tier,
            success=False,
        )

        class Tracker:
            def set_result(self, result: Any):
                """Set the tagging result."""
                if result and hasattr(result, 'success'):
                    metrics.success = result.success
                    if result.success:
                        metrics.tokens_used = getattr(result, 'tokens_used', 0)
                        metrics.model_used = getattr(result, 'model_used', '')
                        metrics.confidence = getattr(result, 'average_confidence', 0.0)
                        # Count extracted tags
                        tag_count = 0
                        for field_name in [
                            'content_type',
                            'time_investment',
                            'difficulty',
                            'pricing',
                        ]:
                            if getattr(result, field_name, None):
                                tag_count += 1
                        for field_name in ['topics', 'tools', 'categories']:
                            tag_count += len(getattr(result, field_name, []))
                        metrics.tags_extracted = tag_count
                    else:
                        metrics.error = getattr(result, 'error', 'Unknown error')

            def mark_error(self, error: str):
                """Mark the operation as failed."""
                metrics.success = False
                metrics.error = error

            def mark_skipped(self, reason: str):
                """Mark the operation as skipped."""
                metrics.success = True  # Skipped is not an error
                metrics.error = f'skipped: {reason}'

        tracker = Tracker()

        try:
            yield tracker
        except Exception as e:
            tracker.mark_error(str(e))
            raise
        finally:
            metrics.duration_ms = int((time.time() - start_time) * 1000)
            self._record_metrics(metrics)

    def _record_metrics(self, metrics: TaggingMetrics):
        """Record metrics to logs and counters."""
        # Structured logging
        log_data = metrics.to_log_dict()
        if metrics.success:
            logger.info(
                f'Tagging completed: {metrics.content_type}/{metrics.content_id} '
                f'tier={metrics.tier} confidence={metrics.confidence:.2f} '
                f'tags={metrics.tags_extracted} duration={metrics.duration_ms}ms',
                extra=log_data,
            )
        else:
            logger.warning(
                f'Tagging failed: {metrics.content_type}/{metrics.content_id} '
                f'tier={metrics.tier} error={metrics.error} duration={metrics.duration_ms}ms',
                extra=log_data,
            )

        # Update counters
        self._increment_counter(f'{metrics.content_type}:total')
        if metrics.success:
            self._increment_counter(f'{metrics.content_type}:success')
            self._increment_counter(f'tier:{metrics.tier}:success')
        else:
            self._increment_counter(f'{metrics.content_type}:failure')
            self._increment_counter(f'tier:{metrics.tier}:failure')

        # Track tokens
        if metrics.tokens_used > 0:
            self._increment_counter(f'{metrics.content_type}:tokens', metrics.tokens_used)
            self._increment_counter(f'tier:{metrics.tier}:tokens', metrics.tokens_used)

        # Track latency buckets
        latency_bucket = self._get_latency_bucket(metrics.duration_ms)
        self._increment_counter(f'latency:{latency_bucket}')

    def _get_latency_bucket(self, duration_ms: int) -> str:
        """Get latency bucket for histogram-style tracking."""
        if duration_ms < 500:
            return 'fast'
        elif duration_ms < 2000:
            return 'normal'
        elif duration_ms < 5000:
            return 'slow'
        else:
            return 'very_slow'

    def _increment_counter(self, key: str, amount: int = 1):
        """Increment a counter in cache."""
        full_key = f'{self._cache_prefix}:{key}'
        try:
            cache.incr(full_key, amount)
        except ValueError:
            # Key doesn't exist, create it
            cache.set(full_key, amount, COUNTER_TTL)

    def _get_counter(self, key: str) -> int:
        """Get a counter value from cache."""
        full_key = f'{self._cache_prefix}:{key}'
        return cache.get(full_key, 0)

    def get_stats(self) -> dict[str, Any]:
        """
        Get aggregated tagging statistics.

        Returns:
            Dict with success rates, token usage, and latency distribution
        """
        content_types = ['project', 'quiz', 'tool', 'micro_lesson']
        tiers = ['bulk', 'premium']

        stats = {
            'by_content_type': {},
            'by_tier': {},
            'latency_distribution': {},
            'total': {
                'operations': 0,
                'success': 0,
                'failure': 0,
                'tokens': 0,
            },
        }

        # Per content type stats
        for ctype in content_types:
            total = self._get_counter(f'{ctype}:total')
            success = self._get_counter(f'{ctype}:success')
            failure = self._get_counter(f'{ctype}:failure')
            tokens = self._get_counter(f'{ctype}:tokens')

            if total > 0:
                stats['by_content_type'][ctype] = {
                    'total': total,
                    'success': success,
                    'failure': failure,
                    'success_rate': round(success / total * 100, 1),
                    'tokens': tokens,
                }
                stats['total']['operations'] += total
                stats['total']['success'] += success
                stats['total']['failure'] += failure
                stats['total']['tokens'] += tokens

        # Per tier stats
        for tier in tiers:
            success = self._get_counter(f'tier:{tier}:success')
            failure = self._get_counter(f'tier:{tier}:failure')
            tokens = self._get_counter(f'tier:{tier}:tokens')
            total = success + failure

            if total > 0:
                stats['by_tier'][tier] = {
                    'total': total,
                    'success': success,
                    'failure': failure,
                    'success_rate': round(success / total * 100, 1),
                    'tokens': tokens,
                }

        # Latency distribution
        for bucket in ['fast', 'normal', 'slow', 'very_slow']:
            count = self._get_counter(f'latency:{bucket}')
            if count > 0:
                stats['latency_distribution'][bucket] = count

        # Overall success rate
        if stats['total']['operations'] > 0:
            stats['total']['success_rate'] = round(stats['total']['success'] / stats['total']['operations'] * 100, 1)
        else:
            stats['total']['success_rate'] = 0.0

        return stats

    def reset_stats(self):
        """Reset all counters (useful for testing)."""
        content_types = ['project', 'quiz', 'tool', 'micro_lesson']
        tiers = ['bulk', 'premium']
        latency_buckets = ['fast', 'normal', 'slow', 'very_slow']

        keys_to_delete = []
        for ctype in content_types:
            keys_to_delete.extend(
                [
                    f'{self._cache_prefix}:{ctype}:total',
                    f'{self._cache_prefix}:{ctype}:success',
                    f'{self._cache_prefix}:{ctype}:failure',
                    f'{self._cache_prefix}:{ctype}:tokens',
                ]
            )
        for tier in tiers:
            keys_to_delete.extend(
                [
                    f'{self._cache_prefix}:tier:{tier}:success',
                    f'{self._cache_prefix}:tier:{tier}:failure',
                    f'{self._cache_prefix}:tier:{tier}:tokens',
                ]
            )
        for bucket in latency_buckets:
            keys_to_delete.append(f'{self._cache_prefix}:latency:{bucket}')

        cache.delete_many(keys_to_delete)


# Global collector instance
metrics_collector = TaggingMetricsCollector()
