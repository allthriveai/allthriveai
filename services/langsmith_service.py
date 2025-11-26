"""
LangSmith Integration Service - AI Gateway Observability

This service provides:
1. LangSmith tracing for all AI operations
2. Cost tracking and analytics
3. Performance monitoring
4. Prompt version management
5. User attribution and spend limits
"""

import logging
import os
from datetime import datetime, timedelta
from functools import wraps
from typing import Any

from django.conf import settings
from django.core.cache import cache
from langsmith import Client

logger = logging.getLogger(__name__)


class LangSmithService:
    """Centralized LangSmith service for AI gateway observability."""

    def __init__(self):
        self.enabled = settings.LANGSMITH_TRACING_ENABLED and settings.LANGSMITH_API_KEY

        if self.enabled:
            # Set environment variables for LangSmith auto-instrumentation
            os.environ['LANGCHAIN_TRACING_V2'] = 'true'
            os.environ['LANGCHAIN_API_KEY'] = settings.LANGSMITH_API_KEY
            os.environ['LANGCHAIN_PROJECT'] = settings.LANGSMITH_PROJECT
            os.environ['LANGCHAIN_ENDPOINT'] = settings.LANGSMITH_ENDPOINT

            self.client = Client(
                api_key=settings.LANGSMITH_API_KEY,
                api_url=settings.LANGSMITH_ENDPOINT,
            )
            logger.info(f'LangSmith initialized for project: {settings.LANGSMITH_PROJECT}')
        else:
            self.client = None
            logger.warning('LangSmith tracing disabled - set LANGSMITH_API_KEY to enable')

    def create_trace(
        self,
        name: str,
        run_type: str = 'chain',
        inputs: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        user_id: int | None = None,
    ):
        """
        Create a LangSmith trace context manager.

        Usage:
            with langsmith.create_trace("auth_chat", inputs={"message": msg}, user_id=123):
                # Your AI operation here
                response = agent.invoke(...)
        """
        if not self.enabled:
            # Return a no-op context manager
            from contextlib import nullcontext

            return nullcontext()

        # Add user attribution to metadata
        if metadata is None:
            metadata = {}
        if user_id:
            metadata['user_id'] = user_id
            metadata['user_attribution'] = True

        # Add environment metadata
        metadata['environment'] = os.getenv('ENVIRONMENT', 'development')
        metadata['ai_provider'] = settings.DEFAULT_AI_PROVIDER

        return self.client.trace(
            name=name,
            run_type=run_type,
            inputs=inputs or {},
            tags=tags or [],
            metadata=metadata,
        )

    def track_cost(
        self,
        user_id: int,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Track AI cost per user and check spend limits.

        Returns:
            dict with 'cost', 'total_tokens', 'limit_exceeded', 'daily_spend', 'monthly_spend'
        """
        # Calculate cost based on provider and model
        cost_per_1k_tokens = self._get_token_cost(provider, model)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (total_tokens / 1000) * cost_per_1k_tokens

        # Track daily and monthly spend
        today = datetime.utcnow().strftime('%Y-%m-%d')
        month = datetime.utcnow().strftime('%Y-%m')

        daily_key = f'ai_cost:user:{user_id}:daily:{today}'
        monthly_key = f'ai_cost:user:{user_id}:monthly:{month}'

        # Increment spend (cache with 25-hour TTL for daily, 32-day for monthly)
        daily_spend = cache.get(daily_key, 0.0) + cost_usd
        monthly_spend = cache.get(monthly_key, 0.0) + cost_usd

        cache.set(daily_key, daily_spend, timeout=60 * 60 * 25)  # 25 hours
        cache.set(monthly_key, monthly_spend, timeout=60 * 60 * 24 * 32)  # 32 days

        # Check limits
        daily_limit = settings.AI_USER_DAILY_SPEND_LIMIT_USD
        monthly_limit = settings.AI_MONTHLY_SPEND_LIMIT_USD

        limit_exceeded = daily_spend > daily_limit or monthly_spend > monthly_limit

        if limit_exceeded:
            logger.warning(
                f'User {user_id} exceeded spend limit: '
                f'daily=${daily_spend:.4f} (limit ${daily_limit}), '
                f'monthly=${monthly_spend:.4f} (limit ${monthly_limit})'
            )

        # Log to LangSmith if enabled
        if self.enabled and run_id:
            self.client.update_run(
                run_id=run_id,
                extra={
                    'cost_usd': cost_usd,
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens,
                    'total_tokens': total_tokens,
                    'daily_spend': daily_spend,
                    'monthly_spend': monthly_spend,
                },
            )

        return {
            'cost_usd': cost_usd,
            'total_tokens': total_tokens,
            'prompt_tokens': prompt_tokens,
            'completion_tokens': completion_tokens,
            'limit_exceeded': limit_exceeded,
            'daily_spend': daily_spend,
            'monthly_spend': monthly_spend,
            'daily_limit': daily_limit,
            'monthly_limit': monthly_limit,
        }

    def _get_token_cost(self, provider: str, model: str) -> float:
        """
        Get cost per 1K tokens for different providers/models.

        Pricing as of Jan 2025 (update regularly):
        - GPT-4 Turbo: $0.01/1K input, $0.03/1K output (avg $0.02)
        - GPT-3.5 Turbo: $0.0005/1K input, $0.0015/1K output (avg $0.001)
        - Claude 3.5 Sonnet: $0.003/1K input, $0.015/1K output (avg $0.009)
        - Claude 3 Haiku: $0.00025/1K input, $0.00125/1K output (avg $0.0006875)
        """
        costs = {
            'azure': {
                'gpt-4': 0.02,
                'gpt-4-turbo': 0.02,
                'gpt-35-turbo': 0.001,
            },
            'openai': {
                'gpt-4': 0.02,
                'gpt-4-turbo': 0.02,
                'gpt-4-turbo-preview': 0.02,
                'gpt-3.5-turbo': 0.001,
            },
            'anthropic': {
                'claude-3-5-sonnet-20241022': 0.009,
                'claude-3-sonnet': 0.009,
                'claude-3-haiku': 0.0006875,
            },
        }

        provider_costs = costs.get(provider.lower(), {})
        return provider_costs.get(model.lower(), 0.01)  # Default to $0.01/1K

    def get_user_analytics(self, user_id: int, days: int = 30) -> dict[str, Any]:
        """Get cost analytics for a specific user."""
        if not self.enabled:
            return {'error': 'LangSmith not enabled'}

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Query LangSmith for user's runs
        runs = self.client.list_runs(
            project_name=settings.LANGSMITH_PROJECT,
            filter=f'metadata.user_id = {user_id}',
            start_time=start_date,
            end_time=end_date,
        )

        total_cost = 0.0
        total_tokens = 0
        run_count = 0
        avg_latency = 0.0

        for run in runs:
            if run.extra:
                total_cost += run.extra.get('cost_usd', 0)
                total_tokens += run.extra.get('total_tokens', 0)
            if run.latency:
                avg_latency += run.latency
            run_count += 1

        if run_count > 0:
            avg_latency = avg_latency / run_count

        return {
            'user_id': user_id,
            'period_days': days,
            'total_cost_usd': round(total_cost, 4),
            'total_tokens': total_tokens,
            'total_requests': run_count,
            'avg_latency_ms': round(avg_latency * 1000, 2) if avg_latency else 0,
            'avg_cost_per_request': round(total_cost / run_count, 4) if run_count else 0,
        }

    def get_system_analytics(self, days: int = 7) -> dict[str, Any]:
        """Get system-wide analytics across all users."""
        if not self.enabled:
            return {'error': 'LangSmith not enabled'}

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        runs = self.client.list_runs(
            project_name=settings.LANGSMITH_PROJECT,
            start_time=start_date,
            end_time=end_date,
        )

        total_cost = 0.0
        total_tokens = 0
        run_count = 0
        error_count = 0
        providers = {}

        for run in runs:
            if run.extra:
                cost = run.extra.get('cost_usd', 0)
                total_cost += cost
                total_tokens += run.extra.get('total_tokens', 0)

                provider = run.extra.get('ai_provider', 'unknown')
                if provider not in providers:
                    providers[provider] = {'cost': 0, 'requests': 0}
                providers[provider]['cost'] += cost
                providers[provider]['requests'] += 1

            if run.error:
                error_count += 1
            run_count += 1

        return {
            'period_days': days,
            'total_cost_usd': round(total_cost, 4),
            'total_tokens': total_tokens,
            'total_requests': run_count,
            'error_count': error_count,
            'error_rate': round(error_count / run_count * 100, 2) if run_count else 0,
            'avg_cost_per_request': round(total_cost / run_count, 4) if run_count else 0,
            'providers': providers,
        }


# Global singleton instance
langsmith_service = LangSmithService()


def track_ai_cost(user_id: int | None = None):
    """
    Decorator to automatically track AI costs from LangChain responses.

    Usage:
        @track_ai_cost(user_id=request.user.id)
        async def my_ai_function():
            response = await llm.ainvoke(...)
            return response
    """

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)

            # Extract usage from response if available
            if hasattr(response, 'response_metadata'):
                usage = response.response_metadata.get('token_usage', {})
                if usage and user_id and settings.AI_COST_TRACKING_ENABLED:
                    langsmith_service.track_cost(
                        user_id=user_id,
                        provider=settings.DEFAULT_AI_PROVIDER,
                        model=getattr(response, 'model', 'unknown'),
                        prompt_tokens=usage.get('prompt_tokens', 0),
                        completion_tokens=usage.get('completion_tokens', 0),
                    )

            return response

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            response = func(*args, **kwargs)

            # Same logic for sync functions
            if hasattr(response, 'response_metadata'):
                usage = response.response_metadata.get('token_usage', {})
                if usage and user_id and settings.AI_COST_TRACKING_ENABLED:
                    langsmith_service.track_cost(
                        user_id=user_id,
                        provider=settings.DEFAULT_AI_PROVIDER,
                        model=getattr(response, 'model', 'unknown'),
                        prompt_tokens=usage.get('prompt_tokens', 0),
                        completion_tokens=usage.get('completion_tokens', 0),
                    )

            return response

        # Return appropriate wrapper based on function type
        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
