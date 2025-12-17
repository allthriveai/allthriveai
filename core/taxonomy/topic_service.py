"""Topic normalization and taxonomy service.

This module handles:
- Normalizing raw topic strings to canonical slugs
- Looking up cached topic definitions
- Creating new definitions via AI when needed
- Managing the Topic taxonomy (free-flowing topics for AI/quizzes/curation agents)
"""

import logging

from django.db.models import Q
from django.utils.text import slugify

from .models import Taxonomy, TopicDefinition

logger = logging.getLogger(__name__)

# Tags that should not be added to the topic taxonomy
EXCLUDED_TAGS = {
    # Battle/prompt types
    'winner',
    'loser',
    'featured',
    'trending',
    'new',
    'prompt battle',
    'text prompt',
    'image prompt',
    'vs ai',
    'vs pip',
    'image',
    'text',
    'battle',
    'prompt',
    'ai',
    # Project types
    'showcase',
    'playground',
    'clipped',
    'product',
    'reddit',
    'other',
    # Generic
    'none',
    'unknown',
    'n/a',
    'na',
    '',
}


def normalize_topic_slug(raw_topic: str) -> str:
    """Convert a raw topic string to a canonical slug.

    Examples:
        "AI Agents" -> "ai-agents"
        "ai_agents" -> "ai-agents"
        "Machine Learning" -> "machine-learning"
        " ChatGPT " -> "chatgpt"

    Args:
        raw_topic: The raw topic string from user input

    Returns:
        Normalized slug (lowercase, hyphenated, no special chars)
    """
    if not raw_topic:
        return ''

    # Strip whitespace
    topic = raw_topic.strip()

    # Replace underscores with spaces (for slugify to handle)
    topic = topic.replace('_', ' ')

    # Use Django's slugify which handles unicode, spaces, etc.
    slug = slugify(topic)

    return slug


def get_display_name_from_slug(slug: str) -> str:
    """Convert a slug to a display-friendly name.

    Examples:
        "ai-agents" -> "AI Agents"
        "machine-learning" -> "Machine Learning"
        "chatgpt" -> "ChatGPT"

    Note: This is a basic conversion. The AI generator provides better
    canonical display names that handle proper capitalization for brands
    and technical terms.

    Args:
        slug: The normalized slug

    Returns:
        Title-cased display name
    """
    if not slug:
        return ''

    # Replace hyphens with spaces and title case
    return slug.replace('-', ' ').title()


def find_topic_definition(slug: str) -> TopicDefinition | None:
    """Find a cached topic definition by slug or alias.

    First checks for an exact slug match, then searches aliases.

    Args:
        slug: Normalized topic slug

    Returns:
        TopicDefinition if found, None otherwise
    """
    # Try exact slug match first
    try:
        return TopicDefinition.objects.get(slug=slug)
    except TopicDefinition.DoesNotExist:
        pass

    # Search in aliases (JSONField contains list of strings)
    # Use case-insensitive search
    try:
        return TopicDefinition.objects.get(aliases__contains=[slug])
    except TopicDefinition.DoesNotExist:
        pass

    # Try with different variations in aliases
    variations = [slug, slug.replace('-', ' '), slug.replace('-', '')]
    for variation in variations:
        definition = TopicDefinition.objects.filter(aliases__icontains=variation).first()
        if definition:
            return definition

    return None


def get_or_create_topic_definition(raw_topic: str, generate_if_missing: bool = True) -> TopicDefinition | None:
    """Get a cached topic definition or generate one via AI.

    This is the main entry point for topic lookups. It:
    1. Normalizes the input topic to a slug
    2. Checks the database for an existing definition (by slug or alias)
    3. If not found and generate_if_missing=True, generates via AI

    Args:
        raw_topic: Raw topic string from user input
        generate_if_missing: If True, generate missing definitions via AI

    Returns:
        TopicDefinition instance or None if not found and generation disabled
    """
    slug = normalize_topic_slug(raw_topic)
    if not slug:
        return None

    # Check for existing definition
    definition = find_topic_definition(slug)
    if definition:
        return definition

    # Generate via AI if allowed
    if generate_if_missing:
        from services.ai.topic_generator import generate_topic_definition

        try:
            definition = generate_topic_definition(raw_topic, slug)
            return definition
        except Exception as e:
            logger.error(f'Failed to generate topic definition for "{raw_topic}": {e}')
            # Fall back to creating a basic definition
            return create_basic_definition(raw_topic, slug)

    return None


def create_basic_definition(raw_topic: str, slug: str) -> TopicDefinition:
    """Create a basic topic definition without AI generation.

    Used as a fallback when AI generation fails.

    Args:
        raw_topic: Original topic string
        slug: Normalized slug

    Returns:
        Basic TopicDefinition with placeholder description
    """
    display_name = get_display_name_from_slug(slug)

    definition = TopicDefinition.objects.create(
        slug=slug,
        display_name=display_name,
        description=f'{display_name} is a topic in AI and creative technology.',
        aliases=[],
    )

    logger.info(f'Created basic topic definition for "{slug}"')
    return definition


def update_topic_project_count(slug: str) -> int:
    """Update the cached project count for a topic.

    Args:
        slug: Topic slug to update

    Returns:
        Updated project count
    """
    from core.projects.models import Project

    definition = find_topic_definition(slug)
    if not definition:
        return 0

    # Count projects with this topic (case-insensitive)
    # Topics are stored as an ArrayField of strings
    count = Project.objects.filter(
        topics__icontains=slug,
        is_archived=False,
    ).count()

    # Also count variations
    variations = [
        definition.display_name,
        definition.display_name.lower(),
    ] + definition.aliases

    for variation in variations:
        if variation != slug:
            count += (
                Project.objects.filter(
                    topics__icontains=variation,
                    is_archived=False,
                )
                .exclude(
                    topics__icontains=slug  # Don't double-count
                )
                .count()
            )

    definition.project_count = count
    definition.save(update_fields=['project_count', 'updated_at'])

    return count


def get_related_projects(slug: str, limit: int = 10):
    """Get projects tagged with a topic.

    Args:
        slug: Topic slug
        limit: Maximum number of projects to return

    Returns:
        QuerySet of related projects
    """
    from core.projects.models import Project

    definition = find_topic_definition(slug)

    # Build search terms
    search_terms = [slug]
    if definition:
        search_terms.append(definition.display_name)
        search_terms.extend(definition.aliases)

    # Build query for any matching topic
    query = Q()
    for term in search_terms:
        query |= Q(topics__icontains=term)

    return (
        Project.objects.filter(query, is_archived=False, is_private=False)
        .select_related('user')
        .prefetch_related('tools', 'categories')
        .order_by('-created_at')[:limit]
    )


# =============================================================================
# Topic Taxonomy Management (free-flowing topics for AI/quizzes/curation agents)
# =============================================================================


def is_valid_topic(raw_topic: str) -> bool:
    """Check if a raw topic string is valid for the taxonomy.

    Excludes generic tags, battle types, and other non-topic strings.

    Args:
        raw_topic: The raw topic string

    Returns:
        True if the topic should be added to taxonomy, False otherwise
    """
    if not raw_topic or not raw_topic.strip():
        return False

    normalized = raw_topic.strip().lower()

    # Check against exclusion list
    if normalized in EXCLUDED_TAGS:
        return False

    # Must be at least 2 characters
    if len(normalized) < 2:
        return False

    # Must contain at least one letter
    if not any(c.isalpha() for c in normalized):
        return False

    return True


def get_or_create_topic(raw_topic: str, description: str = '', color: str = '') -> Taxonomy | None:
    """Get or create a topic in the Taxonomy.

    This is the main entry point for AI, quizzes, and curation agents to add topics.
    If the topic doesn't exist, it will be created dynamically.

    Args:
        raw_topic: Raw topic string (e.g., "Machine Learning", "AI Agents")
        description: Optional description for new topics
        color: Optional color for display (e.g., "blue", "purple")

    Returns:
        Taxonomy instance or None if the topic is invalid/excluded
    """
    from django.db import IntegrityError

    if not is_valid_topic(raw_topic):
        logger.debug(f'Topic "{raw_topic}" is not valid for taxonomy')
        return None

    slug = normalize_topic_slug(raw_topic)
    if not slug:
        return None

    # Try to find existing topic by slug (any taxonomy type - slug is unique across all)
    existing_any = Taxonomy.objects.filter(slug=slug).first()
    if existing_any:
        # If it's already a topic, return it
        if existing_any.taxonomy_type == Taxonomy.TaxonomyType.TOPIC:
            return existing_any
        # If it's another type (tool, category), don't create a duplicate
        # Just return None or could return the existing one
        logger.debug(f'Slug "{slug}" already exists as {existing_any.taxonomy_type}, skipping topic creation')
        return None

    # Try case-insensitive name match for topics
    display_name = get_display_name_from_slug(slug)
    topic = Taxonomy.objects.filter(
        taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
        name__iexact=display_name,
    ).first()

    if topic:
        return topic

    # Also check if name exists in any taxonomy type
    existing_name = Taxonomy.objects.filter(name__iexact=display_name).first()
    if existing_name:
        logger.debug(f'Name "{display_name}" already exists as {existing_name.taxonomy_type}, skipping topic creation')
        return None

    # Create new topic with unique slug
    try:
        topic = Taxonomy.objects.create(
            taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
            name=display_name,
            slug=slug,
            description=description or f'Topics related to {display_name}.',
            color=color,
            is_active=True,
        )
        logger.info(f'Created new topic in taxonomy: "{display_name}" ({slug})')
        return topic
    except IntegrityError as e:
        # Handle race condition or constraint violation
        logger.warning(f'Could not create topic "{display_name}": {e}')
        # Try to fetch it again in case of race condition
        return Taxonomy.objects.filter(
            taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
            slug=slug,
        ).first()


def normalize_topics_list(raw_topics: list[str]) -> list[str]:
    """Normalize a list of raw topic strings to canonical slugs.

    Filters out invalid topics and returns deduplicated slugs.

    Args:
        raw_topics: List of raw topic strings

    Returns:
        List of normalized, valid topic slugs
    """
    normalized = []
    seen = set()

    for raw_topic in raw_topics or []:
        if not is_valid_topic(raw_topic):
            continue

        slug = normalize_topic_slug(raw_topic)
        if slug and slug not in seen:
            normalized.append(slug)
            seen.add(slug)

    return normalized


def ensure_topics_in_taxonomy(raw_topics: list[str]) -> list[Taxonomy]:
    """Ensure all topics exist in the taxonomy, creating them if needed.

    This should be called when saving projects, quizzes, or other entities
    that have topics. It ensures all topics are tracked in the taxonomy.

    Args:
        raw_topics: List of raw topic strings

    Returns:
        List of Taxonomy instances for the valid topics
    """
    taxonomy_topics = []

    for raw_topic in raw_topics or []:
        topic = get_or_create_topic(raw_topic)
        if topic:
            taxonomy_topics.append(topic)

    return taxonomy_topics


def get_all_topics(active_only: bool = True) -> list[Taxonomy]:
    """Get all topics from the taxonomy.

    Args:
        active_only: If True, only return active topics

    Returns:
        List of Taxonomy instances with taxonomy_type='topic'
    """
    queryset = Taxonomy.objects.filter(taxonomy_type=Taxonomy.TaxonomyType.TOPIC)

    if active_only:
        queryset = queryset.filter(is_active=True)

    return list(queryset.order_by('name'))


def search_topics(query: str, limit: int = 10) -> list[Taxonomy]:
    """Search topics by name.

    Args:
        query: Search query string
        limit: Maximum number of results

    Returns:
        List of matching Taxonomy instances
    """
    if not query or len(query) < 2:
        return []

    return list(
        Taxonomy.objects.filter(
            taxonomy_type=Taxonomy.TaxonomyType.TOPIC,
            is_active=True,
            name__icontains=query,
        ).order_by('name')[:limit]
    )


def get_topic_suggestions(partial: str, limit: int = 5) -> list[dict]:
    """Get topic suggestions for autocomplete.

    Args:
        partial: Partial topic string
        limit: Maximum number of suggestions

    Returns:
        List of dicts with 'slug', 'name', and 'color'
    """
    topics = search_topics(partial, limit)

    return [
        {
            'slug': topic.slug,
            'name': topic.name,
            'color': topic.color or 'gray',
        }
        for topic in topics
    ]
