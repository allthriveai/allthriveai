"""
State definitions for the Echo agent.

EchoState tracks conversation flow, user preferences, and content being developed
through the brainstorming process.
"""

from typing import Annotated, Literal

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

# Conversation phases in Echo's SAHR framework
ConversationPhase = Literal[
    'discovery',  # Understanding topic, audience, and goals
    'ideation',  # Brainstorming angles and content pillars
    'hook',  # Generating attention-grabbing openers
    'expansion',  # Developing full content drafts
    'ready_to_save',  # Final review before saving
]


class BrandVoiceContext(TypedDict, total=False):
    """Brand voice context for personalization."""

    name: str
    target_audience: str
    tone: str
    description: str
    catchphrases: list[str]
    topics_to_avoid: list[str]
    example_hooks: list[str]
    keywords: list[str]


class EchoState(TypedDict):
    """
    State for the Echo agent graph.

    Tracks the conversation through Echo's SAHR framework:
    - Scope: Understanding what the creator wants to communicate
    - Angle: Finding the unique perspective
    - Hook: Creating attention-grabbing openers
    - Resonate: Ensuring the message lands

    Attributes:
        messages: Conversation history with add_messages reducer
        user_id: User's database ID
        session_id: Brainstorm session identifier
        conversation_phase: Current phase in SAHR framework
        content_pillars: Active content pillars (e.g., 'educational', 'hot_takes')
        target_platforms: Platforms being targeted (twitter, linkedin, youtube)
        brand_voice: Optional brand voice for personalization
        current_idea: The idea being developed (dict with title, hook, body, etc.)
        pillar_id: Selected content pillar taxonomy ID
    """

    messages: Annotated[list[BaseMessage], add_messages]
    user_id: int | None
    session_id: str
    conversation_phase: ConversationPhase
    content_pillars: list[str]
    target_platforms: list[str]
    brand_voice: BrandVoiceContext | None
    current_idea: dict | None
    pillar_id: int | None
