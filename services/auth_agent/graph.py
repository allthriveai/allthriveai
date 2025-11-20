"""
LangGraph state machine for auth chat flow
"""

from langgraph.graph import END, StateGraph

from .checkpointer import get_checkpointer
from .nodes import (
    AuthState,
    ask_agreement_node,
    ask_email_node,
    ask_interests_node,
    ask_name_node,
    ask_password_node,
    ask_username_custom_node,
    ask_username_suggest_node,
    check_email_node,
    complete_login_node,
    complete_signup_node,
    confirm_username_node,
    show_values_node,
    welcome_node,
)


def create_auth_graph():
    """
    Create and compile the auth chat graph.

    Returns:
        Compiled LangGraph for auth chat
    """
    # Create graph
    graph = StateGraph(AuthState)

    # Add nodes
    graph.add_node('welcome', welcome_node)
    graph.add_node('ask_email', ask_email_node)
    graph.add_node('check_email', check_email_node)
    graph.add_node('ask_username_suggest', ask_username_suggest_node)
    graph.add_node('ask_username_custom', ask_username_custom_node)
    graph.add_node('confirm_username', confirm_username_node)
    graph.add_node('ask_name', ask_name_node)
    graph.add_node('ask_password', ask_password_node)
    graph.add_node('ask_interests', ask_interests_node)
    graph.add_node('show_values', show_values_node)
    graph.add_node('ask_agreement', ask_agreement_node)
    graph.add_node('complete_signup', complete_signup_node)
    graph.add_node('complete_login', complete_login_node)

    # Set entry point
    graph.set_entry_point('welcome')

    # Add edges for flow
    # Welcome -> Ask Email (when user clicks "Continue with Email")
    graph.add_edge('welcome', 'ask_email')

    # Ask Email -> Check Email (when user submits email)
    graph.add_edge('ask_email', 'check_email')

    # Check Email branches:
    # - If user exists -> ask for password (login flow)
    # - If new user -> ask for name (signup flow)
    graph.add_conditional_edges(
        'check_email',
        lambda state: 'login' if state.get('user_exists') else 'signup',
        {
            'login': 'ask_password',
            'signup': 'ask_name',
        },
    )

    # Username suggest / custom nodes are interaction points where the graph
    # should pause and wait for user input. We do NOT add self-loop edges here,
    # because that would create an infinite cycle and hit the LangGraph
    # recursion limit. The view will explicitly continue the graph by
    # specifying the next node (e.g., "confirm_username" or
    # "ask_username_custom").

    # Confirm username -> Name
    graph.add_edge('confirm_username', 'ask_name')

    # Signup flow: Name -> Password
    graph.add_edge('ask_name', 'ask_password')

    # Password branches based on mode:
    # - Login mode -> complete login
    # - Signup mode -> ask interests
    graph.add_conditional_edges(
        'ask_password',
        lambda state: 'complete_login' if state.get('mode') == 'login' else 'ask_interests',
        {'ask_interests': 'ask_interests', 'complete_login': 'complete_login'},
    )

    # Signup flow continues: Interests -> Values -> Agreement -> Complete
    graph.add_edge('ask_interests', 'show_values')
    graph.add_edge('show_values', 'ask_agreement')
    graph.add_edge('ask_agreement', 'complete_signup')

    # Both complete nodes end the flow
    graph.add_edge('complete_signup', END)
    graph.add_edge('complete_login', END)

    # Compile with checkpointer
    checkpointer = get_checkpointer()
    return graph.compile(checkpointer=checkpointer)


# Create singleton instance
auth_graph = create_auth_graph()
