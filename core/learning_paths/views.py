"""Views for Learning Paths API."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from core.users.models import User
from services.gamification import LearningPathService

from .models import (
    Concept,
    LearnerProfile,
    LearningEvent,
    ProjectLearningMetadata,
    UserConceptMastery,
    UserLearningPath,
)
from .serializers import (
    ConceptSerializer,
    CreateLearningEventSerializer,
    LearnerProfileSerializer,
    LearningEventSerializer,
    LearningPathDetailSerializer,
    LearningStatsSerializer,
    ProjectLearningMetadataSerializer,
    TopicRecommendationSerializer,
    UserConceptMasterySerializer,
    UserLearningPathSerializer,
)
from .services import LearningEventService


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
        limit = int(request.query_params.get('limit', 5))
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
        valid_topics = [choice[0] for choice in UserLearningPath.TOPIC_CHOICES]
        return topic in valid_topics


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


class AllTopicsView(APIView):
    """View to get all available topics."""

    permission_classes = []

    def get(self, request):
        """
        GET /api/v1/learning-paths/topics/

        Returns all available learning path topics.
        """
        topics = [
            {
                'slug': choice[0],
                'name': choice[1],
            }
            for choice in UserLearningPath.TOPIC_CHOICES
        ]
        return Response(topics)


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
        limit = int(request.query_params.get('limit', 20))
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
        days = int(request.query_params.get('days', 30))
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
        limit = int(request.query_params.get('limit', 10))

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
