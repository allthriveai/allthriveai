"""
Supervisor agent for multi-agent orchestration.

Analyzes user requests and coordinates specialized agents to fulfill them.
Handles sequential workflows and synthesizes results from multiple agents.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from services.ai import AIProvider

from .handoff import (
    AGENT_CAPABILITIES,
    AgentType,
    HandoffContext,
    get_agent_descriptions_for_prompt,
)
from .prompts import HANDOFF_CONTEXT_PROMPT, SUPERVISOR_SYSTEM_PROMPT, SYNTHESIS_PROMPT

logger = logging.getLogger(__name__)


class OrchestrationPlan:
    """Represents the supervisor's plan for handling a request."""

    def __init__(self, plan_data: dict):
        self.analysis = plan_data.get('analysis', '')
        self.plan_type = plan_data.get('plan_type', 'single')
        self.agents = plan_data.get('agents', [])
        self.synthesis_needed = plan_data.get('synthesis_needed', False)
        self.synthesis_instructions = plan_data.get('synthesis_instructions', '')

    @property
    def is_single_agent(self) -> bool:
        return self.plan_type == 'single' or len(self.agents) == 1

    @property
    def primary_agent(self) -> AgentType | None:
        if self.agents:
            agent_str = self.agents[0].get('agent', '')
            try:
                return AgentType(agent_str)
            except ValueError:
                return None
        return None

    def get_agent_sequence(self) -> list[tuple[AgentType, str, str | None]]:
        """Get ordered list of (agent_type, task, depends_on)."""
        sequence = []
        for agent_config in self.agents:
            try:
                agent_type = AgentType(agent_config.get('agent', ''))
                task = agent_config.get('task', '')
                depends_on = agent_config.get('depends_on')
                sequence.append((agent_type, task, depends_on))
            except ValueError:
                logger.warning(f'Unknown agent type: {agent_config.get("agent")}')
                continue
        return sequence


class SupervisorAgent:
    """
    Coordinates multiple specialized agents to handle complex requests.

    The supervisor:
    1. Analyzes user intent
    2. Creates an orchestration plan
    3. Executes agents in sequence (with handoffs)
    4. Synthesizes results if needed
    """

    def __init__(self, user_id: int | None = None):
        self.provider = AIProvider()
        self.user_id = user_id

    def create_plan(self, user_message: str, conversation_history: list[dict] | None = None) -> OrchestrationPlan:
        """
        Analyze the user's request and create an orchestration plan.

        Args:
            user_message: The user's current message
            conversation_history: Recent conversation for context

        Returns:
            OrchestrationPlan with routing decisions
        """
        # Build the supervisor prompt
        agent_descriptions = get_agent_descriptions_for_prompt()
        system_prompt = SUPERVISOR_SYSTEM_PROMPT.format(agent_descriptions=agent_descriptions)

        # Add conversation context if available
        context = ''
        if conversation_history:
            recent = conversation_history[-3:]
            context = '\n'.join([f'{m.get("sender", "user")}: {m.get("content", "")}' for m in recent])
            context = f'\n\nRecent conversation:\n{context}\n\n'

        prompt = f'{context}User request: {user_message}'

        try:
            # Get the orchestration plan from the supervisor
            # Use short timeout since this is just routing, not content generation
            result = self.provider.complete(
                prompt=prompt,
                system_message=system_prompt,
                temperature=0.1,  # Low temperature for consistent routing
                max_tokens=500,
                timeout=15,  # Fast timeout for routing decisions
            )

            # Parse the JSON plan from the response
            plan_data = self._extract_json_plan(result)
            plan = OrchestrationPlan(plan_data)

            logger.info(f'Orchestration plan: type={plan.plan_type}, agents={[a.get("agent") for a in plan.agents]}')
            return plan

        except Exception as e:
            logger.error(f'Failed to create orchestration plan: {e}')
            # Fallback to simple intent-based routing
            return self._fallback_plan(user_message)

    def _extract_json_plan(self, response: str) -> dict:
        """Extract JSON plan from supervisor response."""
        # Try to find JSON in the response
        try:
            # Look for JSON block
            if '```json' in response:
                start = response.index('```json') + 7
                end = response.index('```', start)
                json_str = response[start:end].strip()
            elif '```' in response:
                start = response.index('```') + 3
                end = response.index('```', start)
                json_str = response[start:end].strip()
            elif '{' in response:
                # Find the JSON object
                start = response.index('{')
                # Find matching closing brace
                depth = 0
                end = start
                for i, char in enumerate(response[start:], start):
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                json_str = response[start:end]
            else:
                raise ValueError('No JSON found in response')

            return json.loads(json_str)

        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f'Failed to parse orchestration plan: {e}')
            # Return a default single-agent plan
            return {
                'analysis': 'Defaulting to support agent',
                'plan_type': 'single',
                'agents': [{'agent': 'support', 'task': 'Handle user request', 'depends_on': None}],
                'synthesis_needed': False,
            }

    def _fallback_plan(self, user_message: str) -> OrchestrationPlan:
        """Create a simple fallback plan based on keywords."""
        message_lower = user_message.lower()

        # Check each agent's keywords
        best_match = AgentType.SUPPORT
        best_score = 0

        for agent_type, capability in AGENT_CAPABILITIES.items():
            score = sum(1 for kw in capability.keywords if kw in message_lower)
            if score > best_score:
                best_score = score
                best_match = agent_type

        return OrchestrationPlan(
            {
                'analysis': f'Fallback routing to {best_match.value}',
                'plan_type': 'single',
                'agents': [{'agent': best_match.value, 'task': 'Handle user request', 'depends_on': None}],
                'synthesis_needed': False,
            }
        )

    def create_handoff_context(
        self,
        from_agent: AgentType,
        to_agent: AgentType,
        reason: str,
        findings: dict,
        instructions: str,
        original_query: str,
    ) -> HandoffContext:
        """Create a handoff context for passing between agents."""
        return HandoffContext(
            from_agent=from_agent,
            to_agent=to_agent,
            reason=reason,
            findings=findings,
            instructions=instructions,
            original_query=original_query,
        )

    def format_handoff_prompt(self, handoff: HandoffContext) -> str:
        """Format handoff context as a prompt prefix for the receiving agent."""
        findings_str = json.dumps(handoff.findings, indent=2) if handoff.findings else 'None'

        return HANDOFF_CONTEXT_PROMPT.format(
            from_agent=AGENT_CAPABILITIES[handoff.from_agent].name,
            reason=handoff.reason,
            findings=findings_str,
            instructions=handoff.instructions,
            original_query=handoff.original_query,
        )

    async def synthesize_results(
        self,
        agent_results: list[dict[str, Any]],
        synthesis_instructions: str,
        original_query: str,
    ) -> AsyncGenerator[dict, None]:
        """
        Synthesize results from multiple agents into a coherent response.

        Args:
            agent_results: List of results from each agent
            synthesis_instructions: How to combine the results
            original_query: The user's original request

        Yields:
            Streaming synthesis response
        """
        # Format agent results for the synthesis prompt
        results_str = ''
        for i, result in enumerate(agent_results, 1):
            agent_name = result.get('agent', f'Agent {i}')
            content = result.get('content', '')
            results_str += f'\n### {agent_name}\n{content}\n'

        prompt = SYNTHESIS_PROMPT.format(
            agent_results=results_str,
            synthesis_instructions=synthesis_instructions,
            original_query=original_query,
        )

        try:
            # Stream the synthesis
            for chunk in self.provider.stream_complete(
                prompt=prompt,
                temperature=0.7,
                max_tokens=1000,
            ):
                yield {'type': 'token', 'content': chunk}

            yield {'type': 'complete'}

        except Exception as e:
            logger.error(f'Synthesis failed: {e}')
            yield {'type': 'error', 'message': str(e)}


def get_supervisor(user_id: int | None = None) -> SupervisorAgent:
    """Create a supervisor agent for this request.

    Note: Not using singleton because each request may have different user context.
    The AIProvider inside handles its own connection pooling.
    """
    return SupervisorAgent(user_id=user_id)
