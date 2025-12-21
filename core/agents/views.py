import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.billing.permissions import CanMakeAIRequest
from core.projects.models import Project
from services.ai.provider import AIProvider

from .intent_detection import get_intent_service
from .models import Conversation, ImageGenerationSession, Message
from .serializers import ConversationSerializer, MessageSerializer

logger = logging.getLogger(__name__)


def _generate_creative_journey_summary(iterations: list[dict]) -> tuple[str, str, str]:
    """
    Generate an AI summary of the creative journey from iterations.

    Args:
        iterations: List of iteration data with prompt, gemini_response, order

    Returns:
        Tuple of (title, summary_text, cleaned_prompt_description)
    """
    if not iterations:
        return 'Nano Banana Creation', 'An AI-generated image.', 'An AI-generated image.'

    # Get the final prompt (last iteration) for the description
    final_prompt = iterations[-1]['prompt'] if iterations else ''

    # Build the journey narrative
    journey_text = '\n'.join([f'Iteration {i["order"] + 1}: User asked: "{i["prompt"]}"' for i in iterations])

    # Use AI to generate a creative summary and clean up the prompt
    prompt = f"""You are summarizing the creative journey of generating an AI image.

The user went through {len(iterations)} iteration(s) to create their final image:

{journey_text}

Write THREE things:
1. A SHORT TITLE (5-8 words max) that captures what was created
2. A BRIEF NARRATIVE (2-3 sentences) describing the creative journey -
   how the image evolved through iterations
3. A CLEANED DESCRIPTION - take the final prompt and fix any spelling/grammar errors,
   but keep the original meaning and style. This should be 1-2 sentences max.

Format your response EXACTLY like this:
TITLE: [your title here]
SUMMARY: [your summary here]
DESCRIPTION: [cleaned version of the final prompt]

Be creative and engaging but concise."""

    try:
        # Use the configured default AI provider instead of hard-coding Azure.
        ai = AIProvider()
        response = ai.complete(prompt=prompt, max_tokens=300, temperature=0.7)

        # Parse the response
        lines = response.strip().split('\n')
        title = 'Nano Banana Creation'
        summary = ''
        description = final_prompt  # Default to original prompt

        for line in lines:
            if line.startswith('TITLE:'):
                title = line.replace('TITLE:', '').strip()
            elif line.startswith('SUMMARY:'):
                summary = line.replace('SUMMARY:', '').strip()
            elif line.startswith('DESCRIPTION:'):
                description = line.replace('DESCRIPTION:', '').strip()

        if not summary:
            summary = response.strip()

        if not description:
            description = final_prompt

        return title, summary, description

    except Exception as e:
        logger.error(f'Failed to generate creative journey summary: {e}')
        # Fallback to simple summary
        first_prompt = iterations[0]['prompt'] if iterations else 'an image'
        return (
            f'Nano Banana: {first_prompt[:50]}',
            f'Created through {len(iterations)} iteration(s), starting with: "{first_prompt}"',
            final_prompt or first_prompt,
        )


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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanMakeAIRequest])
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
@permission_classes([IsAuthenticated, CanMakeAIRequest])
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
            user=request.user,
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_conversation(request):
    """
    Clear the conversation history/checkpoint for a user.

    POST /api/v1/agents/clear-conversation/

    Request body:
    {
        "conversation_id": "ember-chat-2"  // optional, defaults to ember-chat-{user_id}
    }

    This clears:
    - PostgreSQL checkpoints (LangGraph state)
    - checkpoint_writes table
    - Redis cache for the conversation
    """
    from django.db import connection

    user_id = request.user.id
    conversation_id = request.data.get('conversation_id', f'ember-chat-{user_id}')

    # Security: ensure conversation_id belongs to this user
    if not conversation_id.endswith(f'-{user_id}'):
        return Response(
            {'error': 'Invalid conversation_id'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        deleted_checkpoints = 0
        deleted_writes = 0

        with connection.cursor() as cursor:
            # Clear checkpoints
            cursor.execute('DELETE FROM checkpoints WHERE thread_id = %s', [conversation_id])
            deleted_checkpoints = cursor.rowcount

            # Clear checkpoint_writes
            cursor.execute('DELETE FROM checkpoint_writes WHERE thread_id = %s', [conversation_id])
            deleted_writes = cursor.rowcount

        # Clear Redis cache
        try:
            from django_redis import get_redis_connection

            redis_conn = get_redis_connection('default')
            # Clear any cached checkpoints
            keys = redis_conn.keys(f'*{conversation_id}*')
            if keys:
                redis_conn.delete(*keys)
                logger.info(f'Cleared {len(keys)} Redis keys for {conversation_id}')
        except Exception as e:
            logger.warning(f'Failed to clear Redis cache: {e}')

        logger.info(
            f'Cleared conversation {conversation_id}: ' f'{deleted_checkpoints} checkpoints, {deleted_writes} writes'
        )

        return Response(
            {
                'success': True,
                'conversation_id': conversation_id,
                'deleted_checkpoints': deleted_checkpoints,
                'deleted_writes': deleted_writes,
            }
        )

    except Exception as e:
        logger.error(f'Failed to clear conversation: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to clear conversation'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class CreateProjectFromImageView(APIView):
    """
    Create a project from an image generation session.

    POST /api/v1/agents/create-project-from-image/

    This endpoint:
    1. Retrieves the image generation session with all iterations
    2. Uses AI to generate a creative journey summary
    3. Creates a project with the final image as featured image
    4. Includes the iteration history in the project content
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session_id')
        custom_title = request.data.get('title')

        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Get the session
            session = ImageGenerationSession.objects.get(id=session_id, user=request.user)
        except ImageGenerationSession.DoesNotExist:
            return Response(
                {'error': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if session already has a project
        if session.project:
            return Response(
                {
                    'error': 'Project already created from this session',
                    'project': {
                        'id': session.project.id,
                        'slug': session.project.slug,
                        'url': f'/{session.project.user.username}/{session.project.slug}',
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get iteration data for the summary
        iterations = session.get_creative_journey_data()

        if not iterations:
            return Response(
                {'error': 'No images generated in this session'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate title, summary, and cleaned description
        generated_title, summary, cleaned_description = _generate_creative_journey_summary(iterations)
        title = custom_title or generated_title

        # Build project content with creative journey
        content_blocks = [
            {'type': 'text', 'content': summary},
        ]

        # Add iteration history if multiple iterations
        if len(iterations) > 1:
            content_blocks.append({'type': 'heading', 'level': 2, 'content': 'Creative Journey'})
            content_blocks.append(
                {
                    'type': 'text',
                    'content': f'This image was refined through {len(iterations)} iterations:',
                }
            )

            for iteration in iterations:
                content_blocks.append(
                    {
                        'type': 'heading',
                        'level': 3,
                        'content': f'Iteration {iteration["order"] + 1}',
                    }
                )
                content_blocks.append(
                    {
                        'type': 'quote',
                        'content': iteration['prompt'],
                    }
                )
                content_blocks.append(
                    {
                        'type': 'image',
                        'url': iteration['image_url'],
                        'caption': f'Result of iteration {iteration["order"] + 1}',
                    }
                )

        project_content = {
            'templateVersion': 2,
            'sections': [
                {
                    'id': 'main',
                    'type': 'content',
                    'title': 'About This Creation',
                    'blocks': content_blocks,
                }
            ],
            'heroDisplayMode': 'image',
        }

        # Create the project with the cleaned prompt as description
        try:
            project = Project.objects.create(
                user=request.user,
                title=title,
                description=cleaned_description,  # Use the cleaned prompt as description
                featured_image_url=session.final_image_url,
                banner_url=session.final_image_url,
                type='prompt',
                content=project_content,
                is_showcased=True,
                hide_categories=True,  # Categories are for filtering only, not public display
            )

            # Add tools - try to find "Nano Banana" or create AI image generation tools
            from core.taxonomy.models import Taxonomy
            from core.tools.models import Tool

            # Try to add Nano Banana tool
            nano_banana_tool = Tool.objects.filter(name__icontains='Nano Banana').first()
            if not nano_banana_tool:
                # Try to find any AI image generation tool
                nano_banana_tool = Tool.objects.filter(name__icontains='image generation').first()
            if nano_banana_tool:
                project.tools.add(nano_banana_tool)

            # Add relevant categories silently (not displayed but helps with organization)
            ai_art_category = Taxonomy.objects.filter(
                taxonomy_type='category', slug__in=['ai-art', 'ai-generated', 'generative-ai', 'art']
            ).first()
            if ai_art_category:
                project.categories.add(ai_art_category)

            # Link project to session
            session.project = project
            session.save(update_fields=['project'])

            logger.info(f'Created project {project.id} from image session {session_id}')

            # Track quest completion for both image generation and project creation
            from core.thrive_circle.quest_tracker import track_quest_action
            from core.thrive_circle.signals import _mark_as_tracked
            from core.thrive_circle.utils import format_completed_quests

            completed_ids = []

            # Track image generation quest (mark as tracked to prevent double from signal)
            _mark_as_tracked('image_generated', request.user.id, str(session.id))
            iteration_count = getattr(session, 'iteration_count', None) or len(iterations)
            image_ids = track_quest_action(
                request.user,
                'image_generated',
                {
                    'session_id': session.id,
                    'iteration_count': iteration_count,
                },
            )
            completed_ids.extend(image_ids)

            # Track project creation quest (mark as tracked to prevent double from signal)
            _mark_as_tracked('project_created', request.user.id, str(project.id))
            project_ids = track_quest_action(
                request.user,
                'project_created',
                {
                    'project_id': project.id,
                    'project_type': project.type,
                },
            )
            completed_ids.extend(project_ids)

            response_data = {
                'success': True,
                'project': {
                    'id': project.id,
                    'slug': project.slug,
                    'title': project.title,
                    'url': f'/{project.user.username}/{project.slug}',
                },
            }

            if completed_ids:
                response_data['completed_quests'] = format_completed_quests(request.user, completed_ids)

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f'Failed to create project from image session: {e}', exc_info=True)
            return Response(
                {'error': 'Failed to create project'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
