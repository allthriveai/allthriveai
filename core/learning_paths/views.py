"""Views for Learning Paths API."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from core.users.models import User
from services.learning_path_service import LearningPathService

from .models import UserLearningPath
from .serializers import (
    LearningPathDetailSerializer,
    TopicRecommendationSerializer,
    UserLearningPathSerializer,
)


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
