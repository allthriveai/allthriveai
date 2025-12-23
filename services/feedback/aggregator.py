"""
Feedback Aggregator Service.

Aggregates all human feedback signals to provide a unified view of user
preferences and learning patterns for the AI to adapt to.

This service is the central point for understanding:
- What explanations work well for this user
- When proactive help is appreciated vs. unwanted
- Which content types are most effective
- User's self-reported progress and blockers
"""

import logging
from datetime import timedelta
from typing import TypedDict

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cache settings
FEEDBACK_CACHE_TTL = 300  # 5 minutes
FEEDBACK_CONTEXT_CACHE_TTL = 60  # 1 minute for MemberContext (more frequently accessed)


class FeedbackPreferences(TypedDict):
    """User's inferred preferences from feedback."""

    prefers_simple_explanations: bool
    prefers_examples: bool
    prefers_detailed_theory: bool
    prefers_proactive_help: bool
    difficulty_sweet_spot: str  # 'too_easy' | 'just_right' | 'too_hard'
    best_content_types: list[str]
    problematic_topics: list[str]


class FeedbackInsights(TypedDict):
    """Aggregated insights from all feedback sources."""

    preferences: FeedbackPreferences
    recent_struggles: list[str]
    successful_patterns: list[str]
    current_blockers: list[str]
    satisfaction_trend: str  # 'improving' | 'stable' | 'declining'
    engagement_level: str  # 'high' | 'medium' | 'low'


class ProactiveStats(TypedDict):
    """Stats about proactive intervention effectiveness."""

    total_offers: int
    accepted_count: int
    declined_count: int
    acceptance_rate: float
    most_effective_type: str | None
    least_effective_type: str | None


class FeedbackAggregator:
    """
    Aggregates feedback from all sources to understand user preferences.

    Feeds into:
    - MemberContext for AI personalization
    - GapDetector for learning from feedback
    - Proactive intervention decisions
    """

    def __init__(self, user_id: int):
        self.user_id = user_id

    def get_feedback_summary(self, days: int = 30, use_cache: bool = True) -> dict:
        """
        Get a complete feedback summary for the user.

        Args:
            days: Number of days to look back for feedback
            use_cache: Whether to use cached results (default True)

        Returns a dict suitable for inclusion in MemberContext.
        """
        # Check cache first
        cache_key = f'feedback_summary:{self.user_id}:{days}'
        if use_cache:
            cached = cache.get(cache_key)
            if cached:
                return cached

        from core.learning_paths.models import (
            ContentHelpfulness,
            ConversationFeedback,
        )

        cutoff = timezone.now() - timedelta(days=days)

        # Conversation feedback analysis
        conv_feedback = ConversationFeedback.objects.filter(
            user_id=self.user_id,
            created_at__gte=cutoff,
        )

        helpful_count = conv_feedback.filter(feedback='helpful').count()
        total_conv = conv_feedback.count()

        # Analyze feedback patterns by context type
        feedback_by_context = (
            conv_feedback.values('context_type', 'feedback')
            .annotate(count=Count('id'))
            .order_by('context_type', '-count')
        )

        # Proactive offer analysis
        proactive_stats = self._get_proactive_stats(cutoff)

        # Content helpfulness analysis
        content_feedback = ContentHelpfulness.objects.filter(
            user_id=self.user_id,
            created_at__gte=cutoff,
        )

        # Find best content types
        best_content = (
            content_feedback.filter(helpfulness__in=['very_helpful', 'helpful'])
            .values('content_type')
            .annotate(count=Count('id'))
            .order_by('-count')[:3]
        )

        # Analyze difficulty perception
        difficulty_perceptions = (
            content_feedback.exclude(difficulty_perception__isnull=True)
            .values('difficulty_perception')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Goal check-in analysis
        goal_insights = self._get_goal_insights(cutoff)

        # Build preferences from patterns
        preferences = self._infer_preferences(
            conv_feedback,
            content_feedback,
            proactive_stats,
            difficulty_perceptions,
        )

        result = {
            'conversation': {
                'total': total_conv,
                'helpful_rate': (helpful_count / total_conv * 100) if total_conv > 0 else None,
                'by_context': list(feedback_by_context),
                'recent_negative': self._get_recent_negative_feedback(conv_feedback),
            },
            'proactive': proactive_stats,
            'content': {
                'best_types': [item['content_type'] for item in best_content],
                'difficulty_distribution': list(difficulty_perceptions),
            },
            'goals': goal_insights,
            'preferences': preferences,
            'last_updated': timezone.now().isoformat(),
        }

        # Cache the result
        cache.set(cache_key, result, FEEDBACK_CACHE_TTL)
        return result

    def _get_proactive_stats(self, cutoff) -> ProactiveStats:
        """Analyze proactive intervention effectiveness."""
        from core.learning_paths.models import ProactiveOfferResponse

        responses = ProactiveOfferResponse.objects.filter(
            user_id=self.user_id,
            offered_at__gte=cutoff,
        )

        total = responses.count()
        accepted = responses.filter(response__in=['accepted', 'helpful_after']).count()
        declined = responses.filter(response__in=['declined', 'not_helpful_after']).count()

        # Find most/least effective intervention types
        by_type = (
            responses.values('intervention_type')
            .annotate(
                total=Count('id'),
                accepted=Count('id', filter=Q(response__in=['accepted', 'helpful_after'])),
            )
            .order_by('-accepted')
        )

        most_effective = None
        least_effective = None
        if by_type:
            most_effective = by_type[0]['intervention_type'] if by_type[0]['accepted'] > 0 else None
            for item in reversed(list(by_type)):
                if item['total'] > 0 and item['accepted'] < item['total']:
                    least_effective = item['intervention_type']
                    break

        return {
            'total_offers': total,
            'accepted_count': accepted,
            'declined_count': declined,
            'acceptance_rate': (accepted / total * 100) if total > 0 else 0,
            'most_effective_type': most_effective,
            'least_effective_type': least_effective,
        }

    def _get_goal_insights(self, cutoff) -> dict:
        """Extract insights from goal check-ins."""
        from core.learning_paths.models import GoalCheckIn

        checkins = GoalCheckIn.objects.filter(
            user_id=self.user_id,
            created_at__gte=cutoff,
        ).order_by('-created_at')

        if not checkins.exists():
            return {
                'has_checkins': False,
                'last_checkin': None,
                'satisfaction_trend': None,
                'common_blockers': [],
                'what_helps': [],
            }

        last_checkin = checkins.first()

        # Aggregate blockers and what's working (TextField strings, not lists)
        all_blockers = []
        all_helpers = []
        satisfaction_scores = []

        satisfaction_map = {
            'very_satisfied': 5,
            'satisfied': 4,
            'neutral': 3,
            'unsatisfied': 2,
            'very_unsatisfied': 1,
        }

        for checkin in checkins[:10]:  # Last 10 check-ins
            # blockers and whats_working are TextFields, not arrays
            if checkin.blockers:
                all_blockers.append(checkin.blockers.strip())
            if checkin.whats_working:
                all_helpers.append(checkin.whats_working.strip())
            if checkin.satisfaction:
                satisfaction_scores.append(satisfaction_map.get(checkin.satisfaction, 3))

        # For TextFields, we just return the unique values
        # (no need for counting since each is a full text response)
        common_blockers = list(set(all_blockers))[:5]
        common_helpers = list(set(all_helpers))[:5]

        # Calculate satisfaction trend
        trend = 'stable'
        if len(satisfaction_scores) >= 3:
            recent_avg = sum(satisfaction_scores[:3]) / 3
            older_avg = (
                sum(satisfaction_scores[3:6]) / min(3, len(satisfaction_scores) - 3)
                if len(satisfaction_scores) > 3
                else recent_avg
            )
            if recent_avg > older_avg + 0.5:
                trend = 'improving'
            elif recent_avg < older_avg - 0.5:
                trend = 'declining'

        return {
            'has_checkins': True,
            'last_checkin': {
                'progress': last_checkin.progress,
                'satisfaction': last_checkin.satisfaction,
                'created_at': last_checkin.created_at.isoformat(),
            },
            'satisfaction_trend': trend,
            'common_blockers': common_blockers,
            'what_helps': common_helpers,
        }

    def _get_recent_negative_feedback(self, conv_feedback) -> list[dict]:
        """Get recent negative feedback for immediate attention."""
        negative = conv_feedback.filter(
            feedback__in=['not_helpful', 'confusing', 'incorrect', 'too_basic', 'too_advanced']
        ).order_by('-created_at')[:5]

        return [
            {
                'feedback': f.feedback,
                'context_type': f.context_type,
                'topic_slug': f.topic_slug,
                'comment': f.comment,
                'created_at': f.created_at.isoformat(),
            }
            for f in negative
        ]

    def _infer_preferences(
        self,
        conv_feedback,
        content_feedback,
        proactive_stats: ProactiveStats,
        difficulty_perceptions,
    ) -> FeedbackPreferences:
        """Infer user preferences from feedback patterns."""
        # Check if user finds things too complex (suggests preferring simple explanations)
        confusing_count = conv_feedback.filter(feedback='confusing').count()
        too_advanced_count = conv_feedback.filter(feedback='too_advanced').count()
        total_conv = conv_feedback.count() or 1

        prefers_simple = (confusing_count + too_advanced_count) / total_conv > 0.2

        # Check if examples were helpful
        example_helpful = content_feedback.filter(
            content_type__in=['project_example', 'tool_tutorial'],
            helpfulness__in=['very_helpful', 'helpful'],
        ).count()
        example_total = content_feedback.filter(content_type__in=['project_example', 'tool_tutorial']).count() or 1
        prefers_examples = example_helpful / example_total > 0.6

        # Check if detailed explanations work
        concept_helpful = content_feedback.filter(
            content_type='concept_explanation',
            helpfulness__in=['very_helpful', 'helpful'],
        ).count()
        concept_total = content_feedback.filter(content_type='concept_explanation').count() or 1
        prefers_theory = concept_helpful / concept_total > 0.6

        # Proactive help preference
        prefers_proactive = proactive_stats['acceptance_rate'] > 50

        # Difficulty sweet spot
        difficulty_sweet_spot = 'just_right'
        if difficulty_perceptions:
            top_perception = difficulty_perceptions[0] if difficulty_perceptions else None
            if top_perception:
                difficulty_sweet_spot = top_perception.get('difficulty_perception', 'just_right')

        # Best content types
        best_content_types = list(
            content_feedback.filter(helpfulness__in=['very_helpful', 'helpful'])
            .values_list('content_type', flat=True)
            .annotate(count=Count('id'))
            .order_by('-count')[:3]
        )

        # Problematic topics (topics with negative feedback)
        problematic_topics = list(
            conv_feedback.filter(feedback__in=['confusing', 'incorrect', 'too_advanced'])
            .exclude(topic_slug='')
            .values_list('topic_slug', flat=True)
            .distinct()[:5]
        )

        return {
            'prefers_simple_explanations': prefers_simple,
            'prefers_examples': prefers_examples,
            'prefers_detailed_theory': prefers_theory,
            'prefers_proactive_help': prefers_proactive,
            'difficulty_sweet_spot': difficulty_sweet_spot,
            'best_content_types': best_content_types,
            'problematic_topics': problematic_topics,
        }

    def get_for_member_context(self) -> dict:
        """
        Get a concise feedback summary suitable for MemberContext.

        Returns only the most relevant information to avoid bloating context.
        """
        full_summary = self.get_feedback_summary(days=30)

        # Extract the most actionable information
        return {
            'preferences': full_summary['preferences'],
            'proactive_acceptance_rate': full_summary['proactive']['acceptance_rate'],
            'satisfaction_trend': full_summary['goals'].get('satisfaction_trend'),
            'current_blockers': full_summary['goals'].get('common_blockers', [])[:3],
            'recent_struggles': [
                f['topic_slug'] for f in full_summary['conversation'].get('recent_negative', []) if f.get('topic_slug')
            ][:3],
        }

    async def get_for_member_context_async(self) -> dict:
        """Async version of get_for_member_context."""
        from asgiref.sync import sync_to_async

        return await sync_to_async(self.get_for_member_context)()


def get_user_feedback_summary(user_id: int, days: int = 30) -> dict:
    """Convenience function to get feedback summary for a user."""
    aggregator = FeedbackAggregator(user_id)
    return aggregator.get_feedback_summary(days)


async def get_user_feedback_for_context(user_id: int) -> dict:
    """Async convenience function for MemberContext integration."""
    aggregator = FeedbackAggregator(user_id)
    return await aggregator.get_for_member_context_async()


def invalidate_feedback_cache(user_id: int) -> None:
    """
    Invalidate cached feedback for a user.

    Call this after new feedback is submitted to ensure fresh data.
    """
    # Clear all days variants (30 is the default)
    for days in [7, 14, 30, 60, 90]:
        cache_key = f'feedback_summary:{user_id}:{days}'
        cache.delete(cache_key)
