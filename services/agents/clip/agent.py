"""
Clip Agent - LangGraph agent for generating social media clips.

Uses GPT-4 to generate structured clip content from user prompts,
with a conversational approach that builds the story collaboratively.

Flow:
1. Discovery: Ask about audience, goal, key takeaway
2. Hook: Propose hooks and let user pick/refine
3. Story: Build transcript scene-by-scene
4. Generate: Create final clip with AI images
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

from .prompts import CONVERSATIONAL_SYSTEM_PROMPT, GENERATION_SYSTEM_PROMPT
from .templates import get_default_style

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


class SceneTranscript(TypedDict):
    """A single scene in the story transcript."""

    scene: int
    type: str  # hook, point, cta
    text: str


class UserPreferences(TypedDict):
    """User preferences gathered during discovery."""

    audience: str | None
    goal: str | None
    tone: str | None
    key_takeaway: str | None


# Conversation phases
ConversationPhase = Literal['discovery', 'hook', 'story', 'ready_to_generate', 'generating']


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


class ClipAgentState(TypedDict):
    """State for the clip agent graph."""

    messages: Annotated[list[BaseMessage], add_messages]
    user_id: int | None
    username: str
    session_id: str
    conversation_phase: ConversationPhase
    story_transcript: list[SceneTranscript]
    user_preferences: UserPreferences
    current_clip: dict | None  # Current SocialClipContent as dict
    edit_mode: bool  # Are we editing existing clip?
    should_generate: bool  # User approved transcript, ready to generate
    brand_voice: BrandVoiceContext | None  # Optional brand voice for personalization


class ClipAgent:
    """
    LangGraph agent for generating social media clips collaboratively.

    The agent guides users through building a story before generating visuals:
    1. Discovery: Understand audience, goal, key takeaway
    2. Hook: Propose and refine the opening hook
    3. Story: Build the transcript scene-by-scene
    4. Generate: Create final clip with proper timing

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
        graph.add_node('route_conversation', self._route_conversation_node)
        graph.add_node('converse', self._converse_node)
        graph.add_node('generate_clip', self._generate_clip_node)

        # Set entry point
        graph.set_entry_point('route_conversation')

        # Add conditional edges based on conversation state
        graph.add_conditional_edges(
            'route_conversation',
            self._should_generate,
            {
                'generate': 'generate_clip',
                'converse': 'converse',
            },
        )
        graph.add_edge('converse', END)
        graph.add_edge('generate_clip', END)

        return graph.compile()

    def _should_generate(self, state: ClipAgentState) -> str:
        """Determine whether to generate clip or continue conversation."""
        if state.get('should_generate'):
            return 'generate'
        return 'converse'

    async def _route_conversation_node(self, state: ClipAgentState) -> dict:
        """Route to appropriate handler based on conversation phase."""
        # This node just passes through - routing happens via conditional edges
        return {}

    async def _converse_node(self, state: ClipAgentState) -> dict:
        """Handle conversational turns - ask questions, refine story."""
        messages = state.get('messages', [])
        phase = state.get('conversation_phase', 'discovery')
        transcript = state.get('story_transcript', [])
        preferences = state.get('user_preferences', {})
        brand_voice = state.get('brand_voice')

        # Build context for the LLM
        system_prompt = CONVERSATIONAL_SYSTEM_PROMPT.format(
            phase=phase,
            transcript=json.dumps(transcript, indent=2) if transcript else 'None yet',
            preferences=json.dumps(preferences, indent=2) if any(preferences.values()) else 'None yet',
        )

        # Add brand voice context if available
        if brand_voice:
            brand_voice_context = self._format_brand_voice_context(brand_voice)
            system_prompt = brand_voice_context + '\n\n' + system_prompt

        system_message = SystemMessage(content=system_prompt)
        prompt_messages = [system_message] + list(messages)

        try:
            response = await self.llm.ainvoke(prompt_messages)

            # Parse the response to update state
            new_state = self._parse_conversation_response(response.content, state)
            new_state['messages'] = [response]

            return new_state
        except Exception as e:
            logger.error(f'Conversation failed: {e}')
            error_response = AIMessage(
                content="I had trouble processing that. Could you rephrase what you'd like to do?"
            )
            return {'messages': [error_response]}

    def _parse_conversation_response(self, response_text: str, state: ClipAgentState) -> dict:
        """Parse AI response to extract state updates."""
        updates = {}

        # Look for JSON state updates in the response
        if '```state' in response_text:
            try:
                state_start = response_text.find('```state') + 8
                state_end = response_text.find('```', state_start)
                state_json = response_text[state_start:state_end].strip()
                state_updates = json.loads(state_json)

                if 'phase' in state_updates:
                    updates['conversation_phase'] = state_updates['phase']
                if 'transcript' in state_updates:
                    updates['story_transcript'] = state_updates['transcript']
                if 'preferences' in state_updates:
                    current_prefs = state.get('user_preferences', {})
                    updates['user_preferences'] = {**current_prefs, **state_updates['preferences']}
                if state_updates.get('ready_to_generate'):
                    updates['should_generate'] = True
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f'Failed to parse state updates: {e}')

        return updates

    def _format_brand_voice_context(self, brand_voice: BrandVoiceContext) -> str:
        """Format brand voice into prompt context."""
        lines = ["## User's Brand Voice Profile"]
        lines.append(f'**Brand Name**: {brand_voice.get("name", "Default")}')

        if brand_voice.get('target_audience'):
            lines.append(f'**Target Audience**: {brand_voice["target_audience"]}')

        if brand_voice.get('tone'):
            lines.append(f'**Preferred Tone**: {brand_voice["tone"]}')

        if brand_voice.get('description'):
            lines.append(f'**Style Notes**: {brand_voice["description"]}')

        if brand_voice.get('catchphrases'):
            phrases = ', '.join(f'"{p}"' for p in brand_voice['catchphrases'][:5])
            lines.append(f'**Signature Phrases to Use**: {phrases}')

        if brand_voice.get('keywords'):
            keywords = ', '.join(brand_voice['keywords'][:10])
            lines.append(f'**Key Terms/Jargon**: {keywords}')

        if brand_voice.get('topics_to_avoid'):
            avoid = ', '.join(brand_voice['topics_to_avoid'][:5])
            lines.append(f'**Topics to Avoid**: {avoid}')

        if brand_voice.get('example_hooks'):
            lines.append('**Example Hooks That Work for This User**:')
            for hook in brand_voice['example_hooks'][:3]:
                lines.append(f'  - "{hook}"')

        lines.append('')
        lines.append(
            '**IMPORTANT**: Use this brand voice to personalize all responses. '
            'Match the tone, use signature phrases where appropriate, and avoid listed topics.'
        )

        return '\n'.join(lines)

    async def _generate_clip_node(self, state: ClipAgentState) -> dict:
        """Generate the final clip from the approved transcript."""
        messages = state.get('messages', [])
        transcript = state.get('story_transcript', [])
        preferences = state.get('user_preferences', {})
        current_clip = state.get('current_clip')
        edit_mode = state.get('edit_mode', False)
        brand_voice = state.get('brand_voice')

        # Build generation prompt with transcript
        generation_prompt = GENERATION_SYSTEM_PROMPT
        if brand_voice:
            brand_context = self._format_brand_voice_context(brand_voice)
            generation_prompt = brand_context + '\n\n' + generation_prompt

        system_message = SystemMessage(content=generation_prompt)

        # Create context message with transcript and preferences
        context = {
            'transcript': transcript,
            'preferences': preferences,
        }
        if edit_mode and current_clip:
            context['current_clip'] = current_clip
        if brand_voice:
            context['brand_voice'] = {
                'tone': brand_voice.get('tone'),
                'target_audience': brand_voice.get('target_audience'),
            }

        context_message = HumanMessage(
            content=f'Generate the clip from this approved transcript:\n```json\n{json.dumps(context, indent=2)}\n```'
        )

        prompt_messages = [system_message, context_message] + list(messages[-3:])

        try:
            response = await self.llm.ainvoke(prompt_messages)

            # Extract clip content from response
            clip_content = self._extract_clip_content(response.content, current_clip)

            return {
                'messages': [response],
                'current_clip': clip_content,
                'conversation_phase': 'generating',
            }
        except Exception as e:
            logger.error(f'Clip generation failed: {e}')
            error_response = AIMessage(content='I encountered an error generating the clip. Please try again.')
            return {'messages': [error_response]}

    def _extract_clip_content(self, response_text: str, current_clip: dict | None = None) -> dict:
        """Extract structured clip content from LLM response."""
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
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                json_str = response_text[json_start:json_end]
            else:
                raise ValueError('No JSON found in response')

            clip_data = json.loads(json_str)
            return self._normalize_clip_content(clip_data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f'Failed to parse clip JSON: {e}')
            return self._generate_fallback_clip(response_text, current_clip)

    def _normalize_clip_content(self, data: dict) -> dict:
        """Normalize clip content to expected structure."""
        template = data.get('template', 'explainer')
        scenes = data.get('scenes', [])

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

        if content.get('code'):
            base += 2000
        if content.get('bullets') and len(content['bullets']) > 2:
            base += len(content['bullets']) * 1000

        return base

    def _generate_fallback_clip(self, response_text: str, current_clip: dict | None) -> dict:
        """Generate a fallback clip if parsing fails."""
        if current_clip:
            return current_clip

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
        conversation_history: list[BaseMessage] | None = None,
        conversation_phase: ConversationPhase = 'discovery',
        story_transcript: list[SceneTranscript] | None = None,
        user_preferences: UserPreferences | None = None,
        should_generate: bool = False,
        brand_voice: BrandVoiceContext | None = None,
    ) -> dict:
        """
        Generate a clip or continue the conversation.

        Args:
            prompt: The user's request
            user_id: User ID for context
            username: Username for context
            session_id: Session ID for tracking
            current_clip: Existing clip if editing
            conversation_history: Previous messages in this session
            conversation_phase: Current phase of the conversation
            story_transcript: Story built so far
            user_preferences: Preferences gathered during discovery
            should_generate: True if user approved transcript
            brand_voice: Optional brand voice for personalization

        Returns:
            dict with:
            - 'clip': SocialClipContent (if generated)
            - 'message': assistant response
            - 'phase': current conversation phase
            - 'transcript': current story transcript
            - 'preferences': user preferences
            - 'options': clickable options for user (if applicable)
        """
        edit_mode = current_clip is not None

        # Build message history
        messages = list(conversation_history) if conversation_history else []
        messages.append(HumanMessage(content=prompt))

        initial_state: ClipAgentState = {
            'messages': messages,
            'user_id': user_id,
            'username': username,
            'session_id': session_id,
            'conversation_phase': conversation_phase,
            'story_transcript': story_transcript or [],
            'user_preferences': user_preferences or {},
            'current_clip': current_clip,
            'edit_mode': edit_mode,
            'should_generate': should_generate,
            'brand_voice': brand_voice,
        }

        result = await self.graph.ainvoke(initial_state)

        # Extract results
        clip_content = result.get('current_clip')
        result_messages = result.get('messages', [])
        new_phase = result.get('conversation_phase', conversation_phase)
        new_transcript = result.get('story_transcript', story_transcript or [])
        new_preferences = result.get('user_preferences', user_preferences or {})

        # Get the assistant's message
        assistant_message = ''
        for msg in reversed(result_messages):
            if isinstance(msg, AIMessage):
                assistant_message = msg.content
                break

        # Clean up the message (remove state blocks)
        display_message = self._clean_message(assistant_message)

        # Extract options if present
        options = self._extract_options(assistant_message)

        response = {
            'message': display_message,
            'phase': new_phase,
            'transcript': new_transcript,
            'preferences': new_preferences,
        }

        if clip_content:
            response['clip'] = clip_content

        if options:
            response['options'] = options

        return response

    def _clean_message(self, message: str) -> str:
        """Remove state blocks from message for display."""
        if '```state' in message:
            # Remove state block
            state_start = message.find('```state')
            state_end = message.find('```', state_start + 8) + 3
            message = message[:state_start] + message[state_end:]

        return message.strip()

    def _extract_options(self, message: str) -> list[str] | None:
        """Extract clickable options from message if present."""
        if '```options' in message:
            try:
                opts_start = message.find('```options') + 10
                opts_end = message.find('```', opts_start)
                opts_json = message[opts_start:opts_end].strip()
                return json.loads(opts_json)
            except (json.JSONDecodeError, ValueError):
                pass
        return None
