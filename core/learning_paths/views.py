"""Views for Learning Paths API."""

import logging
import uuid

from django.db import IntegrityError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttles import FeedbackReadThrottle, FeedbackThrottle
from core.users.models import User
from services.gamification import LearningPathService

from .models import (
    Concept,
    ContentHelpfulness,
    ConversationFeedback,
    GoalCheckIn,
    LearnerProfile,
    LearningEvent,
    LessonImage,
    LessonProgress,
    LessonRating,
    ProactiveOfferResponse,
    ProjectLearningMetadata,
    SavedLearningPath,
    UserConceptMastery,
)
from .serializers import (
    ConceptSerializer,
    ContentHelpfulnessSerializer,
    ConversationFeedbackSerializer,
    CreateContentHelpfulnessSerializer,
    CreateConversationFeedbackSerializer,
    CreateGoalCheckInSerializer,
    CreateLearningEventSerializer,
    CreateProactiveOfferResponseSerializer,
    GoalCheckInSerializer,
    LearnerProfileSerializer,
    LearningEventSerializer,
    LearningPathDetailSerializer,
    LearningStatsSerializer,
    ProactiveOfferResponseSerializer,
    ProjectLearningMetadataSerializer,
    PublicLearningPathSerializer,
    SavedLearningPathListSerializer,
    SavedLearningPathSerializer,
    SectionOrganizationSerializer,
    TopicRecommendationSerializer,
    UserConceptMasterySerializer,
    UserLearningPathSerializer,
)
from .services import LearningEventService


def safe_int(value, default: int, max_value: int = 100) -> int:
    """Safely parse integer with bounds checking."""
    try:
        result = int(value)
        return min(max(1, result), max_value)
    except (ValueError, TypeError):
        return default


logger = logging.getLogger(__name__)


def get_lesson_from_saved_path(user, slug: str, order: str | int):
    """
    Get a lesson from a user's saved learning path.

    Args:
        user: The authenticated user
        slug: The learning path slug
        order: The lesson order number (will be converted to int)

    Returns:
        Tuple of (path, lesson_index, lesson_item, error_response)
        If error_response is not None, return it immediately.
    """
    path = SavedLearningPath.objects.filter(
        user=user,
        slug=slug,
        is_archived=False,
    ).first()

    if not path:
        return (
            None,
            None,
            None,
            Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            ),
        )

    try:
        lesson_order = int(order)
    except (ValueError, TypeError):
        return (
            None,
            None,
            None,
            Response(
                {'error': 'Invalid lesson order'},
                status=status.HTTP_400_BAD_REQUEST,
            ),
        )

    # Find the AI lesson in the curriculum
    curriculum = path.path_data.get('curriculum', [])
    lesson_index = None
    lesson_item = None

    for i, item in enumerate(curriculum):
        if item.get('order') == lesson_order and item.get('type') == 'ai_lesson':
            lesson_index = i
            lesson_item = item
            break

    if lesson_item is None:
        return (
            None,
            None,
            None,
            Response(
                {'error': 'AI lesson not found at this order'},
                status=status.HTTP_404_NOT_FOUND,
            ),
        )

    return path, lesson_index, lesson_item, None


def normalize_exercises_from_content(content: dict) -> list:
    """
    Get exercises array from content, handling legacy single-exercise format.

    Args:
        content: The lesson content dict

    Returns:
        List of exercises (may be empty)
    """
    exercises = content.get('exercises', [])

    # Backwards compatibility: convert single 'exercise' to array
    if not exercises and content.get('exercise'):
        old_exercise = content['exercise']
        if 'id' not in old_exercise:
            old_exercise['id'] = str(uuid.uuid4())
        exercises = [old_exercise]

    return exercises


class MyLearningPathsViewSet(viewsets.ViewSet):
    """ViewSet for authenticated user's learning paths."""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/v1/me/learning-paths/

        Returns all learning paths for the current user.
        """
        service = LearningPathService()
        paths = service.get_user_paths(request.user, include_empty=False)
        serializer = UserLearningPathSerializer(paths, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """
        GET /api/v1/me/learning-paths/{topic}/

        Returns detailed progress for a specific topic.
        """
        topic = pk  # pk is the topic slug
        if not self._is_valid_topic(topic):
            return Response({'error': 'Invalid topic'}, status=status.HTTP_404_NOT_FOUND)

        service = LearningPathService()
        detail = service.get_path_detail(request.user, topic)
        serializer = LearningPathDetailSerializer(detail)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recommendations(self, request):
        """
        GET /api/v1/me/learning-paths/recommendations/

        Returns recommended topics for the user to explore.
        """
        service = LearningPathService()
        limit = safe_int(request.query_params.get('limit'), default=5, max_value=20)
        recommendations = service.get_recommended_topics(request.user, limit=limit)
        serializer = TopicRecommendationSerializer(recommendations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """
        POST /api/v1/me/learning-paths/{topic}/start/

        Start a new learning path for a topic.
        """
        topic = pk
        if not self._is_valid_topic(topic):
            return Response({'error': 'Invalid topic'}, status=status.HTTP_400_BAD_REQUEST)

        service = LearningPathService()
        path = service.get_or_create_path(request.user, topic)
        serializer = UserLearningPathSerializer(path)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _is_valid_topic(self, topic: str) -> bool:
        """Check if a topic slug is valid."""
        from core.taxonomy.models import Taxonomy

        return Taxonomy.objects.filter(slug=topic, taxonomy_type='topic', is_active=True).exists()


class UserLearningPathsView(APIView):
    """View for any user's public learning paths."""

    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request, username):
        """
        GET /api/v1/users/{username}/learning-paths/

        Returns public learning paths for any user.
        """
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        service = LearningPathService()
        paths = service.get_user_paths(user, include_empty=False)
        serializer = UserLearningPathSerializer(paths, many=True)
        return Response(serializer.data)


class UserLearningPathBySlugView(APIView):
    """View for fetching a user's generated learning path by username and slug."""

    permission_classes = [IsAuthenticated]

    def get(self, request, username, slug):
        """
        GET /api/v1/users/{username}/learning-paths/{slug}/

        Returns a user's generated learning path by slug.
        Checks both LearnerProfile.generated_path and SavedLearningPath.
        Requires authentication.
        """
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # First, check LearnerProfile.generated_path (active path)
        profile = LearnerProfile.objects.filter(
            user=user,
            generated_path__slug=slug,
        ).first()

        if profile and profile.generated_path:
            # Merge the cover_image from SavedLearningPath (generated async)
            response_data = dict(profile.generated_path)
            saved_path = SavedLearningPath.objects.filter(
                user=user,
                slug=slug,
                is_archived=False,
            ).first()
            if saved_path and saved_path.cover_image:
                response_data['cover_image'] = saved_path.cover_image
            return Response(response_data)

        # Fall back to SavedLearningPath (saved paths library)
        saved_path = SavedLearningPath.objects.filter(
            user=user,
            slug=slug,
            is_archived=False,
        ).first()

        # If not found by user, check for a published path with this slug
        # (published paths are accessible to anyone regardless of URL username)
        if not saved_path:
            saved_path = SavedLearningPath.objects.filter(
                slug=slug,
                is_published=True,
                is_archived=False,
            ).first()

        if saved_path:
            # Build response from SavedLearningPath
            # path_data contains curriculum, topics_covered, etc.
            response_data = saved_path.path_data.copy() if saved_path.path_data else {}
            response_data.update(
                {
                    'id': saved_path.id,
                    'slug': saved_path.slug,
                    'title': saved_path.title,
                    'difficulty': saved_path.difficulty,
                    'estimated_hours': saved_path.estimated_hours,
                    'cover_image': saved_path.cover_image,
                }
            )
            # Ensure curriculum is present
            if 'curriculum' not in response_data:
                response_data['curriculum'] = []
            return Response(response_data)

        return Response(
            {'error': 'Learning path not found'},
            status=status.HTTP_404_NOT_FOUND,
        )


class AllTopicsView(APIView):
    """View to get all available topics."""

    permission_classes = []

    def get(self, request):
        """
        GET /api/v1/learning-paths/topics/

        Returns all available learning path topics from Taxonomy.
        """
        from core.taxonomy.models import Taxonomy

        topic_taxonomies = Taxonomy.objects.filter(taxonomy_type='topic', is_active=True).order_by('name')
        topics = [
            {
                'slug': t.slug,
                'name': t.name,
            }
            for t in topic_taxonomies
        ]
        return Response(topics)


class LearningPathBySlugView(APIView):
    """View for fetching a generated learning path by its slug."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        """
        GET /api/v1/learning-paths/{slug}/

        Returns the user's generated learning path by slug.
        Users can only access their own learning paths.
        """
        profile = LearnerProfile.objects.filter(
            user=request.user,
            generated_path__slug=slug,
        ).first()

        if not profile or not profile.generated_path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Merge the cover_image from SavedLearningPath (generated async)
        response_data = dict(profile.generated_path)
        saved_path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()
        if saved_path and saved_path.cover_image:
            response_data['cover_image'] = saved_path.cover_image

        return Response(response_data)


# ============================================================================
# NEW LEARNING VIEWS
# ============================================================================


class LearnerProfileView(APIView):
    """View for managing the authenticated user's learner profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/learner-profile/

        Returns the user's learner profile (creates if doesn't exist).
        """
        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)
        serializer = LearnerProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        """
        PUT /api/v1/me/learner-profile/

        Update learner profile preferences.
        """
        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)
        serializer = LearnerProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SectionsOrganizationView(APIView):
    """
    View for managing learning path section organization.

    Allows users to organize their learning path topics into custom sections
    with drag-and-drop reordering, inline editing, and flexible nesting.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/learning-paths/sections-organization/

        Returns the user's section organization along with their topic sections.
        """

        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)

        # Get topics from the user's generated path
        topics = []
        if profile.generated_path and 'topics' in profile.generated_path:
            topics = profile.generated_path.get('topics', [])

        return Response(
            {
                'sectionsOrganization': profile.sections_organization,
                'topics': topics,
            }
        )

    def patch(self, request):
        """
        PATCH /api/v1/me/learning-paths/sections-organization/

        Update the user's section organization.
        """
        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)

        sections_data = request.data.get('sectionsOrganization')

        # Allow null to reset to default
        if sections_data is None:
            profile.sections_organization = None
            profile.save(update_fields=['sections_organization'])
            return Response({'status': 'success', 'sectionsOrganization': None})

        # Validate the structure
        serializer = SectionOrganizationSerializer(data=sections_data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        profile.sections_organization = serializer.validated_data
        profile.save(update_fields=['sections_organization'])

        return Response(
            {
                'status': 'success',
                'sectionsOrganization': profile.sections_organization,
            }
        )


class ReorderSectionsView(APIView):
    """View for quickly reordering sections by ID."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        POST /api/v1/me/learning-paths/reorder-sections/

        Reorder top-level sections by their IDs.

        Request body:
        {
            "section_ids": ["uuid-1", "uuid-2", "uuid-3"]
        }
        """
        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)

        if not profile.sections_organization:
            return Response(
                {'error': 'No sections to reorder'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_order = request.data.get('section_ids', [])
        if not isinstance(new_order, list):
            return Response(
                {'error': 'section_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sections = profile.sections_organization.get('sections', [])
        section_map = {s.get('id'): s for s in sections if s.get('type') == 'section'}

        # Reorder according to new_order
        reordered = [section_map[sid] for sid in new_order if sid in section_map]

        # Add any sections not in new_order at the end (safety measure)
        seen_ids = set(new_order)
        for section in sections:
            if section.get('id') not in seen_ids:
                reordered.append(section)

        profile.sections_organization['sections'] = reordered
        profile.save(update_fields=['sections_organization'])

        return Response(
            {
                'status': 'success',
                'sectionsOrganization': profile.sections_organization,
            }
        )


class ConceptViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for browsing concepts."""

    permission_classes = []
    serializer_class = ConceptSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        queryset = Concept.objects.filter(is_active=True).select_related('tool')

        # Filter by topic
        topic = self.request.query_params.get('topic')
        if topic:
            queryset = queryset.filter(topic=topic)

        # Filter by difficulty
        difficulty = self.request.query_params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(base_difficulty=difficulty)

        # Search by keyword
        search = self.request.query_params.get('search')
        if search:
            queryset = (
                queryset.filter(name__icontains=search)
                | queryset.filter(description__icontains=search)
                | queryset.filter(keywords__contains=[search])
            )

        return queryset.order_by('topic', 'name')


class UserConceptMasteryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the authenticated user's concept masteries."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserConceptMasterySerializer

    def get_queryset(self):
        queryset = UserConceptMastery.objects.filter(user=self.request.user).select_related('concept', 'concept__tool')

        # Filter by mastery level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(mastery_level=level)

        # Filter by topic
        topic = self.request.query_params.get('topic')
        if topic:
            queryset = queryset.filter(concept__topic=topic)

        # Due for review
        due_for_review = self.request.query_params.get('due_for_review')
        if due_for_review == 'true':
            from django.utils import timezone

            queryset = queryset.filter(next_review_at__lte=timezone.now())

        return queryset.order_by('-mastery_score')

    @action(detail=False, methods=['get'])
    def knowledge_gaps(self, request):
        """
        GET /api/v1/me/concept-mastery/knowledge_gaps/

        Returns concepts where user is struggling (low mastery, high incorrect).
        """
        gaps = (
            UserConceptMastery.objects.filter(
                user=request.user,
                mastery_level__in=['unknown', 'aware', 'learning'],
                times_practiced__gt=0,
            )
            .select_related('concept')
            .order_by('mastery_score')[:10]
        )
        serializer = UserConceptMasterySerializer(gaps, many=True)
        return Response(serializer.data)


class LearningEventsView(APIView):
    """View for learning events."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/learning-events/

        Returns recent learning events for the user.
        """
        limit = safe_int(request.query_params.get('limit'), default=20, max_value=100)
        events = (
            LearningEvent.objects.filter(user=request.user)
            .select_related('concept', 'lesson')
            .order_by('-created_at')[:limit]
        )
        serializer = LearningEventSerializer(events, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        POST /api/v1/me/learning-events/

        Record a new learning event.
        """
        serializer = CreateLearningEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolve concept from slug
        concept_id = None
        if data.get('concept_slug'):
            try:
                concept = Concept.objects.get(slug=data['concept_slug'])
                concept_id = concept.id
            except Concept.DoesNotExist:
                return Response({'error': 'Concept not found'}, status=status.HTTP_404_NOT_FOUND)

        # Create event
        event = LearningEvent.objects.create(
            user=request.user,
            event_type=data['event_type'],
            concept_id=concept_id,
            project_id=data.get('project_id'),
            was_successful=data.get('was_successful'),
            payload=data.get('payload', {}),
        )

        result_serializer = LearningEventSerializer(event)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


class LearningStatsView(APIView):
    """View for learning statistics."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/learning-stats/

        Returns learning statistics for the user.
        """
        days = safe_int(request.query_params.get('days'), default=30, max_value=365)
        # Run sync since we're in a sync view
        from asgiref.sync import async_to_sync

        stats = async_to_sync(LearningEventService.get_learning_stats)(request.user.id, days)
        serializer = LearningStatsSerializer(stats)
        return Response(serializer.data)


class ProjectLearningView(APIView):
    """View for projects as learning content."""

    permission_classes = []

    def get(self, request):
        """
        GET /api/v1/learning/projects/

        Returns top learning-eligible projects.
        """
        limit = safe_int(request.query_params.get('limit'), default=10, max_value=50)

        # Filter by concept
        concept_slug = request.query_params.get('concept')

        queryset = (
            ProjectLearningMetadata.objects.filter(is_learning_eligible=True)
            .select_related('project', 'project__user')
            .prefetch_related('concepts')
        )

        if concept_slug:
            queryset = queryset.filter(concepts__slug=concept_slug)

        projects = queryset.order_by('-learning_quality_score')[:limit]
        serializer = ProjectLearningMetadataSerializer(projects, many=True)
        return Response(serializer.data)


class RecordProjectLearningView(APIView):
    """Record when a user learns from a project."""

    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        """
        POST /api/v1/learning/projects/{project_id}/used/

        Record that user learned from this project.
        """
        from asgiref.sync import async_to_sync

        from .services import ProjectLearningService

        success = async_to_sync(ProjectLearningService.record_learning_usage)(project_id, request.user.id)

        if success:
            return Response({'status': 'recorded'})
        return Response({'error': 'Project not found or not learning-eligible'}, status=status.HTTP_404_NOT_FOUND)


# ============================================================================
# STRUCTURED LEARNING PATH VIEWS
# ============================================================================


class StructuredPathView(APIView):
    """View for the user's personalized structured learning path."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/structured-path/

        Returns the user's personalized structured learning path with progress.
        """
        from .services import StructuredLearningPathGenerator

        path_data = StructuredLearningPathGenerator.get_user_path(request.user.id)
        return Response(path_data)


class LearningSetupView(APIView):
    """View for completing learning path setup (cold-start)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        POST /api/v1/me/learning-setup/

        Complete the cold-start learning setup with a learning goal.

        Request body:
        {
            "learning_goal": "build_projects" | "understand_concepts" | "career" | "exploring"
        }
        """
        from .services import StructuredLearningPathGenerator

        learning_goal = request.data.get('learning_goal', '')

        # Validate learning goal
        valid_goals = [choice[0] for choice in LearnerProfile.LEARNING_GOAL_CHOICES]
        if learning_goal and learning_goal not in valid_goals:
            return Response(
                {'error': f'Invalid learning_goal. Must be one of: {valid_goals}'}, status=status.HTTP_400_BAD_REQUEST
            )

        # Complete setup and get path
        path_data = StructuredLearningPathGenerator.complete_learning_setup(
            request.user.id, learning_goal or 'exploring'
        )

        return Response(path_data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """
        DELETE /api/v1/me/learning-setup/

        Reset the learning setup to allow re-selecting a learning goal.
        """
        profile, _ = LearnerProfile.objects.get_or_create(user=request.user)
        profile.has_completed_path_setup = False
        profile.learning_goal = ''
        profile.generated_path = None
        profile.path_generated_at = None
        profile.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================================
# PROJECT LEARNING ELIGIBILITY TOGGLE
# ============================================================================


class ToggleLearningEligibilityView(APIView):
    """Toggle whether a project appears in learning content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        """
        POST /api/v1/projects/{project_id}/toggle-learning-eligible/

        Toggle whether this project appears in learning content.
        Only the project owner or an admin can toggle.
        """
        from core.projects.models import Project

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check permissions (owner or admin)
        is_owner = project.user_id == request.user.id
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') == 'admin'

        if not (is_owner or is_admin):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        # Get or create metadata (defaults to is_learning_eligible=True)
        metadata, _ = ProjectLearningMetadata.objects.get_or_create(
            project=project, defaults={'is_learning_eligible': True}
        )

        # Toggle
        metadata.is_learning_eligible = not metadata.is_learning_eligible
        metadata.save()

        return Response(
            {
                'projectId': project_id,
                'isLearningEligible': metadata.is_learning_eligible,
            }
        )


# ============================================================================
# FEEDBACK VIEWS - Human feedback loop endpoints
# ============================================================================


class ConversationFeedbackView(APIView):
    """View for submitting and retrieving conversation feedback."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply different throttles for read vs write."""
        if self.request.method == 'GET':
            return [FeedbackReadThrottle()]
        return [FeedbackThrottle()]

    def get(self, request):
        """
        GET /api/v1/me/feedback/conversation/

        Returns recent conversation feedback from the user.
        """
        limit = safe_int(request.query_params.get('limit'), default=20, max_value=100)
        feedback = (
            ConversationFeedback.objects.filter(user=request.user)
            .select_related('concept')
            .order_by('-created_at')[:limit]
        )
        serializer = ConversationFeedbackSerializer(feedback, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        POST /api/v1/me/feedback/conversation/

        Submit feedback on an Ava response.

        Request body:
        {
            "session_id": "abc-123",
            "message_id": "msg-456",
            "feedback": "helpful" | "not_helpful" | "confusing" | "too_basic" | "too_advanced" | "incorrect",
            "context_type": "general" | "lesson" | "quiz" | "project_help" | "troubleshooting",
            "topic_slug": "ai-models-research",
            "concept_slug": "prompt-engineering",
            "comment": "Optional user comment"
        }
        """
        serializer = CreateConversationFeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolve concept from slug if provided
        concept = None
        if data.get('concept_slug'):
            concept = Concept.objects.filter(slug=data['concept_slug']).first()

        feedback = ConversationFeedback.objects.create(
            user=request.user,
            session_id=data['session_id'],
            message_id=data['message_id'],
            feedback=data['feedback'],
            context_type=data.get('context_type', 'general'),
            topic_slug=data.get('topic_slug', ''),
            concept=concept,
            comment=data.get('comment', ''),
        )

        result_serializer = ConversationFeedbackSerializer(feedback)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


class ProactiveOfferResponseView(APIView):
    """View for recording responses to proactive intervention offers."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply different throttles for read vs write."""
        if self.request.method == 'GET':
            return [FeedbackReadThrottle()]
        return [FeedbackThrottle()]

    def get(self, request):
        """
        GET /api/v1/me/feedback/proactive-offers/

        Returns recent proactive offer responses.
        """
        limit = safe_int(request.query_params.get('limit'), default=20, max_value=100)
        responses = (
            ProactiveOfferResponse.objects.filter(user=request.user)
            .select_related('concept')
            .order_by('-offered_at')[:limit]
        )
        serializer = ProactiveOfferResponseSerializer(responses, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        POST /api/v1/me/feedback/proactive-offers/

        Record user's response to a proactive offer.

        Request body:
        {
            "intervention_type": "simplify_explanation",
            "response": "accepted" | "declined" | "ignored" | "helpful_after" | "not_helpful_after",
            "struggle_confidence": 0.75,
            "topic_slug": "ai-models-research",
            "concept_slug": "neural-networks",
            "session_id": "abc-123"
        }
        """
        from django.utils import timezone

        serializer = CreateProactiveOfferResponseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        response = ProactiveOfferResponse.objects.create(
            user=request.user,
            intervention_type=data['intervention_type'],
            response=data['response'],
            struggle_confidence=data['struggle_confidence'],
            topic_slug=data.get('topic_slug', ''),
            concept_slug=data.get('concept_slug', ''),
            session_id=data.get('session_id', ''),
            responded_at=timezone.now(),
        )

        # If user accepted, clear the intervention cooldown
        if data['response'] in ('accepted', 'helpful_after'):
            from services.agents.proactive.intervention_service import get_intervention_service

            get_intervention_service().clear_cooldown(request.user.id)

        result_serializer = ProactiveOfferResponseSerializer(response)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


class ContentHelpfulnessView(APIView):
    """View for submitting helpfulness feedback on learning content."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply different throttles for read vs write."""
        if self.request.method == 'GET':
            return [FeedbackReadThrottle()]
        return [FeedbackThrottle()]

    def get(self, request):
        """
        GET /api/v1/me/feedback/content-helpfulness/

        Returns recent content helpfulness feedback.
        """
        limit = safe_int(request.query_params.get('limit'), default=20, max_value=100)
        content_type = request.query_params.get('content_type')

        queryset = ContentHelpfulness.objects.filter(user=request.user).select_related('micro_lesson', 'concept')
        if content_type:
            queryset = queryset.filter(content_type=content_type)

        feedback = queryset.order_by('-created_at')[:limit]
        serializer = ContentHelpfulnessSerializer(feedback, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        POST /api/v1/me/feedback/content-helpfulness/

        Submit helpfulness feedback on learning content.

        Request body:
        {
            "content_type": "micro_lesson" | "quiz" | "project_example" | ...
            "content_id": "lesson-123",
            "helpfulness": "very_helpful" | "helpful" | "neutral" | "not_helpful" | "confusing",
            "topic_slug": "ai-models-research",
            "concept_slug": "transformers",
            "difficulty_perception": "too_easy" | "just_right" | "too_hard",
            "comment": "Optional feedback",
            "time_spent_seconds": 300
        }
        """
        serializer = CreateContentHelpfulnessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Use update_or_create to handle duplicates gracefully (unique_together constraint)
        try:
            feedback, created = ContentHelpfulness.objects.update_or_create(
                user=request.user,
                content_type=data['content_type'],
                content_id=data['content_id'],
                defaults={
                    'helpfulness': data['helpfulness'],
                    'topic_slug': data.get('topic_slug', ''),
                    'concept_slug': data.get('concept_slug', ''),
                    'difficulty_perception': data.get('difficulty_perception'),
                    'comment': data.get('comment', ''),
                    'time_spent_seconds': data.get('time_spent_seconds'),
                },
            )
        except IntegrityError:
            return Response(
                {'error': 'Unable to save feedback. Please try again.'},
                status=status.HTTP_409_CONFLICT,
            )

        result_serializer = ContentHelpfulnessSerializer(feedback)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(result_serializer.data, status=status_code)


class GoalCheckInView(APIView):
    """View for periodic goal progress check-ins."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply different throttles for read vs write."""
        if self.request.method == 'GET':
            return [FeedbackReadThrottle()]
        return [FeedbackThrottle()]

    def get(self, request):
        """
        GET /api/v1/me/feedback/goal-checkins/

        Returns recent goal check-ins and whether a check-in is due.
        """
        limit = safe_int(request.query_params.get('limit'), default=10, max_value=50)
        checkins = (
            GoalCheckIn.objects.filter(user=request.user)
            .select_related('learning_path')
            .order_by('-created_at')[:limit]
        )

        # Check if a check-in is due
        is_checkin_due = GoalCheckIn.is_checkin_due(request.user.id)

        # Get user's learning goal
        profile = LearnerProfile.objects.filter(user=request.user).first()
        learning_goal = profile.learning_goal if profile else None

        serializer = GoalCheckInSerializer(checkins, many=True)
        return Response(
            {
                'checkins': serializer.data,
                'is_checkin_due': is_checkin_due,
                'learning_goal': learning_goal,
            }
        )

    def post(self, request):
        """
        POST /api/v1/me/feedback/goal-checkins/

        Submit a goal progress check-in.

        Request body:
        {
            "goal_description": "Learn to build AI agents",
            "progress": "on_track" | "ahead" | "behind" | "stuck" | "goal_changed" | "goal_achieved",
            "satisfaction": "very_satisfied" | "satisfied" | "neutral" | "unsatisfied" | "very_unsatisfied",
            "whats_working": "The project examples are really helpful",
            "whats_not_working": "Some explanations are too abstract",
            "blockers": "Limited time to practice",
            "new_goal": "Optional new goal if changing direction"
        }
        """
        serializer = CreateGoalCheckInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Get current learning goal from profile
        profile = LearnerProfile.objects.filter(user=request.user).first()
        goal_description = data.get('goal_description', '')
        if not goal_description and profile:
            goal_description = profile.learning_goal or ''

        checkin = GoalCheckIn.objects.create(
            user=request.user,
            goal_description=goal_description,
            progress=data['progress'],
            satisfaction=data['satisfaction'],
            whats_working=data.get('whats_working', ''),
            whats_not_working=data.get('whats_not_working', ''),
            blockers=data.get('blockers', ''),
            new_goal=data.get('new_goal', ''),
        )

        result_serializer = GoalCheckInSerializer(checkin)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


class FeedbackSummaryView(APIView):
    """View for aggregated feedback summary for the user."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [FeedbackReadThrottle]

    def get(self, request):
        """
        GET /api/v1/me/feedback/summary/

        Returns an aggregated summary of all feedback from this user.
        Useful for the AI to understand user preferences.
        """
        user = request.user

        # Conversation feedback stats
        conv_feedback = ConversationFeedback.objects.filter(user=user)
        total_feedback = conv_feedback.count()
        helpful_count = conv_feedback.filter(feedback__in=['helpful']).count()
        helpful_percentage = (helpful_count / total_feedback * 100) if total_feedback > 0 else 0

        # Proactive offer stats
        proactive_responses = ProactiveOfferResponse.objects.filter(user=user)
        total_offers = proactive_responses.count()
        accepted_count = proactive_responses.filter(response__in=['accepted', 'helpful_after']).count()
        acceptance_rate = (accepted_count / total_offers * 100) if total_offers > 0 else 0

        # Content helpfulness stats
        content_feedback = ContentHelpfulness.objects.filter(user=user)
        # Calculate helpfulness score from choices
        helpfulness_scores = {
            'very_helpful': 5,
            'helpful': 4,
            'neutral': 3,
            'not_helpful': 2,
            'confusing': 1,
        }
        content_scores = [helpfulness_scores.get(f.helpfulness, 3) for f in content_feedback[:100]]
        avg_content_score = sum(content_scores) / len(content_scores) if content_scores else 3.0

        # Last goal check-in
        last_checkin = GoalCheckIn.objects.filter(user=user).order_by('-created_at').first()

        # Recent conversation feedback
        recent_feedback = conv_feedback.select_related('concept').order_by('-created_at')[:5]

        return Response(
            {
                'total_feedback_count': total_feedback,
                'helpful_percentage': round(helpful_percentage, 1),
                'proactive_acceptance_rate': round(acceptance_rate, 1),
                'content_helpfulness_score': round(avg_content_score, 2),
                'last_goal_checkin': GoalCheckInSerializer(last_checkin).data if last_checkin else None,
                'recent_feedback': ConversationFeedbackSerializer(recent_feedback, many=True).data,
            }
        )


# ============================================================================
# SAVED LEARNING PATH VIEWS - Multiple paths per user
# ============================================================================


class SavedLearningPathsView(APIView):
    """View for managing user's saved learning paths (path library)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/v1/me/saved-paths/

        Returns all saved learning paths for the current user.
        """
        paths = SavedLearningPath.objects.filter(user=request.user, is_archived=False).order_by(
            '-is_active', '-updated_at'
        )
        serializer = SavedLearningPathListSerializer(paths, many=True)
        return Response(serializer.data)


class SavedLearningPathDetailView(APIView):
    """View for a specific saved learning path."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        """
        GET /api/v1/me/saved-paths/{slug}/

        Returns a specific saved learning path with full curriculum.
        """
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SavedLearningPathSerializer(path)
        return Response(serializer.data)

    def delete(self, request, slug):
        """
        DELETE /api/v1/me/saved-paths/{slug}/

        Archive a saved learning path (soft delete).
        """
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        path.is_archived = True
        path.is_active = False
        path.save(update_fields=['is_archived', 'is_active', 'updated_at'])

        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivateSavedPathView(APIView):
    """View for activating a saved learning path."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        """
        POST /api/v1/me/saved-paths/{slug}/activate/

        Set a path as the active learning path (deactivates others).
        """
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Activate this path (deactivates all others)
        path.activate()

        serializer = SavedLearningPathSerializer(path)
        return Response(serializer.data)


class PublishSavedPathView(APIView):
    """View for publishing/unpublishing a learning path to the explore feed."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        """
        POST /api/v1/me/saved-paths/{slug}/publish/

        Publish a learning path to the explore feed.
        """
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Publish the path
        path.publish()

        # Trigger lesson image generation if not already done
        # This ensures lessons have images when they appear in the explore feed
        from .tasks import generate_lesson_images_for_path

        generate_lesson_images_for_path.delay(path.id, request.user.id)

        serializer = SavedLearningPathSerializer(path)
        return Response(serializer.data)

    def delete(self, request, slug):
        """
        DELETE /api/v1/me/saved-paths/{slug}/publish/

        Unpublish a learning path from the explore feed.
        """
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Unpublish the path
        path.unpublish()

        serializer = SavedLearningPathSerializer(path)
        return Response(serializer.data)


class ExploreLearningPathsView(APIView):
    """View for browsing published learning paths in the explore feed."""

    permission_classes = [AllowAny]

    def get(self, request):
        """
        GET /api/v1/explore/learning-paths/

        Returns published learning paths sorted by most recent.
        Supports filtering by difficulty and search.
        """
        from django.db.models import Q

        queryset = (
            SavedLearningPath.objects.filter(
                is_published=True,
                is_archived=False,
            )
            .select_related('user')
            .order_by('-published_at')
        )

        # Filter by difficulty
        difficulty = request.GET.get('difficulty')
        if difficulty and difficulty in dict(SavedLearningPath.DIFFICULTY_CHOICES):
            queryset = queryset.filter(difficulty=difficulty)

        # Search by title or username
        search = request.GET.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(user__username__icontains=search) | Q(user__first_name__icontains=search)
            )

        # Paginate results
        paginator = PageNumberPagination()
        paginator.page_size = 20
        paginated = paginator.paginate_queryset(queryset, request)
        serializer = PublicLearningPathSerializer(paginated, many=True)
        return paginator.get_paginated_response(serializer.data)


class ExploreLessonsView(APIView):
    """View for browsing individual AI lessons in the explore feed."""

    permission_classes = [AllowAny]

    def _generate_lesson_slug(self, title: str, lesson_order: int) -> str:
        """Generate a URL-friendly slug from lesson title."""
        from django.utils.text import slugify

        base_slug = slugify(title)[:50] if title else 'lesson'
        # Ensure unique by appending order if slug is empty or generic
        if not base_slug or base_slug == 'lesson':
            return f'lesson-{lesson_order}'
        return base_slug

    def _get_sage_user(self):
        """Get the Sage user for AI-generated content attribution."""
        from django.core.cache import cache

        # Cache Sage user lookup to avoid repeated DB queries
        sage = cache.get('sage_user')
        if sage is None:
            sage = User.objects.filter(username='sage').first()
            if sage:
                cache.set('sage_user', sage, 3600)  # Cache for 1 hour
        return sage

    def get(self, request):
        """
        GET /api/v1/explore/lessons/

        Returns individual AI lessons from published learning paths.
        Each lesson includes its Gemini-generated image if available.
        AI lessons show Sage as the author instead of the user.
        Supports search filtering.
        """

        from .serializers import PublicLessonSerializer

        # Get Sage user for AI lesson attribution
        sage = self._get_sage_user()
        sage_username = sage.username if sage else 'sage'
        sage_full_name = (sage.get_full_name() or sage.username) if sage else 'Sage'
        sage_avatar_url = getattr(sage, 'avatar_url', None) if sage else None

        # Get all published learning paths with their lesson images
        paths = (
            SavedLearningPath.objects.filter(
                is_published=True,
                is_archived=False,
            )
            .select_related('user')
            .prefetch_related('lesson_images')
            .order_by('-published_at')
        )

        # Search filter
        search = request.GET.get('search', '').strip().lower()

        # Extract lessons from all paths
        lessons = []
        for path in paths:
            curriculum = path.path_data.get('curriculum', []) if path.path_data else []
            difficulty = path.path_data.get('difficulty', 'beginner') if path.path_data else 'beginner'

            # Build a lookup dict for lesson images
            image_lookup = {img.lesson_order: img.image_url for img in path.lesson_images.all()}

            for idx, item in enumerate(curriculum):
                # Only include AI lessons
                if item.get('type') != 'ai_lesson':
                    continue

                title = item.get('title', 'Untitled Lesson')
                content = item.get('content', {})
                summary = content.get('summary', '') if isinstance(content, dict) else ''

                # Apply search filter
                if search:
                    searchable = f'{title} {summary}'.lower()
                    if search not in searchable:
                        continue

                lesson_order = item.get('order', idx + 1)
                image_url = image_lookup.get(lesson_order)
                lesson_slug = self._generate_lesson_slug(title, lesson_order)

                # AI lessons show Sage as the author, but include path owner for navigation
                lessons.append(
                    {
                        'id': f'{path.id}_{lesson_order}',
                        'title': title,
                        'summary': summary[:200] if summary else '',
                        'image_url': image_url,
                        'difficulty': difficulty,
                        'estimated_minutes': item.get('estimatedMinutes', 5),
                        'lesson_type': content.get('lessonType', 'explanation')
                        if isinstance(content, dict)
                        else 'explanation',
                        'path_id': path.id,
                        'path_slug': path.slug,
                        'path_title': path.title,
                        'path_username': path.user.username,  # Actual path owner for URL navigation
                        'username': sage_username,
                        'user_full_name': sage_full_name,
                        'user_avatar_url': sage_avatar_url,
                        'lesson_order': lesson_order,
                        'lesson_slug': lesson_slug,
                        'published_at': path.published_at,
                    }
                )

        # Simple pagination
        page = safe_int(request.GET.get('page', 1), default=1, max_value=100)
        page_size = 20
        start = (page - 1) * page_size
        end = start + page_size
        paginated_lessons = lessons[start:end]

        serializer = PublicLessonSerializer(paginated_lessons, many=True)

        return Response(
            {
                'count': len(lessons),
                'next': f'?page={page + 1}' if end < len(lessons) else None,
                'previous': f'?page={page - 1}' if page > 1 else None,
                'results': serializer.data,
            }
        )


class LessonImageView(APIView):
    """View for on-demand lesson image generation."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug, order):
        """
        GET /api/v1/me/saved-paths/{slug}/lessons/{order}/image/

        Get or generate an educational illustration for an AI lesson.
        Images are generated on-demand and cached for future requests.
        """
        import hashlib
        import json

        from .tasks import generate_lesson_image

        # Get the saved learning path
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Find the lesson in the curriculum
        order = int(order)
        curriculum = path.path_data.get('curriculum', [])
        lesson = next(
            (c for c in curriculum if c.get('order') == order and c.get('type') == 'ai_lesson'),
            None,
        )

        if not lesson or not lesson.get('content'):
            return Response(
                {'error': 'AI lesson not found at this order'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Calculate content hash for cache invalidation
        content = lesson.get('content', {})
        content_hash = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()[:16]

        # Check cache first
        cached = LessonImage.objects.filter(
            saved_path=path,
            lesson_order=order,
        ).first()

        if cached and cached.content_hash == content_hash:
            return Response({'imageUrl': cached.image_url})

        # Generate new image (synchronous - runs during request)
        image_url = generate_lesson_image(
            lesson=lesson,
            path_title=path.title,
            user_id=request.user.id,
            lesson_order=order,
        )

        if not image_url:
            return Response(
                {'error': 'Failed to generate image'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Cache the result
        LessonImage.objects.update_or_create(
            saved_path=path,
            lesson_order=order,
            defaults={
                'content_hash': content_hash,
                'image_url': image_url,
            },
        )

        return Response({'imageUrl': image_url})


class PersistLessonView(APIView):
    """Persist an AI-generated lesson when user first views it."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/persist/

        Persists an AI lesson from the curriculum as a Project.
        Returns the persisted project info.
        """
        from services.agents.learning.lesson_persistence import LessonPersistenceService

        # Get the saved path
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get curriculum item
        order = int(order)
        curriculum = path.path_data.get('curriculum', [])
        lesson_item = next(
            (c for c in curriculum if c.get('order') == order and c.get('type') == 'ai_lesson'),
            None,
        )

        if not lesson_item:
            return Response(
                {'error': 'AI lesson not found at this order'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already persisted
        if lesson_item.get('persisted_project_id'):
            return Response(
                {
                    'projectId': lesson_item['persisted_project_id'],
                    'alreadyPersisted': True,
                }
            )

        try:
            # Get topics covered from path data
            topics_covered = path.path_data.get('topics_covered', [])
            topic = topics_covered[0] if topics_covered else path.title

            # Persist the lesson
            result = LessonPersistenceService.persist_ai_lesson(
                title=lesson_item.get('title', 'AI Lesson'),
                lesson_content=lesson_item.get('content', {}),
                topic=topic,
                difficulty=lesson_item.get('difficulty', 'beginner'),
                estimated_minutes=lesson_item.get('estimated_minutes', 15),
                user=request.user,
                saved_path_id=path.id,
                lesson_order=order,
            )

            # Update the curriculum item with persisted project ID
            lesson_item['persisted_project_id'] = result['project_id']
            lesson_item['persisted_url'] = result['url']
            path.save(update_fields=['path_data', 'updated_at'])

            return Response(
                {
                    'projectId': result['project_id'],
                    'slug': result['slug'],
                    'url': result['url'],
                    'alreadyExisted': result['already_existed'],
                }
            )

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LessonRatingView(APIView):
    """Rate a lesson as helpful or not helpful."""

    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        """
        POST /api/v1/lessons/{project_id}/rate/

        Rate a lesson as helpful or not helpful.
        """
        from django.shortcuts import get_object_or_404

        from core.projects.models import Project

        # Get the project (must be a lesson)
        project = get_object_or_404(
            Project.objects.filter(learning_metadata__is_lesson=True),
            id=project_id,
        )

        # Validate rating
        rating_value = request.data.get('rating')
        if rating_value not in ['helpful', 'not_helpful']:
            return Response(
                {'error': 'Rating must be "helpful" or "not_helpful"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or update rating
        rating, created = LessonRating.objects.update_or_create(
            user=request.user,
            project=project,
            defaults={
                'rating': rating_value,
                'feedback': request.data.get('feedback', ''),
            },
        )

        # Update aggregate counts on ProjectLearningMetadata
        if hasattr(project, 'learning_metadata'):
            project.learning_metadata.update_rating_counts()

        return Response(
            {
                'status': 'rated',
                'rating': rating.rating,
                'created': created,
            }
        )

    def get(self, request, project_id):
        """
        GET /api/v1/lessons/{project_id}/rate/

        Get the current user's rating for a lesson.
        """
        from django.shortcuts import get_object_or_404

        from core.projects.models import Project

        project = get_object_or_404(
            Project.objects.filter(learning_metadata__is_lesson=True),
            id=project_id,
        )

        rating = LessonRating.objects.filter(
            user=request.user,
            project=project,
        ).first()

        if not rating:
            return Response({'rating': None})

        return Response(
            {
                'rating': rating.rating,
                'feedback': rating.feedback,
                'createdAt': rating.created_at.isoformat(),
            }
        )


# =============================================================================
# ADMIN LESSON MANAGEMENT
# =============================================================================


class AdminLessonViewSet(viewsets.ModelViewSet):
    """Admin viewset for managing lesson metadata."""

    permission_classes = [IsAuthenticated]
    serializer_class = ProjectLearningMetadataSerializer

    def get_queryset(self):
        """Only admins can access this viewset."""
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            return ProjectLearningMetadata.objects.none()

        queryset = ProjectLearningMetadata.objects.select_related(
            'project',
            'project__user',
        ).order_by('-is_lesson', '-positive_ratings', '-id')

        # Filter by is_lesson
        is_lesson = self.request.query_params.get('isLesson')
        if is_lesson is not None:
            queryset = queryset.filter(is_lesson=is_lesson.lower() == 'true')

        # Search by title or author
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(project__title__icontains=search) | Q(project__user__username__icontains=search)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        """List all lesson metadata with pagination."""
        queryset = self.get_queryset()

        # Pagination
        page = safe_int(request.query_params.get('page'), 1)
        page_size = safe_int(request.query_params.get('pageSize'), 20, max_value=100)
        start = (page - 1) * page_size
        end = start + page_size

        total = queryset.count()
        results = list(queryset[start:end])

        serializer = self.get_serializer(results, many=True)

        return Response(
            {
                'count': total,
                'next': f'?page={page + 1}' if end < total else None,
                'previous': f'?page={page - 1}' if page > 1 else None,
                'results': serializer.data,
            }
        )

    def partial_update(self, request, *args, **kwargs):
        """Update lesson metadata (mark/unmark as lesson, etc)."""
        instance = self.get_object()

        # Only allow updating specific fields
        # Note: Frontend axios converts camelCase to snake_case, so we check for snake_case
        update_data = {}

        if 'is_lesson' in request.data:
            update_data['is_lesson'] = request.data['is_lesson']
        if 'complexity_level' in request.data:
            update_data['complexity_level'] = request.data['complexity_level']
        if 'learning_summary' in request.data:
            update_data['learning_summary'] = request.data['learning_summary']

        for field, value in update_data.items():
            setattr(instance, field, value)

        instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='bulk-mark')
    def bulk_mark(self, request):
        """Bulk mark projects as lessons."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        updated = ProjectLearningMetadata.objects.filter(id__in=ids).update(is_lesson=True)
        return Response({'updated': updated})

    @action(detail=False, methods=['post'], url_path='bulk-unmark')
    def bulk_unmark(self, request):
        """Bulk unmark projects as lessons."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        updated = ProjectLearningMetadata.objects.filter(id__in=ids).update(is_lesson=False)
        return Response({'updated': updated})

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get lesson library stats."""
        from django.db.models import Sum

        # Total lessons
        total_lessons = ProjectLearningMetadata.objects.filter(is_lesson=True).count()

        # AI-generated vs curated (check content_type_taxonomy)
        ai_lessons = ProjectLearningMetadata.objects.filter(
            is_lesson=True,
            project__content_type_taxonomy__slug='ai-lesson',
        ).count()

        curated_lessons = total_lessons - ai_lessons

        # Ratings
        ratings_agg = ProjectLearningMetadata.objects.filter(is_lesson=True).aggregate(
            total_positive=Sum('positive_ratings'),
            total_negative=Sum('negative_ratings'),
        )
        total_ratings = (ratings_agg['total_positive'] or 0) + (ratings_agg['total_negative'] or 0)
        avg_rating = 0
        if total_ratings > 0:
            avg_rating = (ratings_agg['total_positive'] or 0) / total_ratings

        # Top rated lessons
        top_rated = (
            ProjectLearningMetadata.objects.filter(is_lesson=True, positive_ratings__gt=0)
            .select_related('project', 'project__user')
            .order_by('-positive_ratings')[:5]
        )

        return Response(
            {
                'totalLessons': total_lessons,
                'aiGeneratedLessons': ai_lessons,
                'curatedLessons': curated_lessons,
                'totalRatings': total_ratings,
                'averageRating': round(avg_rating, 2),
                'topRatedLessons': ProjectLearningMetadataSerializer(top_rated, many=True).data,
            }
        )

    @action(detail=False, methods=['get'], url_path='ai-lessons')
    def ai_lessons(self, request):
        """
        GET /api/v1/admin/learning/lessons/ai-lessons/

        List all AI-generated lessons from saved learning paths.
        """
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        # Pagination
        page = safe_int(request.query_params.get('page'), 1)
        page_size = safe_int(request.query_params.get('pageSize'), 20, max_value=100)
        search = request.query_params.get('search', '')

        # Get all saved learning paths
        paths = SavedLearningPath.objects.select_related('user').order_by('-created_at')

        if search:
            from django.db.models import Q

            paths = paths.filter(Q(title__icontains=search) | Q(user__username__icontains=search))

        # Extract AI lessons from all paths
        ai_lessons_list = []
        for path in paths:
            path_data = path.path_data or {}
            curriculum = path_data.get('curriculum', [])

            for item in curriculum:
                if item.get('type') == 'ai_lesson':
                    content = item.get('content', {})
                    ai_lessons_list.append(
                        {
                            'id': f"{path.id}-{item.get('order', 0)}",
                            'pathId': path.id,
                            'pathSlug': path.slug,
                            'pathTitle': path.title,
                            'order': item.get('order', 0),
                            'title': item.get('title', 'Untitled Lesson'),
                            'summary': content.get('summary', ''),
                            'keyConcepts': content.get('keyConcepts', []),
                            'difficulty': item.get('difficulty', path.difficulty),
                            'estimatedMinutes': item.get('estimatedMinutes', 10),
                            'username': path.user.username,
                            'createdAt': path.created_at.isoformat(),
                            'hasExamples': bool(content.get('examples')),
                            'hasDiagram': bool(content.get('mermaidDiagram')),
                            'hasPracticePrompt': bool(content.get('practicePrompt')),
                        }
                    )

        # Apply pagination
        total = len(ai_lessons_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_lessons = ai_lessons_list[start:end]

        return Response(
            {
                'count': total,
                'next': f'?page={page + 1}' if end < total else None,
                'previous': f'?page={page - 1}' if page > 1 else None,
                'results': paginated_lessons,
            }
        )

    @action(detail=False, methods=['get'], url_path=r'ai-lessons/(?P<path_id>\d+)/(?P<order>\d+)/detail')
    def get_ai_lesson_detail(self, request, path_id=None, order=None):
        """
        GET /api/v1/admin/learning/lessons/ai-lessons/{path_id}/{order}/detail/

        Get full AI lesson content for editing.
        """
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        path_id = int(path_id)
        order = int(order)

        try:
            path = SavedLearningPath.objects.select_related('user').get(id=path_id)
        except SavedLearningPath.DoesNotExist:
            return Response({'error': 'Learning path not found'}, status=status.HTTP_404_NOT_FOUND)

        # Find the lesson in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson = next(
            (item for item in curriculum if item.get('order') == order and item.get('type') == 'ai_lesson'),
            None,
        )

        if not lesson:
            return Response({'error': 'AI lesson not found at this order'}, status=status.HTTP_404_NOT_FOUND)

        content = lesson.get('content', {})

        return Response(
            {
                'id': f'{path.id}-{order}',
                'pathId': path.id,
                'pathSlug': path.slug,
                'pathTitle': path.title,
                'order': order,
                'title': lesson.get('title', 'Untitled Lesson'),
                'difficulty': lesson.get('difficulty', path.difficulty),
                'estimatedMinutes': lesson.get('estimatedMinutes', 10),
                'username': path.user.username,
                'createdAt': path.created_at.isoformat(),
                # Full content fields
                'summary': content.get('summary', ''),
                'keyConcepts': content.get('keyConcepts', []),
                'explanation': content.get('explanation', ''),
                'examples': content.get('examples', []),
                'practicePrompt': content.get('practicePrompt', ''),
                'mermaidDiagram': content.get('mermaidDiagram', ''),
            }
        )

    @action(detail=False, methods=['patch'], url_path=r'ai-lessons/(?P<path_id>\d+)/(?P<order>\d+)')
    def update_ai_lesson(self, request, path_id=None, order=None):
        """
        PATCH /api/v1/admin/learning/lessons/ai-lessons/{path_id}/{order}/

        Update an AI-generated lesson's content.
        """
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        path_id = int(path_id)
        order = int(order)

        # Get the saved learning path
        try:
            path = SavedLearningPath.objects.get(id=path_id)
        except SavedLearningPath.DoesNotExist:
            return Response({'error': 'Learning path not found'}, status=status.HTTP_404_NOT_FOUND)

        # Find the lesson in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson_index = None
        for i, item in enumerate(curriculum):
            if item.get('order') == order and item.get('type') == 'ai_lesson':
                lesson_index = i
                break

        if lesson_index is None:
            return Response({'error': 'AI lesson not found at this order'}, status=status.HTTP_404_NOT_FOUND)

        # Update lesson fields
        lesson = curriculum[lesson_index]
        content = lesson.get('content', {})

        # Update title if provided
        if 'title' in request.data:
            lesson['title'] = request.data['title']

        # Update difficulty if provided
        if 'difficulty' in request.data:
            lesson['difficulty'] = request.data['difficulty']

        # Update estimatedMinutes if provided
        if 'estimatedMinutes' in request.data:
            lesson['estimatedMinutes'] = request.data['estimatedMinutes']

        # Update content fields
        if 'summary' in request.data:
            content['summary'] = request.data['summary']
        if 'keyConcepts' in request.data:
            content['keyConcepts'] = request.data['keyConcepts']
        if 'explanation' in request.data:
            content['explanation'] = request.data['explanation']
        if 'practicePrompt' in request.data:
            content['practicePrompt'] = request.data['practicePrompt']
        if 'mermaidDiagram' in request.data:
            content['mermaidDiagram'] = request.data['mermaidDiagram']
        if 'examples' in request.data:
            content['examples'] = request.data['examples']

        lesson['content'] = content
        curriculum[lesson_index] = lesson

        # Save the updated path data
        path.path_data['curriculum'] = curriculum
        path.save(update_fields=['path_data', 'updated_at'])

        return Response(
            {
                'id': f'{path.id}-{order}',
                'pathId': path.id,
                'pathSlug': path.slug,
                'pathTitle': path.title,
                'order': order,
                'title': lesson.get('title', 'Untitled Lesson'),
                'summary': content.get('summary', ''),
                'keyConcepts': content.get('keyConcepts', []),
                'difficulty': lesson.get('difficulty', path.difficulty),
                'estimatedMinutes': lesson.get('estimatedMinutes', 10),
                'username': path.user.username,
                'createdAt': path.created_at.isoformat(),
                'hasExamples': bool(content.get('examples')),
                'hasDiagram': bool(content.get('mermaidDiagram')),
                'hasPracticePrompt': bool(content.get('practicePrompt')),
            }
        )


class AdminAddProjectToPathView(APIView):
    """Admin endpoint to add/remove projects from a learning path's community section."""

    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        """
        POST /api/v1/admin/learning-paths/{path_id}/add-project/

        Add a project to a learning path's "See what others are doing" section.

        Request body:
        {
            "project_id": 123
        }
        """
        # Admin check
        if not request.user.is_authenticated or request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get('project_id')
        if not project_id:
            return Response({'error': 'project_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the learning path
        try:
            path = SavedLearningPath.objects.get(id=path_id)
        except SavedLearningPath.DoesNotExist:
            return Response({'error': 'Learning path not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get the project
        from core.projects.models import Project

        try:
            project = Project.objects.select_related('user', 'category').get(id=project_id)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Build project data for the curriculum
        project_data = {
            'id': project.id,
            'title': project.title,
            'slug': project.slug,
            'description': project.description[:200] if project.description else '',
            'thumbnail_url': project.thumbnail_url or '',
            'username': project.user.username,
            'user_avatar_url': getattr(project.user, 'avatar_url', ''),
            'category': project.category.name if project.category else '',
            'view_count': project.view_count,
            'like_count': project.like_count,
        }

        # Find or create the related_projects curriculum item
        curriculum = path.path_data.get('curriculum', [])
        related_projects_item = None
        related_projects_index = None

        for i, item in enumerate(curriculum):
            if item.get('type') == 'related_projects':
                related_projects_item = item
                related_projects_index = i
                break

        if related_projects_item is None:
            # Create a new related_projects item at the end
            max_order = max((item.get('order', 0) for item in curriculum), default=0)
            related_projects_item = {
                'type': 'related_projects',
                'title': 'See what others are doing',
                'order': max_order + 1,
                'projects': [],
            }
            curriculum.append(related_projects_item)
            related_projects_index = len(curriculum) - 1

        # Check if project already exists
        existing_ids = [p.get('id') for p in related_projects_item.get('projects', [])]
        if project.id in existing_ids:
            return Response(
                {'error': 'Project is already in this learning path'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Add project to the list
        related_projects_item.setdefault('projects', []).append(project_data)
        curriculum[related_projects_index] = related_projects_item

        # Also update path_data.related_projects for consistency
        path.path_data['curriculum'] = curriculum
        if 'related_projects' not in path.path_data:
            path.path_data['related_projects'] = []
        path.path_data['related_projects'].append(project_data)

        path.save(update_fields=['path_data', 'updated_at'])

        return Response(
            {
                'status': 'added',
                'project': project_data,
                'total_projects': len(related_projects_item.get('projects', [])),
            }
        )

    def delete(self, request, path_id):
        """
        DELETE /api/v1/admin/learning-paths/{path_id}/add-project/

        Remove a project from a learning path's "See what others are doing" section.

        Request body:
        {
            "project_id": 123
        }
        """
        # Admin check
        if not request.user.is_authenticated or request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        project_id = request.data.get('project_id')
        if not project_id:
            return Response({'error': 'project_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the learning path
        try:
            path = SavedLearningPath.objects.get(id=path_id)
        except SavedLearningPath.DoesNotExist:
            return Response({'error': 'Learning path not found'}, status=status.HTTP_404_NOT_FOUND)

        # Find the related_projects curriculum item
        curriculum = path.path_data.get('curriculum', [])
        related_projects_index = None

        for i, item in enumerate(curriculum):
            if item.get('type') == 'related_projects':
                related_projects_index = i
                break

        if related_projects_index is None:
            return Response({'error': 'No community projects section found'}, status=status.HTTP_404_NOT_FOUND)

        # Remove the project
        projects = curriculum[related_projects_index].get('projects', [])
        original_count = len(projects)
        projects = [p for p in projects if p.get('id') != project_id]

        if len(projects) == original_count:
            return Response({'error': 'Project not found in this learning path'}, status=status.HTTP_404_NOT_FOUND)

        curriculum[related_projects_index]['projects'] = projects

        # Also update path_data.related_projects for consistency
        path.path_data['curriculum'] = curriculum
        if 'related_projects' in path.path_data:
            path.path_data['related_projects'] = [
                p for p in path.path_data['related_projects'] if p.get('id') != project_id
            ]

        path.save(update_fields=['path_data', 'updated_at'])

        return Response(
            {
                'status': 'removed',
                'project_id': project_id,
                'total_projects': len(projects),
            }
        )


# ============================================================================
# LESSON PROGRESS VIEWS - Track lesson completion
# ============================================================================


class LessonProgressView(APIView):
    """View for tracking lesson progress within a learning path."""

    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        """
        GET /api/v1/learning-paths/{path_id}/progress/

        Get progress for all lessons in a learning path.
        Returns completion status for each lesson and overall progress.
        """
        # Get the learning path (can be owned by anyone - users can view other users' paths)
        try:
            path = SavedLearningPath.objects.get(id=path_id, is_archived=False)
        except SavedLearningPath.DoesNotExist:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get user's progress for this path
        progress_records = LessonProgress.objects.filter(
            user=request.user,
            saved_path=path,
        ).values('lesson_order', 'is_completed', 'exercise_completed', 'quiz_completed', 'completed_at')

        # Build a map of lesson_order -> progress
        progress_map = {p['lesson_order']: p for p in progress_records}

        # Get curriculum to build full progress list
        curriculum = path.path_data.get('curriculum', [])
        total_lessons = sum(1 for item in curriculum if item.get('type') == 'ai_lesson')
        completed_lessons = sum(1 for p in progress_records if p['is_completed'])

        # Build lesson-by-lesson progress
        lessons_progress = []
        for item in curriculum:
            if item.get('type') == 'ai_lesson':
                order = item.get('order', 0)
                progress = progress_map.get(order, {})
                lessons_progress.append(
                    {
                        'lessonOrder': order,
                        'title': item.get('title', 'Untitled'),
                        'isCompleted': progress.get('is_completed', False),
                        'exerciseCompleted': progress.get('exercise_completed', False),
                        'quizCompleted': progress.get('quiz_completed', False),
                        'completedAt': progress.get('completed_at'),
                    }
                )

        percentage = int((completed_lessons / total_lessons * 100) if total_lessons > 0 else 0)

        return Response(
            {
                'pathId': path.id,
                'pathTitle': path.title,
                'totalLessons': total_lessons,
                'completedLessons': completed_lessons,
                'percentage': percentage,
                'lessons': lessons_progress,
            }
        )


class CompleteLessonExerciseView(APIView):
    """View for marking a lesson exercise as completed."""

    permission_classes = [IsAuthenticated]

    def post(self, request, path_id, lesson_order):
        """
        POST /api/v1/learning-paths/{path_id}/lessons/{lesson_order}/complete-exercise/

        Mark a lesson's exercise as completed.
        Returns updated progress and whether the lesson is now complete.

        Users can only track progress on:
        - Their own learning paths
        - Published (shared) learning paths
        """
        # Get the learning path
        try:
            path = SavedLearningPath.objects.get(id=path_id, is_archived=False)
        except SavedLearningPath.DoesNotExist:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Security: Only allow progress on own paths or published paths
        if path.user != request.user and not path.is_published:
            return Response(
                {'error': 'You can only track progress on your own paths or shared paths'},
                status=status.HTTP_403_FORBIDDEN,
            )

        lesson_order = int(lesson_order)

        # Verify the lesson exists in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson = next(
            (item for item in curriculum if item.get('order') == lesson_order and item.get('type') == 'ai_lesson'),
            None,
        )

        if not lesson:
            return Response(
                {'error': 'Lesson not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get or create progress record
        progress, created = LessonProgress.objects.get_or_create(
            user=request.user,
            saved_path=path,
            lesson_order=lesson_order,
        )

        # Mark exercise as complete
        was_already_completed = progress.is_completed
        progress.mark_exercise_complete()

        # Get updated overall progress
        overall = LessonProgress.get_path_progress(request.user.id, path.id)

        return Response(
            {
                'lessonOrder': lesson_order,
                'lessonTitle': lesson.get('title', 'Untitled'),
                'isCompleted': progress.is_completed,
                'exerciseCompleted': progress.exercise_completed,
                'quizCompleted': progress.quiz_completed,
                'completedAt': progress.completed_at.isoformat() if progress.completed_at else None,
                'justCompleted': not was_already_completed and progress.is_completed,
                'overallProgress': overall,
            }
        )


class RegenerateLessonView(APIView):
    """View for regenerating an AI lesson with user guidance."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/regenerate/

        Regenerate a single AI lesson with optional user guidance.

        Request body:
        {
            "focus": "I want more hands-on examples",  # optional
            "reason": "The current explanation is too abstract"  # optional
        }

        Returns the regenerated lesson content.
        """
        from services.agents.learning.lesson_generator import AILessonGenerator

        # Get the saved path owned by this user
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        lesson_order = int(order)

        # Find the AI lesson in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson_index = None
        lesson_item = None

        for i, item in enumerate(curriculum):
            if item.get('order') == lesson_order and item.get('type') == 'ai_lesson':
                lesson_index = i
                lesson_item = item
                break

        if lesson_item is None:
            return Response(
                {'error': 'AI lesson not found at this order'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get user guidance from request body
        focus = request.data.get('focus', '')
        reason = request.data.get('reason', '')

        try:
            # Regenerate the lesson
            new_content = AILessonGenerator.regenerate_single_lesson(
                saved_path=path,
                lesson_order=lesson_order,
                focus=focus,
                reason=reason,
                user_id=request.user.id,
            )

            if not new_content:
                return Response(
                    {'error': 'Failed to regenerate lesson'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Update the curriculum with new content and optionally new title
            lesson_item['content'] = new_content

            # If AI generated a new title, update it
            new_title = new_content.get('title')
            if new_title:
                lesson_item['title'] = new_title

            curriculum[lesson_index] = lesson_item
            path.path_data['curriculum'] = curriculum
            path.save(update_fields=['path_data', 'updated_at'])

            # Return camelCase response (axios will convert from snake_case)
            return Response(
                {
                    'success': True,
                    'lesson': {
                        'order': lesson_order,
                        'title': lesson_item.get('title', 'Untitled'),
                        'content': new_content,
                    },
                }
            )

        except Exception as e:
            logger.error(f'Lesson regeneration failed: {e}', exc_info=True)
            return Response(
                {'error': 'Failed to regenerate lesson. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegenerateExerciseView(APIView):
    """View for regenerating a lesson exercise with a different type."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/regenerate-exercise/

        Regenerate just the exercise with a different type.

        Request body:
        {
            "exercise_type": "git"  # terminal, git, ai_prompt, code_review
        }

        Returns the regenerated exercise.
        """
        from services.agents.learning.lesson_generator import AILessonGenerator

        # Get the saved path owned by this user
        path = SavedLearningPath.objects.filter(
            user=request.user,
            slug=slug,
            is_archived=False,
        ).first()

        if not path:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        lesson_order = int(order)

        # Find the AI lesson in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson_index = None
        lesson_item = None

        for i, item in enumerate(curriculum):
            if item.get('order') == lesson_order and item.get('type') == 'ai_lesson':
                lesson_index = i
                lesson_item = item
                break

        if lesson_item is None:
            return Response(
                {'error': 'AI lesson not found at this order'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get and validate exercise type
        exercise_type = request.data.get('exercise_type', '')
        valid_types = {
            'terminal',
            'code',
            'ai_prompt',  # Legacy types
            'drag_sort',
            'connect_nodes',
            'code_walkthrough',
            'timed_challenge',  # Interactive types
        }

        if exercise_type not in valid_types:
            return Response(
                {'error': f'Invalid exercise type. Must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Regenerate just the exercise
            new_exercise = AILessonGenerator.regenerate_exercise(
                lesson_content=lesson_item.get('content', {}),
                lesson_title=lesson_item.get('title', ''),
                exercise_type=exercise_type,
                user_id=request.user.id,
            )

            if not new_exercise:
                return Response(
                    {'error': 'Failed to regenerate exercise'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Update the lesson content with new exercise
            content = lesson_item.get('content', {})
            content['exercise'] = new_exercise
            lesson_item['content'] = content
            curriculum[lesson_index] = lesson_item
            path.path_data['curriculum'] = curriculum
            path.save(update_fields=['path_data', 'updated_at'])

            # Return camelCase response (axios will convert from snake_case)
            return Response(
                {
                    'success': True,
                    'exercise': new_exercise,
                }
            )

        except Exception as e:
            logger.error(f'Exercise regeneration failed: {e}', exc_info=True)
            return Response(
                {'error': 'Failed to regenerate exercise. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AddExerciseView(APIView):
    """Add an additional exercise to a lesson."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/add-exercise/

        Add a new exercise to the lesson's exercises array.

        Request body:
        {
            "exercise_type": "timed_challenge",  # Optional - AI chooses if omitted
            "skill_level": "intermediate"  # Optional
        }

        Returns the newly generated exercise.
        """
        from services.agents.learning.lesson_generator import AILessonGenerator

        # Get the lesson using helper
        path, lesson_index, lesson_item, error = get_lesson_from_saved_path(request.user, slug, order)
        if error:
            return error

        # Get current exercises (normalize from old format if needed)
        content = lesson_item.get('content', {})
        exercises = normalize_exercises_from_content(content)

        # Check limit (max 3 exercises)
        if len(exercises) >= 3:
            return Response(
                {'error': 'Maximum 3 exercises per lesson. Remove one to add another.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get exercise type preference (optional)
        exercise_type = request.data.get('exercise_type', '')
        valid_types = {
            'terminal',
            'code',
            'ai_prompt',
            'drag_sort',
            'connect_nodes',
            'code_walkthrough',
            'timed_challenge',
        }

        if exercise_type and exercise_type not in valid_types:
            return Response(
                {'error': f'Invalid exercise type. Must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get existing exercise types for variety
        existing_types = [ex.get('exercise_type') for ex in exercises if ex.get('exercise_type')]

        try:
            # Generate a new exercise
            new_exercise = AILessonGenerator.regenerate_exercise(
                lesson_content=content,
                lesson_title=lesson_item.get('title', ''),
                exercise_type=exercise_type,
                user_id=request.user.id,
                existing_types=existing_types,  # For variety
            )

            if not new_exercise:
                return Response(
                    {'error': 'Failed to generate exercise'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Ensure the new exercise has an ID
            if 'id' not in new_exercise:
                new_exercise['id'] = str(uuid.uuid4())

            # Add to exercises array
            exercises.append(new_exercise)
            content['exercises'] = exercises

            # Update the lesson
            lesson_item['content'] = content
            curriculum = path.path_data.get('curriculum', [])
            curriculum[lesson_index] = lesson_item
            path.path_data['curriculum'] = curriculum
            path.save(update_fields=['path_data', 'updated_at'])

            return Response(
                {
                    'success': True,
                    'exercise': new_exercise,
                    'total_exercises': len(exercises),
                }
            )

        except Exception as e:
            logger.error(f'Add exercise failed: {e}', exc_info=True)
            return Response(
                {'error': 'Failed to add exercise. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RemoveExerciseView(APIView):
    """Remove an exercise from a lesson."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/remove-exercise/

        Remove an exercise by ID from the lesson's exercises array.

        Request body:
        {
            "exercise_id": "uuid-to-remove"
        }

        Returns success status and remaining exercise count.
        """
        exercise_id = request.data.get('exercise_id', '')

        if not exercise_id:
            return Response(
                {'error': 'exercise_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the lesson using helper
        path, lesson_index, lesson_item, error = get_lesson_from_saved_path(request.user, slug, order)
        if error:
            return error

        # Get current exercises (normalize from old format if needed)
        content = lesson_item.get('content', {})
        exercises = normalize_exercises_from_content(content)

        # Find and remove the exercise
        original_count = len(exercises)
        exercises = [ex for ex in exercises if ex.get('id') != exercise_id]

        if len(exercises) == original_count:
            return Response(
                {'error': 'Exercise not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Update the lesson content
        content['exercises'] = exercises
        lesson_item['content'] = content
        curriculum = path.path_data.get('curriculum', [])
        curriculum[lesson_index] = lesson_item
        path.path_data['curriculum'] = curriculum
        path.save(update_fields=['path_data', 'updated_at'])

        return Response(
            {
                'success': True,
                'remaining_count': len(exercises),
            }
        )


class RegenerateSpecificExerciseView(APIView):
    """Regenerate a specific exercise by ID."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug, order):
        """
        POST /api/v1/me/saved-paths/{slug}/lessons/{order}/regenerate-specific-exercise/

        Regenerate a specific exercise by ID with optionally a different type.

        Request body:
        {
            "exercise_id": "uuid-of-exercise",
            "exercise_type": "timed_challenge"  # Optional - uses same type if omitted
        }

        Returns the regenerated exercise.
        """
        from services.agents.learning.lesson_generator import AILessonGenerator

        exercise_id = request.data.get('exercise_id', '')

        if not exercise_id:
            return Response(
                {'error': 'exercise_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the lesson using helper
        path, lesson_index, lesson_item, error = get_lesson_from_saved_path(request.user, slug, order)
        if error:
            return error

        # Get current exercises (normalize from old format if needed)
        content = lesson_item.get('content', {})
        exercises = normalize_exercises_from_content(content)

        # Find the exercise to regenerate
        exercise_index = None
        old_exercise = None
        for i, ex in enumerate(exercises):
            if ex.get('id') == exercise_id:
                exercise_index = i
                old_exercise = ex
                break

        if exercise_index is None:
            return Response(
                {'error': 'Exercise not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get exercise type (use provided or keep same)
        exercise_type = request.data.get('exercise_type', old_exercise.get('exercise_type', ''))
        valid_types = {
            'terminal',
            'code',
            'ai_prompt',
            'drag_sort',
            'connect_nodes',
            'code_walkthrough',
            'timed_challenge',
        }

        if exercise_type and exercise_type not in valid_types:
            return Response(
                {'error': f'Invalid exercise type. Must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get existing exercise types (excluding the one being regenerated)
        existing_types = [
            ex.get('exercise_type') for ex in exercises if ex.get('id') != exercise_id and ex.get('exercise_type')
        ]

        try:
            # Regenerate the exercise
            new_exercise = AILessonGenerator.regenerate_exercise(
                lesson_content=content,
                lesson_title=lesson_item.get('title', ''),
                exercise_type=exercise_type,
                user_id=request.user.id,
                existing_types=existing_types,
            )

            if not new_exercise:
                return Response(
                    {'error': 'Failed to regenerate exercise'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Keep the same ID
            new_exercise['id'] = exercise_id

            # Replace the exercise in the array
            exercises[exercise_index] = new_exercise
            content['exercises'] = exercises

            # Update the lesson
            lesson_item['content'] = content
            curriculum = path.path_data.get('curriculum', [])
            curriculum[lesson_index] = lesson_item
            path.path_data['curriculum'] = curriculum
            path.save(update_fields=['path_data', 'updated_at'])

            return Response(
                {
                    'success': True,
                    'exercise': new_exercise,
                }
            )

        except Exception as e:
            logger.error(f'Regenerate specific exercise failed: {e}', exc_info=True)
            return Response(
                {'error': 'Failed to regenerate exercise. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CompleteLessonQuizView(APIView):
    """View for marking a lesson quiz as completed."""

    permission_classes = [IsAuthenticated]

    def post(self, request, path_id, lesson_order):
        """
        POST /api/v1/learning-paths/{path_id}/lessons/{lesson_order}/complete-quiz/

        Mark a lesson's quiz as completed with optional score.

        Users can only track progress on:
        - Their own learning paths
        - Published (shared) learning paths

        Request body:
        {
            "score": 0.85  // Optional: quiz score as 0.0-1.0
        }
        """
        # Get the learning path
        try:
            path = SavedLearningPath.objects.get(id=path_id, is_archived=False)
        except SavedLearningPath.DoesNotExist:
            return Response(
                {'error': 'Learning path not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Security: Only allow progress on own paths or published paths
        if path.user != request.user and not path.is_published:
            return Response(
                {'error': 'You can only track progress on your own paths or shared paths'},
                status=status.HTTP_403_FORBIDDEN,
            )

        lesson_order = int(lesson_order)

        # Verify the lesson exists in the curriculum
        curriculum = path.path_data.get('curriculum', [])
        lesson = next(
            (item for item in curriculum if item.get('order') == lesson_order and item.get('type') == 'ai_lesson'),
            None,
        )

        if not lesson:
            return Response(
                {'error': 'Lesson not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get or create progress record
        progress, created = LessonProgress.objects.get_or_create(
            user=request.user,
            saved_path=path,
            lesson_order=lesson_order,
        )

        # Get optional score
        score = request.data.get('score')
        if score is not None:
            try:
                score = float(score)
                score = max(0.0, min(1.0, score))  # Clamp to 0-1
            except (ValueError, TypeError):
                score = None

        # Mark quiz as complete
        was_already_completed = progress.is_completed
        progress.mark_quiz_complete(score=score)

        # Get updated overall progress
        overall = LessonProgress.get_path_progress(request.user.id, path.id)

        return Response(
            {
                'lessonOrder': lesson_order,
                'lessonTitle': lesson.get('title', 'Untitled'),
                'isCompleted': progress.is_completed,
                'exerciseCompleted': progress.exercise_completed,
                'quizCompleted': progress.quiz_completed,
                'quizScore': progress.quiz_score,
                'completedAt': progress.completed_at.isoformat() if progress.completed_at else None,
                'justCompleted': not was_already_completed and progress.is_completed,
                'overallProgress': overall,
            }
        )
