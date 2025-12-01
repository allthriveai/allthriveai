"""
Content moderation service using OpenAI's Moderation API and custom AI logic.
"""

import logging
from typing import Any

from openai import APIConnectionError, APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from services.ai_provider import AIProvider

logger = logging.getLogger(__name__)


class ContentModerator:
    """
    Content moderation service that checks user-generated content
    for safety, toxicity, and appropriateness.
    
    Uses the centralized AIProvider for client management.
    """

    def __init__(self):
        # Get OpenAI-compatible client from AIProvider
        # Uses DEFAULT_AI_PROVIDER from settings (supports Azure OpenAI or OpenAI)
        ai_provider = AIProvider()  # Uses default provider from settings
        self.client = ai_provider.client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((APIConnectionError, APITimeoutError, RateLimitError)),
        reraise=True,
    )
    def moderate(self, content: str, context: str = '') -> dict[str, Any]:
        """
        Moderate content using OpenAI's Moderation API.

        Args:
            content: The text content to moderate
            context: Optional context about the content source

        Returns:
            Dictionary with moderation results
        """
        if not content or not content.strip():
            return {
                'approved': False,
                'flagged': True,
                'reason': 'Content cannot be empty',
                'categories': {},
                'confidence': 1.0,
            }

        try:
            # Use OpenAI's Moderation API
            response = self.client.moderations.create(input=content)
            result = response.results[0]

            # Check if content is flagged
            is_flagged = result.flagged
            categories_flagged = {
                category: score
                for category, score in result.category_scores.model_dump().items()
                if getattr(result.categories, category)
            }

            # Determine approval status
            approved = not is_flagged

            # Generate human-readable reason
            reason = self._generate_reason(is_flagged, categories_flagged, context)

            # Calculate average confidence from flagged categories
            confidence = sum(categories_flagged.values()) / len(categories_flagged) if categories_flagged else 0.0

            # Log moderation result
            if is_flagged:
                logger.warning(
                    f'Content flagged by moderation: context={context}, '
                    f'categories={list(categories_flagged.keys())}, confidence={confidence:.2f}'
                )

            return {
                'approved': approved,
                'flagged': is_flagged,
                'categories': categories_flagged,
                'reason': reason,
                'confidence': confidence,
                'moderation_data': result.model_dump(),
            }

        except (APIConnectionError, APITimeoutError, RateLimitError) as e:
            # These will be retried by the decorator
            logger.warning(f'Retryable moderation error: {type(e).__name__}: {e}')
            raise

        except APIError as e:
            # OpenAI API error (non-retryable)
            logger.error(f'OpenAI API error in moderation: {e}', exc_info=True)
            return {
                'approved': False,
                'flagged': True,
                'reason': 'Content moderation service temporarily unavailable. Please try again.',
                'categories': {'api_error': 1.0},
                'confidence': 1.0,
                'error': str(e),
            }

        except Exception as e:
            # Unexpected error
            logger.error(f'Unexpected error in content moderation: {e}', exc_info=True)
            # Fail closed - reject content if moderation fails
            return {
                'approved': False,
                'flagged': True,
                'reason': 'Unable to moderate content - please try again or contact support',
                'categories': {'system_error': 1.0},
                'confidence': 1.0,
                'error': str(e),
            }

    def _generate_reason(self, is_flagged: bool, categories: dict[str, float], context: str) -> str:
        """Generate a human-readable reason for the moderation result."""
        if not is_flagged:
            return 'Content approved'

        if not categories:
            return 'Content flagged for review'

        # Map categories to user-friendly messages
        category_messages = {
            'hate': 'contains hate speech or discriminatory language',
            'hate/threatening': 'contains threatening hate speech',
            'harassment': 'contains harassment or bullying',
            'harassment/threatening': 'contains threatening harassment',
            'self-harm': 'contains content about self-harm',
            'self-harm/intent': 'contains intent to self-harm',
            'self-harm/instructions': 'contains self-harm instructions',
            'sexual': 'contains sexual content',
            'sexual/minors': 'contains content involving minors',
            'violence': 'contains violent content',
            'violence/graphic': 'contains graphic violence',
        }

        flagged_reasons = [category_messages.get(cat, f'contains {cat} content') for cat in categories.keys()]

        if len(flagged_reasons) == 1:
            reason_text = flagged_reasons[0]
        elif len(flagged_reasons) == 2:
            reason_text = ' and '.join(flagged_reasons)
        else:
            reason_text = ', '.join(flagged_reasons[:-1]) + f', and {flagged_reasons[-1]}'

        context_msg = f' in {context}' if context else ''
        return f'Content flagged: {reason_text}{context_msg}. Please revise and try again.'
