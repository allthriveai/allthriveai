"""
Image content moderation service using OpenAI's GPT-4 Vision API.
"""

import logging
import time
from typing import Any

from openai import APIConnectionError, APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider

logger = logging.getLogger(__name__)


class ImageModerator:
    """
    Image moderation service that checks images for inappropriate content
    using GPT-4 Vision API.

    Uses the centralized AIProvider for client management.
    """

    def __init__(self):
        # Image moderation uses GPT-4 Vision (chat completions)
        # Try to get client from AIProvider, but handle case where API key is missing
        try:
            self.ai_provider = AIProvider()  # Uses default provider from settings
            self.client = self.ai_provider.client
            self.has_client = True
        except (ValueError, Exception) as e:
            logger.warning(f'AI provider not configured for image moderation: {e}. Image moderation will be skipped.')
            self.ai_provider = None
            self.client = None
            self.has_client = False

    def _get_vision_model(self) -> str:
        """Get the appropriate vision model based on the configured provider."""
        from django.conf import settings

        if not self.ai_provider:
            return 'gpt-4o'  # Fallback, though this shouldn't be called if no provider

        provider = self.ai_provider.current_provider

        if provider == 'openai':
            return 'gpt-4o'
        elif provider == 'anthropic':
            return 'claude-3-5-sonnet-20241022'
        elif provider == 'gemini':
            return getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp')
        else:
            return 'gpt-4o'  # Default fallback

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=20),
        retry=retry_if_exception_type((APIConnectionError, APITimeoutError, RateLimitError)),
        reraise=True,
    )
    def moderate_image(self, image_url: str, context: str = '', user=None) -> dict[str, Any]:
        """
        Moderate an image using GPT-4 Vision API.

        Args:
            image_url: URL of the image to moderate
            context: Optional context about the image source
            user: Optional user for usage tracking

        Returns:
            Dictionary with moderation results
        """
        if not image_url or not image_url.strip():
            return {
                'approved': True,  # No image to moderate
                'flagged': False,
                'reason': 'No image provided',
                'categories': {},
                'confidence': 0.0,
            }

        # If no client configured, approve all images with warning
        if not self.has_client or not self.client:
            logger.debug(f'Skipping image moderation (no API key) for context: {context}')
            return {
                'approved': True,
                'flagged': False,
                'reason': 'Image moderation skipped - no API key configured',
                'categories': {},
                'confidence': 0.0,
                'skipped': True,
            }

        try:
            # Use vision model from AI gateway to analyze the image
            start_time = time.time()
            model_used = self._get_vision_model()
            response = self.client.chat.completions.create(
                model=model_used,
                messages=[
                    {
                        'role': 'system',
                        'content': (
                            'You are a content moderation AI. Analyze images for '
                            'inappropriate content including:\n'
                            '- Explicit sexual content or nudity\n'
                            '- Graphic violence or gore\n'
                            '- Hate symbols or extremist imagery\n'
                            '- Self-harm content\n'
                            '- Content exploiting or harming children\n'
                            '- Disturbing or shocking imagery\n\n'
                            'Respond in JSON format with:\n'
                            '{\n'
                            '  "flagged": boolean,\n'
                            '  "categories": ["category1", "category2"],\n'
                            '  "severity": "low|medium|high",\n'
                            '  "explanation": "brief explanation"\n'
                            '}\n\n'
                            'Be strict with NSFW content, violence, and hate symbols. '
                            'Context matters for artistic/educational content.'
                        ),
                    },
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'text',
                                'text': (
                                    f'Analyze this image for inappropriate content. '
                                    f'Context: {context or "general content"}'
                                ),
                            },
                            {
                                'type': 'image_url',
                                'image_url': {'url': image_url, 'detail': 'low'},  # Low detail for faster processing
                            },
                        ],
                    },
                ],
                max_tokens=300,
                response_format={'type': 'json_object'},
            )
            latency_ms = int((time.time() - start_time) * 1000)

            # Track usage - vision API is expensive
            if user:
                try:
                    # Get actual token usage from response
                    usage = response.usage
                    provider = self.ai_provider.current_provider if self.ai_provider else 'openai'
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='image_moderation',
                        provider=provider,
                        model=model_used,
                        input_tokens=usage.prompt_tokens if usage else 0,
                        output_tokens=usage.completion_tokens if usage else 0,
                        latency_ms=latency_ms,
                        status='success',
                        request_metadata={'context': context, 'image_url': image_url[:100]},
                    )
                except Exception as tracking_error:
                    logger.warning(f'Failed to track image moderation usage: {tracking_error}')

            # Parse the response
            import json

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            is_flagged = result.get('flagged', False)
            categories = result.get('categories', [])
            severity = result.get('severity', 'medium')
            explanation = result.get('explanation', '')

            # Convert categories list to dict with confidence scores
            categories_dict = {cat: self._severity_to_score(severity) for cat in categories}

            # Determine approval status
            approved = not is_flagged

            # Generate human-readable reason
            reason = self._generate_reason(is_flagged, categories, severity, explanation, context)

            # Calculate confidence
            confidence = self._severity_to_score(severity) if is_flagged else 0.0

            # Log moderation result
            if is_flagged:
                logger.warning(
                    f'Image flagged by moderation: context={context}, '
                    f'categories={categories}, severity={severity}, url={image_url}'
                )

            return {
                'approved': approved,
                'flagged': is_flagged,
                'categories': categories_dict,
                'reason': reason,
                'confidence': confidence,
                'moderation_data': {
                    'categories': categories,
                    'severity': severity,
                    'explanation': explanation,
                    'image_url': image_url,
                },
            }

        except (APIConnectionError, APITimeoutError, RateLimitError) as e:
            # These will be retried by the decorator
            logger.warning(f'Retryable image moderation error: {type(e).__name__}: {e}')
            raise

        except APIError as e:
            # OpenAI API error (non-retryable)
            logger.error(f'OpenAI API error in image moderation: {e}', exc_info=True)
            return {
                'approved': False,
                'flagged': True,
                'reason': 'Image moderation service temporarily unavailable. Skipping content.',
                'categories': {'api_error': 1.0},
                'confidence': 1.0,
                'error': str(e),
            }

        except Exception as e:
            # Unexpected error
            logger.error(f'Unexpected error in image moderation: {e}', exc_info=True)
            # Fail closed - reject content if moderation fails
            return {
                'approved': False,
                'flagged': True,
                'reason': 'Unable to moderate image - skipping content for safety',
                'categories': {'system_error': 1.0},
                'confidence': 1.0,
                'error': str(e),
            }

    def _severity_to_score(self, severity: str) -> float:
        """Convert severity level to confidence score."""
        severity_map = {'low': 0.4, 'medium': 0.7, 'high': 0.95}
        return severity_map.get(severity, 0.7)

    def _generate_reason(
        self, is_flagged: bool, categories: list[str], severity: str, explanation: str, context: str
    ) -> str:
        """Generate a human-readable reason for the moderation result."""
        if not is_flagged:
            return 'Image approved'

        if not categories:
            return 'Image flagged for review'

        # Map categories to user-friendly messages
        category_messages = {
            'explicit': 'explicit or sexual content',
            'nudity': 'nudity or sexual content',
            'violence': 'violent or graphic content',
            'gore': 'graphic violence or gore',
            'hate': 'hate symbols or extremist imagery',
            'self-harm': 'self-harm content',
            'minors': 'content involving minors',
            'disturbing': 'disturbing or shocking imagery',
        }

        flagged_reasons = []
        for cat in categories:
            # Try exact match first, then partial match
            if cat.lower() in category_messages:
                flagged_reasons.append(category_messages[cat.lower()])
            else:
                # Find partial match
                matched = False
                for key, msg in category_messages.items():
                    if key in cat.lower() or cat.lower() in key:
                        flagged_reasons.append(msg)
                        matched = True
                        break
                if not matched:
                    flagged_reasons.append(f'{cat} content')

        if len(flagged_reasons) == 1:
            reason_text = flagged_reasons[0]
        elif len(flagged_reasons) == 2:
            reason_text = ' and '.join(flagged_reasons)
        else:
            reason_text = ', '.join(flagged_reasons[:-1]) + f', and {flagged_reasons[-1]}'

        context_msg = f' in {context}' if context else ''
        severity_msg = f' (severity: {severity})' if severity == 'high' else ''

        return f'Image flagged: contains {reason_text}{context_msg}{severity_msg}. Content skipped.'
