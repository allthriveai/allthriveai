"""
Unified content discovery tool for Ava agent.

HYPER-PERSONALIZED, INTELLIGENT, AGENTIC content discovery.

This is the backbone of the chat app. Every response is tailored to:
- User's difficulty level (beginner/intermediate/advanced)
- Learning style preferences (visual/hands-on/conceptual)
- Tool interests and expertise
- Recent activity and what they've already seen
- Skill gaps and learning suggestions

Uses Weaviate vector search for semantic matching, not just keyword matching.

Philosophy: Every search is a learning opportunity tailored to YOU.
"""

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import TypedDict

from django.core.cache import cache
from django.core.validators import validate_slug
from django.db.models import Case, Count, Q, Value, When
from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# =============================================================================
# Constants
# =============================================================================

MAX_QUERY_LENGTH = 500
MAX_LIMIT = 12
CACHE_TTL_SECONDS = 60  # 1 minute
ALLOWED_CONTENT_TYPES = {'video', 'article', 'code-repo', 'quiz', 'game', 'project'}

# Rate limiting: max searches per user per minute
RATE_LIMIT_SEARCHES_PER_MINUTE = 10
RATE_LIMIT_WINDOW_SECONDS = 60

# Minimum relevance score for hybrid search results (0.0 to 1.0)
# This filters out low-quality matches that would confuse users
# With alpha=0.3 (70% keyword, 30% semantic), a score of 0.15 means
# the result has at least some keyword match relevance
MIN_HYBRID_RELEVANCE_SCORE = 0.15

# Content type to learning style mapping
LEARNING_STYLE_CONTENT_MAP = {
    'visual': ['video'],
    'hands_on': ['code-repo', 'project'],
    'conceptual': ['article'],
    'mixed': ['video', 'article', 'code-repo'],
}

# Difficulty progression
DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced']


# =============================================================================
# Type Definitions
# =============================================================================


class ContentItem(TypedDict, total=False):
    """Content item (game, quiz, tool info) for frontend rendering."""

    type: str
    gameType: str
    title: str
    description: str
    id: str
    url: str
    thumbnail: str
    questionCount: int
    difficulty: str
    matchReason: str  # Why this was returned

    # Tool comparison fields (only for type='toolInfo')
    tagline: str
    category: str
    pricingModel: str
    startingPrice: str
    hasFreeTier: bool
    keyFeatures: list[dict]  # [{title, description}]
    useCases: list[dict]  # [{title, description, example}]
    limitations: list[str]
    gameStats: dict  # {power, speed, versatility, ease_of_use, value}
    alternatives: list[str]  # Alternative tool slugs
    synergyTools: list[str]  # Tools that combo well
    logoUrl: str
    company: str  # Company name


class ProjectItem(TypedDict, total=False):
    """Project for frontend rendering."""

    id: int
    title: str
    slug: str
    description: str
    author: str
    authorAvatarUrl: str
    featuredImageUrl: str
    thumbnail: str
    categories: list[str]
    url: str
    contentType: str
    difficulty: str
    matchReason: str  # NEW: Why this was returned
    relevanceScore: float  # NEW: How relevant (for debugging)


class FindContentResult(TypedDict):
    """Result from find_content tool."""

    success: bool
    content: list[ContentItem]
    projects: list[ProjectItem]
    message: str
    error: str | None
    personalizationApplied: dict  # NEW: What personalization was applied


# =============================================================================
# Search Context - Extracted from Member Context
# =============================================================================


@dataclass
class SearchContext:
    """
    Search context extracted from member_context.

    This captures everything we know about the user to personalize results.
    """

    user_id: int | None = None

    # Learning preferences
    difficulty_level: str = 'beginner'
    learning_style: str = 'mixed'  # visual, hands_on, conceptual, mixed
    learning_goal: str = 'exploring'  # build_projects, understand_concepts, career, exploring

    # Interests (auto-detected + manual)
    tool_interests: list[str] = field(default_factory=list)  # Tool slugs they're interested in
    topic_interests: list[str] = field(default_factory=list)  # General topics

    # What to avoid
    recent_queries: list[str] = field(default_factory=list)  # Last 7 days

    # Profile context
    is_new_member: bool = True
    has_projects: bool = False

    # Feature preferences
    discovery_balance: int = 50  # 0=familiar, 100=surprise me

    @classmethod
    def from_state(cls, state: dict | None) -> 'SearchContext':
        """
        Extract search context from agent state.

        Uses defensive programming to handle malformed state gracefully.
        If any field has an unexpected type, it falls back to safe defaults.
        """
        if not state or not isinstance(state, dict):
            return cls()

        user_id = state.get('user_id')
        member_context = state.get('member_context')

        # Ensure member_context is a dict
        if not isinstance(member_context, dict):
            member_context = {}

        # Extract learning preferences (must be dict)
        learning = member_context.get('learning')
        if not isinstance(learning, dict):
            learning = {}

        # Extract tool/topic interests (must be lists of dicts)
        tool_prefs = member_context.get('tool_preferences')
        if not isinstance(tool_prefs, list):
            tool_prefs = []

        interests = member_context.get('interests')
        if not isinstance(interests, list):
            interests = []

        feature_interests = member_context.get('feature_interests')
        if not isinstance(feature_interests, dict):
            feature_interests = {}

        recent_queries = member_context.get('recent_queries')
        if not isinstance(recent_queries, list):
            recent_queries = []

        # Safely extract slugs from tool preferences (each item should be a dict)
        tool_interest_slugs = []
        for t in tool_prefs:
            if isinstance(t, dict) and t.get('slug'):
                tool_interest_slugs.append(t['slug'])

        # Safely extract slugs from interests (each item should be a dict)
        topic_interest_slugs = []
        for i in interests:
            if isinstance(i, dict) and i.get('slug'):
                topic_interest_slugs.append(i['slug'])

        return cls(
            user_id=user_id,
            difficulty_level=learning.get('difficulty_level', 'beginner')
            if isinstance(learning.get('difficulty_level'), str)
            else 'beginner',
            learning_style=learning.get('learning_style', 'mixed')
            if isinstance(learning.get('learning_style'), str)
            else 'mixed',
            learning_goal=learning.get('learning_goal', 'exploring')
            if isinstance(learning.get('learning_goal'), str)
            else 'exploring',
            tool_interests=tool_interest_slugs,
            topic_interests=topic_interest_slugs,
            recent_queries=[q for q in recent_queries if isinstance(q, str)],
            is_new_member=bool(member_context.get('is_new_member', True)),
            has_projects=bool(member_context.get('has_projects', False)),
            discovery_balance=int(feature_interests.get('discovery_balance', 50))
            if isinstance(feature_interests.get('discovery_balance'), int | float)
            else 50,
        )

    def get_preferred_content_types(self) -> list[str]:
        """Get content types based on learning style."""
        return LEARNING_STYLE_CONTENT_MAP.get(self.learning_style, [])

    def get_context_hash(self) -> str:
        """
        Hash of context for cache key.

        Uses 16 hex chars (64 bits) instead of 8 to prevent birthday-paradox
        collisions at scale (with 100k users, 8 chars has ~50% collision probability).
        """
        key_parts = [
            self.difficulty_level,
            self.learning_style,
            ','.join(sorted(self.tool_interests[:5])),
        ]
        return hashlib.sha256('|'.join(key_parts).encode()).hexdigest()[:16]  # noqa: S324


# =============================================================================
# Input Validation
# =============================================================================


def _validate_input(
    query: str,
    similar_to: int | str | None,
    content_types: list[str] | None,
    limit: int,
) -> tuple[str, list[str] | None, int]:
    """Validate and sanitize all inputs."""
    if query:
        query = query.strip()[:MAX_QUERY_LENGTH]
        query = re.sub(r'[<>"\']', '', query)

    if similar_to:
        if isinstance(similar_to, int):
            if similar_to < 1:
                raise ValueError('Invalid project ID')
        elif isinstance(similar_to, str):
            try:
                validate_slug(similar_to)
            except Exception as e:
                raise ValueError('Invalid project slug') from e

    if content_types:
        content_types = [ct for ct in content_types if ct in ALLOWED_CONTENT_TYPES]
        if not content_types:
            content_types = None

    limit = max(1, min(limit, MAX_LIMIT))

    return query, content_types, limit


# =============================================================================
# Cache Key Builder
# =============================================================================


def _build_cache_key(
    query: str,
    similar_to: int | str | None,
    content_types: list[str] | None,
    context: SearchContext,
) -> str:
    """Build cache key including personalization context."""
    parts = ['find_content_v2']  # Version bump for new format

    if query:
        query_hash = hashlib.sha256(query.lower().strip().encode()).hexdigest()  # noqa: S324
        parts.append(f'q:{query_hash}')
    elif similar_to:
        parts.append(f's:{similar_to}')
    else:
        parts.append(f'u:{context.user_id or "anon"}')

    if content_types:
        parts.append(f'ct:{",".join(sorted(content_types))}')

    # Include context hash for personalization
    parts.append(f'ctx:{context.get_context_hash()}')

    return ':'.join(parts)


# =============================================================================
# Helper Functions
# =============================================================================


def _serialize_project(project, match_reason: str = '', relevance_score: float = 0.0) -> ProjectItem:
    """Format project for frontend with camelCase keys and match reason."""
    return {
        'id': project.id,
        'title': project.title,
        'slug': project.slug,
        'description': (project.description or '')[:500],
        'author': getattr(project.user, 'username', ''),
        'authorAvatarUrl': getattr(project.user, 'avatar_url', '') or '',
        'featuredImageUrl': project.featured_image_url or '',
        'thumbnail': project.featured_image_url or project.banner_url or '',
        'categories': [cat.name for cat in project.categories.all()[:5]],
        'url': f'/{project.user.username}/{project.slug}',
        'contentType': getattr(project.content_type_taxonomy, 'slug', '') if project.content_type_taxonomy else '',
        'difficulty': getattr(project.difficulty_taxonomy, 'slug', '') if project.difficulty_taxonomy else '',
        'matchReason': match_reason,
        'relevanceScore': round(relevance_score, 3),
    }


def _deduplicate_projects(projects: list) -> list:
    """Remove duplicate projects by ID."""
    seen = set()
    result = []
    for p in projects:
        pid = p.id if hasattr(p, 'id') else p.get('id')
        if pid not in seen:
            seen.add(pid)
            result.append(p)
    return result


def _get_difficulty_index(difficulty: str) -> int:
    """Get numeric index for difficulty."""
    try:
        return DIFFICULTY_ORDER.index(difficulty.lower())
    except (ValueError, AttributeError):
        return 0  # Default to beginner


# =============================================================================
# Content Finders
# =============================================================================


def _find_games(query: str, context: SearchContext) -> list[ContentItem]:
    """Find games related to the query, personalized to user level."""
    if not query:
        return []

    try:
        from core.games.config import GAMES, get_topic_explanation

        matching_games = []
        query_lower = query.lower()

        for game in GAMES:
            topics_match = any(query_lower == topic or query_lower in topic for topic in game.get('topics', []))
            title_match = query_lower in game['title'].lower()
            slug_match = query_lower in game['slug'].lower()
            description_match = query_lower in game['description'].lower()

            if topics_match or title_match or slug_match or description_match:
                game_type_map = {
                    'context-snake': 'snake',
                    'ethics-defender': 'ethics',
                    'prompt-battle': 'prompt_battle',
                }
                game_type = game_type_map.get(game['slug'], 'snake')

                topic_explanation = get_topic_explanation(game['slug'], query_lower)
                if not topic_explanation:
                    topic_explanation = game['description']

                # Personalize match reason
                match_reason = 'Interactive learning'
                if context.learning_style == 'hands_on':
                    match_reason = 'Perfect for hands-on learners like you'
                elif context.learning_goal == 'build_projects':
                    match_reason = 'Practice before building'

                matching_games.append(
                    {
                        'type': 'inlineGame',
                        'gameType': game_type,
                        'title': game['title'],
                        'description': topic_explanation,
                        'url': game.get('url', f"/play/{game['slug']}"),
                        'matchReason': match_reason,
                    }
                )

        return matching_games[:2]

    except Exception as e:
        logger.warning(f'Game finder failed: {e}')
        return []


def _parse_tool_names(query: str) -> list[str]:
    """
    Parse multiple tool names from a query.

    Handles patterns like:
    - "Midjourney vs DALL-E"
    - "Midjourney and DALL-E"
    - "Midjourney or DALL-E"
    - "Midjourney, DALL-E, Stable Diffusion"
    - "compare Midjourney DALL-E"
    - "help me decide between X and Y"
    """
    # Remove common comparison phrases
    cleaned = query.lower()
    for phrase in [
        'help me decide between',
        'help me choose between',
        'compare',
        'difference between',
        'which is better',
        'should i use',
        'what should i use',
    ]:
        cleaned = cleaned.replace(phrase, '')

    # Split on common separators
    separators = [' vs ', ' versus ', ' or ', ' and ', ', ', ' v ', ' compared to ']
    parts = [cleaned]
    for sep in separators:
        new_parts = []
        for part in parts:
            new_parts.extend(part.split(sep))
        parts = new_parts

    # Clean up each part
    tool_names = []
    for part in parts:
        # Strip punctuation and whitespace
        name = part.strip().strip('?:;.!').strip()
        # Skip empty or too short
        if len(name) >= 2:
            tool_names.append(name)

    return tool_names[:5]  # Limit to 5 tools max


def _serialize_tool(tool: 'Tool', match_reason: str = 'Official tool information') -> ContentItem:  # noqa: F821
    """Serialize a Tool model to ContentItem with comparison fields."""
    # Safely get display values
    try:
        category_display = tool.get_category_display() if tool.category else ''
    except (AttributeError, ValueError):
        category_display = tool.category or ''

    try:
        pricing_display = tool.get_pricing_model_display() if tool.pricing_model else ''
    except (AttributeError, ValueError):
        pricing_display = tool.pricing_model or ''

    # Get topics for this tool
    topics = []
    try:
        topics = [t.name for t in tool.topics.all()[:5]]
    except Exception:
        topics = []  # Silently fallback if topics not loaded

    return {
        'type': 'toolInfo',
        'id': str(tool.id),
        'title': tool.name,
        'tagline': tool.tagline or '',
        'description': tool.overview or tool.description or '',
        'url': f'/tools/{tool.slug}',
        'logoUrl': tool.logo_url or '',
        'category': category_display,
        'company': tool.company.name if tool.company else '',
        'pricingModel': pricing_display,
        'startingPrice': tool.starting_price or '',
        'hasFreeTier': tool.has_free_tier,
        'keyFeatures': tool.key_features[:5] if tool.key_features else [],
        'useCases': tool.use_cases[:3] if tool.use_cases else [],
        'limitations': tool.limitations[:5] if tool.limitations else [],
        'gameStats': tool.game_stats or {},
        'alternatives': tool.alternatives[:5] if tool.alternatives else [],
        'synergyTools': tool.synergy_tools[:5] if tool.synergy_tools else [],
        # New comparison metadata fields
        'idealFor': tool.ideal_for[:5] if tool.ideal_for else [],
        'pricingTiers': tool.pricing_tiers[:3] if tool.pricing_tiers else [],
        'sdkLanguages': tool.sdk_languages[:8] if tool.sdk_languages else [],
        'hostingOptions': tool.hosting_options[:5] if tool.hosting_options else [],
        'complianceCerts': tool.compliance_certs[:5] if tool.compliance_certs else [],
        'topics': topics,
        'matchReason': match_reason,
    }


# Decision query patterns for topic-based search
DECISION_PATTERNS = [
    r'\bwhich\s+.+\s+should\s+i\s+use\b',
    r'\bbest\s+(?!practice|way|thing|part)\w+',  # "best X" but not "best practice/way"
    r'\bhelp\s+me\s+(decide|choose)\b',
    r'\brecommend\s+a?\b',
    r'\bwhat\s+.+\s+should\s+i\s+use\b',
    r'\btop\s+.+\s*(tools?|options?|choices?|frameworks?|databases?)\b',
    r'\bi\s+need\s+a\s+\w+',  # "I need a vector database"
]


def _is_decision_query(query: str) -> bool:
    """Check if query is asking for a decision/recommendation."""
    query_lower = query.lower()
    return any(re.search(p, query_lower) for p in DECISION_PATTERNS)


def _extract_topic_keywords(query: str) -> list[str]:
    """
    Extract potential topic keywords from a query.

    E.g., "which vector database should I use" -> ["vector database", "vector", "database"]
    """
    # Remove common decision-making words
    stop_words = {
        'which',
        'what',
        'should',
        'i',
        'use',
        'best',
        'help',
        'me',
        'decide',
        'choose',
        'between',
        'recommend',
        'a',
        'an',
        'the',
        'for',
        'to',
        'is',
        'are',
        'need',
        'want',
        'looking',
        'find',
        'top',
        'tools',
        'tool',
        'options',
    }

    words = query.lower().strip().split()
    keywords = [w for w in words if w not in stop_words and len(w) > 2]

    # Generate bigrams (two-word phrases)
    bigrams = []
    for i in range(len(keywords) - 1):
        bigrams.append(f'{keywords[i]} {keywords[i + 1]}')

    # Return bigrams first (more specific), then single words
    return bigrams + keywords


def _find_tools_by_topic(query: str, limit: int = 5) -> tuple[list[ContentItem], list[int]]:
    """
    Find tools matching a topic like 'vector database'.

    Searches the topics M2M relationship on Tool model.
    Extracts keywords from longer queries for better matching.

    Returns:
        Tuple of (serialized tools, tool IDs for project lookup)
    """
    try:
        from core.taxonomy.models import Taxonomy
        from core.tools.models import Tool

        # Extract potential topic keywords from the query
        keywords = _extract_topic_keywords(query)
        if not keywords:
            keywords = [query.lower().strip()]

        # Try each keyword until we find matching topics
        topics = None
        matched_keyword = None  # Track which keyword matched for better match reason
        for keyword in keywords:
            topics = Taxonomy.objects.filter(
                taxonomy_type='topic',
                is_active=True,
            ).filter(Q(name__icontains=keyword) | Q(slug__icontains=keyword.replace(' ', '-')))[:3]

            if topics.exists():
                matched_keyword = keyword
                break

        if not topics:
            return [], []

        topic_names = [t.name for t in topics]
        logger.info(f'Found matching topics for "{query}": {topic_names}')

        # Get tools linked to these topics, ordered by popularity
        tools = (
            Tool.objects.filter(
                topics__in=topics,
                is_active=True,
            )
            .select_related('company')
            .prefetch_related('topics')
            .order_by('-popularity_score', '-view_count', 'name')
            .distinct()[:limit]
        )

        if not tools:
            return [], []

        # Collect tool IDs for project lookup
        tool_ids = [tool.id for tool in tools]

        # Serialize with topic-based match reason
        results = []
        for tool in tools:
            # Use matched keyword if available for more specific match reason
            match_reason = f'{matched_keyword.title() if matched_keyword else topic_names[0]} tool'
            results.append(_serialize_tool(tool, match_reason=match_reason))

        logger.info(f'Topic-based search returned {len(results)} tools for "{query}"')
        return results, tool_ids

    except Exception as e:
        logger.warning(f'Topic-based tool search failed: {e}')
        return [], []


def _find_projects_using_tools(tool_ids: list[int], context: SearchContext, limit: int = 5) -> list[tuple]:
    """
    Find projects that use specific tools.

    This connects tool discovery to real community examples:
    "which LLM should I use" → finds LLM tools → finds projects using those LLMs

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    if not tool_ids:
        return []

    try:
        from core.projects.models import Project
        from core.tools.models import Tool

        # Get tool names for match reasons
        tool_name_map = dict(Tool.objects.filter(id__in=tool_ids).values_list('id', 'name'))

        # Find projects using any of these tools
        projects = (
            Project.objects.filter(
                tools__id__in=tool_ids,
                is_private=False,
                is_showcased=True,
            )
            .select_related('user', 'content_type_taxonomy', 'difficulty_taxonomy')
            .prefetch_related('categories', 'tools', 'likes')
            .annotate(like_count=Count('likes', distinct=True))
            .order_by('-like_count', '-created_at')
            .distinct()[:limit]
        )

        results = []
        for project in projects:
            # Find which tools from our list this project uses
            project_tool_ids = set(project.tools.values_list('id', flat=True))
            matching_tool_ids = project_tool_ids & set(tool_ids)

            if matching_tool_ids:
                # Get names of matching tools
                matching_tool_names = [tool_name_map.get(tid, 'this tool') for tid in matching_tool_ids]
                if len(matching_tool_names) == 1:
                    match_reason = f'Built with {matching_tool_names[0]}'
                else:
                    match_reason = f'Uses {", ".join(matching_tool_names[:2])}'

                # Higher score for projects using multiple of our target tools
                score = 0.8 + (0.05 * min(len(matching_tool_ids), 3))
                results.append((project, match_reason, score))

        logger.info(f'Found {len(results)} projects using {len(tool_ids)} tools')
        return results

    except Exception as e:
        logger.warning(f'Projects-using-tools search failed: {e}')
        return []


def _find_tool_info(query: str) -> tuple[list[ContentItem], list[int]]:
    """
    Find tool info for the query.

    Supports:
    - Multiple tools for comparison queries like "Midjourney vs DALL-E"
    - Decision queries like "which vector database should I use"
    - Direct tool lookups by name/slug

    Returns:
        Tuple of (tool info items, tool IDs for related project lookup)
    """
    if not query:
        return [], []

    try:
        from core.tools.models import Tool

        # Check for decision query first (topic-based search)
        if _is_decision_query(query):
            results, tool_ids = _find_tools_by_topic(query)
            if results:
                return results, tool_ids

        # Parse potential tool names from query
        tool_names = _parse_tool_names(query)

        if not tool_names:
            # No explicit tool names found, try topic-based search
            results, tool_ids = _find_tools_by_topic(query)
            if results:
                return results, tool_ids
            return [], []

        # Build query for multiple tools - prioritize exact matches
        # First try exact matches only
        exact_query = Q()
        for name in tool_names:
            name_normalized = name.replace(' ', '-')
            exact_query |= Q(slug__iexact=name_normalized)
            exact_query |= Q(name__iexact=name)

        tools = list(
            Tool.objects.filter(exact_query, is_active=True)
            .select_related('company')
            .prefetch_related('topics')
            .order_by('name')
            .distinct()[:5]
        )

        # If we didn't find enough exact matches, try partial matches
        # but only for longer queries (3+ chars) to avoid over-matching
        if len(tools) < len(tool_names):
            partial_query = Q()
            for name in tool_names:
                if len(name) >= 3:  # Only partial match for longer names
                    name_normalized = name.replace(' ', '-')
                    partial_query |= Q(name__icontains=name)
                    partial_query |= Q(slug__icontains=name_normalized)

            if partial_query:
                existing_ids = [t.id for t in tools]
                partial_tools = (
                    Tool.objects.filter(partial_query, is_active=True)
                    .exclude(id__in=existing_ids)
                    .select_related('company')
                    .prefetch_related('topics')
                    .order_by('name')
                    .distinct()[: 5 - len(tools)]
                )
                tools.extend(partial_tools)

        if not tools:
            # Fallback: try single tool lookup with original query
            query_normalized = query.lower().strip().replace(' ', '-')
            tool = (
                Tool.objects.filter(
                    Q(slug=query_normalized) | Q(name__iexact=query.replace('-', ' ')),
                    is_active=True,
                )
                .select_related('company')
                .prefetch_related('topics')
                .first()
            )

            if tool:
                return [_serialize_tool(tool)], [tool.id]

            # Last resort: try topic-based search
            return _find_tools_by_topic(query)

        # Collect tool IDs for project lookup
        tool_ids = [tool.id for tool in tools]

        # Serialize all found tools
        results = [_serialize_tool(tool) for tool in tools]

        # Update match reasons for comparison
        if len(results) > 1:
            for i, result in enumerate(results):
                result['matchReason'] = f'Tool {i + 1} of {len(results)} for comparison'

        return results, tool_ids

    except Exception as e:
        logger.warning(f'Tool finder failed: {e}')
        return [], []


def _find_quizzes(query: str, context: SearchContext, limit: int = 2) -> list[ContentItem]:
    """Find quizzes related to the query, filtered by difficulty."""
    if not query:
        return []

    try:
        from core.quizzes.models import Quiz

        query_normalized = query.lower().strip().replace(' ', '-')

        queryset = (
            Quiz.objects.filter(
                Q(tools__slug=query_normalized)
                | Q(topics__slug=query_normalized)
                | Q(tools__name__icontains=query.replace('-', ' '))
                | Q(topics__name__icontains=query.replace('-', ' '))
                | Q(title__icontains=query.replace('-', ' ')),
                is_published=True,
            )
            .select_related('difficulty_taxonomy')
            .distinct()
        )

        # Order by difficulty match (prioritize user's level)
        queryset = queryset.annotate(
            diff_order=Case(
                *[When(difficulty_taxonomy__slug=d, then=Value(i)) for i, d in enumerate(DIFFICULTY_ORDER)],
                default=Value(0),
            )
        ).order_by('diff_order')[:limit]

        quizzes = []
        for quiz in queryset:
            difficulty = quiz.difficulty
            if quiz.difficulty_taxonomy:
                difficulty = quiz.difficulty_taxonomy.slug

            match_reason = 'Test your knowledge'
            if difficulty == context.difficulty_level:
                match_reason = f'Matched to your {difficulty} level'

            quizzes.append(
                {
                    'type': 'quizCard',
                    'id': str(quiz.id),
                    'title': quiz.title,
                    'description': (quiz.description or '')[:200],
                    'difficulty': difficulty or 'beginner',
                    'questionCount': quiz.question_count,
                    'url': f'/quizzes/{quiz.slug}' if quiz.slug else f'/quizzes/{quiz.id}',
                    'matchReason': match_reason,
                }
            )

        return quizzes

    except Exception as e:
        logger.warning(f'Quiz finder failed: {e}')
        return []


# =============================================================================
# Intelligent Project Search
# =============================================================================


def _search_projects_semantic(
    query: str,
    context: SearchContext,
    content_types: list[str] | None,
    category: str,
    limit: int,
) -> list[tuple]:
    """
    Hybrid search using Weaviate (70% keyword, 30% semantic).

    Uses alpha=0.3 to favor our robust tagging system while still
    benefiting from semantic matching for related concepts.

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    try:
        from services.weaviate import get_embedding_service, get_weaviate_client
        from services.weaviate.client import WeaviateClientError
        from services.weaviate.schema import WeaviateSchema

        embedding_service = get_embedding_service()
        client = get_weaviate_client()

        # Check if Weaviate is available
        if not client.is_available():
            logger.info('Weaviate unavailable, falling back to keyword search')
            return []

        # Generate query embedding for hybrid search
        query_vector = embedding_service.generate_embedding(query)

        if not query_vector:
            logger.warning('Failed to generate query embedding, falling back to keyword search')
            return []

        # Use hybrid_search with alpha=0.3 (70% keyword, 30% semantic)
        # This matches globalSearch.ts behavior and favors our robust tagging system
        weaviate_results = client.hybrid_search(
            collection=WeaviateSchema.PROJECT_COLLECTION,
            query=query,
            vector=query_vector,
            alpha=0.3,  # 70% keyword, 30% semantic - favors tagging system
            limit=limit * 3,  # Get more candidates for filtering
            return_properties=['project_id', 'title', 'tool_names', 'category_names'],
            enforce_visibility=True,  # Only show public, non-archived projects
        )

        project_ids = []
        scores = {}

        for item in weaviate_results:
            pid = item.get('project_id')
            if pid:
                # Score is in _additional for hybrid search (already 0-1 range)
                score = item.get('_additional', {}).get('score', 0.0)
                if isinstance(score, str):
                    score = float(score)
                score = max(0, min(1, score))

                # Only include results above the minimum threshold
                if score >= MIN_HYBRID_RELEVANCE_SCORE:
                    project_ids.append(int(pid))
                    scores[int(pid)] = score
                else:
                    logger.debug(f'Filtered out project {pid} with low score {score:.3f}')

        if not project_ids:
            logger.debug(f'No results above threshold {MIN_HYBRID_RELEVANCE_SCORE} from Weaviate')
            return []

        # Fetch full project objects from Django
        from core.projects.models import Project

        projects = (
            Project.objects.filter(
                id__in=project_ids,
                is_private=False,
                is_showcased=True,
            )
            .select_related('user', 'content_type_taxonomy', 'difficulty_taxonomy')
            .prefetch_related('categories', 'tools', 'likes')
        )

        # Apply content type filter
        if content_types:
            projects = projects.filter(content_type_taxonomy__slug__in=content_types)

        # Apply category filter
        if category:
            projects = projects.filter(categories__name__icontains=category).distinct()

        # Build result tuples with scores
        results = []
        for project in projects:
            relevance = scores.get(project.id, 0.5)
            match_reason = f'Hybrid match ({int(relevance * 100)}% relevant)'
            results.append((project, match_reason, relevance))

        # Sort by relevance score
        results.sort(key=lambda x: x[2], reverse=True)

        logger.info(f'Hybrid search returned {len(results)} results for query: {query[:50]}')
        return results[:limit]

    except WeaviateClientError as e:
        logger.warning(f'Weaviate client error, falling back to keyword search: {e}')
        return []
    except Exception as e:
        logger.warning(f'Semantic search failed: {e}', exc_info=True)
        return []


def _search_projects_keyword(
    query: str,
    context: SearchContext,
    content_types: list[str] | None,
    category: str,
    limit: int,
) -> list[tuple]:
    """
    Keyword-based search as fallback.

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    try:
        from core.projects.models import Project

        queryset = (
            Project.objects.filter(
                is_private=False,
                is_showcased=True,
            )
            .select_related('user', 'content_type_taxonomy', 'difficulty_taxonomy')
            .prefetch_related('categories', 'tools', 'likes')
        )

        if query:
            # Simple filter - search across text fields and related name fields
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(tools__name__icontains=query)
                | Q(categories__name__icontains=query)
                | Q(topics__name__icontains=query)
            ).distinct()

        if content_types:
            queryset = queryset.filter(content_type_taxonomy__slug__in=content_types)

        if category:
            queryset = queryset.filter(categories__name__icontains=category).distinct()

        # Simple ordering by likes and recency
        queryset = queryset.annotate(like_count=Count('likes', distinct=True)).order_by('-like_count', '-created_at')

        results = []
        for project in queryset[:limit]:
            # Determine match reason based on what matched
            title_lower = project.title.lower()
            query_lower = query.lower()

            if query_lower in title_lower:
                match_reason = 'Title match'
                score = 0.9
            elif any(query_lower in t.name.lower() for t in project.tools.all()):
                match_reason = f'Uses {query}'
                score = 0.8
            elif project.description and query_lower in project.description.lower():
                match_reason = 'Description match'
                score = 0.7
            else:
                match_reason = 'Related content'
                score = 0.6

            results.append((project, match_reason, score))

        return results

    except Exception as e:
        logger.warning(f'Keyword search failed: {e}', exc_info=True)
        return []


def _search_projects_personalized(
    query: str,
    context: SearchContext,
    content_types: list[str] | None,
    category: str,
    limit: int,
) -> list[tuple]:
    """
    Intelligent personalized search combining semantic + keyword + personalization.

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    # Try semantic search first
    semantic_results = _search_projects_semantic(query, context, content_types, category, limit * 2)

    # Fall back to keyword search if semantic fails
    if not semantic_results:
        semantic_results = _search_projects_keyword(query, context, content_types, category, limit * 2)

    if not semantic_results:
        return []

    # Apply personalization scoring
    scored_results = []

    for project, base_reason, base_score in semantic_results:
        score = base_score
        reasons = [base_reason]

        # 1. Difficulty matching boost
        project_diff = (
            getattr(project.difficulty_taxonomy, 'slug', 'beginner') if project.difficulty_taxonomy else 'beginner'
        )
        user_diff_idx = _get_difficulty_index(context.difficulty_level)
        project_diff_idx = _get_difficulty_index(project_diff)

        if project_diff_idx == user_diff_idx:
            score += 0.15
            reasons.append(f'Matches your {project_diff} level')
        elif project_diff_idx == user_diff_idx + 1:
            score += 0.05
            reasons.append('Slight challenge')
        elif project_diff_idx > user_diff_idx + 1:
            score -= 0.1  # Too advanced, penalize

        # 2. Learning style boost
        content_type = getattr(project.content_type_taxonomy, 'slug', '') if project.content_type_taxonomy else ''
        preferred_types = context.get_preferred_content_types()

        if content_type in preferred_types:
            score += 0.1
            style_names = {'video': 'visual', 'code-repo': 'hands-on', 'article': 'reading'}
            style_name = style_names.get(content_type, content_type)
            reasons.append(f'Great for {style_name} learning')

        # 3. Tool interest boost
        project_tools = [t.slug for t in project.tools.all()]
        matching_tools = set(project_tools) & set(context.tool_interests)
        if matching_tools:
            score += 0.1
            reasons.append('Uses tools you follow')

        # 4. Popularity factor (minor)
        like_count = getattr(project, 'like_count', 0) or project.likes.count()
        if like_count > 50:
            score += 0.05
        elif like_count > 10:
            score += 0.02

        # Combine reasons
        if len(reasons) > 1:
            match_reason = reasons[0] + ' • ' + reasons[1]
        else:
            match_reason = reasons[0]

        scored_results.append((project, match_reason, min(score, 1.0)))

    # Sort by final score
    scored_results.sort(key=lambda x: x[2], reverse=True)

    return scored_results[:limit]


def _get_trending_projects(limit: int = 3) -> list:
    """Get trending projects."""
    try:
        from services.personalization import TrendingEngine

        engine = TrendingEngine()
        result = engine.get_trending_feed(page=1, page_size=limit)
        return result.get('projects', [])

    except Exception as e:
        logger.warning(f'Trending engine failed: {e}')
        return []


def _get_personalized_projects(user_id: int, context: SearchContext, limit: int = 3) -> list[tuple]:
    """
    Get personalized projects using PersonalizationEngine.

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    try:
        from django.contrib.auth import get_user_model

        from services.personalization import PersonalizationEngine

        User = get_user_model()
        user = User.objects.get(id=user_id)

        engine = PersonalizationEngine()
        result = engine.get_for_you_feed(user=user, page=1, page_size=limit)

        projects = result.get('projects', [])

        # Convert to tuples with personalized reasons
        return [(p, 'Personalized for you', 0.7) for p in projects]

    except Exception as e:
        logger.warning(f'Personalization engine failed: {e}')
        return []


def _get_similar_projects(similar_to: int | str, context: SearchContext, limit: int) -> list[tuple]:
    """
    Get projects similar to the given project, personalized.

    Returns list of (project, match_reason, relevance_score) tuples.
    """
    try:
        from core.projects.models import Project

        if isinstance(similar_to, int):
            source = Project.objects.prefetch_related('categories', 'tools').get(id=similar_to)
        else:
            source = Project.objects.prefetch_related('categories', 'tools').get(slug=similar_to)

        category_ids = list(source.categories.values_list('id', flat=True))
        tool_ids = list(source.tools.values_list('id', flat=True))

        queryset = (
            Project.objects.filter(is_private=False, is_showcased=True)
            .exclude(id=source.id)
            .select_related('user', 'content_type_taxonomy', 'difficulty_taxonomy')
            .prefetch_related('categories', 'tools', 'likes')
        )

        if category_ids or tool_ids:
            queryset = queryset.filter(Q(categories__id__in=category_ids) | Q(tools__id__in=tool_ids)).distinct()

        queryset = queryset.annotate(like_count=Count('likes')).order_by('-like_count', '-created_at')

        results = []
        for project in queryset[:limit]:
            # Check what's similar
            shared_categories = set(project.categories.values_list('id', flat=True)) & set(category_ids)
            shared_tools = set(project.tools.values_list('id', flat=True)) & set(tool_ids)

            if shared_tools:
                match_reason = 'Uses same tools'
                score = 0.85
            elif shared_categories:
                match_reason = 'Same category'
                score = 0.75
            else:
                match_reason = 'Related project'
                score = 0.6

            results.append((project, match_reason, score))

        return results

    except Exception as e:
        logger.warning(f'Similar projects failed: {e}')
        return []


# =============================================================================
# Main Tool
# =============================================================================


class FindContentInput(BaseModel):
    """Input schema for find_content tool."""

    model_config = {'extra': 'allow'}

    query: str = Field(
        default='',
        description='Search term, topic, or project name. Empty for feed mode.',
    )
    similar_to: int | str | None = Field(
        default=None,
        description='Project ID or slug for "more like this" mode.',
    )
    content_types: list[str] | None = Field(
        default=None,
        description='Filter: video, article, code-repo, quiz, game, project.',
    )
    category: str = Field(
        default='',
        description='Category filter (e.g., "AI Agents", "Developer & Coding").',
    )
    limit: int = Field(
        default=6,
        ge=1,
        le=12,
        description='Maximum number of projects to return (1-12).',
    )
    state: dict | None = Field(
        default=None,
        description='Internal - injected by agent with user context and member_context.',
    )


def _check_rate_limit(user_id: int | None) -> tuple[bool, int]:
    """
    Check if user has exceeded the search rate limit.

    Uses a sliding window counter in Redis/cache.

    Args:
        user_id: User ID to check (None = anonymous, skip rate limit)

    Returns:
        Tuple of (is_allowed, current_count)
    """
    if user_id is None:
        # Anonymous users skip rate limiting (they have limited functionality anyway)
        return (True, 0)

    rate_limit_key = f'find_content:rate_limit:{user_id}'
    current_count = cache.get(rate_limit_key, 0)

    if current_count >= RATE_LIMIT_SEARCHES_PER_MINUTE:
        logger.warning(f'Rate limit exceeded for user {user_id}: {current_count}/{RATE_LIMIT_SEARCHES_PER_MINUTE}')
        return (False, current_count)

    # Increment counter
    try:
        # Use cache.incr if available (atomic increment)
        new_count = cache.incr(rate_limit_key)
        if new_count == 1:
            # First request in window, set TTL
            cache.expire(rate_limit_key, RATE_LIMIT_WINDOW_SECONDS)
    except (ValueError, TypeError):
        # Key doesn't exist or incr not supported, set with default TTL
        cache.set(rate_limit_key, 1, timeout=RATE_LIMIT_WINDOW_SECONDS)
        new_count = 1

    return (True, new_count)


@tool(args_schema=FindContentInput)
def find_content(
    query: str = '',
    similar_to: int | str | None = None,
    content_types: list[str] | None = None,
    category: str = '',
    limit: int = 6,
    state: dict | None = None,
) -> dict:
    """
    Find content on AllThrive - hyper-personalized, intelligent discovery.

    EVERY response is tailored to the user:
    - Difficulty-matched projects (beginner sees beginner content)
    - Learning style preferences (visual learners get videos)
    - Tool interests (shows projects using tools they follow)
    - Semantic search (finds related content, not just keyword matches)

    This is the ONLY tool needed for content discovery.

    Examples:
    - find_content() → personalized feed based on interests
    - find_content(query="RAG") → semantic search + games + quizzes at your level
    - find_content(query="langchain") → tool info + matching projects
    - find_content(similar_to=123) → projects like #123

    Returns:
        Dictionary with:
        - content: List of games, quizzes, tool info (with matchReason)
        - projects: List of project cards (with matchReason and relevanceScore)
        - personalizationApplied: What personalization was used
        - success: Boolean
        - message: Description for AI response
    """
    # Extract search context from member_context
    context = SearchContext.from_state(state)

    logger.info(
        f'find_content called: query={query}, similar_to={similar_to}, '
        f'user_id={context.user_id}, difficulty={context.difficulty_level}, '
        f'learning_style={context.learning_style}'
    )

    # Check rate limit before processing
    is_allowed, current_count = _check_rate_limit(context.user_id)
    if not is_allowed:
        return {
            'success': False,
            'content': [],
            'projects': [],
            'message': 'Please wait a moment before searching again.',
            'error': 'rate_limit_exceeded',
            'personalizationApplied': {},
        }

    # Initialize response
    response: FindContentResult = {
        'success': True,
        'content': [],
        'projects': [],
        'message': '',
        'error': None,
        'personalizationApplied': {
            'difficultyLevel': context.difficulty_level,
            'learningStyle': context.learning_style,
            'toolInterests': context.tool_interests[:5],
            'isNewMember': context.is_new_member,
        },
    }

    try:
        query, content_types, limit = _validate_input(query, similar_to, content_types, limit)
    except ValueError as e:
        logger.warning(f'Input validation failed: {e}')
        response['success'] = False
        response['error'] = str(e)
        response['message'] = str(e)
        return response

    # Verify user exists
    if context.user_id:
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            if not User.objects.filter(id=context.user_id, is_active=True).exists():
                logger.warning(f'Invalid user_id: {context.user_id}')
                context.user_id = None
        except Exception as e:
            logger.debug(f'Failed to verify user existence: {e}')
            context.user_id = None

    # Check cache
    cache_key = _build_cache_key(query, similar_to, content_types, context)
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f'Cache hit for find_content: {cache_key}')
        return cached

    # 1. Find inline games (personalized)
    try:
        games = _find_games(query, context)
        response['content'].extend(games)
    except Exception as e:
        logger.warning(f'Game finder failed: {e}')

    # 2. Find tool info (supports multiple tools for comparison)
    # Also returns tool IDs for finding related projects
    discovered_tool_ids = []
    try:
        tool_infos, discovered_tool_ids = _find_tool_info(query)
        if tool_infos:
            response['content'].extend(tool_infos)
    except Exception as e:
        logger.warning(f'Tool finder failed: {e}')

    # 3. Get projects based on mode (PERSONALIZED)
    project_tuples = []
    try:
        if similar_to:
            # "More like this" mode
            project_tuples = _get_similar_projects(similar_to, context, limit)
        elif query:
            # If we found tools, prioritize projects using those tools
            # This connects "which LLM should I use" → projects using Claude, ChatGPT, etc.
            if discovered_tool_ids:
                tool_projects = _find_projects_using_tools(discovered_tool_ids, context, limit=limit)
                project_tuples.extend(tool_projects)
                logger.info(f'Found {len(tool_projects)} projects using discovered tools')

            # Supplement with general search if we need more projects
            if len(project_tuples) < limit:
                remaining = limit - len(project_tuples)
                existing_ids = {p.id for p, _, _ in project_tuples}
                search_results = _search_projects_personalized(query, context, content_types, category, remaining + 3)
                # Dedupe and add
                for p, reason, score in search_results:
                    if p.id not in existing_ids and len(project_tuples) < limit:
                        project_tuples.append((p, reason, score))
                        existing_ids.add(p.id)
        else:
            # Feed mode - personalized feed
            if context.user_id:
                project_tuples = _get_personalized_projects(context.user_id, context, limit)

            # Supplement with trending if needed
            if len(project_tuples) < limit:
                trending = _get_trending_projects(limit=limit - len(project_tuples))
                for p in trending:
                    project_tuples.append((p, 'Trending now', 0.6))

        # Serialize projects with match reasons
        response['projects'] = [
            _serialize_project(p, match_reason, score) for p, match_reason, score in project_tuples[:limit]
        ]

    except Exception as e:
        logger.error(f'Project search failed: {e}', exc_info=True)
        # Fallback to cached trending
        try:
            from services.personalization.cache import PersonalizationCache

            cached_trending = PersonalizationCache.get_trending_feed(page=1)
            if cached_trending and cached_trending.get('projects'):
                response['projects'] = [
                    _serialize_project(p, 'Trending (fallback)', 0.5) for p in cached_trending['projects'][:limit]
                ]
                logger.info('find_content: Using fallback cached trending projects')
        except Exception as fallback_err:
            logger.warning(f'find_content: Fallback cache also failed: {fallback_err}')

    # 4. Find relevant quizzes (difficulty-matched)
    try:
        quizzes = _find_quizzes(query, context, limit=2)
        response['content'].extend(quizzes)
    except Exception as e:
        logger.warning(f'Quiz finder failed: {e}')

    # Build message
    content_count = len(response['content'])
    project_count = len(response['projects'])

    if content_count == 0 and project_count == 0:
        response['message'] = f"I couldn't find content about '{query}'. Let me help you explore other topics."
    elif similar_to:
        response['message'] = f'Found {project_count} similar projects.'
    elif query:
        parts = []
        if any(c.get('type') == 'inlineGame' for c in response['content']):
            parts.append('an interactive game')

        # Count tools for comparison message
        tool_count = sum(1 for c in response['content'] if c.get('type') == 'toolInfo')
        if tool_count > 1:
            tool_names = [c.get('title') for c in response['content'] if c.get('type') == 'toolInfo']
            parts.append(f'comparison info for {", ".join(tool_names)}')
        elif tool_count == 1:
            parts.append('tool information')

        if project_count > 0:
            # Check if projects are specifically using discovered tools
            using_tools = sum(
                1
                for p in response['projects']
                if 'Built with' in p.get('matchReason', '') or 'Uses' in p.get('matchReason', '')
            )
            if using_tools > 0 and tool_count > 0:
                parts.append(f'{project_count} projects by people using these tools')
            else:
                parts.append(f'{project_count} community projects')
        if any(c.get('type') == 'quizCard' for c in response['content']):
            parts.append('quizzes')

        response['message'] = f"Found {' and '.join(parts)} about '{query}'."
    else:
        if context.user_id:
            response['message'] = f'Here are {project_count} projects personalized for you.'
        else:
            response['message'] = f'Here are {project_count} trending projects.'

    # Cache the response
    cache.set(cache_key, response, CACHE_TTL_SECONDS)

    logger.info(
        f'find_content returning: {content_count} content items, {project_count} projects, '
        f'personalization: difficulty={context.difficulty_level}, style={context.learning_style}'
    )

    return response


# =============================================================================
# Exports
# =============================================================================

# Tools that need state injection
TOOLS_NEEDING_STATE = {'find_content'}

# All tools from this module
FIND_CONTENT_TOOLS = [find_content]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in FIND_CONTENT_TOOLS}
