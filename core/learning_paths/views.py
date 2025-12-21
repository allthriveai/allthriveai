"""Views for Learning Paths API."""

from django.db import IntegrityError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
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
    ProactiveOfferResponse,
    ProjectLearningMetadata,
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


class AllTopicsView(APIView):
    """View to get all available topics."""

    permission_classes = []

    def get(self, request):
        """
        GET /api/v1/learning-paths/topics/

        Returns all available learning path topics from Taxonomy.
        """
        from core.taxonomy.models import Taxonomy

        topic_taxonomies = Taxonomy.objects.filter(taxonomy_type='topic', is_active=True).order_by('order', 'name')
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

        return Response(profile.generated_path)


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

        Submit feedback on an Ember response.

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
