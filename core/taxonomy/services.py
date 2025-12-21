"""
Personalization services for automatic tag detection and confidence scoring.

This module provides intelligent, automatic personalization by:
- Extracting tools from project descriptions
- Auto-tagging users based on their projects and behavior
- Calculating confidence scores for preferences
- Generating UserTags with minimal user effort
- Automatically assigning categories to projects
"""

import logging
from datetime import timedelta

from django.utils import timezone

from core.taxonomy.models import Taxonomy, UserTag
from core.tools.models import Tool
from services.ai import AIProvider

logger = logging.getLogger(__name__)


def auto_assign_category_to_project(project, force: bool = False) -> Taxonomy | None:
    """
    Automatically assign a category to a project using AI analysis.

    Analyzes the project title and description to determine the best
    matching category from the available taxonomy.

    Args:
        project: Project instance to categorize
        force: If True, reassign even if project already has categories

    Returns:
        The assigned Taxonomy category, or None if assignment failed
    """
    # Skip if project already has categories (unless forced)
    if not force and project.categories.exists():
        logger.debug(f"Project '{project.title}' already has categories, skipping auto-assign")
        return None

    # Skip if tags were manually edited
    if project.tags_manually_edited:
        logger.debug(f"Project '{project.title}' has manually edited tags, skipping auto-assign")
        return None

    try:
        # Get available categories
        available_categories = list(
            Taxonomy.objects.filter(taxonomy_type='category', is_active=True).values_list('name', flat=True)
        )

        if not available_categories:
            logger.warning('No active categories found in taxonomy')
            return None

        # Use AI to determine category
        ai = AIProvider(provider='openai')

        system_message = f"""You are an AI content categorizer for a tech/AI learning platform.
Analyze the project title and description, and classify it into ONE of these categories:

{', '.join(available_categories)}

Rules:
1. Choose the SINGLE most relevant category
2. If the content is about AI tools, models, or LLMs, use "AI Models & Research"
3. If it's about building chatbots or conversation systems, use "Chatbots & Conversation"
4. For code/development projects, use "Developer & Coding"
5. For image/video generation, use "Images & Video"
6. If nothing fits well, use the closest match

Respond with ONLY the category name, exactly as written above."""

        combined_text = f"""Title: {project.title}

Description: {project.description[:800] if project.description else 'No description available'}"""

        response = ai.complete(
            prompt=combined_text,
            system_message=system_message,
            max_tokens=50,
            temperature=0.1,
        )

        if not response:
            logger.warning(f'No AI response for project category: {project.title}')
            return None

        category_name = response.strip().strip('"\'')

        # Find matching category
        category = Taxonomy.objects.filter(taxonomy_type='category', is_active=True, name__iexact=category_name).first()

        if not category:
            # Try case-insensitive partial match
            for cat_name in available_categories:
                if cat_name.lower() in category_name.lower() or category_name.lower() in cat_name.lower():
                    category = Taxonomy.objects.filter(
                        taxonomy_type='category', is_active=True, name__iexact=cat_name
                    ).first()
                    if category:
                        break

        if category:
            project.categories.add(category)
            logger.info(f'Auto-assigned category "{category.name}" to project "{project.title}"')
            return category
        else:
            # Fallback: assign a default category based on project type
            default_categories = {
                'github_repo': 'Developer & Coding',
                'figma_design': 'Design (Mockups & UI)',
                'video': 'Images & Video',
                'prompt': 'Chatbots & Conversation',
                'image_collection': 'Images & Video',
                'rss_article': 'AI Models & Research',
                'battle': 'Images & Video',
            }
            default_name = default_categories.get(project.type, 'AI Models & Research')
            fallback = Taxonomy.objects.filter(
                taxonomy_type='category', is_active=True, name__iexact=default_name
            ).first()

            if fallback:
                project.categories.add(fallback)
                logger.info(f'Assigned fallback category "{fallback.name}" to project "{project.title}"')
                return fallback

            logger.warning(f'Could not assign any category to project "{project.title}"')
            return None

    except Exception as e:
        logger.error(f'Error auto-assigning category to project: {e}', exc_info=True)
        return None


def extract_tools_from_project(project) -> list[Tool]:
    """
    Extract AI tools mentioned in project title/description.

    Searches for known Tool names in the project's text content.
    Case-insensitive matching with whole-word boundaries.

    Args:
        project: Project instance to analyze

    Returns:
        List of Tool instances found in the project
    """
    tools_found = []

    # Combine text sources for analysis
    text = f'{project.title} {project.description or ""}'.lower()

    if not text.strip():
        return tools_found

    # Get all active tools with their common variations
    known_tools = Tool.objects.filter(is_active=True).select_related('taxonomy')

    for tool in known_tools:
        # Check tool name
        tool_name_lower = tool.name.lower()

        # Simple word boundary check
        if tool_name_lower in text:
            # Verify it's a word boundary (not part of another word)
            import re

            pattern = r'\b' + re.escape(tool_name_lower) + r'\b'
            if re.search(pattern, text):
                tools_found.append(tool)
                logger.debug(f"Found tool '{tool.name}' in project '{project.title}'")

    return tools_found


def calculate_confidence_score(user, tag_name: str, source: str) -> float:
    """
    Calculate confidence score for a UserTag based on evidence.

    Formula:
    - Base score from frequency (1=0.3, 2-4=0.5, 5+=0.7)
    - Recency bonus (+0.1 if activity in last 30 days)
    - Interaction bonus (+0.2 if user actively engaged)
    - Max 0.95 for auto-generated, 1.0 for manual

    Args:
        user: User instance
        tag_name: Name of the tag
        source: Source type (manual, auto_project, etc.)

    Returns:
        Confidence score between 0.0 and 1.0
    """
    # Manual tags always have 1.0 confidence
    if source == UserTag.TagSource.MANUAL:
        return 1.0

    # Count evidence for this tag
    evidence_count = 0

    # Count projects mentioning this tool/tag
    from core.projects.models import Project

    projects = Project.objects.filter(user=user, is_archived=False)

    for project in projects:
        text = f'{project.title} {project.description or ""}'.lower()
        if tag_name.lower() in text:
            evidence_count += 1

    # Count interactions with this tag
    from core.taxonomy.models import UserInteraction

    interactions = UserInteraction.objects.filter(user=user, metadata__icontains=tag_name).count()

    evidence_count += interactions

    # Base score from frequency
    if evidence_count == 0:
        base_score = 0.0
    elif evidence_count == 1:
        base_score = 0.3
    elif evidence_count <= 4:
        base_score = 0.5
    else:
        base_score = 0.7

    # Recency bonus
    recency_bonus = 0.0
    recent_projects = projects.filter(created_at__gte=timezone.now() - timedelta(days=30))

    for project in recent_projects:
        text = f'{project.title} {project.description or ""}'.lower()
        if tag_name.lower() in text:
            recency_bonus = 0.1
            break

    # Interaction bonus
    interaction_bonus = 0.0
    if interactions > 0:
        interaction_bonus = 0.2

    # Calculate total
    confidence = base_score + recency_bonus + interaction_bonus

    # Cap at 0.95 for auto-generated
    confidence = min(confidence, 0.95)

    logger.debug(
        f"Confidence for '{tag_name}': {confidence:.2f} "
        f'(evidence={evidence_count}, base={base_score:.2f}, '
        f'recency={recency_bonus:.2f}, interaction={interaction_bonus:.2f})'
    )

    return confidence


def create_or_update_user_tags_from_tools(user, tools: list[Tool]) -> list[UserTag]:
    """
    Create or update UserTags based on detected tools.

    For each tool:
    1. Get or create UserTag linked to tool's taxonomy
    2. Calculate confidence score based on evidence
    3. Increment interaction count
    4. Update timestamps

    Args:
        user: User instance
        tools: List of Tool instances detected

    Returns:
        List of created/updated UserTag instances
    """
    user_tags = []

    for tool in tools:
        # Get tool's taxonomy (if it exists)
        taxonomy = tool.taxonomy
        if not taxonomy:
            logger.warning(f"Tool '{tool.name}' has no linked taxonomy, skipping")
            continue

        # Calculate initial confidence
        confidence = calculate_confidence_score(user, tool.name, UserTag.TagSource.AUTO_PROJECT)

        # Get or create UserTag
        user_tag, created = UserTag.objects.get_or_create(
            user=user,
            taxonomy=taxonomy,
            defaults={
                'name': tool.name,
                'source': UserTag.TagSource.AUTO_PROJECT,
                'confidence_score': confidence,
                'interaction_count': 1,
            },
        )

        if not created:
            # Update existing tag
            user_tag.interaction_count += 1
            user_tag.confidence_score = confidence
            user_tag.updated_at = timezone.now()
            user_tag.save(update_fields=['interaction_count', 'confidence_score', 'updated_at'])
            logger.info(f"Updated UserTag '{user_tag.name}' for {user.username} (confidence: {confidence:.2f})")
        else:
            logger.info(f"Created UserTag '{user_tag.name}' for {user.username} (confidence: {confidence:.2f})")

        user_tags.append(user_tag)

    return user_tags


def auto_tag_project(project) -> list[UserTag]:
    """
    Automatically tag a user based on their project content.

    Main entry point for auto-tagging. Called from Django signals
    when a project is created or updated.

    Process:
    1. Extract tools from project description
    2. Create/update UserTags for the user
    3. Link tools to the project

    Args:
        project: Project instance to analyze

    Returns:
        List of UserTag instances created/updated
    """
    if not project.user:
        logger.warning(f"Project '{project.title}' has no user, skipping auto-tag")
        return []

    # Extract tools from project
    tools = extract_tools_from_project(project)

    if not tools:
        logger.debug(f"No tools detected in project '{project.title}'")
        return []

    logger.info(f"Detected {len(tools)} tools in project '{project.title}': {[t.name for t in tools]}")

    # Create or update UserTags
    user_tags = create_or_update_user_tags_from_tools(project.user, tools)

    # Link tools to project (many-to-many)
    project.tools.add(*tools)

    return user_tags


def recalculate_all_confidence_scores(user) -> int:
    """
    Recalculate confidence scores for all of a user's auto-generated tags.

    Useful for:
    - Periodic maintenance
    - After bulk project imports
    - User requests refresh

    Args:
        user: User instance

    Returns:
        Number of tags updated
    """
    auto_tags = UserTag.objects.filter(
        user=user,
        source__in=[
            UserTag.TagSource.AUTO_PROJECT,
            UserTag.TagSource.AUTO_CONVERSATION,
            UserTag.TagSource.AUTO_ACTIVITY,
        ],
    )

    updated_count = 0
    for tag in auto_tags:
        old_confidence = tag.confidence_score
        new_confidence = calculate_confidence_score(user, tag.name, tag.source)

        if abs(old_confidence - new_confidence) > 0.01:  # Only update if changed significantly
            tag.confidence_score = new_confidence
            tag.save(update_fields=['confidence_score'])
            updated_count += 1
            logger.debug(f"Updated confidence for '{tag.name}': {old_confidence:.2f} -> {new_confidence:.2f}")

    logger.info(f'Recalculated {updated_count} confidence scores for {user.username}')
    return updated_count


def get_user_tool_preferences(user, min_confidence: float = 0.3) -> list[UserTag]:
    """
    Get user's tool preferences sorted by confidence.

    Args:
        user: User instance
        min_confidence: Minimum confidence score to include

    Returns:
        List of UserTag instances for tools
    """
    return (
        UserTag.objects.filter(user=user, taxonomy__taxonomy_type='tool', confidence_score__gte=min_confidence)
        .select_related('taxonomy')
        .order_by('-confidence_score', '-interaction_count')
    )


def get_user_preferences_summary(user) -> dict:
    """
    Get summary of all user preferences organized by type.

    Returns:
        Dict with keys: tools, interests, skills, topics, etc.
        Each value is a list of UserTag instances
    """
    all_tags = UserTag.objects.filter(user=user).select_related('taxonomy')

    summary = {'tools': [], 'interests': [], 'skills': [], 'goals': [], 'topics': [], 'industries': [], 'custom': []}

    for tag in all_tags:
        if tag.taxonomy:
            taxonomy_type = tag.taxonomy.taxonomy_type.lower()
            if taxonomy_type in summary:
                summary[taxonomy_type].append(tag)
        else:
            summary['custom'].append(tag)

    return summary


def extract_tools_from_text(text: str) -> list[Tool]:
    """
    Extract AI tools mentioned in any text (search queries, chat, etc.).

    Searches for known Tool names in the provided text.
    Case-insensitive matching with whole-word boundaries.

    Args:
        text: Text content to analyze

    Returns:
        List of Tool instances found in the text
    """
    import re

    tools_found = []

    if not text or not text.strip():
        return tools_found

    text_lower = text.lower()

    # Get all active tools
    known_tools = Tool.objects.filter(is_active=True).select_related('taxonomy')

    for tool in known_tools:
        tool_name_lower = tool.name.lower()

        # Word boundary check
        pattern = r'\b' + re.escape(tool_name_lower) + r'\b'
        if re.search(pattern, text_lower):
            tools_found.append(tool)
            logger.debug(f"Found tool '{tool.name}' in text")

    return tools_found


def auto_tag_from_search(user, search_query: str) -> list[UserTag]:
    """
    Auto-tag a user based on their search query.

    When users search for specific tools or topics, this indicates intent
    and interest. Create/update UserTags with AUTO_ACTIVITY source.

    Args:
        user: User instance who performed the search
        search_query: The search query text

    Returns:
        List of created/updated UserTag instances
    """
    if not user or not search_query:
        return []

    # Extract tools mentioned in the search query
    tools = extract_tools_from_text(search_query)

    if not tools:
        logger.debug(f"No tools detected in search query '{search_query}'")
        return []

    logger.info(f'Detected {len(tools)} tools in search by {user.username}: {[t.name for t in tools]}')

    user_tags = []

    for tool in tools:
        # Get tool's taxonomy
        taxonomy = tool.taxonomy
        if not taxonomy:
            logger.warning(f"Tool '{tool.name}' has no linked taxonomy, skipping")
            continue

        # Lower confidence for search-based tags (0.4 base)
        # Can be reinforced by repeat searches
        base_confidence = 0.4

        # Get or create UserTag
        user_tag, created = UserTag.objects.get_or_create(
            user=user,
            taxonomy=taxonomy,
            defaults={
                'name': tool.name,
                'source': UserTag.TagSource.AUTO_ACTIVITY,
                'confidence_score': base_confidence,
                'interaction_count': 1,
            },
        )

        if not created:
            # Update existing tag - increment interaction count
            user_tag.interaction_count += 1

            # Boost confidence for repeat searches (cap at 0.8)
            new_confidence = min(base_confidence + (user_tag.interaction_count - 1) * 0.1, 0.8)
            user_tag.confidence_score = max(user_tag.confidence_score, new_confidence)
            user_tag.updated_at = timezone.now()
            user_tag.save(update_fields=['interaction_count', 'confidence_score', 'updated_at'])
            logger.info(
                f"Updated UserTag '{user_tag.name}' for {user.username} from search "
                f'(interactions: {user_tag.interaction_count}, confidence: {user_tag.confidence_score:.2f})'
            )
        else:
            logger.info(f"Created UserTag '{user_tag.name}' for {user.username} from search")

        user_tags.append(user_tag)

    return user_tags


def auto_tag_from_conversation(user, message: str) -> list[UserTag]:
    """
    Auto-tag a user based on their conversation with Ember.

    When users discuss specific tools or topics in chat, this indicates
    interest. Create/update UserTags with AUTO_CONVERSATION source.

    Args:
        user: User instance who sent the message
        message: The chat message text

    Returns:
        List of created/updated UserTag instances
    """
    if not user or not message:
        return []

    # Extract tools mentioned in the message
    tools = extract_tools_from_text(message)

    if not tools:
        # No tools detected, just return empty (normal for most conversations)
        return []

    logger.info(f'Detected {len(tools)} tools in conversation by {user.username}: {[t.name for t in tools]}')

    user_tags = []

    for tool in tools:
        # Get tool's taxonomy
        taxonomy = tool.taxonomy
        if not taxonomy:
            logger.warning(f"Tool '{tool.name}' has no linked taxonomy, skipping")
            continue

        # Conversation-based tags start with slightly higher confidence than search (0.45)
        # because asking about something in chat is more intentional than a quick search
        base_confidence = 0.45

        # Get or create UserTag
        user_tag, created = UserTag.objects.get_or_create(
            user=user,
            taxonomy=taxonomy,
            defaults={
                'name': tool.name,
                'source': UserTag.TagSource.AUTO_CONVERSATION,
                'confidence_score': base_confidence,
                'interaction_count': 1,
            },
        )

        if not created:
            # Update existing tag - increment interaction count
            user_tag.interaction_count += 1

            # Boost confidence for repeat mentions (cap at 0.85)
            new_confidence = min(base_confidence + (user_tag.interaction_count - 1) * 0.1, 0.85)
            user_tag.confidence_score = max(user_tag.confidence_score, new_confidence)
            user_tag.updated_at = timezone.now()
            user_tag.save(update_fields=['interaction_count', 'confidence_score', 'updated_at'])
            logger.info(
                f"Updated UserTag '{user_tag.name}' for {user.username} from conversation "
                f'(interactions: {user_tag.interaction_count}, confidence: {user_tag.confidence_score:.2f})'
            )
        else:
            logger.info(f"Created UserTag '{user_tag.name}' for {user.username} from conversation")

        user_tags.append(user_tag)

    return user_tags
