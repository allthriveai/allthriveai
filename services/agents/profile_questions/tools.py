"""
Profile Question Tools for Ember.

LangChain tool for asking interactive profile-building questions.
"""

import logging

from langchain.tools import tool
from pydantic import BaseModel, Field

from .question_bank import (
    get_next_question,
    get_question_by_id,
)

logger = logging.getLogger(__name__)


class AskProfileQuestionInput(BaseModel):
    """Input for ask_profile_question tool."""

    model_config = {'extra': 'allow'}

    question_id: str = Field(
        default='',
        description=('Optional: specific question ID to ask. ' 'If empty, auto-selects based on context gaps.'),
    )
    context_hint: str = Field(
        default='',
        description=(
            'Optional: conversational context for natural transition. '
            'E.g., "noticed you like videos" or "before we continue"'
        ),
    )
    state: dict | None = Field(
        default=None,
        description='Internal - injected by agent with user context and member_context',
    )


@tool(args_schema=AskProfileQuestionInput)
def ask_profile_question(
    question_id: str = '',
    context_hint: str = '',
    state: dict | None = None,
) -> dict:
    """
    Ask a fun profile-building question with clickable options.

    Use this tool to learn more about the user in a fun, engaging way.
    Questions appear as interactive pills the user can tap to answer.

    WHEN TO USE:
    - After 3+ messages of good conversation
    - When you notice missing context (e.g., don't know their learning style)
    - During natural pauses in conversation
    - When context would help personalize your responses

    WHEN NOT TO USE:
    - User seems frustrated or asking urgent questions
    - Already asked 2+ questions this session
    - User just answered a question (wait a few messages)

    Returns an interactive question that renders as clickable pills.
    The user's selection will come back as their next message.
    """
    logger.info(
        'ask_profile_question called',
        extra={
            'question_id': question_id,
            'context_hint': context_hint,
            'user_id': state.get('user_id') if state else None,
        },
    )

    member_context = state.get('member_context') if state else None
    user_id = state.get('user_id') if state else None

    if not user_id:
        return {
            'success': False,
            'error': 'User not authenticated',
        }

    # Get profile completion info to find gaps
    profile_completion = {}
    if member_context:
        profile_completion = member_context.get('profile_completion', {})

    missing_fields = profile_completion.get('missing_fields', [])

    # Select question
    question = None
    if question_id:
        question = get_question_by_id(question_id)
        if not question:
            logger.warning(f'Question not found: {question_id}')
    else:
        # Auto-select based on gaps
        # TODO: Track asked questions in session to avoid repeats
        question = get_next_question(missing_fields)

    if not question:
        # No question available - return gracefully
        return {
            'success': False,
            'message': 'No questions available right now.',
        }

    logger.info(
        f'Selected profile question: {question.id}',
        extra={
            'question_id': question.id,
            'category': question.category.value,
            'target_field': question.target_field,
            'user_id': user_id,
        },
    )

    # Build response with _frontend_content for interactive rendering
    return {
        'success': True,
        'question_id': question.id,
        'message': question.prompt,
        '_frontend_content': [
            {
                'type': 'profile_question',
                **question.to_frontend_dict(),
            }
        ],
    }


# =============================================================================
# Tool Registry
# =============================================================================

# Tools that need state injection
TOOLS_NEEDING_STATE = {
    'ask_profile_question',
}

# All profile question tools
PROFILE_QUESTION_TOOLS = [
    ask_profile_question,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in PROFILE_QUESTION_TOOLS}
