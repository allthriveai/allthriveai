"""
LangChain tool for content moderation using AI.

This tool can be used by any agent to moderate user-generated content
for toxicity, hate speech, harassment, and other harmful content.
"""

import logging
from typing import Any

from langchain.tools import tool
from pydantic import BaseModel, Field

from services.agents.moderation.moderator import ContentModerator

logger = logging.getLogger(__name__)


class ModerateContentInput(BaseModel):
    """Input schema for content moderation tool."""

    content: str = Field(description='The text content to moderate')
    context: str = Field(
        default='',
        description="Optional context about where this content is being used (e.g., 'project comment', 'chat message')",
    )


@tool(args_schema=ModerateContentInput)
def moderate_content(content: str, context: str = '') -> dict[str, Any]:
    """
    Moderate user-generated content for safety and appropriateness.

    This tool checks content for:
    - Toxicity and hate speech
    - Harassment or bullying
    - Explicit or inappropriate language
    - Spam or promotional content
    - Other harmful content

    Use this tool whenever users submit content that will be publicly visible
    or stored in the system.

    Args:
        content: The text content to moderate
        context: Optional context about where this content is being used

    Returns:
        Dictionary with moderation results:
        - approved: Boolean indicating if content is safe
        - flagged: Boolean indicating if content needs review
        - categories: Dictionary of flagged categories
        - reason: Human-readable explanation
        - confidence: Confidence score (0-1)
    """
    try:
        moderator = ContentModerator()
        result = moderator.moderate(content, context=context)

        return {'success': True, **result}
    except Exception as e:
        logger.error(f'Error moderating content: {e}', exc_info=True)
        return {
            'success': False,
            'approved': False,
            'flagged': True,
            'reason': 'Moderation system error - content flagged for manual review',
            'error': str(e),
        }


# Export tools list
MODERATION_TOOLS = [moderate_content]
