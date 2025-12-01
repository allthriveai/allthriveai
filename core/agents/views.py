import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .intent_detection import get_intent_service
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

logger = logging.getLogger(__name__)


class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing conversations."""

    permission_classes = [IsAuthenticated]
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
            return Response({'error': 'Message content is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create user message
        user_message = Message.objects.create(conversation=conversation, role='user', content=message_content)

        # TODO: Integrate with AI service (OpenAI/Anthropic)
        # For now, return a placeholder response
        assistant_response = 'AI response placeholder - integrate with OpenAI/Anthropic'

        assistant_message = Message.objects.create(
            conversation=conversation, role='assistant', content=assistant_response
        )

        return Response(
            {
                'user_message': MessageSerializer(user_message).data,
                'assistant_message': MessageSerializer(assistant_message).data,
            }
        )


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing messages."""

    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Message.objects.filter(conversation__user=self.request.user)
        return Message.objects.none()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def detect_intent(request):
    """
    Detect user intent using LLM-based reasoning.

    POST /api/v1/agents/detect-intent/

    Request body:
    {
        "message": "How do I create a project?",
        "conversation_history": [
            {"sender": "user", "content": "Hi"},
            {"sender": "agent", "content": "Hello! How can I help?"}
        ],
        "integration_type": "github"  // optional
    }

    Response:
    {
        "intent": "support",
        "transition_message": "How can I help you today?"
    }
    """
    # Constants for validation
    MAX_MESSAGE_LENGTH = 5000
    MAX_HISTORY_ITEMS = 10
    VALID_INTEGRATION_TYPES = ['github', 'youtube', 'upload', 'url', None]

    try:
        # Extract request data
        user_message = request.data.get('message', '')
        conversation_history = request.data.get('conversation_history', [])
        integration_type = request.data.get('integration_type')

        # Validate message exists and is not empty
        if not user_message or not user_message.strip():
            return Response(
                {'error': 'Message is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate message length
        if len(user_message) > MAX_MESSAGE_LENGTH:
            return Response(
                {'error': f'Message too long. Maximum length is {MAX_MESSAGE_LENGTH} characters'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate conversation history is a list
        if not isinstance(conversation_history, list):
            return Response(
                {'error': 'conversation_history must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Limit conversation history size (take most recent)
        if len(conversation_history) > MAX_HISTORY_ITEMS:
            conversation_history = conversation_history[-MAX_HISTORY_ITEMS:]
            logger.warning(f'Conversation history truncated to {MAX_HISTORY_ITEMS} items for user {request.user.id}')

        # Validate integration type
        if integration_type and integration_type not in VALID_INTEGRATION_TYPES:
            return Response(
                {
                    'error': 'Invalid integration_type. Must be one of: {}'.format(
                        ', '.join(filter(None, VALID_INTEGRATION_TYPES))
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get intent service
        intent_service = get_intent_service()

        # Detect intent
        detected_intent = intent_service.detect_intent(
            user_message=user_message,
            conversation_history=conversation_history,
            integration_type=integration_type,
        )

        # Get transition message
        transition_message = intent_service.get_mode_transition_message(
            new_mode=detected_intent,
            integration_type=integration_type,
        )

        logger.info(f'Intent detected for user {request.user.id}: {detected_intent}')

        return Response(
            {
                'intent': detected_intent,
                'transition_message': transition_message,
            }
        )

    except Exception as e:
        logger.error(f'Error detecting intent: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to detect intent'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
