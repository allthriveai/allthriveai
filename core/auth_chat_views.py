"""
Auth chat views with streaming support
"""
import json
import uuid
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import login, authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from services.auth_agent.graph import auth_graph
from services.auth_agent.validators import (
    validate_email,
    validate_name,
    validate_password,
    validate_interests,
    validate_username
)
from core.models import User


@csrf_exempt
@require_http_methods(["POST"])
def auth_chat_stream(request):
    """
    Streaming endpoint for auth chat.
    Uses Server-Sent Events (SSE) to stream AI responses.
    
    Request body:
        {
            "session_id": "uuid",
            "action": "start" | "submit_email" | "submit_name" | "submit_password" | "submit_interests" | "agree_values",
            "data": {...}  // Depends on action
        }
    """
    try:
        body = json.loads(request.body)
        session_id = body.get('session_id') or str(uuid.uuid4())
        action = body.get('action', 'start')
        data = body.get('data', {})
        
        # Configure for streaming
        config = {
            "configurable": {
                "thread_id": session_id
            }
        }
        
        def event_stream():
            """Generator for SSE events."""
            try:
                # Get current state
                current_state = auth_graph.get_state(config)
                
                # Initialize state if new session
                if not current_state.values.get('messages'):
                    initial_state = {
                        "messages": [],
                        "step": "welcome",
                        "mode": "signup",
                        "email": None,
                        "first_name": None,
                        "last_name": None,
                        "password": None,
                        "interests": [],
                        "agreed_to_values": False,
                        "user_exists": False,
                        "error": None
                    }
                    current_state = auth_graph.update_state(config, initial_state)
                
                # Handle different actions
                if action == "start":
                    # Start the graph - welcome message
                    result = auth_graph.invoke(None, config)
                    
                elif action == "submit_email":
                    email = data.get('email', '').strip().lower()
                    
                    # Validate email
                    is_valid, error = validate_email(email)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return
                    
                    # Update state with email
                    auth_graph.update_state(config, {"email": email})
                    
                    # Add user message
                    new_msg = {"role": "user", "content": email}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Continue graph - check email
                    result = auth_graph.invoke(None, config)
                
                elif action == "accept_username":
                    # User accepted suggested username
                    suggested_username = current_state.values.get('suggested_username')
                    
                    # Validate it's still available
                    is_valid, error = validate_username(suggested_username)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return
                    
                    # Update state with username
                    auth_graph.update_state(config, {"username": suggested_username})
                    
                    # Add user message
                    new_msg = {"role": "user", "content": "Yes"}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Move to confirm_username node
                    result = auth_graph.invoke(None, config, {"next": "confirm_username"})
                    
                elif action == "reject_username":
                    # User wants to choose own username
                    # Add user message
                    new_msg = {"role": "user", "content": "No, I'll choose my own"}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Move to ask_username_custom node
                    result = auth_graph.invoke(None, config, {"next": "ask_username_custom"})
                    
                elif action == "submit_username":
                    username = data.get('username', '').strip().lower()
                    
                    # Validate username
                    is_valid, error = validate_username(username)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return
                    
                    # Update state with username
                    auth_graph.update_state(config, {"username": username})
                    
                    # Add user message
                    new_msg = {"role": "user", "content": username}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Move to confirm_username node
                    result = auth_graph.invoke(None, config, {"next": "confirm_username"})
                    
                elif action == "submit_name":
                    first_name = data.get('first_name', '').strip()
                    last_name = data.get('last_name', '').strip()
                    
                    # Validate name
                    is_valid, error = validate_name(first_name, last_name)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return
                    
                    # Update state
                    auth_graph.update_state(config, {
                        "first_name": first_name,
                        "last_name": last_name
                    })
                    
                    # Add user message
                    new_msg = {"role": "user", "content": f"{first_name} {last_name}"}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Continue graph
                    result = auth_graph.invoke(None, config)
                    
                elif action == "submit_password":
                    password = data.get('password')
                    
                    # Validate password
                    is_valid, error = validate_password(password)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return
                    
                    # Update state
                    auth_graph.update_state(config, {"password": password})
                    
                    # Add user message (don't show actual password)
                    new_msg = {"role": "user", "content": "••••••••"}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Check if login or signup
                    mode = current_state.values.get('mode')
                    if mode == 'login':
                        # Attempt login
                        email = current_state.values.get('email')
                        user = authenticate(request, username=email, password=password)
                        
                        if user is None:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid password'})}\n\n"
                            return
                        
                        # Login successful
                        login(request, user)
                        
                    # Continue graph
                    result = auth_graph.invoke(None, config)
                    
                elif action == "submit_interests":
                    interests = data.get('interests', [])
                    
                    # Validate interests
                    is_valid, error = validate_interests(interests)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
                        return
                    
                    # Update state
                    auth_graph.update_state(config, {"interests": interests})
                    
                    # Add user message
                    interest_labels = {
                        'explore': 'Explore',
                        'share_skills': 'Share my skills',
                        'invest': 'Invest in AI projects',
                        'mentor': 'Mentor others'
                    }
                    selected = [interest_labels.get(i, i) for i in interests]
                    new_msg = {"role": "user", "content": ", ".join(selected)}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Continue graph
                    result = auth_graph.invoke(None, config)
                    
                elif action == "agree_values":
                    # Update state
                    auth_graph.update_state(config, {"agreed_to_values": True})
                    
                    # Add user message
                    new_msg = {"role": "user", "content": "Yes, I agree"}
                    messages = current_state.values.get('messages', [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})
                    
                    # Create user account if signup
                    mode = current_state.values.get('mode')
                    if mode == 'signup':
                        state = current_state.values
                        
                        # Create user
                        user = User.objects.create_user(
                            username=state.get('username', state['email']),  # Use chosen username or fallback to email
                            email=state['email'],
                            password=state['password'],
                            first_name=state['first_name'],
                            last_name=state['last_name'],
                            role='explorer'  # Default role
                        )
                        
                        # Store interests (you can add an interests field to User model)
                        # For now, we'll skip storing interests
                        
                        # Auto-login
                        login(request, user)
                    
                    # Continue graph - completion message
                    result = auth_graph.invoke(None, config)
                
                # Get final state
                final_state = auth_graph.get_state(config)
                
                # Stream the last message (AI response)
                messages = final_state.values.get('messages', [])
                if messages:
                    last_message = messages[-1]
                    if last_message['role'] == 'assistant':
                        content = last_message['content']
                        
                        # Stream word by word for effect
                        words = content.split()
                        for word in words:
                            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
                
                # Send completion event with next step
                step = final_state.values.get('step')
                mode = final_state.values.get('mode')
                suggested_username = final_state.values.get('suggested_username')
                
                completion_data = {
                    'type': 'complete',
                    'step': step,
                    'mode': mode,
                    'session_id': session_id,
                    'suggested_username': suggested_username
                }
                yield f"data: {json.dumps(completion_data)}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        
        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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
    
    config = {
        "configurable": {
            "thread_id": session_id
        }
    }
    
    try:
        current_state = auth_graph.get_state(config)
        
        return Response({
            'session_id': session_id,
            'step': current_state.values.get('step'),
            'mode': current_state.values.get('mode'),
            'messages': current_state.values.get('messages', []),
            'has_email': bool(current_state.values.get('email')),
            'has_name': bool(current_state.values.get('first_name')),
            'has_password': bool(current_state.values.get('password')),
            'has_interests': len(current_state.values.get('interests', [])) > 0,
            'agreed_to_values': current_state.values.get('agreed_to_values', False)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
