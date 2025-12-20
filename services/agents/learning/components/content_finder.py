"""
Content finder component.

Unified discovery of learning content across Tools, Projects, Quizzes, and Games.
Taxonomy-driven - automatically supports new content types and topics.
"""

import logging
from typing import TypedDict

from django.db.models import Exists, OuterRef, Q

from core.games.config import GAMES, get_topic_explanation

logger = logging.getLogger(__name__)


class ToolInfo(TypedDict):
    """Tool information for learning."""

    name: str
    slug: str
    description: str
    key_features: list[dict]
    use_cases: list[dict]
    usage_tips: list[str]
    best_practices: list[str]
    documentation_url: str
    website_url: str


class ProjectInfo(TypedDict):
    """Project information for learning."""

    id: str
    title: str
    slug: str
    username: str
    content_type: str
    thumbnail: str
    url: str
    difficulty: str
    description: str


class QuizInfo(TypedDict):
    """Quiz information for learning."""

    id: str
    title: str
    slug: str
    description: str
    difficulty: str
    question_count: int
    estimated_time: int
    url: str


class GameInfo(TypedDict):
    """Game information for learning."""

    slug: str
    title: str
    description: str
    topic: str
    url: str
    topic_explanation: str  # Contextual explanation connecting game to queried topic


class ContentFinderResult(TypedDict):
    """Result from content finder."""

    tool: ToolInfo | None
    projects: list[ProjectInfo]
    quizzes: list[QuizInfo]
    games: list[GameInfo]
    query: str
    content_type_filter: str


class ContentFinder:
    """
    Finds learning content across Tools, Projects, Quizzes, and Games.

    Taxonomy-driven - queries by tool slug, topic slug, or content_type.
    Automatically supports new taxonomy terms without code changes.

    Games are imported from core.games.config (single source of truth).
    """

    @classmethod
    def find(
        cls,
        query: str,
        content_type: str = '',
        limit: int = 5,
        user_id: int | None = None,
        learner_context: dict | None = None,
    ) -> ContentFinderResult:
        """
        Find learning content matching the query.

        Args:
            query: Tool slug, topic slug, or search term
            content_type: Optional filter (video, article, quiz, game, etc.)
            limit: Maximum results per category
            user_id: User ID for personalization
            learner_context: Injected learner context for prioritization

        Returns:
            ContentFinderResult with tool, projects, quizzes, and games
        """
        logger.info(
            'Finding learning content',
            extra={'query': query, 'content_type': content_type, 'user_id': user_id},
        )

        # Normalize query
        query_normalized = query.lower().strip().replace(' ', '-')

        # Get tool info if query matches a tool
        tool_info = cls._find_tool(query_normalized)

        # Get projects
        projects = cls._find_projects(
            query_normalized,
            content_type,
            limit,
            learner_context,
        )

        # Get quizzes
        quizzes = (
            cls._find_quizzes(
                query_normalized,
                limit,
            )
            if not content_type or content_type in ('quiz', 'quiz-challenges')
            else []
        )

        # Get games
        games = (
            cls._find_games(
                query_normalized,
            )
            if not content_type or content_type == 'game'
            else []
        )

        return {
            'tool': tool_info,
            'projects': projects,
            'quizzes': quizzes,
            'games': games,
            'query': query,
            'content_type_filter': content_type,
        }

    @classmethod
    def _find_tool(cls, query: str) -> ToolInfo | None:
        """Find tool by slug or name."""
        from core.tools.models import Tool

        try:
            # Try exact slug match first
            tool = Tool.objects.filter(
                Q(slug=query) | Q(name__iexact=query.replace('-', ' ')),
                is_active=True,
            ).first()

            if not tool:
                return None

            return {
                'name': tool.name,
                'slug': tool.slug,
                'description': tool.description,
                'key_features': tool.key_features or [],
                'use_cases': tool.use_cases or [],
                'usage_tips': tool.usage_tips or [],
                'best_practices': tool.best_practices or [],
                'documentation_url': tool.documentation_url or '',
                'website_url': tool.website_url or '',
            }
        except Exception as e:
            logger.error('Error finding tool', extra={'query': query, 'error': str(e)}, exc_info=True)
            return None

    @classmethod
    def _find_projects(
        cls,
        query: str,
        content_type: str,
        limit: int,
        learner_context: dict | None,
    ) -> list[ProjectInfo]:
        """Find learning-eligible projects matching query."""
        from core.learning_paths.models import ProjectLearningMetadata
        from core.projects.models import Project

        try:
            # Build base query - public, not archived
            base_filter = Q(is_private=False, is_archived=False)

            # Filter by tool slug or topic slug
            content_filter = (
                Q(tools__slug=query)
                | Q(topics__slug=query)
                | Q(tools__name__icontains=query.replace('-', ' '))
                | Q(topics__name__icontains=query.replace('-', ' '))
                | Q(title__icontains=query.replace('-', ' '))
            )

            # Use subquery to annotate learning eligibility (avoids loading all IDs)
            eligible_subquery = ProjectLearningMetadata.objects.filter(
                project_id=OuterRef('pk'),
                is_learning_eligible=True,
            )

            queryset = (
                Project.objects.filter(base_filter & content_filter)
                .annotate(is_learning_eligible=Exists(eligible_subquery))
                .select_related(
                    'user',
                    'content_type_taxonomy',
                    'difficulty_taxonomy',
                )
                .prefetch_related('tools', 'topics')
                .distinct()
                # Order by learning eligibility first
                .order_by('-is_learning_eligible')
            )

            # Filter by content_type if specified
            if content_type:
                queryset = queryset.filter(content_type_taxonomy__slug=content_type)

            # Get projects (already sorted by eligibility)
            all_projects = list(queryset[: limit * 2])

            # Apply learner preference for content type prioritization
            preferred_style = None
            if learner_context and learner_context.get('profile'):
                preferred_style = learner_context['profile'].get('learning_style')

            # Sort by preference if available
            if preferred_style == 'visual':
                all_projects.sort(
                    key=lambda p: (0 if p.content_type_taxonomy and p.content_type_taxonomy.slug == 'video' else 1)
                )

            projects: list[ProjectInfo] = []
            for project in all_projects[:limit]:
                content_type_slug = ''
                if project.content_type_taxonomy:
                    content_type_slug = project.content_type_taxonomy.slug

                difficulty_slug = ''
                if project.difficulty_taxonomy:
                    difficulty_slug = project.difficulty_taxonomy.slug

                # Get thumbnail from featured_image or banner
                thumbnail = project.featured_image_url or project.banner_url or ''

                projects.append(
                    {
                        'id': str(project.id),
                        'title': project.title,
                        'slug': project.slug,
                        'username': project.user.username,
                        'content_type': content_type_slug,
                        'thumbnail': thumbnail,
                        'url': f'/{project.user.username}/{project.slug}',
                        'difficulty': difficulty_slug,
                        'description': (project.description or '')[:200],
                    }
                )

            return projects

        except Exception as e:
            logger.error('Error finding projects', extra={'query': query, 'error': str(e)}, exc_info=True)
            return []

    @classmethod
    def _find_quizzes(cls, query: str, limit: int) -> list[QuizInfo]:
        """Find quizzes matching query."""
        from core.quizzes.models import Quiz

        try:
            queryset = (
                Quiz.objects.filter(
                    Q(tools__slug=query)
                    | Q(topics__slug=query)
                    | Q(tools__name__icontains=query.replace('-', ' '))
                    | Q(topics__name__icontains=query.replace('-', ' '))
                    | Q(title__icontains=query.replace('-', ' ')),
                    is_published=True,
                )
                .select_related('difficulty_taxonomy')
                .distinct()[:limit]
            )

            quizzes = []
            for quiz in queryset:
                difficulty = quiz.difficulty  # Fallback to old field
                if quiz.difficulty_taxonomy:
                    difficulty = quiz.difficulty_taxonomy.slug

                quizzes.append(
                    {
                        'id': str(quiz.id),
                        'title': quiz.title,
                        'slug': quiz.slug or '',
                        'description': (quiz.description or '')[:200],
                        'difficulty': difficulty,
                        'question_count': quiz.question_count,
                        'estimated_time': quiz.estimated_time,
                        'url': f'/quizzes/{quiz.slug}' if quiz.slug else f'/quizzes/{quiz.id}',
                    }
                )

            return quizzes

        except Exception as e:
            logger.error('Error finding quizzes', extra={'query': query, 'error': str(e)}, exc_info=True)
            return []

    @classmethod
    def _find_games(cls, query: str) -> list[GameInfo]:
        """Find games related to the query."""
        # Games are imported from core.games.config (single source of truth)
        matching_games = []
        query_lower = query.lower()

        for game in GAMES:
            # Match on topics list, title, slug, or description
            topics_match = any(query_lower in topic for topic in game.get('topics', []))
            title_match = query_lower in game['title'].lower()
            slug_match = query_lower in game['slug'].lower()
            description_match = query_lower in game['description'].lower()

            if topics_match or title_match or slug_match or description_match:
                # Get topic-specific explanation for the queried topic
                topic_explanation = get_topic_explanation(game['slug'], query_lower)
                if not topic_explanation:
                    # Fallback to primary topic explanation
                    topic_explanation = (
                        get_topic_explanation(game['slug'], game.get('primary_topic', '')) or game['description']
                    )

                matching_games.append(
                    {
                        'slug': game['slug'],
                        'title': game['title'],
                        'description': game['description'],
                        'topic': game.get('primary_topic', game.get('topics', [''])[0]),
                        'url': game.get('url', f"/play/{game['slug']}"),
                        'topic_explanation': topic_explanation,
                    }
                )

        return matching_games
