"""
Echo Agent - LangGraph agent for content brainstorming with creators.

Uses GPT-4 to guide creators through the SAHR framework:
- Scope: Understanding what the creator wants to communicate
- Angle: Finding the unique perspective
- Hook: Creating attention-grabbing openers
- Resonate: Ensuring the message lands

Flow:
1. Discovery: Understand topic, audience, goal, platform
2. Ideation: Brainstorm angles and perspectives
3. Hook: Generate attention-grabbing openers
4. Expansion: Develop full content drafts
5. Save: Capture ideas to the content bank
"""

import logging
from typing import Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .prompts import build_echo_prompt
from .state import BrandVoiceContext, ConversationPhase, EchoState, StrategyContext
from .tools import ECHO_TOOLS

logger = logging.getLogger(__name__)

# Maximum messages to keep in context
MAX_CONTEXT_MESSAGES = 30


def get_default_model() -> str:
    """Get the default model from AI gateway configuration."""
    from services.ai.provider import get_model_for_purpose

    return get_model_for_purpose('openai', 'default')


class EchoAgent:
    """
    LangGraph agent for content brainstorming with creators.

    Guides creators through the SAHR framework to develop
    compelling content ideas with strong hooks.

    Usage:
        agent = EchoAgent()
        async for event in agent.stream(
            message="I want to write about RAG",
            user_id=123,
            session_id="session-abc"
        ):
            print(event)
    """

    def __init__(self, model_name: str | None = None):
        """
        Initialize the Echo agent.

        Args:
            model_name: Optional model override. Uses AI gateway default if None.
        """
        self.model_name = model_name or get_default_model()
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=0.7,
            max_tokens=4096,
        )
        self.llm_with_tools = self.llm.bind_tools(ECHO_TOOLS)
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        graph = StateGraph(EchoState)

        # Add nodes
        graph.add_node('route', self._route_node)
        graph.add_node('converse', self._converse_node)
        graph.add_node('save_idea', self._save_idea_node)

        # Set entry point
        graph.set_entry_point('route')

        # Add conditional edges from route
        graph.add_conditional_edges(
            'route',
            self._route_decision,
            {
                'converse': 'converse',
                'save_idea': 'save_idea',
                'end': END,
            },
        )

        # Converse can lead back to route or end
        graph.add_conditional_edges(
            'converse',
            self._after_converse,
            {
                'route': 'route',
                'end': END,
            },
        )

        # Save idea leads to end
        graph.add_edge('save_idea', END)

        return graph.compile()

    def _route_decision(self, state: EchoState) -> Literal['converse', 'save_idea', 'end']:
        """Determine which node to route to based on state."""
        messages = state.get('messages', [])
        if not messages:
            return 'end'

        last_message = messages[-1]

        # Check if the LLM requested tool calls
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                if tool_call.get('name') == 'save_idea':
                    return 'save_idea'

        # Default to conversation
        return 'converse'

    def _after_converse(self, state: EchoState) -> Literal['route', 'end']:
        """Determine next step after conversation."""
        messages = state.get('messages', [])
        if not messages:
            return 'end'

        last_message = messages[-1]

        # If the LLM made tool calls, route back to handle them
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return 'route'

        return 'end'

    async def _route_node(self, state: EchoState) -> dict:
        """Route node - determines conversation flow."""
        # This node just passes through - actual routing happens in edges
        return {}

    async def _converse_node(self, state: EchoState) -> dict:
        """Handle conversational turns with the creator."""
        messages = state.get('messages', [])
        phase = state.get('conversation_phase', 'discovery')
        content_pillars = state.get('content_pillars', [])
        target_platforms = state.get('target_platforms', [])
        brand_voice = state.get('brand_voice')

        # Build system prompt with context
        system_prompt = build_echo_prompt(
            phase=phase,
            content_pillars=content_pillars,
            target_platforms=target_platforms,
            brand_voice=brand_voice,
        )

        # Trim messages to prevent context bloat
        if len(messages) > MAX_CONTEXT_MESSAGES:
            messages = messages[-MAX_CONTEXT_MESSAGES:]

        # Build full message list
        full_messages = [SystemMessage(content=system_prompt)] + list(messages)

        try:
            response = await self.llm_with_tools.ainvoke(full_messages)

            # Parse state updates from response
            new_state = self._parse_response_for_state(response.content, state)
            new_state['messages'] = [response]

            return new_state

        except Exception as e:
            logger.error(f'Echo conversation failed: {e}', exc_info=True)
            error_response = AIMessage(
                content="I had trouble processing that. Could you rephrase what you'd like to work on?"
            )
            return {'messages': [error_response]}

    async def _save_idea_node(self, state: EchoState) -> dict:
        """Execute the save_idea tool."""
        from langchain_core.messages import ToolMessage

        messages = state.get('messages', [])
        user_id = state.get('user_id')
        session_id = state.get('session_id', '')

        # Find the save_idea tool call
        last_message = messages[-1] if messages else None
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return {}

        tool_results = []
        for tool_call in last_message.tool_calls:
            if tool_call.get('name') != 'save_idea':
                continue

            tool_id = tool_call.get('id', '')
            tool_args = dict(tool_call.get('args', {}))

            # Inject state for the tool
            tool_args['state'] = {
                'user_id': user_id,
                'session_id': session_id,
            }

            # Execute the tool
            from .tools import save_idea

            try:
                result = save_idea.invoke(tool_args)
                logger.info(f'Saved idea via Echo: {result}')
            except Exception as e:
                logger.error(f'Failed to save idea: {e}')
                result = {'success': False, 'error': str(e)}

            tool_results.append(
                ToolMessage(
                    content=str(result),
                    tool_call_id=tool_id,
                    name='save_idea',
                )
            )

        return {'messages': tool_results}

    def _parse_response_for_state(self, response_text: str, state: EchoState) -> dict:
        """Parse AI response for phase transitions and state updates."""
        import json

        updates = {}
        current_phase = state.get('conversation_phase', 'discovery')

        # Look for phase transition signals in the response
        phase_signals = {
            'ideation': [
                "let's brainstorm",
                'explore some angles',
                'find your angle',
                'unique perspective',
            ],
            'hook': [
                "let's create some hooks",
                'hook options',
                'attention-grabbing',
                'stop the scroll',
            ],
            'expansion': [
                "let's expand",
                'full post',
                'develop this further',
                'flesh this out',
            ],
            'ready_to_save': [
                'save this idea',
                'ready to save',
                "let's capture this",
                'add to your ideas',
            ],
        }

        response_lower = response_text.lower()
        for phase, signals in phase_signals.items():
            if any(signal in response_lower for signal in signals):
                if self._is_valid_phase_transition(current_phase, phase):
                    updates['conversation_phase'] = phase
                    logger.info(f'Echo phase transition: {current_phase} -> {phase}')
                    break

        # Look for JSON state updates in the response (like Clip agent)
        if '```state' in response_text:
            try:
                state_start = response_text.find('```state') + 8
                state_end = response_text.find('```', state_start)
                state_json = response_text[state_start:state_end].strip()
                state_updates = json.loads(state_json)

                if 'phase' in state_updates:
                    updates['conversation_phase'] = state_updates['phase']
                if 'pillars' in state_updates:
                    updates['content_pillars'] = state_updates['pillars']
                if 'platforms' in state_updates:
                    updates['target_platforms'] = state_updates['platforms']
                if 'current_idea' in state_updates:
                    updates['current_idea'] = state_updates['current_idea']

            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f'Failed to parse state updates: {e}')

        return updates

    def _is_valid_phase_transition(self, current: str, target: str) -> bool:
        """Check if a phase transition is valid."""
        # Define valid transitions
        valid_transitions = {
            'discovery': ['ideation', 'hook'],  # Can skip to hook if topic is clear
            'ideation': ['hook', 'expansion'],
            'hook': ['expansion', 'ready_to_save'],
            'expansion': ['ready_to_save', 'hook'],  # Can go back to refine hook
            'ready_to_save': ['discovery'],  # Start fresh after saving
        }
        return target in valid_transitions.get(current, [])


async def _load_brand_voice(user_id: int | None) -> BrandVoiceContext | None:
    """
    Load brand voice for a user if they have one configured.

    Args:
        user_id: User ID to load brand voice for

    Returns:
        BrandVoiceContext dict or None
    """
    if not user_id:
        return None

    try:
        from asgiref.sync import sync_to_async

        from core.content_engine.models import BrandVoice

        brand_voice = await sync_to_async(lambda: BrandVoice.objects.filter(user_id=user_id).first())()

        if not brand_voice:
            return None

        return BrandVoiceContext(
            name=f'{brand_voice.user.get_full_name() or brand_voice.user.username} Brand',
            tone=brand_voice.tone or '',
            description=brand_voice.visual_style or '',
            catchphrases=brand_voice.signature_phrases or [],
            keywords=brand_voice.topics or [],
        )

    except Exception as e:
        logger.warning(f'Failed to load brand voice for user {user_id}: {e}')
        return None


async def _load_user_strategy(user_id: int | None) -> StrategyContext | None:
    """
    Load user's content strategy from DB on agent init.

    This provides Echo with context about the user's goals, platforms,
    cadence, and voice to give more personalized coaching.

    Args:
        user_id: User ID to load strategy for

    Returns:
        StrategyContext dict or None if no strategy exists (new user)
    """
    if not user_id:
        return None

    try:
        from asgiref.sync import sync_to_async

        from core.content_engine.models import Strategy

        strategy = await sync_to_async(lambda: Strategy.objects.filter(user_id=user_id).first())()

        if not strategy:
            # No strategy exists - this is a new user
            logger.debug(f'No strategy found for user {user_id} - new user')
            return None

        return StrategyContext(
            goals=strategy.goals or [],
            platforms=strategy.platforms or [],
            posts_per_week=strategy.posts_per_week,
            schedule=strategy.schedule or {},
            pillars=strategy.pillars or [],
            voice=strategy.voice or '',
            recommendations=strategy.recommendations or {},
        )

    except Exception as e:
        # Graceful degradation - continue without strategy
        logger.warning(f'Failed to load strategy for user {user_id}: {e}')
        return None


async def stream_echo_response(
    user_message: str,
    user_id: int | None = None,
    session_id: str = '',
    conversation_phase: ConversationPhase = 'discovery',
    content_pillars: list[str] | None = None,
    target_platforms: list[str] | None = None,
    conversation_history: list[BaseMessage] | None = None,
    current_idea: dict | None = None,
    pillar_id: int | None = None,
    model_name: str | None = None,
):
    """
    Stream Echo agent response with tool execution events.

    Yields events:
    - {'type': 'token', 'content': '...'} - Text tokens from LLM
    - {'type': 'tool_start', 'tool': '...'} - Tool execution started
    - {'type': 'tool_end', 'tool': '...', 'output': {...}} - Tool completed
    - {'type': 'idea_suggested', 'idea': {...}} - Idea ready to save
    - {'type': 'phase_change', 'phase': '...'} - Conversation phase changed
    - {'type': 'complete'} - Agent finished
    - {'type': 'error', 'message': '...'} - Error occurred

    Args:
        user_message: User's input message
        user_id: User's database ID
        session_id: Brainstorm session identifier
        conversation_phase: Current phase in SAHR framework
        content_pillars: Active content pillars
        target_platforms: Target platforms (twitter, linkedin, youtube)
        conversation_history: Previous messages in this session
        current_idea: The idea being developed
        pillar_id: Selected content pillar taxonomy ID
        model_name: Optional model override

    Yields:
        Event dicts with type and content
    """
    # Validate required user_id
    if user_id is None:
        yield {'type': 'error', 'message': 'User not authenticated'}
        return

    total_output_content = ''

    try:
        # Load brand voice and user strategy in parallel
        brand_voice = await _load_brand_voice(user_id)
        user_strategy = await _load_user_strategy(user_id)

        # Build message history
        messages = list(conversation_history) if conversation_history else []
        messages.append(HumanMessage(content=user_message))

        # Create initial state
        initial_state: EchoState = {
            'messages': messages,
            'user_id': user_id,
            'session_id': session_id,
            'conversation_phase': conversation_phase,
            'content_pillars': content_pillars or [],
            'target_platforms': target_platforms or [],
            'brand_voice': brand_voice,
            'user_strategy': user_strategy,
            'current_idea': current_idea,
            'pillar_id': pillar_id,
        }

        # Create agent
        agent = EchoAgent(model_name=model_name)

        # Build system prompt for streaming
        system_prompt = build_echo_prompt(
            phase=conversation_phase,
            content_pillars=content_pillars or [],
            target_platforms=target_platforms or [],
            brand_voice=brand_voice,
            user_strategy=user_strategy,
        )

        # Prepare messages for LLM
        full_messages = [SystemMessage(content=system_prompt)] + messages

        # Track processed events
        processed_tool_calls = set()

        # Stream with astream_events
        async for event in agent.llm_with_tools.astream_events(full_messages, version='v1'):
            kind = event['event']

            # Stream LLM tokens
            if kind == 'on_chat_model_stream':
                chunk = event.get('data', {}).get('chunk')
                if chunk and hasattr(chunk, 'content') and chunk.content:
                    content = chunk.content
                    if isinstance(content, str):
                        total_output_content += content
                        yield {'type': 'token', 'content': content}

            # Tool execution started
            elif kind == 'on_tool_start':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')

                if run_id not in processed_tool_calls:
                    processed_tool_calls.add(run_id)
                    yield {'type': 'tool_start', 'tool': tool_name}

            # Tool execution completed
            elif kind == 'on_tool_end':
                tool_name = event.get('name', '')
                run_id = event.get('run_id', '')
                end_key = f'{run_id}_end'

                if end_key not in processed_tool_calls:
                    processed_tool_calls.add(end_key)
                    output = event.get('data', {}).get('output', {})

                    # Emit idea_suggested for save_idea tool
                    if tool_name == 'save_idea' and isinstance(output, dict):
                        if output.get('success'):
                            yield {
                                'type': 'idea_suggested',
                                'idea': {
                                    'id': output.get('idea_id'),
                                    'title': output.get('title'),
                                },
                            }

                    yield {'type': 'tool_end', 'tool': tool_name, 'output': output}

        # Check for phase changes in the response
        new_state = agent._parse_response_for_state(total_output_content, initial_state)
        if 'conversation_phase' in new_state and new_state['conversation_phase'] != conversation_phase:
            yield {
                'type': 'phase_change',
                'phase': new_state['conversation_phase'],
                'previous_phase': conversation_phase,
            }

        yield {'type': 'complete'}

    except TimeoutError as e:
        logger.error(f'Echo LLM timeout: {e}', exc_info=True)
        yield {
            'type': 'error',
            'message': 'Request timed out. Please try again.',
        }

    except Exception as e:
        error_str = str(e).lower()
        # Check for timeout-related errors from various sources
        if 'timeout' in error_str or 'timed out' in error_str:
            logger.error(f'Echo LLM timeout: {e}', exc_info=True)
            yield {
                'type': 'error',
                'message': 'Request timed out. Please try again.',
            }
        else:
            logger.error(f'Echo streaming error: {e}', exc_info=True)
            yield {
                'type': 'error',
                'message': 'I encountered an issue. Please try again.',
            }
