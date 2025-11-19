"""LangGraph state machine for project creation."""
from langgraph.graph import StateGraph, END
from .nodes import (
    ProjectState,
    welcome_node,
    process_title_node,
    process_description_node,
    process_type_node,
    process_showcase_node,
    create_project_node,
)
from services.auth_agent.checkpointer import get_checkpointer


def should_create_project(state: ProjectState) -> str:
    """Determine if we should create the project or go back to editing."""
    last_msg = next((m for m in reversed(state["messages"]) if m["role"] == "user"), None)
    if last_msg:
        content = last_msg["content"].strip().lower()
        # If user confirms, create the project
        if content in ["yes", "y", "yeah", "sure", "yep", "create", "confirm", "ok", "okay"]:
            return "create"
    # Otherwise, stay in confirm state for edits
    return "confirm"


# Build the graph
workflow = StateGraph(ProjectState)

# Add nodes
workflow.add_node("welcome", welcome_node)
workflow.add_node("process_title", process_title_node)
workflow.add_node("process_description", process_description_node)
workflow.add_node("process_type", process_type_node)
workflow.add_node("process_showcase", process_showcase_node)
workflow.add_node("create_project", create_project_node)

# Set entry point
workflow.set_entry_point("welcome")

# Add edges
workflow.add_edge("welcome", END)  # After welcome, wait for user input
workflow.add_edge("process_title", END)  # After processing title, wait for description
workflow.add_edge("process_description", END)  # After description, wait for type
workflow.add_edge("process_type", END)  # After type, wait for showcase
workflow.add_edge("process_showcase", END)  # After showcase, wait for confirmation
workflow.add_conditional_edges(
    "create_project",
    lambda state: "done" if state.get("step") == "done" else "error",
    {
        "done": END,
        "error": END,
    }
)

# Compile the graph with checkpointer for persistence
project_graph = workflow.compile(checkpointer=get_checkpointer())
