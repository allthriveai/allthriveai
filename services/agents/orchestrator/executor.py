"""
Orchestrator executor - handles the execution of multi-agent workflows.

Coordinates agent execution based on supervisor plans, handles handoffs,
and manages streaming responses.
"""

import logging
from collections.abc import AsyncGenerator

from .handoff import AgentType, HandoffContext
from .supervisor import OrchestrationPlan, SupervisorAgent

logger = logging.getLogger(__name__)


class OrchestratorExecutor:
    """
    Executes orchestration plans by invoking specialized agents.

    Handles:
    - Single agent execution
    - Sequential multi-agent workflows with handoffs
    - Result synthesis for multi-agent responses
    """

    def __init__(self, user_id: int, username: str, session_id: str):
        self.user_id = user_id
        self.username = username
        self.session_id = session_id
        self.supervisor = SupervisorAgent(user_id=user_id)

    async def execute(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Execute the orchestration for a user message.

        Args:
            user_message: The user's message
            conversation_history: Recent conversation context

        Yields:
            Streaming events (tokens, tool calls, completions)
        """
        # Step 1: Create orchestration plan
        yield {'type': 'orchestration_start', 'message': 'Analyzing your request...'}

        plan = self.supervisor.create_plan(user_message, conversation_history)

        logger.info(f'Executing plan: {plan.plan_type} with {len(plan.agents)} agent(s)')

        # Step 2: Execute based on plan type
        if plan.is_single_agent:
            # Simple single-agent execution
            async for event in self._execute_single_agent(plan, user_message):
                yield event
        else:
            # Multi-agent sequential execution
            async for event in self._execute_sequential(plan, user_message):
                yield event

    async def _execute_single_agent(
        self,
        plan: OrchestrationPlan,
        user_message: str,
    ) -> AsyncGenerator[dict, None]:
        """Execute a single-agent plan."""
        agent_type = plan.primary_agent

        if not agent_type:
            yield {'type': 'error', 'message': 'No agent specified in plan'}
            return

        # Route to the appropriate agent
        async for event in self._invoke_agent(agent_type, user_message, None):
            yield event

    async def _execute_sequential(
        self,
        plan: OrchestrationPlan,
        user_message: str,
    ) -> AsyncGenerator[dict, None]:
        """Execute a sequential multi-agent plan with handoffs."""
        agent_sequence = plan.get_agent_sequence()
        agent_results = []
        previous_findings = {}

        for i, (agent_type, task, depends_on) in enumerate(agent_sequence):
            is_last = i == len(agent_sequence) - 1
            step_num = i + 1
            total_steps = len(agent_sequence)

            # Notify about the current step
            yield {
                'type': 'agent_step',
                'step': step_num,
                'total': total_steps,
                'agent': agent_type.value,
                'task': task,
            }

            # Create handoff context if we have previous results
            handoff = None
            if depends_on and previous_findings:
                previous_agent = agent_sequence[i - 1][0] if i > 0 else AgentType.SUPPORT
                handoff = HandoffContext(
                    from_agent=previous_agent,
                    to_agent=agent_type,
                    reason=depends_on,
                    findings=previous_findings,
                    instructions=task,
                    original_query=user_message,
                    is_multi_step=True,
                    step_number=step_num,
                    total_steps=total_steps,
                )

            # Collect agent response with error recovery
            agent_content = []
            agent_error = None

            try:
                async for event in self._invoke_agent(agent_type, user_message, handoff):
                    # Collect tokens for synthesis and handoff context
                    if event.get('type') == 'token':
                        agent_content.append(event.get('content', ''))
                    elif event.get('type') == 'error':
                        agent_error = event.get('message', 'Unknown error')

                    # Streaming logic:
                    # - If no synthesis needed: stream all events
                    # - If synthesis needed: only stream tool events (synthesis will provide final output)
                    if not plan.synthesis_needed:
                        yield event
                    elif event.get('type') in ('tool_start', 'tool_end'):
                        # Always stream tool events for visibility
                        yield event

            except Exception as e:
                agent_error = str(e)
                logger.error(f'Agent {agent_type.value} failed: {e}', exc_info=True)

                # If not the last agent, we can try to continue with partial results
                if not is_last:
                    yield {
                        'type': 'agent_error',
                        'agent': agent_type.value,
                        'error': 'Agent encountered an issue, continuing with next step...',
                    }

            # Store results for potential synthesis (even partial results)
            agent_results.append(
                {
                    'agent': agent_type.value,
                    'content': ''.join(agent_content) if agent_content else f'[Error: {agent_error}]',
                    'task': task,
                    'error': agent_error,
                }
            )

            # Extract findings for next agent (empty if failed)
            if agent_content:
                previous_findings = {
                    'agent': agent_type.value,
                    'content_summary': ''.join(agent_content)[:500],  # Truncate for context
                    'task_completed': task,
                }
            else:
                previous_findings = {
                    'agent': agent_type.value,
                    'error': agent_error,
                    'task_attempted': task,
                }

        # Step 3: Synthesize if needed and not already streamed
        if plan.synthesis_needed and len(agent_results) > 1:
            yield {'type': 'synthesis_start', 'message': 'Combining results...'}

            async for event in self.supervisor.synthesize_results(
                agent_results=agent_results,
                synthesis_instructions=plan.synthesis_instructions,
                original_query=user_message,
            ):
                yield event

    async def _invoke_agent(
        self,
        agent_type: AgentType,
        user_message: str,
        handoff: HandoffContext | None,
    ) -> AsyncGenerator[dict, None]:
        """
        Invoke a specialized agent.

        Args:
            agent_type: Which agent to invoke
            user_message: The user's message
            handoff: Optional handoff context from previous agent

        Yields:
            Agent response events
        """
        # Prepare message with handoff context if present
        if handoff:
            handoff_prompt = self.supervisor.format_handoff_prompt(handoff)
            enhanced_message = f'{handoff_prompt}\n\nUser message: {user_message}'
        else:
            enhanced_message = user_message

        # Route to appropriate agent streamer
        # Note: All chat now goes through unified Ember agent (see tasks.py)
        # Discovery, Learning, and Project agent types now route to support fallback
        if agent_type == AgentType.IMAGE_GENERATION:
            async for event in self._stream_image_generation(enhanced_message):
                yield event

        else:
            # Fallback to support
            async for event in self._stream_support(enhanced_message):
                yield event

    async def _stream_image_generation(self, message: str) -> AsyncGenerator[dict, None]:
        """Handle image generation (not a streaming agent).

        Note: Handoff context is already incorporated into the message.
        """
        # Image generation is handled differently - yield start event
        yield {'type': 'tool_start', 'tool': 'image_generation'}

        # The actual image generation happens in tasks.py
        # Here we just signal that it should be routed there
        yield {
            'type': 'route_to_image_generation',
            'message': message,
        }

    async def _stream_support(self, message: str) -> AsyncGenerator[dict, None]:
        """Stream response from support (simple AI provider).

        Note: Handoff context is already incorporated into the message.
        """
        from services.ai import AIProvider

        provider = AIProvider()

        system_message = (
            'You are a helpful support assistant for AllThrive AI, a platform for '
            'managing and showcasing AI/ML projects. Help users understand features, '
            'troubleshoot issues, and answer questions. Be patient and clear.'
        )

        try:
            for chunk in provider.stream_complete(
                prompt=message,
                system_message=system_message,
                temperature=0.7,
            ):
                yield {'type': 'token', 'content': chunk}

            yield {'type': 'complete', 'session_id': self.session_id}

        except Exception as e:
            logger.error(f'Support agent error: {e}')
            yield {'type': 'error', 'message': str(e)}


async def orchestrate_request(
    user_message: str,
    user_id: int,
    username: str,
    session_id: str,
    conversation_history: list[dict] | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Main entry point for orchestrated requests.

    Args:
        user_message: The user's message
        user_id: User ID
        username: Username
        session_id: Session/conversation ID
        conversation_history: Recent conversation context

    Yields:
        Streaming events from the orchestration
    """
    executor = OrchestratorExecutor(
        user_id=user_id,
        username=username,
        session_id=session_id,
    )

    async for event in executor.execute(user_message, conversation_history):
        yield event
