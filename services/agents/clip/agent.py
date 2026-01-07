"""
Clip Agent - LangGraph agent for generating social media clips.

Uses GPT-4 to generate structured clip content from user prompts,
supporting iterative editing and refinement.
"""

import json
import logging
from typing import Annotated, Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from .prompts import CLIP_SYSTEM_PROMPT
from .templates import get_default_style

# Constants
MESSAGE_CONTEXT_WINDOW = 3  # Number of recent messages to include

logger = logging.getLogger(__name__)


class SceneContent(BaseModel):
    """Content for a single scene."""

    headline: str | None = None
    body: str | None = None
    code: str | None = None
    codeLanguage: str | None = None
    bullets: list[str] | None = None
    visual: dict | None = None
    backgroundImage: str | None = None
    backgroundGradient: str | None = None


class Scene(BaseModel):
    """A single scene in the clip."""

    id: str
    type: Literal['hook', 'point', 'example', 'cta', 'comparison_a', 'comparison_b', 'winner']
    timing: dict = Field(default_factory=lambda: {'start': 0, 'end': 4500})
    content: SceneContent


class ClipStyle(BaseModel):
    """Visual style configuration."""

    primaryColor: str = '#22D3EE'
    accentColor: str = '#10B981'


class SocialClipContent(BaseModel):
    """The complete clip content structure."""

    template: Literal['quick_tip', 'explainer', 'how_to', 'comparison'] = 'explainer'
    scenes: list[Scene]
    duration: int  # Total milliseconds
    style: ClipStyle = Field(default_factory=ClipStyle)
    sourceLesson: int | None = None


class ClipAgentState(TypedDict):
    """State for the clip agent graph."""

    messages: Annotated[list[BaseMessage], add_messages]
    user_id: int | None
    username: str
    session_id: str
    current_clip: dict | None  # Current SocialClipContent as dict
    edit_mode: bool  # Are we editing existing clip?


class ClipAgent:
    """
    LangGraph agent for generating social media clips.

    Usage:
        agent = ClipAgent()
        result = await agent.generate(
            prompt="Explain RAG in 30 seconds",
            user_id=123,
            username="allierays",
            session_id="session-abc"
        )
    """

    def __init__(self, model_name: str = 'gpt-4o'):
        self.model_name = model_name
        self.llm = ChatOpenAI(
            model=model_name,
            temperature=0.7,
            max_tokens=4096,
        )
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        graph = StateGraph(ClipAgentState)

        # Add nodes
        graph.add_node('generate_clip', self._generate_clip_node)
        graph.add_node('format_response', self._format_response_node)

        # Set entry point
        graph.set_entry_point('generate_clip')

        # Add edges
        graph.add_edge('generate_clip', 'format_response')
        graph.add_edge('format_response', END)

        return graph.compile()

    async def _generate_clip_node(self, state: ClipAgentState) -> dict:
        """Generate or edit the clip content."""
        messages = state.get('messages', [])
        current_clip = state.get('current_clip')
        edit_mode = state.get('edit_mode', False)

        # Build the prompt
        system_message = SystemMessage(content=CLIP_SYSTEM_PROMPT)

        # If editing, include current clip in context
        if edit_mode and current_clip:
            clip_json = json.dumps(current_clip, indent=2)
            context_message = HumanMessage(
                content=f'Current clip content:\n```json\n{clip_json}\n```\n\nPlease modify it based on my request.'
            )
            prompt_messages = [system_message, context_message] + messages[-MESSAGE_CONTEXT_WINDOW:]
        else:
            prompt_messages = [system_message] + messages[-MESSAGE_CONTEXT_WINDOW:]

        # Generate with structured output
        try:
            response = await self.llm.ainvoke(prompt_messages)

            # Extract clip content from response
            clip_content = self._extract_clip_content(response.content, current_clip)

            return {
                'messages': [response],
                'current_clip': clip_content,
            }
        except Exception as e:
            logger.error(f'Clip generation failed: {e}')
            error_response = AIMessage(
                content='I encountered an error generating the clip. Please try again with a different prompt.'
            )
            return {'messages': [error_response]}

    async def _format_response_node(self, state: ClipAgentState) -> dict:
        """Format the final response for the frontend."""
        # The response is already formatted by generate_clip_node
        return {}

    def _extract_clip_content(self, response_text: str, current_clip: dict | None = None) -> dict:
        """Extract structured clip content from LLM response."""
        # Try to find JSON in the response
        try:
            # Look for JSON block
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                json_str = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                json_str = response_text[json_start:json_end].strip()
            elif '{' in response_text:
                # Try to find raw JSON
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                json_str = response_text[json_start:json_end]
            else:
                raise ValueError('No JSON found in response')

            clip_data = json.loads(json_str)

            # Validate and normalize the structure
            return self._normalize_clip_content(clip_data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f'Failed to parse clip JSON: {e}')
            # Return a default clip based on the response
            return self._generate_fallback_clip(response_text, current_clip)

    def _normalize_clip_content(self, data: dict) -> dict:
        """Normalize clip content to expected structure."""
        # Ensure required fields
        template = data.get('template', 'explainer')
        scenes = data.get('scenes', [])

        # Calculate timing for scenes
        current_time = 0
        normalized_scenes = []

        for i, scene in enumerate(scenes):
            scene_type = scene.get('type', 'point')
            duration = self._get_scene_duration(scene_type, scene.get('content', {}))

            normalized_scene = {
                'id': scene.get('id', f'{scene_type}-{i+1}'),
                'type': scene_type,
                'timing': {
                    'start': current_time,
                    'end': current_time + duration,
                },
                'content': scene.get('content', {}),
            }

            # Add visual if specified
            if 'visual' in scene:
                normalized_scene['content']['visual'] = scene['visual']

            normalized_scenes.append(normalized_scene)
            current_time += duration

        return {
            'template': template,
            'scenes': normalized_scenes,
            'duration': current_time,
            'style': data.get('style', get_default_style()),
        }

    def _get_scene_duration(self, scene_type: str, content: dict) -> int:
        """Calculate appropriate duration for a scene type."""
        durations = {
            'hook': 4500,
            'point': 10000,
            'example': 10000,
            'cta': 4500,
            'comparison_a': 6000,
            'comparison_b': 6000,
            'winner': 5000,
        }
        base = durations.get(scene_type, 8000)

        # Adjust for content length
        if content.get('code'):
            base += 2000  # Extra time for code
        if content.get('bullets') and len(content['bullets']) > 2:
            base += len(content['bullets']) * 1000

        return base

    def _generate_fallback_clip(self, response_text: str, current_clip: dict | None) -> dict:
        """Generate a fallback clip if parsing fails."""
        if current_clip:
            return current_clip

        # Create a simple explainer clip
        return {
            'template': 'explainer',
            'scenes': [
                {
                    'id': 'hook-1',
                    'type': 'hook',
                    'timing': {'start': 0, 'end': 4500},
                    'content': {
                        'headline': 'Creating your clip...',
                        'body': 'Please try again with more details.',
                        'visual': {'type': 'icon', 'icon': 'magic', 'size': 'large', 'animation': 'pulse'},
                    },
                },
            ],
            'duration': 4500,
            'style': get_default_style(),
        }

    async def generate(
        self,
        prompt: str,
        user_id: int | None = None,
        username: str = 'user',
        session_id: str = '',
        current_clip: dict | None = None,
    ) -> dict:
        """
        Generate a clip from a user prompt.

        Args:
            prompt: The user's request
            user_id: User ID for context
            username: Username for context
            session_id: Session ID for tracking
            current_clip: Existing clip if editing

        Returns:
            dict with 'clip' (SocialClipContent) and 'message' (assistant response)
        """
        edit_mode = current_clip is not None

        initial_state: ClipAgentState = {
            'messages': [HumanMessage(content=prompt)],
            'user_id': user_id,
            'username': username,
            'session_id': session_id,
            'current_clip': current_clip,
            'edit_mode': edit_mode,
        }

        result = await self.graph.ainvoke(initial_state)

        # Extract the clip and format response
        clip_content = result.get('current_clip')
        messages = result.get('messages', [])

        # Get the assistant's message
        assistant_message = ''
        for msg in reversed(messages):
            if isinstance(msg, AIMessage):
                assistant_message = msg.content
                break

        return {
            'clip': clip_content,
            'message': self._format_assistant_message(clip_content, assistant_message, edit_mode),
        }

    def _format_assistant_message(self, clip: dict | None, raw_message: str, edit_mode: bool) -> str:
        """Format a user-friendly assistant message."""
        if not clip or not clip.get('scenes'):
            return "I had trouble generating the clip. Could you provide more details about what you'd like to create?"

        scenes = clip['scenes']
        duration_sec = clip['duration'] / 1000

        action = 'updated' if edit_mode else 'created'

        parts = [f"I've {action} your clip! Here's the breakdown:\n"]

        # Hook
        hook_scene = next((s for s in scenes if s['type'] == 'hook'), None)
        if hook_scene:
            headline = hook_scene['content'].get('headline', 'Opening hook')
            parts.append(f'**Hook:** "{headline}"')

        # Points
        points = [s for s in scenes if s['type'] in ('point', 'example')]
        if points:
            parts.append('\n**Key Points:**')
            for i, p in enumerate(points, 1):
                headline = p['content'].get('headline', f'Point {i}')
                parts.append(f'{i}. {headline}')

        # CTA
        cta_scene = next((s for s in scenes if s['type'] == 'cta'), None)
        if cta_scene:
            headline = cta_scene['content'].get('headline', 'Call to action')
            parts.append(f'\n**CTA:** "{headline}"')

        parts.append(f'\n**Duration:** {duration_sec:.1f} seconds')
        parts.append("\nThe preview is now playing! Let me know if you'd like to:")
        parts.append('- Change the hook or make it more attention-grabbing')
        parts.append('- Add, remove, or reorder points')
        parts.append('- Adjust the pacing or timing')
        parts.append('- Change the visual style or add icons')

        return '\n'.join(parts)
