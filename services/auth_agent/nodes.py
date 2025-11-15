"""
LangGraph nodes for auth chat flow
"""
from typing import TypedDict, Literal, List, Optional
from services.ai_provider import AIProvider
from core.models import User
from . import prompts


class AuthState(TypedDict):
    """State for auth chat conversation."""
    messages: List[dict]
    step: Literal['welcome', 'email', 'name', 'password', 'interests', 'values', 'agreement', 'complete']
    mode: Literal['signup', 'login', 'oauth_setup']
    email: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    password: Optional[str]
    interests: List[str]
    agreed_to_values: bool
    user_exists: bool
    error: Optional[str]


def welcome_node(state: AuthState) -> dict:
    """Generate welcome message."""
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.WELCOME_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=150
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "welcome"
    }


def ask_email_node(state: AuthState) -> dict:
    """Ask for email address."""
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.EMAIL_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=100
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "email"
    }


def check_email_node(state: AuthState) -> dict:
    """Check if email exists and route accordingly."""
    email = state.get("email")
    
    # Check if user exists
    try:
        user = User.objects.get(email=email)
        user_exists = True
        first_name = user.first_name
        mode = "login"
        
        # Generate welcome back message
        ai = AIProvider()
        prompt = prompts.EMAIL_EXISTS_PROMPT.format(email=email, first_name=first_name)
        response = ai.complete(
            prompt=prompt,
            system_message=prompts.SYSTEM_PROMPT,
            temperature=0.8,
            max_tokens=100
        )
        
        next_step = "password"  # Ask for password to login
        
    except User.DoesNotExist:
        user_exists = False
        first_name = None
        mode = "signup"
        
        # Generate new user message
        ai = AIProvider()
        prompt = prompts.EMAIL_NEW_PROMPT.format(email=email)
        response = ai.complete(
            prompt=prompt,
            system_message=prompts.SYSTEM_PROMPT,
            temperature=0.8,
            max_tokens=100
        )
        
        next_step = "name"  # Ask for name to signup
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "user_exists": user_exists,
        "first_name": first_name,
        "mode": mode,
        "step": next_step
    }


def ask_name_node(state: AuthState) -> dict:
    """Ask for first and last name."""
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.NAME_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=100
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "name"
    }


def ask_password_node(state: AuthState) -> dict:
    """Ask for password (signup or login)."""
    ai = AIProvider()
    mode = state.get("mode")
    
    if mode == "login":
        # Login - ask for password
        first_name = state.get("first_name", "")
        prompt = prompts.LOGIN_PASSWORD_PROMPT
        response = ai.complete(
            prompt=prompt,
            system_message=prompts.SYSTEM_PROMPT.replace("sign up", f"log in {first_name}"),
            temperature=0.8,
            max_tokens=100
        )
    else:
        # Signup - create password
        response = ai.complete(
            prompt=prompts.PASSWORD_PROMPT,
            system_message=prompts.SYSTEM_PROMPT,
            temperature=0.8,
            max_tokens=100
        )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "password"
    }


def ask_interests_node(state: AuthState) -> dict:
    """Ask for interests (multi-select)."""
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.INTERESTS_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=150
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "interests"
    }


def show_values_node(state: AuthState) -> dict:
    """Show AllThrive core values."""
    ai = AIProvider()
    
    # Generate intro to values
    intro = ai.complete(
        prompt=prompts.VALUES_INTRO_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=150
    )
    
    # Core values (you can customize these)
    values = """
🌟 **Innovation** - We embrace new ideas and creative solutions
🤝 **Collaboration** - We thrive together, supporting each other
💡 **Growth** - We're always learning and improving
🎯 **Impact** - We focus on making a real difference
"""
    
    full_message = f"{intro}\n\n{values}"
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": full_message}],
        "step": "values"
    }


def ask_agreement_node(state: AuthState) -> dict:
    """Ask for values agreement."""
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.AGREEMENT_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.8,
        max_tokens=100
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "agreement"
    }


def complete_signup_node(state: AuthState) -> dict:
    """Complete signup - create user account."""
    # Account creation happens in the view after this node
    # This node just generates success message
    ai = AIProvider()
    
    response = ai.complete(
        prompt=prompts.SUCCESS_PROMPT,
        system_message=prompts.SYSTEM_PROMPT,
        temperature=0.9,
        max_tokens=100
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "complete"
    }


def complete_login_node(state: AuthState) -> dict:
    """Complete login - authenticate user."""
    # Login happens in the view after this node
    # This node just generates welcome back message
    ai = AIProvider()
    first_name = state.get("first_name", "")
    
    response = ai.complete(
        prompt=prompts.LOGIN_SUCCESS_PROMPT,
        system_message=prompts.SYSTEM_PROMPT.replace("sign up", f"welcome back {first_name}"),
        temperature=0.9,
        max_tokens=100
    )
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response}],
        "step": "complete"
    }
