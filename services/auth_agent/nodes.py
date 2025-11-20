"""
LangGraph nodes for auth chat flow
"""
from typing import List, Literal, Optional, TypedDict

from core.users.models import User
from services.ai_provider import AIProvider

from . import prompts


class AuthState(TypedDict):
    """State for auth chat conversation."""

    messages: List[dict]
    step: Literal[
        "welcome",
        "email",
        "username_suggest",
        "username_custom",
        "name",
        "password",
        "interests",
        "values",
        "agreement",
        "complete",
    ]
    mode: Literal["signup", "login", "oauth_setup"]
    email: Optional[str]
    username: Optional[str]
    suggested_username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    password: Optional[str]
    interests: List[str]
    agreed_to_values: bool
    user_exists: bool
    error: Optional[str]


def welcome_node(state: AuthState) -> dict:
    """Generate a static welcome message.

    This is intentionally hard-coded so that when a non-logged-in user lands on
    the /login chat-based auth page, the first chat response is predictable and
    matches the desired copy.
    """
    response = "Welcome to All Thrive. We are glad you are here."

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "welcome"}


def ask_email_node(state: AuthState) -> dict:
    """Ask for email address."""
    response = "What's your email address?"

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "email"}


def check_email_node(state: AuthState) -> dict:
    """Check if email exists and route accordingly.

    This node is sometimes reached before the user has actually submitted an
    email (e.g., when the graph flows from the initial welcome node). In that
    case, we should *not* attempt to look up a user or generate a username
    from a missing email; instead, we re-ask for the email address.
    """
    email = state.get("email")

    # If we don't yet have an email in state, fall back to asking for it again.
    if not email:
        response = "What's your email address?"
        return {
            "messages": state["messages"] + [{"role": "assistant", "content": response}],
            "user_exists": False,
            "first_name": None,
            "mode": "signup",
            "step": "email",
            "suggested_username": None,
        }

    # Check if user exists
    try:
        user = User.objects.get(email=email)
        user_exists = True
        first_name = user.first_name
        mode = "login"

        # Welcome back message
        response = f"Welcome back, {first_name}! Please enter your password."

        next_step = "password"  # Ask for password to login
        suggested_username = None

    except User.DoesNotExist:
        user_exists = False
        first_name = None
        mode = "signup"
        suggested_username = None

        # New user message
        response = "Great! Let's create your account. What's your name?"

        # Move directly to collecting name (no username step)
        next_step = "name"

    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "user_exists": user_exists,
        "first_name": first_name,
        "mode": mode,
        "step": next_step,
        "suggested_username": suggested_username,
    }


def ask_username_suggest_node(state: AuthState) -> dict:
    """Suggest username from email and ask if they want to use it."""
    ai = AIProvider()
    email = state.get("email")
    suggested_username = state.get("suggested_username")

    prompt = prompts.USERNAME_SUGGEST_PROMPT.format(email=email, suggested_username=suggested_username)
    response = ai.complete(prompt=prompt, system_message=prompts.SYSTEM_PROMPT, temperature=0.8, max_tokens=150)

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "username_suggest"}


def ask_username_custom_node(state: AuthState) -> dict:
    """Ask for custom username."""
    ai = AIProvider()

    response = ai.complete(
        prompt=prompts.USERNAME_CUSTOM_PROMPT, system_message=prompts.SYSTEM_PROMPT, temperature=0.8, max_tokens=100
    )

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "username_custom"}


def confirm_username_node(state: AuthState) -> dict:
    """Confirm username is available."""
    ai = AIProvider()
    username = state.get("username")

    prompt = prompts.USERNAME_CONFIRMED_PROMPT.format(username=username)
    response = ai.complete(prompt=prompt, system_message=prompts.SYSTEM_PROMPT, temperature=0.8, max_tokens=100)

    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "name",  # Move to name step after username confirmed
    }


def ask_name_node(state: AuthState) -> dict:
    """Ask for first and last name."""
    response = "What's your first and last name?"

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "name"}


def ask_password_node(state: AuthState) -> dict:
    """Ask for password (signup or login)."""
    mode = state.get("mode")

    if mode == "login":
        # Login - ask for password
        first_name = state.get("first_name", "")
        response = f"Enter your password to continue, {first_name}."
    else:
        # Signup - create password
        response = "Create a secure password (at least 8 characters with letters and numbers)."

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "password"}


def ask_interests_node(state: AuthState) -> dict:
    """Ask for interests (multi-select)."""
    response = (
        "What brings you to All Thrive? Select all that apply: Explore, Share my skills, "
        "Invest in AI projects, or Mentor others."
    )

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "interests"}


def show_values_node(state: AuthState) -> dict:
    """Show AllThrive core values."""
    intro = "Here are the core values that guide our community:"

    # Core values
    values = """
🌟 **Innovation** - We embrace new ideas and creative solutions
🤝 **Collaboration** - We thrive together, supporting each other
💡 **Growth** - We're always learning and improving
🎯 **Impact** - We focus on making a real difference
"""

    full_message = f"{intro}\n\n{values}"

    return {"messages": state["messages"] + [{"role": "assistant", "content": full_message}], "step": "values"}


def ask_agreement_node(state: AuthState) -> dict:
    """Ask for values agreement."""
    response = "Do you agree to these values?"

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "agreement"}


def complete_signup_node(state: AuthState) -> dict:
    """Complete signup - create user account."""
    # Account creation happens in the view after this node
    # This node just generates success message
    first_name = state.get("first_name", "")
    response = f"Welcome to All Thrive, {first_name}! Your account is ready."

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "complete"}


def complete_login_node(state: AuthState) -> dict:
    """Complete login - authenticate user."""
    # Login happens in the view after this node
    # This node just generates welcome back message
    first_name = state.get("first_name", "")
    response = f"Welcome back, {first_name}! You're all set."

    return {"messages": state["messages"] + [{"role": "assistant", "content": response}], "step": "complete"}
