"""
Embedding generation service for Weaviate personalization and learning intelligence.

Uses OpenAI for generating embeddings from:
- Project content, user preferences, and tool descriptions (personalization)
- Knowledge states, concepts, and learning gaps (learning intelligence)

Learning Intelligence Embeddings:
- KnowledgeState: Embeds what a user KNOWS (not content about topics)
- Concept: Embeds learnable concepts for semantic path generation
- LearningGap: Embeds detected confusion patterns for proactive help

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
    Service for generating text embeddings using OpenAI.

    Handles embedding generation for:
    - Projects (title + description + topics + tools + categories)
    - User profiles (tags + bio + behavioral summary)
    - Tools (name + description + use cases)

    Uses circuit breaker pattern to fail fast when the API is unavailable,
    preventing cascading failures and wasted API calls.
    """

    # Shared circuit breaker for all embedding requests
    _circuit_breaker = CircuitBreaker(
        failure_threshold=5,  # Open after 5 consecutive failures
        recovery_timeout=60,  # Try again after 60 seconds
        name='ai_embeddings',
    )

    def __init__(self):
        self._client = None
        self.model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')

    @property
    def client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            from openai import OpenAI

            api_key = getattr(settings, 'OPENAI_API_KEY', '')
            if not api_key:
                raise ValueError('OPENAI_API_KEY not configured for embeddings')
            self._client = OpenAI(api_key=api_key)

        return self._client

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
            return response.data[0].embedding

        except CircuitOpenError:
            raise  # Re-raise circuit open errors
        except Exception as e:
            # Record failure for circuit breaker
            self._circuit_breaker.record_failure()
            logger.error(
                f'Failed to generate embedding: {e}',
                extra={
                    'model': self.model,
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
            return result

        except CircuitOpenError:
            raise  # Re-raise circuit open errors
        except Exception as e:
            # Record failure for circuit breaker
            self._circuit_breaker.record_failure()
            logger.error(
                f'Failed to generate batch embeddings: {e}',
                extra={
                    'model': self.model,
                    'provider': 'openai',
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
        - Creator/author info (username, full name)
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

        # Creator/author info - important for searching by username
        if project.user:
            if project.user.username:
                parts.append(f'By: {project.user.username}')
            full_name = project.user.get_full_name()
            if full_name and full_name != project.user.username:
                parts.append(f'Creator: {full_name}')

        # Description
        if project.description:
            parts.append(project.description)

        # Topics (ManyToMany to Taxonomy)
        topic_names = list(project.topics.values_list('name', flat=True))
        if topic_names:
            topics_text = ', '.join(topic_names)
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
        """Extract readable text from project content (sections or legacy blocks)."""
        texts = []

        if not isinstance(content, dict):
            return ''

        # Handle templateVersion 2 (sections-based structure)
        sections = content.get('sections', [])
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue

                section_type = section.get('type', '')
                section_content = section.get('content', {})

                if not isinstance(section_content, dict):
                    continue

                # Overview section - headline and description
                if section_type == 'overview':
                    if section_content.get('headline'):
                        texts.append(section_content['headline'])
                    if section_content.get('description'):
                        texts.append(section_content['description'])

                # Features section - feature titles and descriptions
                elif section_type == 'features':
                    features = section_content.get('features', [])
                    for feature in features:
                        if isinstance(feature, dict):
                            if feature.get('title'):
                                texts.append(feature['title'])
                            if feature.get('description'):
                                texts.append(feature['description'])

                # Challenges section - problems and solutions
                elif section_type == 'challenges':
                    items = section_content.get('items', [])
                    for item in items:
                        if isinstance(item, dict):
                            if item.get('challenge'):
                                texts.append(item['challenge'])
                            if item.get('solution'):
                                texts.append(item['solution'])
                            if item.get('outcome'):
                                texts.append(item['outcome'])

                # Tech stack section - technology names
                elif section_type == 'tech_stack':
                    categories = section_content.get('categories', [])
                    for category in categories:
                        if isinstance(category, dict):
                            if category.get('name'):
                                texts.append(category['name'])
                            techs = category.get('technologies', [])
                            for tech in techs:
                                if isinstance(tech, dict) and tech.get('name'):
                                    texts.append(tech['name'])
                                elif isinstance(tech, str):
                                    texts.append(tech)

                # Video section - title and platform context
                elif section_type == 'video':
                    if section_content.get('title'):
                        texts.append(section_content['title'])
                    # Add platform context for searchability (e.g., "youtube tutorial")
                    platform = section_content.get('platform', '')
                    if platform and platform != 'other':
                        texts.append(f'{platform} video')

                # Gallery section - image captions and alt text
                elif section_type == 'gallery':
                    if section_content.get('title'):
                        texts.append(section_content['title'])
                    images = section_content.get('images', [])
                    for image in images:
                        if isinstance(image, dict):
                            if image.get('caption'):
                                texts.append(image['caption'])
                            if image.get('alt'):
                                texts.append(image['alt'])

                # Demo section - CTAs and live URL context
                elif section_type == 'demo':
                    if section_content.get('title'):
                        texts.append(section_content['title'])
                    ctas = section_content.get('ctas', [])
                    for cta in ctas:
                        if isinstance(cta, dict):
                            if cta.get('label'):
                                texts.append(cta['label'])
                    if section_content.get('liveUrl'):
                        texts.append('Live Demo')

                # Slideup section - element captions and text content
                elif section_type == 'slideup':
                    for element_key in ['element1', 'element2']:
                        element = section_content.get(element_key)
                        if element and isinstance(element, dict):
                            if element.get('caption'):
                                texts.append(element['caption'])
                            # Extract text content from text-type elements
                            if element.get('type') == 'text' and element.get('content'):
                                texts.append(element['content'])

                # Architecture section - description
                elif section_type == 'architecture':
                    if section_content.get('description'):
                        texts.append(section_content['description'])
                    if section_content.get('title'):
                        texts.append(section_content['title'])

                # Links section - link labels and descriptions
                elif section_type == 'links':
                    links = section_content.get('links', [])
                    for link in links:
                        if isinstance(link, dict):
                            if link.get('label'):
                                texts.append(link['label'])
                            if link.get('description'):
                                texts.append(link['description'])

                # Custom section - extract from blocks
                elif section_type == 'custom':
                    if section_content.get('title'):
                        texts.append(section_content['title'])
                    blocks = section_content.get('blocks', [])
                    for block in blocks:
                        if isinstance(block, dict):
                            text = block.get('content', '') or block.get('text', '')
                            if text:
                                texts.append(text)

        # Legacy: Check for blocks array (templateVersion 1 or no version)
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

        # Check for top-level description/summary fields
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

        parts = []

        # Get recent interactions
        recent_interactions = UserInteraction.objects.filter(user=user).order_by('-created_at')[:100]

        # Extract keywords from interactions
        all_keywords = []
        for interaction in recent_interactions:
            keywords = interaction.extracted_keywords or []
            all_keywords.extend(keywords)

        if all_keywords:
            keyword_counts = Counter(all_keywords)
            top_keywords = [kw for kw, _ in keyword_counts.most_common(20)]
            if top_keywords:
                parts.append(f'Activity patterns: {", ".join(top_keywords)}')

        # Get engagement-derived interests from viewed projects
        engagement_interests = self._get_engagement_derived_interests(user)
        if engagement_interests:
            parts.append(engagement_interests)

        return '\n'.join(parts)

    def _get_engagement_derived_interests(self, user: 'User') -> str:
        """
        Extract interests from engagement events (view milestones, time spent).

        Projects that users spend significant time viewing indicate interest,
        even without explicit likes or tag selections.
        """
        from collections import Counter
        from datetime import timedelta

        from django.utils import timezone

        try:
            from core.engagement.models import EngagementEvent
        except ImportError:
            # Engagement app not yet installed
            return ''

        # Get recent view milestone and time spent events
        cutoff = timezone.now() - timedelta(days=30)

        engagement_events = list(
            EngagementEvent.objects.filter(
                user=user,
                event_type__in=[
                    EngagementEvent.EventType.VIEW_MILESTONE,
                    EngagementEvent.EventType.TIME_SPENT,
                ],
                created_at__gte=cutoff,
                project__isnull=False,
            )
            .select_related('project')
            .prefetch_related('project__tools')
            .order_by('-created_at')[:200]
        )

        if not engagement_events:
            return ''

        # Extract topics from viewed projects
        viewed_topics: Counter = Counter()
        viewed_tools: Counter = Counter()

        for event in engagement_events:
            project = event.project
            if not project:
                continue

            # Weight view milestones more heavily
            weight = 2 if event.event_type == EngagementEvent.EventType.VIEW_MILESTONE else 1

            # Time spent events with high seconds get extra weight
            if event.event_type == EngagementEvent.EventType.TIME_SPENT:
                seconds = event.payload.get('seconds', 0)
                if seconds >= 60:
                    weight = 2
                elif seconds >= 30:
                    weight = 1
                else:
                    weight = 0.5

            # Extract topics (topics is a ManyToManyField)
            topic_names = list(project.topics.values_list('name', flat=True))
            for topic in topic_names:
                viewed_topics[topic] += weight

            # Extract tool names
            tool_names = list(project.tools.values_list('name', flat=True))
            for tool in tool_names:
                viewed_tools[tool] += weight

        # Build interest strings
        parts = []

        top_viewed_topics = [t for t, _ in viewed_topics.most_common(10)]
        if top_viewed_topics:
            parts.append(f'Viewed topics: {", ".join(top_viewed_topics)}')

        top_viewed_tools = [t for t, _ in viewed_tools.most_common(5)]
        if top_viewed_tools:
            parts.append(f'Viewed tools: {", ".join(top_viewed_tools)}')

        return ' '.join(parts)

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

    def generate_learning_path_embedding_text(self, learning_path) -> str:
        """
        Generate combined text for learning path embedding.

        Combines:
        - Title (weighted high - repeated)
        - Topics covered
        - Difficulty level
        - Curriculum item titles
        - Owner/author info

        Args:
            learning_path: SavedLearningPath model instance

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Title (repeat for weight)
        if learning_path.title:
            parts.append(learning_path.title)
            parts.append(learning_path.title)

        # Extract path_data
        path_data = learning_path.path_data or {}

        # Difficulty
        difficulty = path_data.get('difficulty', 'beginner')
        parts.append(f'Difficulty: {difficulty}')

        # Topics covered
        topics_covered = path_data.get('topics_covered', [])
        if topics_covered:
            topics_str = ', '.join(t.replace('-', ' ') for t in topics_covered)
            parts.append(f'Topics: {topics_str}')

        # Curriculum titles for searchability
        curriculum = path_data.get('curriculum', [])
        curriculum_titles = []
        for item in curriculum[:20]:  # Limit to first 20 items
            if 'title' in item:
                curriculum_titles.append(item['title'])
        if curriculum_titles:
            parts.append(f'Curriculum: {", ".join(curriculum_titles)}')

        # Owner username and name for searchability
        if hasattr(learning_path, 'user') and learning_path.user:
            user = learning_path.user
            if user.username:
                parts.append(f'By: {user.username}')
            full_name = user.get_full_name()
            if full_name:
                parts.append(f'Author: {full_name}')

        return '\n'.join(parts)

    # =========================================================================
    # Learning Intelligence Embeddings
    # =========================================================================

    def generate_knowledge_state_embedding_text(self, mastery) -> str:
        """
        Generate text for user knowledge state embedding.

        This embeds what a user KNOWS (not content about the topic), enabling:
        - Find concepts the user should learn next (similar to known concepts)
        - Identify gaps (concepts needed but unknown)
        - Match users with similar knowledge profiles

        Args:
            mastery: UserConceptMastery model instance with concept prefetched

        Returns:
            Text representing user's understanding of this concept
        """
        parts = []
        concept = mastery.concept

        # Concept identification
        parts.append(f'Knowledge of {concept.name}.')

        # Topic context
        if concept.topic_taxonomy:
            parts.append(f'Topic area: {concept.topic_taxonomy.name}.')
        elif concept.topic:
            parts.append(f'Topic area: {concept.topic}.')

        # Mastery level context
        mastery_descriptions = {
            'unknown': f'User is not familiar with {concept.name}.',
            'aware': f'User has heard of {concept.name} but lacks understanding.',
            'learning': f'User is actively learning {concept.name}, needs guidance.',
            'practicing': f'User is practicing {concept.name}, building confidence.',
            'proficient': f'User can apply {concept.name} independently in projects.',
            'expert': f'User has mastered {concept.name} and can teach others.',
        }
        mastery_text = mastery_descriptions.get(
            mastery.mastery_level,
            f'User has {mastery.mastery_level} level in {concept.name}.',
        )
        parts.append(mastery_text)

        # Mastery score context
        if mastery.mastery_score >= 0.8:
            parts.append('Strong understanding demonstrated.')
        elif mastery.mastery_score >= 0.5:
            parts.append('Moderate understanding, needs more practice.')
        elif mastery.mastery_score >= 0.2:
            parts.append('Beginning to understand, still learning fundamentals.')
        else:
            parts.append('Just starting to learn this concept.')

        # Prerequisites context (helps with gap detection)
        if hasattr(concept, 'prerequisites') and concept.prerequisites.exists():
            prereq_names = list(concept.prerequisites.values_list('name', flat=True))
            if prereq_names:
                parts.append(f'Builds on: {", ".join(prereq_names)}.')

        # Practice context
        if mastery.times_practiced > 0:
            parts.append(f'Practiced {mastery.times_practiced} times.')

        return ' '.join(parts)

    def generate_concept_embedding_text(self, concept) -> str:
        """
        Generate text for concept embedding.

        This embeds the concept itself for semantic path generation, enabling:
        - Find semantically similar concepts
        - Generate learning paths
        - Match concepts to user interests

        Args:
            concept: Concept model instance

        Returns:
            Text representing the concept for embedding
        """
        parts = []

        # Concept name (repeated for weight)
        if concept.name:
            parts.append(concept.name)
            parts.append(concept.name)

        # Description
        if concept.description:
            parts.append(concept.description)

        # Topic context
        if concept.topic_taxonomy:
            parts.append(f'Topic: {concept.topic_taxonomy.name}.')
        elif concept.topic:
            parts.append(f'Topic: {concept.topic}.')

        # Difficulty context
        if concept.difficulty:
            parts.append(f'Difficulty: {concept.difficulty}.')

        # Prerequisites (important for learning paths)
        if hasattr(concept, 'prerequisites') and concept.prerequisites.exists():
            prereq_names = list(concept.prerequisites.values_list('name', flat=True))
            if prereq_names:
                parts.append(f'Prerequisites: {", ".join(prereq_names)}.')

        # What this concept unlocks
        if hasattr(concept, 'unlocks') and concept.unlocks.exists():
            unlocks_names = list(concept.unlocks.values_list('name', flat=True))
            if unlocks_names:
                parts.append(f'Unlocks: {", ".join(unlocks_names)}.')

        # Related tools
        if hasattr(concept, 'related_tools') and concept.related_tools.exists():
            tool_names = list(concept.related_tools.values_list('name', flat=True))
            if tool_names:
                parts.append(f'Related tools: {", ".join(tool_names)}.')

        return ' '.join(parts)

    def generate_learning_gap_embedding_text(
        self,
        concept_name: str,
        topic_slug: str,
        gap_type: str,
        evidence_summary: str,
    ) -> str:
        """
        Generate text for learning gap embedding.

        This embeds detected learning gaps for pattern matching, enabling:
        - Find if user struggled with similar topics before
        - Match common confusion patterns across users
        - Suggest interventions based on similar past gaps

        Args:
            concept_name: Name of the concept with detected gap
            topic_slug: Topic taxonomy slug
            gap_type: Type of gap (confusion, prerequisite, practice, retention)
            evidence_summary: Summary of evidence for this gap

        Returns:
            Text representing the learning gap for embedding
        """
        parts = []

        # Gap identification
        parts.append(f'Learning gap in {concept_name}.')

        # Topic context
        if topic_slug:
            parts.append(f'Topic: {topic_slug}.')

        # Gap type context
        gap_type_descriptions = {
            'confusion': 'User expressed confusion or asked for clarification.',
            'prerequisite': 'User is missing prerequisite knowledge.',
            'practice': 'User needs more practice with this concept.',
            'retention': 'User may have forgotten previously learned material.',
        }
        gap_description = gap_type_descriptions.get(
            gap_type,
            f'Gap type: {gap_type}.',
        )
        parts.append(gap_description)

        # Evidence summary (helps match similar patterns)
        if evidence_summary:
            parts.append(f'Evidence: {evidence_summary}')

        return ' '.join(parts)


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get singleton embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
