"""Topic normalization and caching service.

This module handles:
- Normalizing raw topic strings to canonical slugs
- Looking up cached topic definitions
- Creating new definitions via AI when needed
"""

import logging

from django.db.models import Q
from django.utils.text import slugify

from .models import TopicDefinition

logger = logging.getLogger(__name__)


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
