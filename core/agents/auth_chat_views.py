"""
Auth chat views with streaming support
"""
import json
import uuid

from django.contrib.auth import authenticate, login
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.users.models import User
from services.auth_agent.graph import auth_graph
from services.auth_agent.validators import (
    validate_email,
    validate_interests,
    validate_name,
    validate_password,
    validate_username,
)
from services.project_agent.graph import project_graph


def _get_state_values(state_snapshot):
    """Return the underlying dict of state values.

    LangGraph's get_state() may return an object with a `.values` dict
    attribute, or in some cases a plain dict. This helper normalizes both
    so the rest of the code can safely call `.get(...)` on the result.
    """
    values = getattr(state_snapshot, "values", None)
    if isinstance(values, dict):
        return values
    if isinstance(state_snapshot, dict):
        return state_snapshot
    return {}


@csrf_exempt
@require_http_methods(["POST"])
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
        session_id = body.get("session_id") or str(uuid.uuid4())
        action = body.get("action", "start")
        data = body.get("data", {})

        # Configure for streaming
        config = {"configurable": {"thread_id": session_id}}

        def event_stream():
            """Generator for SSE events."""
            try:
                # Get current state
                current_state = auth_graph.get_state(config)
                state_values = _get_state_values(current_state)

                # Initialize state if new session
                if not state_values.get("messages"):
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
                        "error": None,
                    }
                    current_state = auth_graph.update_state(config, initial_state)
                    state_values = _get_state_values(current_state)

                # Handle different actions
                if action == "start":
                    # Start chat with a static welcome message (no AI call)
                    welcome_text = "Welcome to All Thrive. We are glad you are here."
                    messages = state_values.get("messages", [])

                    # Update graph state so future actions (submit_email, etc.)
                    # see this first assistant message and the correct step/mode
                    auth_graph.update_state(
                        config,
                        {
                            "messages": messages + [{"role": "assistant", "content": welcome_text}],
                            "step": "welcome",
                            "mode": state_values.get("mode", "signup"),
                        },
                    )

                    # We don't need to invoke the graph here; the generic
                    # streaming logic below will read the updated state and
                    # stream this static message as tokens.

                elif action == "submit_email":
                    email = data.get("email", "").strip().lower()

                    # Validate email
                    is_valid, error = validate_email(email)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
                        return

                    # Add user message
                    new_msg = {"role": "user", "content": email}
                    messages = state_values.get("messages", [])

                    # Check if user exists
                    try:
                        user = User.objects.get(email=email)
                        # Email already registered
                        response_text = (
                            "This email is already registered! Would you like to log in instead? "
                            "Please enter your password to continue, or use a different email."
                        )
                        auth_graph.update_state(
                            config,
                            {
                                "email": email,
                                "first_name": user.first_name,
                                "user_exists": True,
                                "mode": "login",
                                "step": "password",
                                "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                            },
                        )
                    except User.DoesNotExist:
                        # New user - signup flow
                        response_text = "Great! Let's create your account. What's your name?"
                        auth_graph.update_state(
                            config,
                            {
                                "email": email,
                                "user_exists": False,
                                "mode": "signup",
                                "step": "name",
                                "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                            },
                        )

                elif action == "accept_username":
                    # User accepted suggested username
                    suggested_username = state_values.get("suggested_username")

                    # Validate it's still available
                    is_valid, error = validate_username(suggested_username)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return

                    # Update state with username
                    auth_graph.update_state(config, {"username": suggested_username})

                    # Add user message
                    new_msg = {"role": "user", "content": "Yes"}
                    messages = state_values.get("messages", [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})

                    # Move to confirm_username node
                    auth_graph.invoke(None, config, {"next": "confirm_username"})

                elif action == "reject_username":
                    # User wants to choose own username
                    # Add user message
                    new_msg = {"role": "user", "content": "No, I'll choose my own"}
                    messages = state_values.get("messages", [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})

                    # Move to ask_username_custom node
                    auth_graph.invoke(None, config, {"next": "ask_username_custom"})

                elif action == "submit_username":
                    username = data.get("username", "").strip().lower()

                    # Validate username
                    is_valid, error = validate_username(username)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\\n\\n"
                        return

                    # Update state with username
                    auth_graph.update_state(config, {"username": username})

                    # Add user message
                    new_msg = {"role": "user", "content": username}
                    messages = state_values.get("messages", [])
                    auth_graph.update_state(config, {"messages": messages + [new_msg]})

                    # Move to confirm_username node
                    auth_graph.invoke(None, config, {"next": "confirm_username"})

                elif action == "submit_name":
                    first_name = data.get("first_name", "").strip()
                    last_name = data.get("last_name", "").strip()

                    # Validate name
                    is_valid, error = validate_name(first_name, last_name)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
                        return

                    # Add user message
                    new_msg = {"role": "user", "content": f"{first_name} {last_name}"}
                    messages = state_values.get("messages", [])
                    response_text = "Create a secure password (at least 8 characters with letters and numbers)."

                    # Update state
                    auth_graph.update_state(
                        config,
                        {
                            "first_name": first_name,
                            "last_name": last_name,
                            "step": "password",
                            "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                        },
                    )

                elif action == "submit_password":
                    password = data.get("password")

                    # Validate password
                    is_valid, error = validate_password(password)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
                        return

                    # Add user message (don't show actual password)
                    new_msg = {"role": "user", "content": "••••••••"}
                    messages = state_values.get("messages", [])

                    # Check if login or signup
                    mode = state_values.get("mode")
                    if mode == "login":
                        # Attempt login
                        email = state_values.get("email")
                        user = authenticate(request, username=email, password=password)

                        if user is None:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid password'})}\n\n"
                            return

                        # Login successful
                        login(request, user)
                        first_name = user.first_name
                        response_text = f"Welcome back, {first_name}! You're all set."

                        auth_graph.update_state(
                            config,
                            {
                                "password": password,
                                "step": "complete",
                                "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                            },
                        )
                    else:
                        # Signup flow - ask for interests
                        response_text = (
                            "What brings you to All Thrive? Select all that apply: Explore, Share my skills, "
                            "Invest in AI projects, or Mentor others."
                        )
                        auth_graph.update_state(
                            config,
                            {
                                "password": password,
                                "step": "interests",
                                "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                            },
                        )

                elif action == "submit_interests":
                    interests = data.get("interests", [])

                    # Validate interests
                    is_valid, error = validate_interests(interests)
                    if not is_valid:
                        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
                        return

                    # Add user message
                    interest_labels = {
                        "explore": "Explore",
                        "share_skills": "Share my skills",
                        "invest": "Invest in AI projects",
                        "mentor": "Mentor others",
                    }
                    selected = [interest_labels.get(i, i) for i in interests]
                    new_msg = {"role": "user", "content": ", ".join(selected)}
                    messages = state_values.get("messages", [])

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
                            "interests": interests,
                            "step": "values",
                            "messages": messages + [new_msg, {"role": "assistant", "content": values_text}],
                        },
                    )

                elif action == "agree_values":
                    # Add user message
                    new_msg = {"role": "user", "content": "Yes, I agree"}
                    messages = state_values.get("messages", [])

                    # Create user account if signup
                    mode = state_values.get("mode")
                    if mode == "signup":
                        state = state_values

                        # Create user
                        user = User.objects.create_user(
                            username=state.get("username", state["email"]),  # Use email as username
                            email=state["email"],
                            password=state["password"],
                            first_name=state["first_name"],
                            last_name=state["last_name"],
                            role="explorer",  # Default role
                        )

                        # Auto-login
                        login(request, user)

                        first_name = state["first_name"]
                        response_text = f"Welcome to All Thrive, {first_name}! Your account is ready."

                        auth_graph.update_state(
                            config,
                            {
                                "agreed_to_values": True,
                                "step": "complete",
                                "messages": messages + [new_msg, {"role": "assistant", "content": response_text}],
                            },
                        )

                # Get final state
                final_state = auth_graph.get_state(config)
                final_values = _get_state_values(final_state)

                # Stream the last message (AI response)
                messages = final_values.get("messages", [])
                if messages:
                    last_message = messages[-1]
                    if last_message["role"] == "assistant":
                        content = last_message["content"]

                        # Stream word by word for effect
                        words = content.split()
                        for word in words:
                            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"

                # Send completion event with next step
                step = final_values.get("step")
                mode = final_values.get("mode")
                suggested_username = final_values.get("suggested_username")

                completion_data = {
                    "type": "complete",
                    "step": step,
                    "mode": mode,
                    "session_id": session_id,
                    "suggested_username": suggested_username,
                }
                yield f"data: {json.dumps(completion_data)}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def auth_chat_state(request):
    """
    Get current state of auth chat session.

    Query params:
        session_id: Chat session ID
    """
    session_id = request.GET.get("session_id")

    if not session_id:
        return Response({"error": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

    config = {"configurable": {"thread_id": session_id}}

    try:
        current_state = auth_graph.get_state(config)
        values = _get_state_values(current_state)

        return Response(
            {
                "session_id": session_id,
                "step": values.get("step"),
                "mode": values.get("mode"),
                "messages": values.get("messages", []),
                "has_email": bool(values.get("email")),
                "has_name": bool(values.get("first_name")),
                "has_password": bool(values.get("password")),
                "has_interests": len(values.get("interests", [])) > 0,
                "agreed_to_values": values.get("agreed_to_values", False),
            }
        )

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@require_http_methods(["POST"])
def project_chat_stream(request):
    """
    Streaming endpoint for project creation chat.
    Uses Server-Sent Events (SSE) to stream AI responses.
    Requires authentication.

    Request body:
        {
            "session_id": "uuid",
            "action": "start" | "submit",
            "message": "user message"  // For submit action
        }
    """
    print("[PROJECT_CHAT] Request received")

    # Check authentication
    if not request.user.is_authenticated:
        print("[PROJECT_CHAT] User not authenticated")
        return JsonResponse({"error": "Authentication required"}, status=401)

    print(f"[PROJECT_CHAT] User: {request.user.username} (id={request.user.id})")

    try:
        body = json.loads(request.body)
        session_id = body.get("session_id") or str(uuid.uuid4())
        action = body.get("action", "start")
        user_message = body.get("message", "")

        print(f"[PROJECT_CHAT] Session: {session_id}, Action: {action}, Message: {user_message}")

        # Configure for streaming
        config = {"configurable": {"thread_id": session_id}}

        def event_stream():
            """Generator for SSE events."""
            try:
                print(f"[PROJECT_CHAT] Starting event stream for session {session_id}")
                # Get current state
                current_state = project_graph.get_state(config)
                state_values = _get_state_values(current_state)
                print(f"[PROJECT_CHAT] Current state step at start: {state_values.get('step')}")

                # Initialize state if new session
                if not state_values.get("messages"):
                    initial_state = {
                        "messages": [],
                        "step": "welcome",
                        "title": None,
                        "description": None,
                        "project_type": None,
                        "is_showcase": False,
                        "user_id": request.user.id,
                        "username": request.user.username,
                        "error": None,
                        "project_id": None,
                        "project_slug": None,
                    }
                    current_state = project_graph.update_state(config, initial_state)
                    state_values = _get_state_values(current_state)

                # Handle different actions
                if action == "start":
                    print("[PROJECT_CHAT] Action=start: invoking welcome node")
                    try:
                        # Invoke welcome node first
                        result = project_graph.invoke(None, config)
                        print(f"[PROJECT_CHAT] Welcome node completed: {result}")
                    except Exception as e:
                        print(f"[PROJECT_CHAT] Error invoking welcome node: {e}")
                        import traceback

                        traceback.print_exc()
                        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                        return

                    # If a message was provided with start, process it as the title
                    if user_message:
                        print(f"[PROJECT_CHAT] Processing message with start: {user_message}")
                        try:
                            # Get updated state after welcome
                            current_state = project_graph.get_state(config)
                            state_values = _get_state_values(current_state)
                            print(f"[PROJECT_CHAT] State after welcome: step={state_values.get('step')}")

                            # Add user message
                            messages = state_values.get("messages", [])
                            new_msg = {"role": "user", "content": user_message}
                            messages.append(new_msg)
                            project_graph.update_state(config, {"messages": messages})
                            print("[PROJECT_CHAT] Updated messages, invoking process_title")

                            # Process the title (first step after welcome)
                            # Call the node function directly since graph ends at each node
                            from services.project_agent.nodes import process_title_node

                            updated_state = process_title_node(state_values)
                            project_graph.update_state(config, updated_state)
                            print("[PROJECT_CHAT] process_title completed")
                        except Exception as e:
                            print(f"[PROJECT_CHAT] Error processing title: {e}")
                            import traceback

                            traceback.print_exc()
                            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                            return

                elif action == "submit":
                    if not user_message:
                        print("[PROJECT_CHAT] Error: submit without message")
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Message required'})}\n\n"
                        return

                    print(f"[PROJECT_CHAT] Received user message: {user_message}")

                    # Add user message
                    messages = state_values.get("messages", [])
                    new_msg = {"role": "user", "content": user_message}
                    messages.append(new_msg)

                    # Update state with user message
                    project_graph.update_state(config, {"messages": messages})

                    # Determine which node to invoke based on current step
                    step = state_values.get("step")
                    print(f"[PROJECT_CHAT] Current step before processing: {step}")
                    node_map = {
                        "welcome": "process_title",
                        "title": "process_title",
                        "description": "process_description",
                        "type": "process_type",
                        "showcase": "process_showcase",
                        "confirm": "create_project",  # User confirmed, create it
                    }

                    next_node = node_map.get(step)
                    print(f"[PROJECT_CHAT] Next node: {next_node}, current step: {step}")
                    if next_node:
                        # Call the node function directly
                        from services.project_agent.nodes import (
                            create_project_node,
                            process_description_node,
                            process_showcase_node,
                            process_title_node,
                            process_type_node,
                        )

                        node_functions = {
                            "process_title": process_title_node,
                            "process_description": process_description_node,
                            "process_type": process_type_node,
                            "process_showcase": process_showcase_node,
                            "create_project": create_project_node,
                        }

                        node_fn = node_functions.get(next_node)
                        if node_fn:
                            # Get current state
                            current_state = project_graph.get_state(config)
                            state_values = _get_state_values(current_state)
                            # Call node function
                            updated_state = node_fn(state_values)
                            # Update graph state
                            project_graph.update_state(config, updated_state)
                            print(f"[PROJECT_CHAT] {next_node} completed")
                    else:
                        print("[PROJECT_CHAT] No next node mapped for step", step)

                # Get final state
                final_state = project_graph.get_state(config)
                final_values = _get_state_values(final_state)
                print(f"[PROJECT_CHAT] Final step: {final_values.get('step')}")

                # Stream the last message (AI response)
                messages = final_values.get("messages", [])
                if messages:
                    last_message = messages[-1]
                    if last_message["role"] == "assistant":
                        content = last_message["content"]

                        # Stream word by word for effect
                        words = content.split()
                        for word in words:
                            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"

                # Send completion event with current step
                step = final_values.get("step")
                project_id = final_values.get("project_id")
                project_slug = final_values.get("project_slug")

                completion_data = {
                    "type": "complete",
                    "step": step,
                    "session_id": session_id,
                    "project_id": project_id,
                    "project_slug": project_slug,
                }
                yield f"data: {json.dumps(completion_data)}\n\n"

            except Exception as e:
                import traceback

                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
