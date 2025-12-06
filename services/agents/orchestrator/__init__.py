"""
Multi-agent orchestrator for AllThrive AI.

Coordinates specialized agents to handle complex user requests:
- Discovery Agent: Find and explore projects
- Learning Agent (Scout): Quizzes, progress, explanations
- Project Agent: Create and import projects
- Image Generation (Nano Banana): Create visuals

The orchestrator:
1. Analyzes user intent via a supervisor agent
2. Creates execution plans (single, sequential, or parallel)
3. Handles handoffs between agents with context preservation
4. Synthesizes results from multiple agents
"""

from .executor import OrchestratorExecutor, orchestrate_request
from .handoff import (
    AGENT_CAPABILITIES,
    AgentType,
    HandoffContext,
    get_agent_descriptions_for_prompt,
    get_valid_handoff_targets,
)
from .supervisor import OrchestrationPlan, SupervisorAgent, get_supervisor

__all__ = [
    # Main entry point
    'orchestrate_request',
    # Executor
    'OrchestratorExecutor',
    # Supervisor
    'SupervisorAgent',
    'OrchestrationPlan',
    'get_supervisor',
    # Handoff protocol
    'AgentType',
    'HandoffContext',
    'AGENT_CAPABILITIES',
    'get_agent_descriptions_for_prompt',
    'get_valid_handoff_targets',
]
