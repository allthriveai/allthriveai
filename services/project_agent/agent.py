"""
LLM-powered project creation agent using LangGraph and OpenAI.
"""
import logging
from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages
from django.conf import settings

from .tools import PROJECT_TOOLS, create_project
from .prompts import SYSTEM_PROMPT

logger = logging.getLogger(__name__)


# Agent State
class ProjectAgentState(TypedDict):
    """State for the project creation agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_id: int
    username: str


# Initialize LLM
def get_llm():
    """Get configured LLM instance."""
    api_key = settings.OPENAI_API_KEY or settings.AZURE_OPENAI_API_KEY
    
    if settings.DEFAULT_AI_PROVIDER == 'azure' and settings.AZURE_OPENAI_ENDPOINT:
        return ChatOpenAI(
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            temperature=0.7,
            timeout=30,  # 30 second timeout
            max_retries=2,  # Retry failed calls
        )
    else:
        return ChatOpenAI(
            model="gpt-4-turbo-preview",
            api_key=api_key,
            temperature=0.7,
            timeout=30,  # 30 second timeout
            max_retries=2,  # Retry failed calls
        )


# Bind tools to LLM
llm = get_llm()
llm_with_tools = llm.bind_tools(PROJECT_TOOLS)


# Agent node
async def agent_node(state: ProjectAgentState) -> ProjectAgentState:
    """
    Main agent node that processes user input and decides on actions.
    Uses async for non-blocking LLM calls.
    """
    messages = state["messages"]
    
    # Add system prompt if not already present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)
    
    # Invoke LLM with tools (async)
    response = await llm_with_tools.ainvoke(messages)
    
    return {"messages": [response]}


# Tool node
tool_node = ToolNode(PROJECT_TOOLS)


# Routing function
def should_continue(state: ProjectAgentState) -> str:
    """
    Determine if we should continue to tools or end.
    """
    messages = state["messages"]
    last_message = messages[-1]
    
    # If LLM made tool calls, continue to tools
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    
    # Otherwise, end
    return END


# Build graph
def create_project_agent():
    """Create and compile the project creation agent graph."""
    workflow = StateGraph(ProjectAgentState)
    
    # Add nodes
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    # Set entry point
    workflow.set_entry_point("agent")
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            END: END
        }
    )
    
    # After tools, always go back to agent
    workflow.add_edge("tools", "agent")
    
    # Compile
    from services.auth_agent.checkpointer import get_checkpointer
    return workflow.compile(checkpointer=get_checkpointer())


# Create agent instance
project_agent = create_project_agent()


# Helper function for streaming
async def stream_agent_response(user_message: str, user_id: int, username: str, session_id: str):
    """
    Stream agent responses for a user message.
    
    Yields:
        Dictionary with response chunks and metadata
    """
    config = {"configurable": {"thread_id": session_id}}
    
    # Create input
    input_state = {
        "messages": [HumanMessage(content=user_message)],
        "user_id": user_id,
        "username": username
    }
    
    try:
        # Stream agent execution
        async for event in project_agent.astream_events(input_state, config, version="v1"):
            kind = event["event"]
            
            # Stream LLM tokens
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield {"type": "token", "content": content}
            
            # Tool execution started
            elif kind == "on_tool_start":
                tool_name = event["name"]
                yield {"type": "tool_start", "tool": tool_name}
            
            # Tool execution ended
            elif kind == "on_tool_end":
                tool_name = event["name"]
                output = event["data"].get("output")
                yield {"type": "tool_end", "tool": tool_name, "output": output}
        
        # Get final state
        final_state = project_agent.get_state(config)
        
        # Check if project was created
        messages = final_state.values.get("messages", [])
        project_created = any(
            isinstance(m, ToolMessage) and "project_id" in str(m.content)
            for m in messages
        )
        
        yield {
            "type": "complete",
            "session_id": session_id,
            "project_created": project_created
        }
        
    except Exception as e:
        logger.error(f"Error in agent stream: {e}", exc_info=True)
        yield {"type": "error", "message": str(e)}
