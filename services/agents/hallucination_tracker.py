"""
Lightweight Hallucination Tracking - Optimized for Speed

ZERO user-facing latency - runs async in background after response sent.
Admin-only reporting via Django admin or analytics dashboard.

Design principles:
- Fire-and-forget pattern (no blocking)
- Celery tasks for heavy processing
- Minimal DB writes (batch inserts)
- Redis cache for real-time metrics
"""

import logging
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)


class ConfidenceLevel(str, Enum):
    """Simplified confidence levels."""

    HIGH = 'high'  # 80-100%
    MEDIUM = 'medium'  # 60-79%
    LOW = 'low'  # 40-59%
    UNCERTAIN = 'uncertain'  # 0-39%


@dataclass
class QuickCheck:
    """Lightweight confidence check result."""

    level: ConfidenceLevel
    score: float
    flags: list[str]  # Quick issues found
    timestamp: datetime


class FastHallucinationTracker:
    """
    Ultra-fast hallucination tracker - no user latency impact.

    Usage:
        # In streaming view - fire and forget
        tracker.track_response_async(
            response=full_response,
            tool_outputs=tool_outputs,
            session_id=session_id,
            user_id=user_id,
        )
    """

    # Quick pattern checks (compiled once for speed)
    OVERCONFIDENT = re.compile(r'\b(definitely|certainly|always|never|100%|guaranteed)\b', re.IGNORECASE)
    FABRICATED = re.compile(r'\b(I (found|discovered|detected) \d+|according to my analysis)\b', re.IGNORECASE)

    def __init__(self):
        self.cache = cache

    def quick_check(
        self,
        response: str,
        tool_outputs: list[dict[str, Any]] = None,
    ) -> QuickCheck:
        """
        Fast confidence check - runs in <10ms.

        Only checks:
        1. Response length (truncated = bad)
        2. Overconfident patterns
        3. Fabrication patterns
        4. Tool output alignment

        Returns confidence score + flags (no detailed analysis).
        """
        score = 100.0
        flags = []

        # Check 1: Response too short or empty
        if not response or len(response.strip()) < 10:
            score -= 30
            flags.append('empty_response')

        # Check 2: Overconfident language
        if self.OVERCONFIDENT.search(response):
            score -= 15
            flags.append('overconfident')

        # Check 3: Fabricated data patterns
        if self.FABRICATED.search(response):
            score -= 20
            flags.append('possible_fabrication')

        # Check 4: Tool output alignment (simple check)
        if tool_outputs:
            # Quick check: does response mention ANY data from tools?
            tool_data_found = False
            for output in tool_outputs:
                if isinstance(output, dict):
                    # Check if any tool values appear in response
                    for value in output.values():
                        if isinstance(value, str | int | float):
                            if str(value) in response:
                                tool_data_found = True
                                break
                if tool_data_found:
                    break

            if not tool_data_found and len(response) > 50:
                # Long response with no tool data = suspicious
                score -= 10
                flags.append('no_tool_citation')
        else:
            # No tools called but response is detailed = possibly making things up
            if len(response) > 100:
                score -= 5
                flags.append('no_tools_used')

        # Determine level
        score = max(0, min(100, score))
        if score >= 80:
            level = ConfidenceLevel.HIGH
        elif score >= 60:
            level = ConfidenceLevel.MEDIUM
        elif score >= 40:
            level = ConfidenceLevel.LOW
        else:
            level = ConfidenceLevel.UNCERTAIN

        return QuickCheck(
            level=level,
            score=score / 100.0,  # Normalize to 0-1
            flags=flags,
            timestamp=datetime.now(),
        )

    def track_response_async(
        self,
        response: str,
        tool_outputs: list[dict[str, Any]] = None,
        session_id: str = None,
        user_id: int = None,
        feature: str = 'project_agent',
        metadata: dict[str, Any] = None,
    ):
        """
        Fire-and-forget tracking - runs in background.

        Usage:
            tracker.track_response_async(...)
            # Returns immediately, processing happens async
        """
        # Quick sync check first (fast)
        check = self.quick_check(response, tool_outputs)

        # Store in cache for real-time dashboard (fast)
        self._cache_metrics(session_id, check, feature)

        # Queue background task for DB insert (slow, non-blocking)
        self._queue_db_insert(
            response=response,
            check=check,
            tool_outputs=tool_outputs,
            session_id=session_id,
            user_id=user_id,
            feature=feature,
            metadata=metadata,
        )

        # Log if concerning (for immediate alerts)
        if check.level in [ConfidenceLevel.LOW, ConfidenceLevel.UNCERTAIN]:
            logger.warning(
                f'[HALLUCINATION_RISK] {feature} - Score: {check.score:.2f} - Flags: {check.flags}',
                extra={
                    'session_id': session_id,
                    'user_id': user_id,
                    'confidence_level': check.level.value,
                    'confidence_score': check.score,
                    'flags': check.flags,
                },
            )

    def _cache_metrics(self, session_id: str, check: QuickCheck, feature: str):
        """Store metrics in Redis for real-time dashboard."""
        if not session_id:
            return

        # Store session result
        cache_key = f'hallucination:session:{session_id}'
        self.cache.set(cache_key, asdict(check), timeout=3600)  # 1 hour

        # Update rolling counters for dashboard
        today = datetime.now().strftime('%Y-%m-%d')

        # Increment total responses
        total_key = f'hallucination:daily:{today}:total'
        self.cache.incr(total_key)
        self.cache.expire(total_key, 86400 * 7)  # 7 days

        # Increment by level
        level_key = f'hallucination:daily:{today}:level:{check.level.value}'
        self.cache.incr(level_key)
        self.cache.expire(level_key, 86400 * 7)

        # Increment by feature
        feature_key = f'hallucination:daily:{today}:feature:{feature}'
        self.cache.incr(feature_key)
        self.cache.expire(feature_key, 86400 * 7)

        # Track flags
        for flag in check.flags:
            flag_key = f'hallucination:daily:{today}:flag:{flag}'
            self.cache.incr(flag_key)
            self.cache.expire(flag_key, 86400 * 7)

    def _queue_db_insert(
        self,
        response: str,
        check: QuickCheck,
        tool_outputs: list[dict[str, Any]],
        session_id: str,
        user_id: int,
        feature: str,
        metadata: dict[str, Any],
    ):
        """Queue Celery task for DB insert (non-blocking)."""
        try:
            # Import here to avoid circular dependency
            from services.agents.tasks import save_hallucination_metrics

            # Queue async task (returns immediately)
            save_hallucination_metrics.delay(
                response_text=response[:1000],  # Truncate for storage
                confidence_level=check.level.value,
                confidence_score=check.score,
                flags=check.flags,
                tool_outputs=tool_outputs or [],
                session_id=session_id,
                user_id=user_id,
                feature=feature,
                metadata=metadata or {},
            )
        except Exception as e:
            # Non-critical - just log and continue
            logger.warning(f'Failed to queue hallucination metrics: {e}')

    def get_dashboard_metrics(self, days: int = 7) -> dict[str, Any]:
        """
        Get metrics for admin dashboard.

        Returns:
            {
                'total_responses': 1234,
                'by_level': {'high': 980, 'medium': 200, 'low': 50, 'uncertain': 4},
                'by_feature': {'project_agent': 1000, 'auth_chat': 234},
                'common_flags': [('overconfident', 45), ('no_tool_citation', 23), ...],
                'hallucination_rate': 0.04,  # % uncertain
            }
        """
        from datetime import timedelta

        metrics = {
            'total_responses': 0,
            'by_level': {level.value: 0 for level in ConfidenceLevel},
            'by_feature': {},
            'common_flags': [],
            'hallucination_rate': 0.0,
        }

        # Aggregate from Redis cache
        today = datetime.now()
        for i in range(days):
            date = (today - timedelta(days=i)).strftime('%Y-%m-%d')

            # Total
            total_key = f'hallucination:daily:{date}:total'
            daily_total = self.cache.get(total_key, 0)
            metrics['total_responses'] += daily_total

            # By level
            for level in ConfidenceLevel:
                level_key = f'hallucination:daily:{date}:level:{level.value}'
                count = self.cache.get(level_key, 0)
                metrics['by_level'][level.value] += count

        # Calculate hallucination rate
        if metrics['total_responses'] > 0:
            uncertain_count = metrics['by_level']['uncertain']
            metrics['hallucination_rate'] = uncertain_count / metrics['total_responses']

        return metrics


# Singleton instance
tracker = FastHallucinationTracker()
