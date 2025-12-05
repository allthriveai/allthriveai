"""
Embedding generation service for Weaviate personalization.

Uses the AI gateway (Azure OpenAI or OpenAI based on DEFAULT_AI_PROVIDER setting)
for generating embeddings from project content, user preferences, and tool descriptions.

Includes circuit breaker pattern for resilience against API outages.
"""

import logging
import threading
import time
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    from core.projects.models import Project

    User = get_user_model()

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """
    Circuit breaker for external API calls.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failures exceeded threshold, requests fail fast
    - HALF_OPEN: Testing if service recovered

    After failure_threshold consecutive failures, circuit opens for
    recovery_timeout seconds. Then it enters half-open state where
    a single success closes the circuit, or a failure re-opens it.
    """

    CLOSED = 'closed'
    OPEN = 'open'
    HALF_OPEN = 'half_open'

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        name: str = 'circuit',
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.name = name
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time: float | None = None
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        with self._lock:
            if self._state == self.OPEN:
                # Check if recovery timeout has passed
                if self._last_failure_time and time.time() - self._last_failure_time > self.recovery_timeout:
                    self._state = self.HALF_OPEN
                    logger.info(f'Circuit breaker {self.name}: OPEN -> HALF_OPEN')
            return self._state

    def record_success(self) -> None:
        """Record a successful call."""
        with self._lock:
            self._failure_count = 0
            if self._state != self.CLOSED:
                logger.info(f'Circuit breaker {self.name}: {self._state} -> CLOSED')
                self._state = self.CLOSED

    def record_failure(self) -> None:
        """Record a failed call."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == self.HALF_OPEN:
                # Single failure in half-open state re-opens circuit
                self._state = self.OPEN
                logger.warning(f'Circuit breaker {self.name}: HALF_OPEN -> OPEN (failure in test)')
            elif self._failure_count >= self.failure_threshold:
                if self._state != self.OPEN:
                    logger.warning(f'Circuit breaker {self.name}: CLOSED -> OPEN (failures={self._failure_count})')
                    self._state = self.OPEN

    def can_execute(self) -> bool:
        """Check if a call should be allowed."""
        state = self.state  # Property handles OPEN -> HALF_OPEN transition
        return state in (self.CLOSED, self.HALF_OPEN)


class EmbeddingServiceError(Exception):
    """Base exception for embedding service errors."""

    pass


class CircuitOpenError(EmbeddingServiceError):
    """Raised when circuit breaker is open."""

    pass


class EmbeddingService:
    """
    Service for generating text embeddings using the AI gateway.

    Supports Azure OpenAI and OpenAI based on DEFAULT_AI_PROVIDER setting.

    Handles embedding generation for:
    - Projects (title + description + topics + tools + categories)
    - User profiles (tags + bio + behavioral summary)
    - Tools (name + description + use cases)

    Uses circuit breaker pattern to fail fast when the API is unavailable,
    preventing cascading failures and wasted API calls.

    Configuration:
    - DEFAULT_AI_PROVIDER: 'azure' or 'openai'
    - AZURE_OPENAI_EMBEDDING_DEPLOYMENT: Name of the embedding deployment in Azure
    - EMBEDDING_FALLBACK_TO_OPENAI: If True, falls back to OpenAI when Azure fails
    """

    # Shared circuit breaker for all embedding requests
    _circuit_breaker = CircuitBreaker(
        failure_threshold=5,  # Open after 5 consecutive failures
        recovery_timeout=60,  # Try again after 60 seconds
        name='ai_embeddings',
    )

    def __init__(self):
        self._client = None
        self._fallback_client = None
        self._provider = getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')
        self._enable_fallback = getattr(settings, 'EMBEDDING_FALLBACK_TO_OPENAI', False)
        self._using_fallback = False

        # Use Azure deployment name for Azure, regular model name for OpenAI
        if self._provider == 'azure':
            self.model = getattr(settings, 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small')
            self._fallback_model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')
        else:
            self.model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')
            self._fallback_model = None

    @property
    def client(self):
        """Lazy initialization of AI client based on DEFAULT_AI_PROVIDER."""
        if self._client is None:
            if self._provider == 'azure':
                from openai import AzureOpenAI

                api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', '')
                endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', '')
                api_version = getattr(settings, 'AZURE_OPENAI_API_VERSION', '2024-02-15-preview')

                if not api_key or not endpoint:
                    raise ValueError(
                        'Azure OpenAI credentials not configured for embeddings. '
                        'Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT.'
                    )
                self._client = AzureOpenAI(
                    api_key=api_key,
                    azure_endpoint=endpoint,
                    api_version=api_version,
                )
            else:
                # Fall back to direct OpenAI
                from openai import OpenAI

                api_key = getattr(settings, 'OPENAI_API_KEY', '')
                if not api_key:
                    raise ValueError('OPENAI_API_KEY not configured for embeddings')
                self._client = OpenAI(api_key=api_key)

        return self._client

    @property
    def fallback_client(self):
        """Lazy initialization of fallback OpenAI client (when Azure fails)."""
        if self._fallback_client is None and self._enable_fallback and self._provider == 'azure':
            from openai import OpenAI

            api_key = getattr(settings, 'OPENAI_API_KEY', '')
            if api_key:
                self._fallback_client = OpenAI(api_key=api_key)
                logger.info('Initialized OpenAI fallback client for embeddings')

        return self._fallback_client

    def _is_deployment_not_found_error(self, error: Exception) -> bool:
        """Check if the error is a 404 deployment not found error."""
        error_str = str(error).lower()
        return '404' in error_str or 'deploymentnotfound' in error_str or 'not found' in error_str

    @property
    def circuit_state(self) -> str:
        """Get current circuit breaker state for monitoring."""
        return self._circuit_breaker.state

    def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding vector for text.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector

        Raises:
            CircuitOpenError: If circuit breaker is open (API unavailable)
            EmbeddingServiceError: If embedding generation fails
        """
        if not text or not text.strip():
            logger.warning('Attempted to generate embedding for empty text')
            return []

        # Check circuit breaker before making API call
        if not self._circuit_breaker.can_execute():
            logger.warning(
                f'Circuit breaker OPEN for embeddings, failing fast '
                f'(recovery in {self._circuit_breaker.recovery_timeout}s)'
            )
            raise CircuitOpenError('OpenAI embedding API circuit breaker is open')

        # Truncate text if too long (max ~8000 tokens for embedding models)
        truncated_text = text[:30000]  # Rough character limit
        if len(text) > 30000:
            logger.info(f'Truncated embedding text from {len(text)} to 30000 chars')

        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=truncated_text,
            )

            # Success - record it
            self._circuit_breaker.record_success()
            self._using_fallback = False
            return response.data[0].embedding

        except CircuitOpenError:
            raise  # Re-raise circuit open errors
        except Exception as e:
            # Check if we should try fallback for deployment not found errors
            if self._is_deployment_not_found_error(e) and self.fallback_client is not None:
                logger.warning(f'Azure deployment "{self.model}" not found, falling back to OpenAI: {e}')
                try:
                    response = self.fallback_client.embeddings.create(
                        model=self._fallback_model,
                        input=truncated_text,
                    )
                    self._circuit_breaker.record_success()
                    self._using_fallback = True
                    logger.info(f'Fallback to OpenAI {self._fallback_model} successful')
                    return response.data[0].embedding
                except Exception as fallback_error:
                    logger.error(f'Fallback to OpenAI also failed: {fallback_error}')
                    # Continue to record failure and raise original error

            # Record failure for circuit breaker
            self._circuit_breaker.record_failure()
            logger.error(
                f'Failed to generate embedding: {e}',
                extra={
                    'model': self.model,
                    'provider': self._provider,
                    'text_length': len(text) if text else 0,
                    'circuit_state': self._circuit_breaker.state,
                },
                exc_info=True,
            )
            raise EmbeddingServiceError(f'Embedding generation failed: {e}') from e

    def generate_batch_embeddings(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts in a batch.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors

        Raises:
            CircuitOpenError: If circuit breaker is open (API unavailable)
            EmbeddingServiceError: If embedding generation fails
        """
        if not texts:
            return []

        # Check circuit breaker before making API call
        if not self._circuit_breaker.can_execute():
            logger.warning('Circuit breaker OPEN for batch embeddings, failing fast')
            raise CircuitOpenError('OpenAI embedding API circuit breaker is open')

        # Filter out empty texts and track indices
        valid_texts = []
        valid_indices = []
        for i, text in enumerate(texts):
            if text and text.strip():
                valid_texts.append(text[:30000])
                valid_indices.append(i)

        if not valid_texts:
            return [[] for _ in texts]

        def _create_embeddings(client, model):
            """Helper to create embeddings and map results."""
            response = client.embeddings.create(
                model=model,
                input=valid_texts,
            )
            result = [[] for _ in texts]
            for i, embedding_data in enumerate(response.data):
                original_idx = valid_indices[i]
                result[original_idx] = embedding_data.embedding
            return result

        try:
            result = _create_embeddings(self.client, self.model)
            self._circuit_breaker.record_success()
            self._using_fallback = False
            return result

        except CircuitOpenError:
            raise  # Re-raise circuit open errors
        except Exception as e:
            # Check if we should try fallback for deployment not found errors
            if self._is_deployment_not_found_error(e) and self.fallback_client is not None:
                logger.warning(f'Azure deployment "{self.model}" not found for batch, falling back to OpenAI: {e}')
                try:
                    result = _create_embeddings(self.fallback_client, self._fallback_model)
                    self._circuit_breaker.record_success()
                    self._using_fallback = True
                    logger.info(f'Batch fallback to OpenAI {self._fallback_model} successful')
                    return result
                except Exception as fallback_error:
                    logger.error(f'Batch fallback to OpenAI also failed: {fallback_error}')

            # Record failure for circuit breaker
            self._circuit_breaker.record_failure()
            logger.error(
                f'Failed to generate batch embeddings: {e}',
                extra={
                    'model': self.model,
                    'provider': self._provider,
                    'batch_size': len(texts),
                    'valid_texts': len(valid_texts),
                    'circuit_state': self._circuit_breaker.state,
                },
                exc_info=True,
            )
            raise EmbeddingServiceError(f'Batch embedding generation failed: {e}') from e

    def generate_project_embedding_text(self, project: 'Project') -> str:
        """
        Generate combined text for project embedding.

        Combines:
        - Title (weighted high - repeated)
        - Description
        - Topics
        - Tool names
        - Category names
        - Reddit/external content if available

        Args:
            project: Project model instance

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Title (repeat for higher weight)
        if project.title:
            parts.append(project.title)
            parts.append(project.title)  # Repeat for weight

        # Description
        if project.description:
            parts.append(project.description)

        # Topics
        if project.topics:
            topics_text = ', '.join(project.topics)
            parts.append(f'Topics: {topics_text}')

        # Tools
        tool_names = list(project.tools.values_list('name', flat=True))
        if tool_names:
            tools_text = ', '.join(tool_names)
            parts.append(f'Tools used: {tools_text}')

        # Categories
        category_names = list(project.categories.values_list('name', flat=True))
        if category_names:
            categories_text = ', '.join(category_names)
            parts.append(f'Categories: {categories_text}')

        # Content blocks (extract text from structured content)
        if project.content:
            content_text = self._extract_text_from_content(project.content)
            if content_text:
                parts.append(content_text)

        return '\n'.join(parts)

    def _extract_text_from_content(self, content: dict) -> str:
        """Extract readable text from project content blocks."""
        texts = []

        # Handle different content structures
        if isinstance(content, dict):
            # Check for blocks array
            blocks = content.get('blocks', [])
            if isinstance(blocks, list):
                for block in blocks:
                    if isinstance(block, dict):
                        # Text blocks
                        if block.get('type') == 'text':
                            text = block.get('content', '') or block.get('text', '')
                            if text:
                                texts.append(text)
                        # Header blocks
                        elif block.get('type') == 'header':
                            text = block.get('text', '')
                            if text:
                                texts.append(text)

            # Check for description/summary fields
            if content.get('description'):
                texts.append(content['description'])
            if content.get('summary'):
                texts.append(content['summary'])

        return ' '.join(texts)[:5000]  # Limit extracted content

    def generate_user_profile_embedding_text(self, user: 'User') -> str:
        """
        Generate combined text for user profile embedding.

        Combines:
        - UserTags (weighted by confidence score)
        - Bio/about text
        - Behavioral summary from interactions

        Args:
            user: User model instance

        Returns:
            Combined text string for embedding
        """
        from core.taxonomy.models import UserTag

        parts = []

        # User bio/about if available
        if hasattr(user, 'profile') and user.profile:
            if hasattr(user.profile, 'bio') and user.profile.bio:
                parts.append(f'About: {user.profile.bio}')
            if hasattr(user.profile, 'headline') and user.profile.headline:
                parts.append(user.profile.headline)

        # UserTags (high confidence first)
        user_tags = UserTag.objects.filter(user=user).order_by('-confidence_score')[:50]

        if user_tags:
            # Group by source for structured text
            manual_tags = []
            auto_tags = []

            for tag in user_tags:
                if tag.source == UserTag.TagSource.MANUAL:
                    manual_tags.append(tag.name)
                else:
                    # Weight auto tags by confidence
                    if tag.confidence_score >= 0.7:
                        auto_tags.append(tag.name)

            if manual_tags:
                parts.append(f'Interests: {", ".join(manual_tags)}')
            if auto_tags:
                parts.append(f'Related interests: {", ".join(auto_tags)}')

        # Add behavioral summary from recent interactions
        behavioral_text = self._get_behavioral_summary(user)
        if behavioral_text:
            parts.append(behavioral_text)

        return '\n'.join(parts)

    def _get_behavioral_summary(self, user: 'User') -> str:
        """Generate summary of user's recent behavioral patterns."""
        from collections import Counter

        from core.taxonomy.models import UserInteraction

        # Get recent interactions
        recent_interactions = UserInteraction.objects.filter(user=user).order_by('-created_at')[:100]

        if not recent_interactions.exists():
            return ''

        # Extract keywords from interactions
        all_keywords = []
        for interaction in recent_interactions:
            keywords = interaction.extracted_keywords or []
            all_keywords.extend(keywords)

        if not all_keywords:
            return ''

        # Get top keywords
        keyword_counts = Counter(all_keywords)
        top_keywords = [kw for kw, _ in keyword_counts.most_common(20)]

        if top_keywords:
            return f'Activity patterns: {", ".join(top_keywords)}'

        return ''

    def generate_tool_embedding_text(self, tool) -> str:
        """
        Generate combined text for tool embedding.

        Args:
            tool: Tool or Taxonomy model instance

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Tool name (repeat for weight)
        if hasattr(tool, 'name') and tool.name:
            parts.append(tool.name)
            parts.append(tool.name)

        # Description
        if hasattr(tool, 'description') and tool.description:
            parts.append(tool.description)

        # Best for / use cases
        if hasattr(tool, 'best_for') and tool.best_for:
            if isinstance(tool.best_for, list):
                parts.append(f'Best for: {", ".join(tool.best_for)}')

        # Usage tips
        if hasattr(tool, 'usage_tips') and tool.usage_tips:
            if isinstance(tool.usage_tips, list):
                parts.append(f'Tips: {", ".join(tool.usage_tips)}')

        # Category if available
        if hasattr(tool, 'category') and tool.category:
            parts.append(f'Category: {tool.category}')

        return '\n'.join(parts)


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get singleton embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
