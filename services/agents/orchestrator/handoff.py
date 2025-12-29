"""
Handoff protocol for multi-agent orchestration.

Defines the handoff context that gets passed between agents,
allowing them to share state and delegate tasks.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AgentType(str, Enum):
    """Available specialized agents."""

    DISCOVERY = 'discovery'
    LEARNING = 'learning'
    PROJECT = 'project'
    IMAGE_GENERATION = 'image_generation'
    SUPPORT = 'support'
    ORCHESTRATION = 'orchestration'  # Site navigation, UI highlighting, action triggers
    AVA = 'ava'  # Unified agent with all tools (replaces multi-agent routing)


@dataclass
class HandoffContext:
    """
    Context passed between agents during handoffs.

    Contains the results from the previous agent and instructions
    for the next agent.
    """

    # The agent that initiated the handoff
    from_agent: AgentType

    # The agent receiving the handoff
    to_agent: AgentType

    # Why the handoff is happening
    reason: str

    # Key findings/results from the previous agent
    findings: dict[str, Any] = field(default_factory=dict)

    # Specific instructions for the next agent
    instructions: str = ''

    # The original user query (for context)
    original_query: str = ''

    # Accumulated context from the conversation
    conversation_context: list[dict] = field(default_factory=list)

    # Whether this is part of a multi-step workflow
    is_multi_step: bool = False

    # Step number in a multi-step workflow
    step_number: int = 1

    # Total expected steps (0 = unknown)
    total_steps: int = 0

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            'from_agent': self.from_agent.value,
            'to_agent': self.to_agent.value,
            'reason': self.reason,
            'findings': self.findings,
            'instructions': self.instructions,
            'original_query': self.original_query,
            'conversation_context': self.conversation_context,
            'is_multi_step': self.is_multi_step,
            'step_number': self.step_number,
            'total_steps': self.total_steps,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'HandoffContext':
        """Create from dictionary."""
        return cls(
            from_agent=AgentType(data['from_agent']),
            to_agent=AgentType(data['to_agent']),
            reason=data.get('reason', ''),
            findings=data.get('findings', {}),
            instructions=data.get('instructions', ''),
            original_query=data.get('original_query', ''),
            conversation_context=data.get('conversation_context', []),
            is_multi_step=data.get('is_multi_step', False),
            step_number=data.get('step_number', 1),
            total_steps=data.get('total_steps', 0),
        )


@dataclass
class AgentCapability:
    """Describes what an agent can do."""

    agent_type: AgentType
    name: str
    description: str
    can_handoff_to: list[AgentType]
    keywords: list[str]

    def to_prompt_description(self) -> str:
        """Format for inclusion in supervisor prompt."""
        return f'**{self.name}** ({self.agent_type.value}): {self.description}'


# Define agent capabilities for the supervisor
AGENT_CAPABILITIES = {
    AgentType.DISCOVERY: AgentCapability(
        agent_type=AgentType.DISCOVERY,
        name='Discovery Agent',
        description='Searches and explores projects on the platform. Finds projects by topic, '
        'recommends projects based on interests, shows trending content, and finds similar projects.',
        can_handoff_to=[AgentType.LEARNING, AgentType.IMAGE_GENERATION, AgentType.PROJECT],
        keywords=['find', 'search', 'discover', 'explore', 'trending', 'recommend', 'projects', 'similar'],
    ),
    AgentType.LEARNING: AgentCapability(
        agent_type=AgentType.LEARNING,
        name='Scout (Learning Tutor)',
        description='Helps users learn through quizzes and learning paths. Checks progress, '
        'provides quiz hints, explains concepts, and suggests next learning activities.',
        can_handoff_to=[AgentType.DISCOVERY, AgentType.IMAGE_GENERATION],
        keywords=['learn', 'quiz', 'hint', 'explain', 'progress', 'study', 'understand', 'teach'],
    ),
    AgentType.PROJECT: AgentCapability(
        agent_type=AgentType.PROJECT,
        name='Project Agent',
        description='Helps create and import projects. Imports from GitHub, YouTube, '
        'or any URL. Scrapes webpages to create portfolio projects.',
        can_handoff_to=[AgentType.IMAGE_GENERATION, AgentType.DISCOVERY],
        keywords=[
            'create',
            'import',
            'github',
            'youtube',
            'upload',
            'new project',
            'add project',
            'url',
            'link',
            'http',
            'https',
            'website',
            'webpage',
            'scrape',
            '.com',
            '.io',
            '.org',
            '.net',
            'portfolio',
            'showcase',
        ],
    ),
    AgentType.IMAGE_GENERATION: AgentCapability(
        agent_type=AgentType.IMAGE_GENERATION,
        name='Nano Banana (Image Generator)',
        description='Creates images and infographics using AI. Generates visuals, diagrams, '
        'flowcharts, and creative imagery.',
        can_handoff_to=[AgentType.DISCOVERY, AgentType.PROJECT],
        keywords=['image', 'infographic', 'visual', 'diagram', 'picture', 'generate image', 'create image'],
    ),
    AgentType.SUPPORT: AgentCapability(
        agent_type=AgentType.SUPPORT,
        name='Support Agent',
        description='General help and platform support. Answers questions about features, '
        'troubleshoots issues, and provides guidance.',
        can_handoff_to=[AgentType.DISCOVERY, AgentType.LEARNING, AgentType.PROJECT, AgentType.ORCHESTRATION],
        keywords=['help', 'how to', 'what is', 'support', 'question', 'issue', 'problem'],
    ),
    AgentType.ORCHESTRATION: AgentCapability(
        agent_type=AgentType.ORCHESTRATION,
        name='Ava (Site Guide)',
        description='Navigates users around the site, highlights UI elements to teach features, '
        'opens panels/trays, and triggers actions. Use for "take me to", "show me where", '
        '"go to", "where is", and site navigation requests.',
        can_handoff_to=[AgentType.DISCOVERY, AgentType.LEARNING, AgentType.PROJECT, AgentType.SUPPORT],
        keywords=[
            'take me',
            'go to',
            'navigate',
            'show me',
            'where is',
            'where do i',
            'how do i find',
            'open',
            'battles',
            'quizzes',
            'explore',
            'profile',
            'settings',
            'quest',
            'challenges',
            'side quest',
        ],
    ),
    AgentType.AVA: AgentCapability(
        agent_type=AgentType.AVA,
        name='Ava (Unified Assistant)',
        description='Unified AI assistant with access to ALL tools - discovery, learning, project creation, '
        'navigation, and profile management. Single agent that handles any request without routing overhead.',
        can_handoff_to=[],  # Ava handles everything, no handoffs needed
        keywords=[],  # Ava is selected via feature flag, not keywords
    ),
}


def get_agent_descriptions_for_prompt() -> str:
    """Get formatted agent descriptions for the supervisor prompt."""
    lines = []
    for capability in AGENT_CAPABILITIES.values():
        lines.append(capability.to_prompt_description())
    return '\n'.join(lines)


def get_valid_handoff_targets(from_agent: AgentType) -> list[AgentType]:
    """Get list of agents that can receive a handoff from the given agent."""
    capability = AGENT_CAPABILITIES.get(from_agent)
    if capability:
        return capability.can_handoff_to
    return []
