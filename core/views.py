from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import connections
from django.db.utils import OperationalError
from .models import Conversation, Message, Project
from .serializers import ConversationSerializer, MessageSerializer, ProjectSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def db_health(request):
    """Health check endpoint to verify database connectivity.

    Returns 200 with {'status': 'ok'} when SELECT 1 succeeds, 503 otherwise.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1;')
            cursor.fetchone()
        return Response({'status': 'ok'})
    except OperationalError as e:
        return Response({'status': 'error', 'detail': str(e)}, status=503)

class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing conversations."""
    serializer_class = ConversationSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Conversation.objects.filter(user=self.request.user)
        return Conversation.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message in a conversation and get AI response."""
        conversation = self.get_object()
        message_content = request.data.get('content', '')

        if not message_content:
            return Response(
                {'error': 'Message content is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create user message
        user_message = Message.objects.create(
            conversation=conversation,
            role='user',
            content=message_content
        )

        # TODO: Integrate with AI service (OpenAI/Anthropic)
        # For now, return a placeholder response
        assistant_response = "AI response placeholder - integrate with OpenAI/Anthropic"

        assistant_message = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=assistant_response
        )

        return Response({
            'user_message': MessageSerializer(user_message).data,
            'assistant_message': MessageSerializer(assistant_message).data
        })


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing messages."""
    serializer_class = MessageSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Message.objects.filter(conversation__user=self.request.user)
        return Message.objects.none()


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user projects.

    All projects are scoped to the authenticated user; `user` is never
    client-controlled.
    """

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return projects for the current user
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Bind project to the authenticated user and let the model handle slug
        # generation / uniqueness on save.
        serializer.save(user=self.request.user)
