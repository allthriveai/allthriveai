"""
Prometheus metrics for AI chat agents

Tracks:
- Message throughput (messages/sec)
- LLM response latency (p50, p95, p99)
- Intent detection performance
- Rate limit hits
- Circuit breaker state
"""

import time

from prometheus_client import Counter, Gauge, Histogram

# Message counters
messages_total = Counter('allthrive_chat_messages_total', 'Total number of chat messages', ['intent', 'user_id'])

messages_by_intent = Counter('allthrive_chat_messages_by_intent', 'Chat messages by detected intent', ['intent'])

# Response time metrics
llm_response_time = Histogram(
    'allthrive_llm_response_seconds',
    'LLM response time in seconds',
    ['provider', 'model'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

intent_detection_time = Histogram(
    'allthrive_intent_detection_seconds', 'Intent detection time in seconds', buckets=[0.05, 0.1, 0.2, 0.5, 1.0]
)

# Rate limiting
rate_limit_hits = Counter('allthrive_rate_limit_hits_total', 'Number of rate limit hits', ['user_id', 'limit_type'])

rate_limit_remaining = Gauge('allthrive_rate_limit_remaining', 'Remaining requests before rate limit', ['user_id'])

# Circuit breaker
circuit_breaker_state = Gauge(
    'allthrive_circuit_breaker_state', 'Circuit breaker state (0=closed, 1=open, 2=half-open)', ['service']
)

circuit_breaker_failures = Counter(
    'allthrive_circuit_breaker_failures_total', 'Circuit breaker failure count', ['service']
)

# Cache metrics
cache_hits = Counter('allthrive_cache_hits_total', 'Cache hit count', ['cache_type'])

cache_misses = Counter('allthrive_cache_misses_total', 'Cache miss count', ['cache_type'])

# Active conversations
active_conversations = Gauge('allthrive_active_conversations', 'Number of active conversations')

# Token usage (for cost tracking)
tokens_used = Counter('allthrive_tokens_used_total', 'Total tokens used', ['provider', 'model', 'token_type'])


class MetricsCollector:
    """Helper class for collecting metrics"""

    @staticmethod
    def record_message(intent: str, user_id: int):
        """Record a chat message"""
        messages_total.labels(intent=intent, user_id=str(user_id)).inc()
        messages_by_intent.labels(intent=intent).inc()

    @staticmethod
    def record_llm_response(provider: str, model: str, duration: float):
        """Record LLM response time"""
        llm_response_time.labels(provider=provider, model=model).observe(duration)

    @staticmethod
    def record_intent_detection(duration: float):
        """Record intent detection time"""
        intent_detection_time.observe(duration)

    @staticmethod
    def record_rate_limit_hit(user_id: int, limit_type: str):
        """Record rate limit hit"""
        rate_limit_hits.labels(user_id=str(user_id), limit_type=limit_type).inc()

    @staticmethod
    def update_rate_limit_remaining(user_id: int, remaining: int):
        """Update remaining rate limit"""
        rate_limit_remaining.labels(user_id=str(user_id)).set(remaining)

    @staticmethod
    def update_circuit_breaker_state(service: str, state: int):
        """Update circuit breaker state (0=closed, 1=open, 2=half-open)"""
        circuit_breaker_state.labels(service=service).set(state)

    @staticmethod
    def record_circuit_breaker_failure(service: str):
        """Record circuit breaker failure"""
        circuit_breaker_failures.labels(service=service).inc()

    @staticmethod
    def record_cache_hit(cache_type: str):
        """Record cache hit"""
        cache_hits.labels(cache_type=cache_type).inc()

    @staticmethod
    def record_cache_miss(cache_type: str):
        """Record cache miss"""
        cache_misses.labels(cache_type=cache_type).inc()

    @staticmethod
    def update_active_conversations(count: int):
        """Update active conversation count"""
        active_conversations.set(count)

    @staticmethod
    def record_tokens(provider: str, model: str, token_type: str, count: int):
        """Record token usage"""
        tokens_used.labels(provider=provider, model=model, token_type=token_type).inc(count)


# Context manager for timing
class timed_metric:
    """Context manager for timing operations"""

    def __init__(self, metric, **labels):
        self.metric = metric
        self.labels = labels
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        if self.labels:
            self.metric.labels(**self.labels).observe(duration)
        else:
            self.metric.observe(duration)
