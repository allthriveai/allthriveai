"""LangGraph state machine for project creation."""

from langgraph.graph import END, StateGraph

from .nodes import (
    ProjectState,
    create_project_node,
    process_description_node,
    process_title_node,
    process_type_node,
    welcome_node,
)


def should_create_project(state: ProjectState) -> str:
    """Determine if we should create the project or go back to editing."""
    last_msg = next((m for m in reversed(state['messages']) if m['role'] == 'user'), None)
    if last_msg:
        content = last_msg['content'].strip().lower()
        # If user confirms, create the project
        if content in ['yes', 'y', 'yeah', 'sure', 'yep', 'create', 'confirm', 'ok', 'okay']:
            return 'create'
    # Otherwise, stay in confirm state for edits
    return 'confirm'


# Build the graph
workflow = StateGraph(ProjectState)

# Add nodes
workflow.add_node('welcome', welcome_node)
workflow.add_node('process_title', process_title_node)
workflow.add_node('process_description', process_description_node)
workflow.add_node('process_type', process_type_node)
workflow.add_node('create_project', create_project_node)

# Set entry point
workflow.set_entry_point('welcome')

# Add edges
workflow.add_edge('welcome', END)  # After welcome, wait for user input
workflow.add_edge('process_title', END)  # After processing title, wait for description
workflow.add_edge('process_description', END)  # After description, wait for type
workflow.add_edge('process_type', END)  # After type, wait for confirmation
workflow.add_conditional_edges(
    'create_project',
    lambda state: 'done' if state.get('step') == 'done' else 'error',
    {
        'done': END,
        'error': END,
    },
)

# Compile the graph without an external checkpointer to keep the
# project chat flow simple and compatible with async streaming.
project_graph = workflow.compile()
