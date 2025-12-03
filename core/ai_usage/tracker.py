"""
AI Usage Tracker

Centralized tracking of all AI API usage with automatic cost calculation.
"""

import hashlib
import logging
import time
from contextlib import contextmanager
from decimal import Decimal
from typing import Any

from django.db.models import F

from .models import AIProviderPricing, AIUsageLog, UserAICostSummary

logger = logging.getLogger(__name__)


def anonymize_user_id(user_id: int) -> str:
    """
    Hash user ID for privacy-safe logging.

    Args:
        user_id: User ID to anonymize

    Returns:
        12-character hash of the user ID
    """
    return hashlib.sha256(f'{user_id}'.encode()).hexdigest()[:12]


class AIUsageTracker:
    """
    Centralized AI usage tracking with automatic cost calculation.

    Usage:
        # Simple tracking
        AIUsageTracker.track_usage(
            user=request.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            input_tokens=100,
            output_tokens=50
        )

        # With context manager (auto timing)
        with AIUsageTracker.track_ai_request(user, 'chat', 'openai', 'gpt-4') as tracker:
            response = call_openai_api(...)
            tracker.set_tokens(response.usage.prompt_tokens, response.usage.completion_tokens)
    """

    @staticmethod
    def get_current_pricing(provider: str, model: str) -> AIProviderPricing | None:
        """
        Get the current active pricing for a provider/model.

        Args:
            provider: AI provider name (e.g., 'openai', 'anthropic')
            model: Model name (e.g., 'gpt-4', 'claude-3-opus')

        Returns:
            AIProviderPricing instance or None if not found
        """
        return (
            AIProviderPricing.objects.filter(provider=provider, model=model, is_active=True)
            .order_by('-effective_date')
            .first()
        )

    @staticmethod
    def calculate_cost(
        provider: str, model: str, input_tokens: int, output_tokens: int
    ) -> tuple[Decimal, Decimal, Decimal, AIProviderPricing | None]:
        """
        Calculate costs for an AI request.

        Args:
            provider: AI provider name
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Tuple of (input_cost, output_cost, total_cost, pricing_version)
        """
        pricing = AIUsageTracker.get_current_pricing(provider, model)

        if not pricing:
            logger.warning(f'No pricing found for {provider}/{model}, using $0')
            return Decimal('0'), Decimal('0'), Decimal('0'), None

        # Calculate costs (pricing is per 1M tokens)
        input_cost = (Decimal(str(input_tokens)) / Decimal('1000000')) * pricing.input_price_per_million
        output_cost = (Decimal(str(output_tokens)) / Decimal('1000000')) * pricing.output_price_per_million
        total_cost = input_cost + output_cost

        return input_cost, output_cost, total_cost, pricing

    @staticmethod
    def track_usage(
        user,
        feature: str,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        request_type: str = 'completion',
        latency_ms: int | None = None,
        status: str = 'success',
        error_message: str = '',
        request_metadata: dict[str, Any] | None = None,
        response_metadata: dict[str, Any] | None = None,
        session_id: str = '',
    ) -> AIUsageLog:
        """
        Track a single AI usage event with automatic cost calculation.

        Args:
            user: Django User instance
            feature: Feature name (e.g., 'chat', 'project_generation', 'ai_mentor')
            provider: AI provider (e.g., 'openai', 'anthropic')
            model: Model name (e.g., 'gpt-4', 'claude-3-opus')
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            request_type: Type of request ('completion', 'chat', 'embedding', etc.)
            latency_ms: Request latency in milliseconds
            status: Request status ('success', 'error', 'timeout', 'rate_limited')
            error_message: Error message if status != 'success'
            request_metadata: Additional request metadata
            response_metadata: Additional response metadata
            session_id: Session ID for tracking user sessions

        Returns:
            AIUsageLog instance
        """
        # Calculate costs
        input_cost, output_cost, total_cost, pricing = AIUsageTracker.calculate_cost(
            provider, model, input_tokens, output_tokens
        )

        total_tokens = input_tokens + output_tokens

        # Create usage log
        usage_log = AIUsageLog.objects.create(
            user=user,
            session_id=session_id,
            feature=feature,
            request_type=request_type,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            input_cost=input_cost,
            output_cost=output_cost,
            total_cost=total_cost,
            pricing_version=pricing,
            latency_ms=latency_ms,
            status=status,
            error_message=error_message,
            request_metadata=request_metadata or {},
            response_metadata=response_metadata or {},
        )

        # Update daily summary (async or real-time)
        try:
            AIUsageTracker.update_daily_summary(user, usage_log)
        except Exception as e:
            logger.error(f'Error updating daily summary: {e}')

        # Log for monitoring (with anonymized user ID for privacy)
        logger.info(
            f'AI Usage: user_hash={anonymize_user_id(user.id)}, feature={feature}, provider={provider}/{model}, '
            f'tokens={total_tokens}, cost=${total_cost:.6f}, status={status}'
        )

        return usage_log

    @staticmethod
    @contextmanager
    def track_ai_request(
        user, feature: str, provider: str, model: str, request_type: str = 'completion', session_id: str = ''
    ):
        """
        Context manager for tracking AI requests with automatic timing.

        Usage:
            with AIUsageTracker.track_ai_request(user, 'chat', 'openai', 'gpt-4') as tracker:
                response = call_openai(...)
                tracker.set_tokens(response.usage.prompt_tokens, response.usage.completion_tokens)
                tracker.set_metadata(response_meta={'finish_reason': response.choices[0].finish_reason})

        Args:
            user: Django User instance
            feature: Feature name
            provider: AI provider
            model: Model name
            request_type: Type of request
            session_id: Session ID

        Yields:
            Tracker object with methods: set_tokens(), set_metadata(), mark_error()
        """
        start_time = time.time()

        tracker_data = {
            'input_tokens': 0,
            'output_tokens': 0,
            'status': 'success',
            'error_message': '',
            'request_metadata': {},
            'response_metadata': {},
        }

        class Tracker:
            def set_tokens(self, input_tokens: int, output_tokens: int):
                """Set token counts for the request."""
                tracker_data['input_tokens'] = input_tokens
                tracker_data['output_tokens'] = output_tokens

            def set_metadata(self, request_meta: dict = None, response_meta: dict = None):
                """Set additional metadata for the request/response."""
                if request_meta:
                    tracker_data['request_metadata'].update(request_meta)
                if response_meta:
                    tracker_data['response_metadata'].update(response_meta)

            def mark_error(self, error_message: str, status: str = 'error'):
                """Mark the request as failed."""
                tracker_data['status'] = status
                tracker_data['error_message'] = error_message

        tracker = Tracker()

        try:
            yield tracker
        except Exception as e:
            tracker.mark_error(str(e))
            raise
        finally:
            latency_ms = int((time.time() - start_time) * 1000)

            AIUsageTracker.track_usage(
                user=user,
                feature=feature,
                provider=provider,
                model=model,
                request_type=request_type,
                session_id=session_id,
                latency_ms=latency_ms,
                **tracker_data,
            )

    @staticmethod
    def update_daily_summary(user, usage_log: AIUsageLog):
        """
        Update the daily cost summary for a user.

        Args:
            user: Django User instance
            usage_log: AIUsageLog instance
        """
        summary, created = UserAICostSummary.objects.get_or_create(
            user=user,
            date=usage_log.created_at.date(),
            defaults={
                'total_requests': 0,
                'total_tokens': 0,
                'total_cost': Decimal('0'),
                'cost_by_feature': {},
                'cost_by_provider': {},
                'requests_by_feature': {},
            },
        )

        # Update aggregates using F() expressions for atomic updates
        summary.total_requests = F('total_requests') + 1
        summary.total_tokens = F('total_tokens') + usage_log.total_tokens
        summary.total_cost = F('total_cost') + usage_log.total_cost
        summary.save()

        # Refresh to get actual values for JSON updates
        summary.refresh_from_db()

        # Update feature breakdown
        feature_costs = summary.cost_by_feature
        feature_costs[usage_log.feature] = str(
            Decimal(feature_costs.get(usage_log.feature, '0')) + usage_log.total_cost
        )
        summary.cost_by_feature = feature_costs

        # Update provider breakdown
        provider_costs = summary.cost_by_provider
        provider_costs[usage_log.provider] = str(
            Decimal(provider_costs.get(usage_log.provider, '0')) + usage_log.total_cost
        )
        summary.cost_by_provider = provider_costs

        # Update request count by feature
        requests_by_feature = summary.requests_by_feature
        requests_by_feature[usage_log.feature] = requests_by_feature.get(usage_log.feature, 0) + 1
        summary.requests_by_feature = requests_by_feature

        summary.save()

    @staticmethod
    def get_user_monthly_cost(user, year: int = None, month: int = None) -> Decimal:
        """
        Get total AI cost for a user in a given month.

        Args:
            user: Django User instance
            year: Year (defaults to current year)
            month: Month (defaults to current month)

        Returns:
            Total cost as Decimal
        """
        return UserAICostSummary.get_user_monthly_cost(user, year, month)

    @staticmethod
    def check_user_budget(user, monthly_budget: Decimal) -> tuple[bool, Decimal, Decimal]:
        """
        Check if user has exceeded their monthly budget.

        Args:
            user: Django User instance
            monthly_budget: Budget in USD

        Returns:
            Tuple of (is_over_budget, current_cost, remaining_budget)
        """
        current_cost = AIUsageTracker.get_user_monthly_cost(user)
        remaining = monthly_budget - current_cost
        is_over = current_cost > monthly_budget

        if is_over:
            logger.warning(
                f'User {anonymize_user_id(user.id)} exceeded monthly AI budget: ${current_cost} > ${monthly_budget}'
            )

        return is_over, current_cost, remaining

    @staticmethod
    def get_cau(days: int = 30, start_date=None, end_date=None) -> dict:
        """
        Get Cost per Active User (CAU) for a date range.

        Active User = any user who made at least 1 AI request in the period.
        CAU = Total AI Cost / Number of Active Users

        Args:
            days: Number of days to look back (default: 30)
            start_date: Optional explicit start date
            end_date: Optional explicit end date

        Returns:
            dict with CAU metrics: {
                'cau': Decimal,
                'total_cost': Decimal,
                'active_users': int,
                'avg_cost_per_user': Decimal,
                'period_days': int,
                'start_date': date,
                'end_date': date
            }

        Example:
            # Get CAU for last 30 days
            cau_data = AIUsageTracker.get_cau(days=30)
            print(f"CAU (30d): ${cau_data['cau']:.2f}")
            print(f"Active Users: {cau_data['active_users']}")
            print(f"Total Cost: ${cau_data['total_cost']:.2f}")
        """
        return UserAICostSummary.get_cau(days=days, start_date=start_date, end_date=end_date)
