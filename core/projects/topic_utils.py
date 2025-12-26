"""
Utility functions for working with project topics.

The Project.topics field is a ManyToManyField to Taxonomy (not an ArrayField).
These utilities provide consistent patterns for getting/setting topics.

Usage:
    from core.projects.topic_utils import (
        set_project_topics,
        get_project_topic_names,
        project_has_topics,
    )

    # Setting topics from a list of strings
    set_project_topics(project, ['python', 'machine-learning', 'api'])

    # Getting topic names as a list of strings
    names = get_project_topic_names(project)  # ['python', 'machine-learning', 'api']

    # Checking if project has topics
    if project_has_topics(project):
        ...
"""

import logging
from typing import TYPE_CHECKING

from django.db import IntegrityError
from django.utils.text import slugify

if TYPE_CHECKING:
    from core.projects.models import Project
    from core.taxonomy.models import Taxonomy

logger = logging.getLogger(__name__)


def _get_or_create_topic_taxonomy(topic_name: str, topic_slug: str) -> 'Taxonomy':
    """
    Get or create a topic taxonomy with proper handling of slug conflicts.

    The Taxonomy.slug field is unique across ALL taxonomy types. This means if
    a slug like 'images-video' exists as type='category', we can't create it
    as type='topic'. This function handles that by appending '-topic' suffix.

    Also handles race conditions where concurrent requests try to create
    the same taxonomy simultaneously.
    """
    from core.taxonomy.models import Taxonomy

    # First, try to get existing topic with this slug
    existing = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic').first()
    if existing:
        return existing

    # Try to create it
    try:
        topic_obj, created = Taxonomy.objects.get_or_create(
            slug=topic_slug,
            taxonomy_type='topic',
            defaults={
                'name': topic_name.title(),
                'is_active': True,
            },
        )
        if created:
            logger.debug(f'Created new topic taxonomy: {topic_obj.name}')
        return topic_obj
    except IntegrityError:
        # Slug already exists - either race condition or different taxonomy_type

        # Check if it was a race condition (same slug+type created by another process)
        existing = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic').first()
        if existing:
            return existing

        # Slug exists with different taxonomy_type - try with '-topic' suffix
        suffixed_slug = f'{topic_slug}-topic'[:120]  # Respect max_length
        try:
            topic_obj, created = Taxonomy.objects.get_or_create(
                slug=suffixed_slug,
                taxonomy_type='topic',
                defaults={
                    'name': topic_name.title(),
                    'is_active': True,
                },
            )
            if created:
                logger.debug(f'Created topic taxonomy with suffix: {topic_obj.name} ({suffixed_slug})')
            return topic_obj
        except IntegrityError:
            # Even suffixed slug exists - get it
            existing = Taxonomy.objects.filter(slug=suffixed_slug, taxonomy_type='topic').first()
            if existing:
                return existing

            # Last resort: try to get the original slug regardless of type
            # (better to reuse existing taxonomy than fail completely)
            fallback = Taxonomy.objects.filter(slug=topic_slug).first()
            if fallback:
                logger.warning(
                    f'Using existing taxonomy {fallback.slug} (type={fallback.taxonomy_type}) '
                    f'for topic {topic_name}'
                )
                return fallback

            # This should rarely happen
            logger.error(f'Failed to get or create topic taxonomy for: {topic_name}')
            raise


def set_project_topics(
    project: 'Project',
    topic_names: list[str],
    *,
    create_missing: bool = True,
    max_topics: int = 15,
) -> list['Taxonomy']:
    """
    Set project topics from a list of topic name strings.

    Converts string names to Taxonomy objects and uses M2M .set() method.

    Args:
        project: The project to set topics on
        topic_names: List of topic names (strings)
        create_missing: If True, create new Taxonomy entries for unknown topics
        max_topics: Maximum number of topics to set (default 15)

    Returns:
        List of Taxonomy objects that were set

    Example:
        set_project_topics(project, ['python', 'api', 'machine-learning'])
    """
    from core.taxonomy.models import Taxonomy

    if not topic_names:
        project.topics.clear()
        return []

    # Clean and deduplicate topic names
    cleaned_names = []
    seen = set()
    for name in topic_names[:max_topics]:
        if not name:
            continue
        # Normalize: strip, lowercase, limit length
        clean_name = str(name).strip().lower()[:50]
        if clean_name and clean_name not in seen:
            cleaned_names.append(clean_name)
            seen.add(clean_name)

    if not cleaned_names:
        project.topics.clear()
        return []

    topic_objects = []

    for topic_name in cleaned_names:
        # Generate slug from name
        topic_slug = slugify(topic_name)[:50]
        if not topic_slug:
            topic_slug = topic_name.replace(' ', '-')[:50]

        if create_missing:
            # Get or create the topic taxonomy (handles race conditions and slug conflicts)
            topic_obj = _get_or_create_topic_taxonomy(topic_name, topic_slug)
            topic_objects.append(topic_obj)
        else:
            # Only use existing topics
            topic_obj = Taxonomy.objects.filter(
                slug=topic_slug,
                taxonomy_type='topic',
                is_active=True,
            ).first()
            if topic_obj:
                topic_objects.append(topic_obj)

    # Use .set() for ManyToMany field
    project.topics.set(topic_objects)
    logger.debug(f'Set {len(topic_objects)} topics on project {project.id}')

    return topic_objects


def get_project_topic_names(project: 'Project') -> list[str]:
    """
    Get project topics as a list of name strings.

    Args:
        project: The project to get topics from

    Returns:
        List of topic names (strings)

    Example:
        names = get_project_topic_names(project)
        # ['Python', 'Machine Learning', 'API']
    """
    return list(project.topics.values_list('name', flat=True))


def get_project_topic_slugs(project: 'Project') -> list[str]:
    """
    Get project topics as a list of slug strings.

    Args:
        project: The project to get topics from

    Returns:
        List of topic slugs (strings)

    Example:
        slugs = get_project_topic_slugs(project)
        # ['python', 'machine-learning', 'api']
    """
    return list(project.topics.values_list('slug', flat=True))


def project_has_topics(project: 'Project') -> bool:
    """
    Check if a project has any topics.

    Args:
        project: The project to check

    Returns:
        True if the project has at least one topic

    Example:
        if project_has_topics(project):
            print("Has topics!")
    """
    return project.topics.exists()


def add_project_topics(
    project: 'Project',
    topic_names: list[str],
    *,
    create_missing: bool = True,
) -> list['Taxonomy']:
    """
    Add topics to a project (without removing existing ones).

    Args:
        project: The project to add topics to
        topic_names: List of topic names to add
        create_missing: If True, create new Taxonomy entries for unknown topics

    Returns:
        List of Taxonomy objects that were added

    Example:
        add_project_topics(project, ['new-topic', 'another-topic'])
    """
    from core.taxonomy.models import Taxonomy

    if not topic_names:
        return []

    topic_objects = []

    for topic_name in topic_names:
        if not topic_name:
            continue

        clean_name = str(topic_name).strip().lower()[:50]
        topic_slug = slugify(clean_name)[:50]
        if not topic_slug:
            topic_slug = clean_name.replace(' ', '-')[:50]

        if create_missing:
            # Get or create the topic taxonomy (handles race conditions and slug conflicts)
            topic_obj = _get_or_create_topic_taxonomy(clean_name, topic_slug)
            topic_objects.append(topic_obj)
        else:
            topic_obj = Taxonomy.objects.filter(
                slug=topic_slug,
                taxonomy_type='topic',
                is_active=True,
            ).first()
            if topic_obj:
                topic_objects.append(topic_obj)

    if topic_objects:
        project.topics.add(*topic_objects)
        logger.debug(f'Added {len(topic_objects)} topics to project {project.id}')

    return topic_objects
