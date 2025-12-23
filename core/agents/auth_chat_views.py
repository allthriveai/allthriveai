"""
Auth chat views with streaming support
"""

import json
import logging
import uuid

from django.contrib.auth import authenticate
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.users.models import User
from services.agents.auth.graph import auth_graph
from services.agents.auth.validators import (
    validate_email,
    validate_interests,
    validate_name,
    validate_password,
    validate_username,
)

logger = logging.getLogger(__name__)


def _get_state_values(state_snapshot):
    """Return the underlying dict of state values.

    LangGraph's get_state() may return an object with a `.values` dict
    attribute, or in some cases a plain dict. This helper normalizes both
    so the rest of the code can safely call `.get(...)` on the result.
    """
    values = getattr(state_snapshot, 'values', None)
    if isinstance(values, dict):
        return values
    if isinstance(state_snapshot, dict):
        return state_snapshot
    return {}


@csrf_exempt
@require_http_methods(['POST'])
def auth_chat_stream(request):
    """
    Streaming endpoint for auth chat.
    Uses Server-Sent Events (SSE) to stream AI responses.

    Request body:
        {
            "session_id": "uuid",
            "action": "start", "submit_email", "submit_name", "submit_password",
                      "submit_interests", or "agree_values",
            "data": {...}  // Depends on action
        }
    """
    try:
        body = json.loads(request.body)
        session_id = body.get('session_id') or str(uuid.uuid4())
        action = body.get('action', 'start')
        data = body.get('data', {})

        # Configure for streaming
        config = {'configurable': {'thread_id': session_id}}

        def event_stream():
            """Generator for SSE events."""
            try:
                # Get current state
                current_state = auth_graph.get_state(config)
                state_values = _get_state_values(current_state)

                # Initialize state if new session
                if not state_values.get('messages'):
                    initial_state = {
                        'messages': [],
                        'step': 'welcome',
                        'mode': 'signup',
                        'email': None,
                        'username': None,
                        'suggested_username': None,
                        'first_name': None,
                        'last_name': None,
                        'password_validated': False,
                        'interests': [],
                        'agreed_to_values': False,
                        'user_exists': False,
                        'error': None,
                    }
                    current_state = auth_graph.update_state(config, initial_state)
                    state_values = _get_state_values(current_state)

                # Handle different actions
                if action == 'start':
                    # Start chat with a static welcome message (no AI call)
                    welcome_text = 'Welcome to All Thrive. We are glad you are here.'
                    messages = state_values.get('messages', [])

                    # Update graph state so future actions (submit_email, etc.)
                    # see this first assistant message and the correct step/mode
                    auth_graph.update_state(
                        config,
                        {
                            'messages': messages + [{'role': 'assistant', 'content': welcome_text}],
                            'step': 'welcome',
                            'mode': state_values.get('mode', 'signup'),
                        },
                    )

                    # We don't need to invoke the graph here; the generic
                    # streaming logic below will read the updated state and
                    # stream this static message as tokens.

                elif action == 'submit_email':
                    email = data.get('email', '').strip().lower()

                    # Validate email
                    is_valid, error = validate_email(email)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\n\n'
                        return

                    # Add user message
                    new_msg = {'role': 'user', 'content': email}
                    messages = state_values.get('messages', [])

                    # Check if user exists
                    try:
                        user = User.objects.get(email=email)
                        # Email already registered
                        response_text = (
                            'This email is already registered! Would you like to log in instead? '
                            'Please enter your password to continue, or use a different email.'
                        )
                        auth_graph.update_state(
                            config,
                            {
                                'email': email,
                                'first_name': user.first_name,
                                'user_exists': True,
                                'mode': 'login',
                                'step': 'password',
                                'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                            },
                        )
                    except User.DoesNotExist:
                        # New user - signup flow
                        response_text = "Great! Let's create your account. What's your name?"
                        auth_graph.update_state(
                            config,
                            {
                                'email': email,
                                'user_exists': False,
                                'mode': 'signup',
                                'step': 'name',
                                'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                            },
                        )

                elif action == 'accept_username':
                    # User accepted suggested username
                    suggested_username = state_values.get('suggested_username')

                    # Validate it's still available
                    is_valid, error = validate_username(suggested_username)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\\n\\n'
                        return

                    # Update state with username
                    auth_graph.update_state(config, {'username': suggested_username})

                    # Add user message
                    new_msg = {'role': 'user', 'content': 'Yes'}
                    messages = state_values.get('messages', [])
                    auth_graph.update_state(config, {'messages': messages + [new_msg]})

                    # Move to confirm_username node
                    auth_graph.invoke(None, config, {'next': 'confirm_username'})

                elif action == 'reject_username':
                    # User wants to choose own username
                    # Add user message
                    new_msg = {'role': 'user', 'content': "No, I'll choose my own"}
                    messages = state_values.get('messages', [])
                    auth_graph.update_state(config, {'messages': messages + [new_msg]})

                    # Move to ask_username_custom node
                    auth_graph.invoke(None, config, {'next': 'ask_username_custom'})

                elif action == 'submit_username':
                    username = data.get('username', '').strip().lower()

                    # Validate username
                    is_valid, error = validate_username(username)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\\n\\n'
                        return

                    # Update state with username
                    auth_graph.update_state(config, {'username': username})

                    # Add user message
                    new_msg = {'role': 'user', 'content': username}
                    messages = state_values.get('messages', [])
                    auth_graph.update_state(config, {'messages': messages + [new_msg]})

                    # Move to confirm_username node
                    auth_graph.invoke(None, config, {'next': 'confirm_username'})

                elif action == 'submit_name':
                    first_name = data.get('first_name', '').strip()
                    last_name = data.get('last_name', '').strip()

                    # Validate name
                    is_valid, error = validate_name(first_name, last_name)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\n\n'
                        return

                    # Add user message
                    new_msg = {'role': 'user', 'content': f'{first_name} {last_name}'}
                    messages = state_values.get('messages', [])
                    response_text = 'Create a secure password (at least 8 characters with letters and numbers).'

                    # Update state
                    auth_graph.update_state(
                        config,
                        {
                            'first_name': first_name,
                            'last_name': last_name,
                            'step': 'password',
                            'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                        },
                    )

                elif action == 'submit_password':
                    password = data.get('password')

                    # Validate password
                    is_valid, error = validate_password(password)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\n\n'
                        return

                    # Add user message (don't show actual password)
                    new_msg = {'role': 'user', 'content': '••••••••'}
                    messages = state_values.get('messages', [])

                    # SECURITY: Store password ONLY in cache with TTL, never in LangGraph state
                    # Use cache with 5-minute expiry to prevent stale passwords and race conditions
                    from django.core.cache import cache

                    cache.set(f'auth_password_{session_id}', password, timeout=300)  # 5 min TTL

                    # Check if login or signup
                    mode = state_values.get('mode')
                    if mode == 'login':
                        # Attempt login validation (don't actually authenticate yet)
                        email = state_values.get('email')
                        user = authenticate(request, username=email, password=password)

                        if user is None:
                            # Clear password from cache on failure
                            from django.core.cache import cache

                            cache.delete(f'auth_password_{session_id}')
                            yield f'data: {json.dumps({"type": "error", "message": "Invalid password"})}\n\n'
                            return

                        # Password validated (cookies will be issued via finalize endpoint)
                        first_name = user.first_name
                        response_text = f"Welcome back, {first_name}! You're all set."

                        auth_graph.update_state(
                            config,
                            {
                                'password_validated': True,
                                'step': 'complete',
                                'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                            },
                        )
                    else:
                        # Signup flow - ask for interests
                        response_text = (
                            'What brings you to All Thrive? Select all that apply: Explore, Share my skills, '
                            'Invest in AI projects, or Mentor others.'
                        )
                        auth_graph.update_state(
                            config,
                            {
                                'password_validated': True,
                                'step': 'interests',
                                'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                            },
                        )

                elif action == 'submit_interests':
                    interests = data.get('interests', [])

                    # Validate interests
                    is_valid, error = validate_interests(interests)
                    if not is_valid:
                        yield f'data: {json.dumps({"type": "error", "message": error})}\n\n'
                        return

                    # Add user message
                    interest_labels = {
                        'explore': 'Explore',
                        'share_skills': 'Share my skills',
                        'invest': 'Invest in AI projects',
                        'mentor': 'Mentor others',
                    }
                    selected = [interest_labels.get(i, i) for i in interests]
                    new_msg = {'role': 'user', 'content': ', '.join(selected)}
                    messages = state_values.get('messages', [])

                    # Show values
                    values_text = """Here are the core values that guide our community:

🌟 **Innovation** - We embrace new ideas and creative solutions
🤝 **Collaboration** - We thrive together, supporting each other
💡 **Growth** - We're always learning and improving
🎯 **Impact** - We focus on making a real difference

Do you agree to these values?"""

                    auth_graph.update_state(
                        config,
                        {
                            'interests': interests,
                            'step': 'values',
                            'messages': messages + [new_msg, {'role': 'assistant', 'content': values_text}],
                        },
                    )

                elif action == 'agree_values':
                    # Add user message
                    new_msg = {'role': 'user', 'content': 'Yes, I agree'}
                    messages = state_values.get('messages', [])

                    # Update state (user creation happens in finalize endpoint)
                    first_name = state_values.get('first_name', '')
                    response_text = f'Welcome to All Thrive, {first_name}! Your account is ready.'

                    auth_graph.update_state(
                        config,
                        {
                            'agreed_to_values': True,
                            'step': 'complete',
                            'messages': messages + [new_msg, {'role': 'assistant', 'content': response_text}],
                        },
                    )

                # Get final state
                final_state = auth_graph.get_state(config)
                final_values = _get_state_values(final_state)

                # Stream the last message (AI response)
                messages = final_values.get('messages', [])
                if messages:
                    last_message = messages[-1]
                    if last_message['role'] == 'assistant':
                        content = last_message['content']

                        # Stream word by word for effect
                        words = content.split()
                        for word in words:
                            yield f'data: {json.dumps({"type": "token", "content": word + " "})}\n\n'

                # Send completion event with next step
                step = final_values.get('step')
                mode = final_values.get('mode')
                suggested_username = final_values.get('suggested_username')

                completion_data = {
                    'type': 'complete',
                    'step': step,
                    'mode': mode,
                    'session_id': session_id,
                    'suggested_username': suggested_username,
                }
                yield f'data: {json.dumps(completion_data)}\n\n'

            except Exception as e:
                # Clean up any cached password on error
                from django.core.cache import cache

                cache.delete(f'auth_password_{session_id}')
                yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@extend_schema(
    parameters=[
        {
            'name': 'session_id',
            'in': 'query',
            'required': True,
            'schema': {'type': 'string', 'format': 'uuid'},
            'description': 'Chat session ID',
        }
    ],
    responses={
        200: inline_serializer(
            name='AuthChatStateResponse',
            fields={
                'session_id': serializers.CharField(),
                'step': serializers.CharField(allow_null=True),
                'mode': serializers.CharField(allow_null=True),
                'messages': serializers.ListField(child=serializers.DictField()),
                'has_email': serializers.BooleanField(),
                'has_name': serializers.BooleanField(),
                'has_password': serializers.BooleanField(),
                'has_interests': serializers.BooleanField(),
                'agreed_to_values': serializers.BooleanField(),
            },
        ),
        400: inline_serializer(
            name='AuthChatStateErrorResponse',
            fields={'error': serializers.CharField()},
        ),
    },
)
@api_view(['GET'])
@permission_classes([AllowAny])
def auth_chat_state(request):
    """
    Get current state of auth chat session.

    Query params:
        session_id: Chat session ID
    """
    session_id = request.GET.get('session_id')

    if not session_id:
        return Response({'error': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)

    config = {'configurable': {'thread_id': session_id}}

    try:
        current_state = auth_graph.get_state(config)
        values = _get_state_values(current_state)

        return Response(
            {
                'session_id': session_id,
                'step': values.get('step'),
                'mode': values.get('mode'),
                'messages': values.get('messages', []),
                'has_email': bool(values.get('email')),
                'has_name': bool(values.get('first_name')),
                'has_password': bool(values.get('password')),
                'has_interests': len(values.get('interests', [])) > 0,
                'agreed_to_values': values.get('agreed_to_values', False),
            }
        )

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    request=inline_serializer(
        name='AuthChatFinalizeRequest',
        fields={'session_id': serializers.CharField()},
    ),
    responses={
        200: inline_serializer(
            name='AuthChatFinalizeResponse',
            fields={
                'success': serializers.BooleanField(),
                'username': serializers.CharField(),
            },
        ),
        400: inline_serializer(
            name='AuthChatFinalizeErrorResponse',
            fields={'error': serializers.CharField()},
        ),
        401: inline_serializer(
            name='AuthChatFinalizeUnauthorizedResponse',
            fields={'error': serializers.CharField()},
        ),
    },
)
@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def auth_chat_finalize(request):
    """
    Finalize auth chat by issuing JWT cookies based on stored session state.

    Body:
        {"session_id": "uuid"}
    """
    from services.auth import (
        AuthenticationFailed,
        AuthValidationError,
        SessionError,
        UserCreationError,
        set_auth_cookies,
    )
    from services.auth.chat import ChatAuthService

    try:
        body = json.loads(request.body)
        session_id = body.get('session_id')
        if not session_id:
            return Response({'error': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve password from cache (never stored in LangGraph state)
        from django.core.cache import cache

        password = cache.get(f'auth_password_{session_id}')
        if not password:
            return Response(
                {'error': 'Password expired or session invalid. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use service to finalize authentication
        user = ChatAuthService.finalize_session(session_id, password)

        # Clear password from cache after successful use
        cache.delete(f'auth_password_{session_id}')

        # Set JWT cookies using centralized service
        response = Response({'success': True, 'username': user.username})
        return set_auth_cookies(response, user)

    except AuthValidationError as e:
        # Invalid input data (e.g., email format, password strength)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except UserCreationError as e:
        # User creation failed (e.g., username conflicts, database errors)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except SessionError as e:
        # Session state issues (e.g., incomplete data, invalid state)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except AuthenticationFailed as e:
        # Authentication failed (wrong password, disabled account)
        return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)
    except json.JSONDecodeError:
        # Malformed request body
        return Response({'error': 'Invalid request format'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        # Unexpected errors - log and return generic message
        logger.error(f'Unexpected error in auth_chat_finalize: {e}', exc_info=True)
        return Response(
            {'error': 'Authentication failed. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
