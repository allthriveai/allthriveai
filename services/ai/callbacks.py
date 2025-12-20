"""
LangChain callback handlers for AI usage tracking.

Provides accurate token counting from LLM responses instead of character-based estimates.
"""

import logging
from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

logger = logging.getLogger(__name__)


def parse_gateway_model(model_string: str) -> tuple[str | None, str]:
    """
    Parse a gateway model identifier to extract provider and model name.

    Gateway services like OpenRouter return models in format "provider/model-name"
    (e.g., "openai/gpt-4", "anthropic/claude-3-opus").

    Args:
        model_string: Model identifier, possibly with provider prefix

    Returns:
        Tuple of (gateway_provider, model_name)
    """
    if '/' in model_string:
        parts = model_string.split('/', 1)
        return parts[0].lower(), parts[1]
    return None, model_string


class TokenTrackingCallback(BaseCallbackHandler):
    """
    Callback handler that tracks actual token usage from LLM responses.

    Also captures gateway provider information when using AI gateways like OpenRouter.

    Usage:
        callback = TokenTrackingCallback()
        llm = ChatOpenAI(callbacks=[callback])

        # After LLM calls complete:
        input_tokens = callback.total_input_tokens
        output_tokens = callback.total_output_tokens

        # If using a gateway:
        if callback.gateway_metadata:
            actual_provider = callback.gateway_metadata['gateway_provider']
    """

    def __init__(self):
        super().__init__()
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_tokens = 0
        self.llm_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        # Gateway metadata (captured from response model field)
        self.gateway_metadata: dict[str, Any] | None = None
        self._requested_model: str | None = None

    def reset(self):
        """Reset all counters for a new tracking session."""
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_tokens = 0
        self.llm_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.gateway_metadata = None
        self._requested_model = None

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM starts running."""
        self.llm_calls += 1
        # Capture the requested model from kwargs or serialized config
        if 'invocation_params' in kwargs:
            self._requested_model = kwargs['invocation_params'].get('model')
        elif serialized and 'kwargs' in serialized:
            self._requested_model = serialized['kwargs'].get('model')

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM ends running - extract token usage and gateway info."""
        self.successful_calls += 1

        # Try to capture gateway provider info from response model field
        # OpenRouter returns models like "openai/gpt-4" or "anthropic/claude-3"
        self._capture_gateway_info(response)

        # Try to get token usage from response
        if response.llm_output:
            token_usage = response.llm_output.get('token_usage', {})
            if token_usage:
                self.total_input_tokens += token_usage.get('prompt_tokens', 0)
                self.total_output_tokens += token_usage.get('completion_tokens', 0)
                self.total_tokens += token_usage.get('total_tokens', 0)
                logger.debug(
                    f'TokenTrackingCallback: captured {token_usage.get("prompt_tokens", 0)} input, '
                    f'{token_usage.get("completion_tokens", 0)} output tokens'
                )
                return

            # OpenAI format (newer)
            usage_metadata = response.llm_output.get('usage', {})
            if usage_metadata:
                self.total_input_tokens += usage_metadata.get('prompt_tokens', 0)
                self.total_output_tokens += usage_metadata.get('completion_tokens', 0)
                self.total_tokens += usage_metadata.get('total_tokens', 0)
                return

        # Try to extract from generation info (per-generation metadata)
        for generation_list in response.generations:
            for generation in generation_list:
                gen_info = getattr(generation, 'generation_info', {}) or {}

                # Check for usage in generation_info
                if 'usage' in gen_info:
                    usage = gen_info['usage']
                    self.total_input_tokens += usage.get('prompt_tokens', 0)
                    self.total_output_tokens += usage.get('completion_tokens', 0)
                    self.total_tokens += usage.get('total_tokens', 0)
                    return

                # Anthropic format
                if 'usage' in gen_info:
                    usage = gen_info['usage']
                    self.total_input_tokens += usage.get('input_tokens', 0)
                    self.total_output_tokens += usage.get('output_tokens', 0)
                    return

        # If no token info found, log warning
        logger.debug('TokenTrackingCallback: no token usage found in LLM response')

    def _capture_gateway_info(self, response: LLMResult) -> None:
        """
        Capture gateway provider info from the response.

        When using AI gateways like OpenRouter, the response model field
        contains the actual provider/model in format "provider/model-name".
        """
        if self.gateway_metadata:
            return  # Already captured

        model_name = None

        # Try to get model from llm_output
        if response.llm_output:
            model_name = response.llm_output.get('model_name') or response.llm_output.get('model')

        # Try to get from generation info
        if not model_name and response.generations:
            for gen_list in response.generations:
                for gen in gen_list:
                    gen_info = getattr(gen, 'generation_info', {}) or {}
                    model_name = gen_info.get('model')
                    if model_name:
                        break
                if model_name:
                    break

        if model_name:
            gateway_provider, actual_model = parse_gateway_model(model_name)
            if gateway_provider:
                self.gateway_metadata = {
                    'gateway_provider': gateway_provider,
                    'gateway_model': actual_model,
                    'requested_model': self._requested_model,
                }
                logger.debug(
                    f'TokenTrackingCallback: gateway detected - requested={self._requested_model}, '
                    f'actual_provider={gateway_provider}, actual_model={actual_model}'
                )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM errors."""
        self.failed_calls += 1
        logger.warning(f'TokenTrackingCallback: LLM error - {error}')

    @property
    def has_token_data(self) -> bool:
        """Check if we captured any token data."""
        return self.total_tokens > 0 or self.total_input_tokens > 0 or self.total_output_tokens > 0

    def get_usage_summary(self) -> dict[str, int]:
        """Get a summary of token usage."""
        return {
            'input_tokens': self.total_input_tokens,
            'output_tokens': self.total_output_tokens,
            'total_tokens': self.total_tokens or (self.total_input_tokens + self.total_output_tokens),
            'llm_calls': self.llm_calls,
            'successful_calls': self.successful_calls,
            'failed_calls': self.failed_calls,
        }


class AsyncTokenTrackingCallback(TokenTrackingCallback):
    """
    Async-compatible version of TokenTrackingCallback.

    Use this for async LangGraph agents.
    """

    async def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM starts running."""
        self.llm_calls += 1

    async def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM ends running - extract token usage."""
        # Reuse sync implementation
        super().on_llm_end(response, run_id=run_id, parent_run_id=parent_run_id, **kwargs)

    async def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM errors."""
        super().on_llm_error(error, run_id=run_id, parent_run_id=parent_run_id, **kwargs)


def estimate_tokens(text: str) -> int:
    """
    Fallback token estimation when actual counts aren't available.

    Uses ~4 characters per token heuristic (industry standard).

    Args:
        text: Text to estimate tokens for

    Returns:
        Estimated token count
    """
    if not text:
        return 0
    return max(1, len(text) // 4)
