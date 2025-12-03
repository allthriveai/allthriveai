"""
Intent Detection Service using LLM-based reasoning

Replaces keyword-based intent detection with intelligent LLM analysis.
Uses the configured AI provider (OpenAI/Azure/Anthropic) to determine user intent.

Supported intents:
- support: Help, questions, troubleshooting
- project-creation: Creating projects from integrations
- discovery: Exploring projects, recommendations
- image-generation: Creating images, infographics, or visuals with AI
"""

import hashlib
import logging
import time
from typing import Literal

from django.core.cache import cache

from services.ai import AIProvider

from .metrics import MetricsCollector
from .security import PromptInjectionFilter

logger = logging.getLogger(__name__)

# Intent types
ChatMode = Literal['support', 'project-creation', 'discovery', 'image-generation']


INTENT_DETECTION_PROMPT = """You are an intent classifier for AllThrive AI, a platform for managing AI/ML projects.

Your job is to analyze user messages and determine their intent from these categories:

1. **support**: User needs help, has questions, troubleshooting, wants to learn how to use features
   - Examples: "How do I add a project?", "I'm getting an error", "What does this button do?"

2. **project-creation**: User wants to create, import, or add a new project
   - Examples: "Create a new project", "Import from GitHub", "Add my YouTube video"

3. **discovery**: User wants to explore, search, or discover existing projects
   - Examples: "Show me AI projects", "Find similar projects", "What projects do I have?"

4. **image-generation**: User wants to create, generate, or edit images, infographics, diagrams, or visuals
   - Examples: "Create an infographic", "Generate an image of...", "Make me a flowchart", "Design a banner"

Context about the user:
- Integration type: {integration_type}
- Recent messages: {conversation_history}

User message: {user_message}

Respond with ONLY the intent category (support, project-creation, discovery, or image-generation).
No explanation, just the category name.
"""


class IntentDetectionService:
    """
    LLM-based intent detection service
    """

    def __init__(self):
        """Initialize AI provider for intent detection"""
        self.provider = AIProvider()

    def detect_intent(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
        integration_type: str | None = None,
    ) -> ChatMode:
        """
        Detect user intent using LLM reasoning.

        Args:
            user_message: The current user message
            conversation_history: Recent conversation messages for context
            integration_type: Optional integration context (github, youtube, etc.)

        Returns:
            ChatMode: Detected intent category
        """
        start_time = time.time()
        try:
            # If integration is present, it's definitely project creation
            if integration_type:
                logger.info(f'Intent detected: project-creation (integration: {integration_type})')
                MetricsCollector.record_intent_detection(time.time() - start_time)
                return 'project-creation'

            # Sanitize user input to prevent prompt injection
            filter = PromptInjectionFilter()
            sanitized_message = filter.sanitize_input(user_message)

            # Check cache for previously detected intents
            cache_key = self._get_cache_key(sanitized_message)
            cached_intent = cache.get(cache_key)
            if cached_intent:
                logger.debug(f'Cache hit for message: {sanitized_message[:50]}...')
                MetricsCollector.record_cache_hit('intent_detection')
                MetricsCollector.record_intent_detection(time.time() - start_time)
                return cached_intent

            # Cache miss - proceed with LLM detection
            MetricsCollector.record_cache_miss('intent_detection')

            # Build context from conversation history
            history_text = self._format_history(conversation_history or [])

            # Build prompt
            prompt = INTENT_DETECTION_PROMPT.format(
                user_message=sanitized_message,
                conversation_history=history_text,
                integration_type=integration_type or 'none',
            )

            # Call AI provider and track response time
            llm_start = time.time()
            result = self.provider.complete(
                prompt,
                temperature=0.0,  # Deterministic for classification
                max_tokens=20,  # We only need one word
            )
            llm_duration = time.time() - llm_start

            # Record LLM metrics with actual provider and model
            MetricsCollector.record_llm_response(
                self.provider.current_provider, self.provider.current_model, llm_duration
            )

            # Track token usage for cost monitoring
            if self.provider.last_usage:
                usage = self.provider.last_usage
                MetricsCollector.record_tokens(
                    self.provider.current_provider, self.provider.current_model, 'prompt', usage.get('prompt_tokens', 0)
                )
                MetricsCollector.record_tokens(
                    self.provider.current_provider,
                    self.provider.current_model,
                    'completion',
                    usage.get('completion_tokens', 0),
                )
                logger.debug(
                    f'Token usage - Prompt: {usage.get("prompt_tokens", 0)}, '
                    f'Completion: {usage.get("completion_tokens", 0)}, '
                    f'Total: {usage.get("total_tokens", 0)}'
                )

            # Parse result
            intent = result.strip().lower()

            # Validate intent
            valid_intents: list[ChatMode] = ['support', 'project-creation', 'discovery', 'image-generation']
            if intent not in valid_intents:
                logger.warning(f'Invalid intent from LLM: {intent}, defaulting to support')
                intent = 'support'

            logger.info(f'Intent detected: {intent}')

            # Cache the result for 1 hour
            cache.set(cache_key, intent, timeout=3600)

            # Record intent detection time
            MetricsCollector.record_intent_detection(time.time() - start_time)

            return intent  # type: ignore

        except Exception as e:
            logger.error(f'Failed to detect intent: {e}')
            logger.info('Falling back to support mode')
            MetricsCollector.record_intent_detection(time.time() - start_time)
            return 'support'

    def _get_cache_key(self, message: str) -> str:
        """
        Generate cache key for intent detection.

        Args:
            message: Sanitized user message

        Returns:
            Cache key for Redis
        """
        # Use SHA256 hash to create a deterministic cache key
        message_hash = hashlib.sha256(message.encode()).hexdigest()
        return f'intent_detection:{message_hash}'

    def _format_history(self, conversation_history: list[dict]) -> str:
        """
        Format conversation history for context.

        Args:
            conversation_history: List of message dicts with 'sender' and 'content'

        Returns:
            Formatted history string
        """
        if not conversation_history:
            return 'No previous messages'

        # Take last 3 messages for context
        recent = conversation_history[-3:]
        formatted = []

        for msg in recent:
            sender = msg.get('sender', 'unknown')
            content = msg.get('content', '')
            formatted.append(f'{sender}: {content}')

        return '\n'.join(formatted)

    def get_mode_transition_message(self, new_mode: ChatMode, integration_type: str | None = None) -> str:
        """
        Get a friendly message for mode transitions.

        Args:
            new_mode: The new mode being switched to
            integration_type: Optional integration context

        Returns:
            Friendly transition message
        """
        if new_mode == 'project-creation':
            if integration_type == 'github':
                return "Great! Let's import your GitHub repository. Please provide the repository URL."
            if integration_type == 'youtube':
                return "Perfect! Let's import your YouTube video. Please provide the video URL."
            if integration_type == 'upload':
                return "Ready to upload! Please select the files you'd like to add to your project."
            if integration_type == 'url':
                return "I can help you import from any URL. Please paste the URL you'd like to import."
            return "Let's create a new project! What would you like to import?"

        if new_mode == 'discovery':
            return 'I can help you explore projects. What are you looking for?'

        if new_mode == 'image-generation':
            return (
                "Hey there! I'm Nano Banana, your creative image assistant. "
                'I can help you create infographics, diagrams, banners, and more. '
                'What would you like me to create?'
            )

        # support mode
        return 'How can I help you today?'


# Singleton instance
_intent_service = None


def get_intent_service() -> IntentDetectionService:
    """Get or create the intent detection service singleton"""
    global _intent_service
    if _intent_service is None:
        _intent_service = IntentDetectionService()
    return _intent_service
