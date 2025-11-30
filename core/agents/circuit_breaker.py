"""
Circuit Breaker pattern for OpenAI/LLM API calls.

Prevents cascading failures when the LLM API is down or slow.
Falls back to cached responses or graceful degradation.
"""

import logging
import time
from collections.abc import Callable
from enum import Enum
from functools import wraps
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""

    CLOSED = 'closed'  # Normal operation
    OPEN = 'open'  # Failing, reject requests
    HALF_OPEN = 'half_open'  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker for external API calls.

    States:
    - CLOSED: Normal operation, all requests go through
    - OPEN: Too many failures, reject requests immediately
    - HALF_OPEN: After timeout, allow one request to test recovery

    Configuration:
    - failure_threshold: Number of failures before opening circuit (default: 5)
    - recovery_timeout: Seconds to wait before entering half-open state (default: 60)
    - success_threshold: Number of successes needed to close circuit (default: 2)
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        # Cache keys
        self.state_key = f'circuit_breaker:{name}:state'
        self.failure_count_key = f'circuit_breaker:{name}:failures'
        self.success_count_key = f'circuit_breaker:{name}:successes'
        self.last_failure_key = f'circuit_breaker:{name}:last_failure'

    def _get_state(self) -> CircuitState:
        """Get current circuit state"""
        state_str = cache.get(self.state_key, CircuitState.CLOSED.value)
        return CircuitState(state_str)

    def _set_state(self, state: CircuitState):
        """Set circuit state"""
        cache.set(self.state_key, state.value, timeout=None)

    def _get_failure_count(self) -> int:
        """Get current failure count"""
        return cache.get(self.failure_count_key, 0)

    def _increment_failures(self):
        """Increment failure counter"""
        count = self._get_failure_count()
        cache.set(self.failure_count_key, count + 1, timeout=300)  # 5 min TTL
        cache.set(self.last_failure_key, time.time(), timeout=300)

    def _reset_failures(self):
        """Reset failure counter"""
        cache.delete(self.failure_count_key)
        cache.delete(self.last_failure_key)

    def _get_success_count(self) -> int:
        """Get success count in half-open state"""
        return cache.get(self.success_count_key, 0)

    def _increment_successes(self):
        """Increment success counter"""
        count = self._get_success_count()
        cache.set(self.success_count_key, count + 1, timeout=300)

    def _reset_successes(self):
        """Reset success counter"""
        cache.delete(self.success_count_key)

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt recovery"""
        last_failure_time = cache.get(self.last_failure_key, 0)
        if not last_failure_time:
            return True

        time_since_failure = time.time() - last_failure_time
        return time_since_failure >= self.recovery_timeout

    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Function to call
            *args, **kwargs: Arguments to pass to function

        Returns:
            Function result

        Raises:
            CircuitBreakerOpenError: If circuit is open
            Original exception from func if it fails
        """
        state = self._get_state()

        # OPEN state: reject request
        if state == CircuitState.OPEN:
            if self._should_attempt_reset():
                logger.info(f'[CIRCUIT_BREAKER] {self.name}: Entering half-open state')
                self._set_state(CircuitState.HALF_OPEN)
                self._reset_successes()
            else:
                logger.warning(f'[CIRCUIT_BREAKER] {self.name}: Circuit open, rejecting request')
                raise CircuitBreakerOpenError(f'Circuit breaker {self.name} is OPEN')

        # Execute function
        try:
            result = func(*args, **kwargs)

            # Track success
            state = self._get_state()  # Re-check state
            if state == CircuitState.HALF_OPEN:
                self._increment_successes()
                if self._get_success_count() >= self.success_threshold:
                    logger.info(f'[CIRCUIT_BREAKER] {self.name}: Closing circuit (recovered)')
                    self._set_state(CircuitState.CLOSED)
                    self._reset_failures()
                    self._reset_successes()
            elif state == CircuitState.CLOSED:
                # Reset failure count on success
                self._reset_failures()

            return result

        except Exception as e:
            # Track failure
            logger.error(f'[CIRCUIT_BREAKER] {self.name}: Call failed: {e}')
            self._increment_failures()

            state = self._get_state()
            if state == CircuitState.HALF_OPEN:
                # Failed during recovery test
                logger.warning(f'[CIRCUIT_BREAKER] {self.name}: Opening circuit (recovery failed)')
                self._set_state(CircuitState.OPEN)
                self._reset_successes()
            elif state == CircuitState.CLOSED:
                # Check if threshold exceeded
                if self._get_failure_count() >= self.failure_threshold:
                    logger.warning(f'[CIRCUIT_BREAKER] {self.name}: Opening circuit (threshold exceeded)')
                    self._set_state(CircuitState.OPEN)

            raise


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""

    pass


# Decorator for easy usage
def with_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    fallback: Callable | None = None,
):
    """
    Decorator to protect function with circuit breaker.

    Args:
        name: Unique name for this circuit breaker
        failure_threshold: Number of failures before opening
        recovery_timeout: Seconds to wait before retry
        fallback: Function to call when circuit is open (optional)

    Example:
        @with_circuit_breaker(
            name='openai_api',
            failure_threshold=5,
            recovery_timeout=60,
            fallback=lambda: "I'm currently experiencing issues. Please try again later."
        )
        def call_openai_api(prompt):
            return openai.ChatCompletion.create(...)
    """
    breaker = CircuitBreaker(name, failure_threshold, recovery_timeout)

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return breaker.call(func, *args, **kwargs)
            except CircuitBreakerOpenError:
                logger.warning(f'[CIRCUIT_BREAKER] Using fallback for {name}')
                if fallback:
                    return fallback(*args, **kwargs)
                raise

        return wrapper

    return decorator


# Global circuit breakers for common services
openai_circuit_breaker = CircuitBreaker(
    name='openai_api',
    failure_threshold=5,
    recovery_timeout=60,
    success_threshold=2,
)

langraph_circuit_breaker = CircuitBreaker(
    name='langraph_agent',
    failure_threshold=3,
    recovery_timeout=30,
    success_threshold=2,
)


def get_cached_faq_response() -> str:
    """
    Fallback response when circuit is open.

    Returns cached FAQ response or generic message.
    """
    # TODO: Implement actual FAQ cache
    return (
        "I'm currently experiencing technical difficulties. "
        'Here are some helpful resources:\n\n'
        "- To add a project, click the 'Add Project' button in your profile\n"
        '- For GitHub imports, connect your account in Settings\n'
        '- For support, visit our help center\n\n'
        'Please try again in a few moments.'
    )
