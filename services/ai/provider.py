"""
AI Provider Service
Supports OpenAI, Anthropic, and Gemini with easy switching between providers.
Includes Phoenix tracing (auto-instrumented) and cost tracking.
"""

import logging
import time
from enum import Enum

from django.conf import settings

from core.logging_utils import StructuredLogger

logger = logging.getLogger(__name__)

# Default timeout for AI API calls (in seconds)
DEFAULT_AI_TIMEOUT = 60

# Gateway detection
_using_ai_gateway = None  # Cached gateway detection result


def is_using_ai_gateway() -> bool:
    """
    Check if an AI gateway (like OpenRouter) is configured.

    Returns:
        True if OPENAI_BASE_URL is set (indicating gateway usage)
    """
    global _using_ai_gateway
    if _using_ai_gateway is None:
        base_url = getattr(settings, 'OPENAI_BASE_URL', None)
        _using_ai_gateway = bool(base_url)
    return _using_ai_gateway


def parse_gateway_model(model_string: str) -> tuple[str | None, str]:
    """
    Parse a gateway model identifier to extract provider and model name.

    Gateway services like OpenRouter return models in format "provider/model-name"
    (e.g., "openai/gpt-4", "anthropic/claude-3-opus").

    Args:
        model_string: Model identifier, possibly with provider prefix

    Returns:
        Tuple of (gateway_provider, model_name)
        - gateway_provider is None if no provider prefix found
        - model_name is the model without provider prefix

    Examples:
        "openai/gpt-4" -> ("openai", "gpt-4")
        "anthropic/claude-3-opus" -> ("anthropic", "claude-3-opus")
        "gpt-4" -> (None, "gpt-4")
    """
    if '/' in model_string:
        parts = model_string.split('/', 1)
        return parts[0].lower(), parts[1]
    return None, model_string


# Token limit defaults (can be overridden in settings)
DEFAULT_TOKEN_SOFT_LIMIT = 8000  # Warn above this
DEFAULT_TOKEN_HARD_LIMIT = 32000  # Block above this
DEFAULT_OUTPUT_TOKEN_LIMIT = 4096  # Max output tokens per request


class TokenLimitExceededError(Exception):
    """Raised when a request exceeds the hard token limit."""

    def __init__(self, estimated_tokens: int, limit: int, message: str = None):
        self.estimated_tokens = estimated_tokens
        self.limit = limit
        self.message = message or f'Request exceeds token limit: {estimated_tokens} > {limit}'
        super().__init__(self.message)


def estimate_token_count(text: str) -> int:
    """
    Estimate token count for a text string.

    Uses a simple heuristic: ~4 characters per token for English text.
    This is conservative (tends to overestimate) which is safer for limits.

    For more accurate counting, use tiktoken, but this is fast and sufficient
    for limit checking.

    Args:
        text: The text to estimate tokens for

    Returns:
        Estimated token count
    """
    if not text:
        return 0
    # Conservative estimate: ~3.5 chars per token (rounds up)
    return max(1, len(text) // 3)


def get_token_limits() -> tuple[int, int, int]:
    """
    Get token limits from settings with fallbacks.

    Returns:
        Tuple of (soft_limit, hard_limit, output_limit)
    """
    soft_limit = getattr(settings, 'AI_TOKEN_SOFT_LIMIT', DEFAULT_TOKEN_SOFT_LIMIT)
    hard_limit = getattr(settings, 'AI_TOKEN_HARD_LIMIT', DEFAULT_TOKEN_HARD_LIMIT)
    output_limit = getattr(settings, 'AI_OUTPUT_TOKEN_LIMIT', DEFAULT_OUTPUT_TOKEN_LIMIT)
    return soft_limit, hard_limit, output_limit


def check_token_limits(prompt: str, system_message: str = None, user_id: int = None) -> tuple[bool, int]:
    """
    Check if a request is within token limits.

    Args:
        prompt: The user prompt
        system_message: Optional system message
        user_id: User ID for logging

    Returns:
        Tuple of (is_allowed, estimated_tokens)

    Raises:
        TokenLimitExceededError: If request exceeds hard limit
    """
    soft_limit, hard_limit, _ = get_token_limits()

    # Estimate total input tokens
    estimated_tokens = estimate_token_count(prompt)
    if system_message:
        estimated_tokens += estimate_token_count(system_message)

    # Check hard limit - block request entirely
    if estimated_tokens > hard_limit:
        StructuredLogger.log_service_operation(
            service_name='AIProvider',
            operation='token_limit_exceeded',
            success=False,
            metadata={
                'estimated_tokens': estimated_tokens,
                'hard_limit': hard_limit,
                'user_id': user_id,
            },
            logger_instance=logger,
        )
        raise TokenLimitExceededError(
            estimated_tokens=estimated_tokens,
            limit=hard_limit,
            message=(
                f'Request too large: approximately {estimated_tokens:,} tokens exceeds '
                f'the {hard_limit:,} token limit. '
                f'Please shorten your message or break it into smaller parts.'
            ),
        )

    # Check soft limit - warn but allow (for beta)
    if estimated_tokens > soft_limit:
        logger.warning(
            f'Request approaching token limit: {estimated_tokens} tokens (soft limit: {soft_limit})',
            extra={
                'estimated_tokens': estimated_tokens,
                'soft_limit': soft_limit,
                'user_id': user_id,
            },
        )

    return True, estimated_tokens


# Nano Banana system prompt for image generation
NANO_BANANA_SYSTEM_PROMPT = """You are Nano Banana, an image generation assistant.
IMPORTANT: Always generate and return an actual image in your response.
If the user's request is vague, ask a brief clarifying question BUT ALSO generate a sample
image to show what you can do.
Never just describe what you would create - always include an actual generated image."""


class AIProviderType(Enum):
    """Supported AI provider types."""

    OPENAI = 'openai'
    AZURE = 'azure'
    ANTHROPIC = 'anthropic'
    GEMINI = 'gemini'


# Valid purpose types for model selection
# - default: General purpose (gpt-4o-mini)
# - reasoning: Complex reasoning tasks (gpt-5-mini)
# - image: Image generation (gemini-2.0-flash)
# - vision: Image analysis/understanding
# - tagging: Bulk content tagging (cheap model for high volume)
# - tagging_premium: High-quality tagging for important content
# - avatar: Fast avatar generation (uses gemini-2.5-flash-image)
VALID_PURPOSES = ('default', 'reasoning', 'image', 'avatar', 'vision', 'tagging', 'tagging_premium')


def get_model_for_purpose(provider: str, purpose: str = 'default') -> str:
    """Get the configured model for a given provider and purpose.

    Args:
        provider: Provider type (openai, anthropic, gemini)
        purpose: Purpose type (default, reasoning, image, vision)

    Returns:
        Model name from settings.AI_MODELS
    """
    # Validate purpose
    if purpose not in VALID_PURPOSES:
        logger.warning(f'Invalid AI purpose "{purpose}", falling back to "default". Valid: {VALID_PURPOSES}')
        purpose = 'default'

    ai_models = getattr(settings, 'AI_MODELS', {})
    provider_models = ai_models.get(provider, {})

    # Try to get the specific purpose model, fall back to default
    model = provider_models.get(purpose) or provider_models.get('default')

    if not model:
        # Ultimate fallbacks if settings not configured
        fallbacks = {
            'openai': 'gpt-4o-mini',
            'azure': 'gpt-4.1',
            'anthropic': 'claude-3-5-haiku-20241022',
            'gemini': 'gemini-2.0-flash',
        }
        model = fallbacks.get(provider, 'gpt-4o-mini')
        logger.warning(f'No model configured for {provider}/{purpose}, using fallback: {model}')

    return model


def is_reasoning_model(model_name: str) -> bool:
    """Check if a model is a reasoning model that doesn't support temperature.

    Reasoning models (o1, o3, gpt-5) use internal chain-of-thought and don't
    support temperature, top_p, or other sampling parameters.
    """
    reasoning_prefixes = ('o1', 'o3', 'gpt-5')
    return any(model_name.startswith(prefix) for prefix in reasoning_prefixes)


def _convert_url_for_docker(url: str) -> str:
    """
    Convert localhost URLs to Docker-internal hostnames when running inside Docker.

    MinIO URLs stored as localhost:9000 won't work from inside containers.
    This converts them to use the Docker service name (minio:9000).
    """
    import os

    # Check if we're running inside Docker (this file exists in Docker containers)
    if os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER'):
        # Convert localhost MinIO URLs to use Docker service name
        if 'localhost:9000' in url:
            return url.replace('localhost:9000', 'minio:9000')
        if '127.0.0.1:9000' in url:
            return url.replace('127.0.0.1:9000', 'minio:9000')
    return url


def _is_s3_url(url: str) -> bool:
    """Check if URL is an AWS S3 URL that needs IAM authentication."""
    return 's3.amazonaws.com' in url or 's3.us-east-1.amazonaws.com' in url


def _fetch_s3_image(url: str) -> tuple[bytes, str]:
    """
    Fetch image from S3 using IAM credentials.

    Args:
        url: S3 URL in format https://s3.region.amazonaws.com/bucket/key

    Returns:
        Tuple of (image_bytes, content_type)
    """
    import re

    from services.integrations.storage.storage_service import get_storage_service

    # Parse S3 URL to extract bucket and key
    # Format: https://s3.us-east-1.amazonaws.com/bucket-name/path/to/object.png
    match = re.match(r'https?://s3[.\w-]*\.amazonaws\.com/([^/]+)/(.+)', url)
    if not match:
        raise ValueError(f'Invalid S3 URL format: {url}')

    bucket_name = match.group(1)
    object_key = match.group(2)

    # Get storage service and fetch object
    storage = get_storage_service()

    # Use the minio client to get object directly
    try:
        response = storage.client.get_object(bucket_name, object_key)
        image_data = response.read()
        content_type = response.headers.get('Content-Type', 'image/png')
        response.close()
        response.release_conn()
        return image_data, content_type
    except Exception as e:
        logger.error(f'Failed to fetch S3 image {url}: {e}')
        raise


class AIProvider:
    """
    Global AI provider class that can switch between OpenAI, Anthropic, and Gemini.

    Usage:
        # Use default provider from settings
        ai = AIProvider()
        response = ai.complete("What is Django?")

        # Specify a provider
        ai = AIProvider(provider="openai")
        response = ai.complete("What is Django?")

        # Switch provider dynamically
        ai.set_provider("anthropic")
        response = ai.complete("What is Django?")
    """

    def __init__(self, provider: str | None = None, user_id: int | None = None, **kwargs):
        """
        Initialize AI provider.

        Args:
            provider: Provider type (openai, anthropic, gemini).
                     Defaults to DEFAULT_AI_PROVIDER from settings.
            user_id: User ID for cost tracking and attribution
            **kwargs: Additional configuration options for the provider.
        """
        self._provider = None
        self._client = None
        self._config = kwargs
        self.user_id = user_id
        self.last_usage = None  # Track last request token usage

        # Set provider (uses default from settings if not specified).
        # If DEFAULT_AI_PROVIDER is not set, fall back to FALLBACK_AI_PROVIDER.
        provider_type = provider or getattr(settings, 'DEFAULT_AI_PROVIDER', settings.FALLBACK_AI_PROVIDER)
        self.set_provider(provider_type)

    def set_provider(self, provider: str) -> None:
        """
        Switch to a different AI provider.

        Args:
            provider: Provider type (openai, anthropic, gemini)
        """
        try:
            provider_enum = AIProviderType(provider.lower())
        except ValueError as e:
            raise ValueError(
                f'Invalid provider: {provider}. Must be one of: {[p.value for p in AIProviderType]}'
            ) from e

        self._provider = provider_enum
        self._client = self._initialize_client()

    def _initialize_client(self):
        """Initialize the appropriate client based on the current provider."""
        if self._provider == AIProviderType.OPENAI:
            return self._initialize_openai_client()
        elif self._provider == AIProviderType.AZURE:
            return self._initialize_azure_client()
        elif self._provider == AIProviderType.ANTHROPIC:
            return self._initialize_anthropic_client()
        elif self._provider == AIProviderType.GEMINI:
            return self._initialize_gemini_client()

    def _initialize_openai_client(self):
        """Initialize OpenAI client.

        Supports using an AI gateway (OpenRouter, etc.) by setting OPENAI_BASE_URL.
        """
        try:
            from openai import OpenAI
        except ImportError as e:
            raise ImportError('OpenAI library not installed. Install with: pip install openai') from e

        api_key = getattr(settings, 'OPENAI_API_KEY', None)
        base_url = getattr(settings, 'OPENAI_BASE_URL', None)

        if not api_key:
            raise ValueError('OpenAI API key not configured. Set OPENAI_API_KEY in settings.')

        # If base_url is set, use it for AI gateway; otherwise use default OpenAI API
        client_kwargs = {'api_key': api_key}
        if base_url:
            client_kwargs['base_url'] = base_url
            logger.info(f'Using AI gateway at: {base_url}')

        return OpenAI(**client_kwargs)

    def _initialize_azure_client(self):
        """Initialize Azure OpenAI client."""
        try:
            from openai import AzureOpenAI
        except ImportError as e:
            raise ImportError('OpenAI library not installed. Install with: pip install openai') from e

        api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', None)
        endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', None)
        api_version = getattr(settings, 'AZURE_OPENAI_API_VERSION', '2025-01-01-preview')

        if not api_key:
            raise ValueError('Azure OpenAI API key not configured. Set AZURE_OPENAI_API_KEY in settings.')
        if not endpoint:
            raise ValueError('Azure OpenAI endpoint not configured. Set AZURE_OPENAI_ENDPOINT in settings.')

        logger.info(f'Using Azure OpenAI at: {endpoint}')
        return AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version,
        )

    def _initialize_anthropic_client(self):
        """Initialize Anthropic client."""
        try:
            from anthropic import Anthropic
        except ImportError as e:
            raise ImportError('Anthropic library not installed. Install with: pip install anthropic') from e

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)

        if not api_key:
            raise ValueError('Anthropic API key not configured. Set ANTHROPIC_API_KEY in settings.')

        return Anthropic(api_key=api_key)

    def _initialize_gemini_client(self):
        """Initialize Google Gemini client."""
        try:
            import google.generativeai as genai
        except ImportError as e:
            raise ImportError(
                'Google Generative AI library not installed. Install with: pip install google-generativeai'
            ) from e

        api_key = getattr(settings, 'GOOGLE_API_KEY', None)

        if not api_key:
            raise ValueError('Google API key not configured. Set GOOGLE_API_KEY in settings.')

        genai.configure(api_key=api_key)
        return genai

    def complete(
        self,
        prompt: str,
        model: str | None = None,
        purpose: str = 'default',
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_message: str | None = None,
        timeout: int | None = None,
        **kwargs,
    ) -> str:
        """
        Generate a completion using the current AI provider.

        Args:
            prompt: The user prompt/message
            model: Model name (provider-specific). If None, uses purpose-based selection.
            purpose: Purpose for model selection ('default', 'reasoning', 'image', 'vision').
                    'default' uses gpt-4o-mini (supports temperature, cost-effective).
                    'reasoning' uses gpt-5-mini (complex tasks, no temperature).
            temperature: Sampling temperature (0-1). Ignored for reasoning models.
            max_tokens: Maximum tokens to generate
            system_message: System message/instructions
            timeout: Request timeout in seconds (default: 60)
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text response

        Raises:
            TokenLimitExceededError: If the request exceeds the hard token limit
            TimeoutError: If the request times out
            Exception: If the API call fails
        """
        timeout = timeout or DEFAULT_AI_TIMEOUT
        start_time = time.time()

        # Check token limits before making API call
        _, estimated_tokens = check_token_limits(prompt, system_message, self.user_id)

        # Resolve model from purpose if not explicitly provided
        if model is None:
            model = get_model_for_purpose(self._provider.value, purpose)

        # Log request start
        logger.debug(
            f'AI completion started: provider={self._provider.value}, model={model}, purpose={purpose}',
            extra={
                'provider': self._provider.value,
                'model': model,
                'purpose': purpose,
                'user_id': self.user_id,
                'prompt_length': len(prompt),
                'has_system_message': bool(system_message),
                'estimated_input_tokens': estimated_tokens,
            },
        )

        try:
            if self._provider in (AIProviderType.OPENAI, AIProviderType.AZURE):
                result = self._complete_openai(
                    prompt, model, temperature, max_tokens, system_message, timeout, **kwargs
                )
            elif self._provider == AIProviderType.ANTHROPIC:
                result = self._complete_anthropic(
                    prompt, model, temperature, max_tokens, system_message, timeout, **kwargs
                )
            elif self._provider == AIProviderType.GEMINI:
                result = self._complete_gemini(
                    prompt, model, temperature, max_tokens, system_message, timeout, **kwargs
                )
            else:
                raise ValueError(f'Unsupported provider: {self._provider}')

            # Calculate duration and log success
            duration_ms = (time.time() - start_time) * 1000

            StructuredLogger.log_api_call(
                service=f'AI:{self._provider.value}',
                endpoint=f'/completions/{model}',
                method='POST',
                status_code=200,
                duration_ms=duration_ms,
                success=True,
                logger_instance=logger,
            )

            # Log token usage if available
            if self.last_usage:
                logger.info(
                    f'AI completion success: provider={self._provider.value}, model={model}, '
                    f'tokens={self.last_usage.get("total_tokens", "N/A")}, duration={duration_ms:.0f}ms',
                    extra={
                        'provider': self._provider.value,
                        'model': model,
                        'purpose': purpose,
                        'user_id': self.user_id,
                        'prompt_tokens': self.last_usage.get('prompt_tokens'),
                        'completion_tokens': self.last_usage.get('completion_tokens'),
                        'total_tokens': self.last_usage.get('total_tokens'),
                        'duration_ms': round(duration_ms, 2),
                        'response_length': len(result) if result else 0,
                    },
                )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            StructuredLogger.log_api_call(
                service=f'AI:{self._provider.value}',
                endpoint=f'/completions/{model}',
                method='POST',
                duration_ms=duration_ms,
                success=False,
                error=e,
                logger_instance=logger,
            )

            StructuredLogger.log_error(
                message=f'AI completion failed: {self._provider.value}/{model}',
                error=e,
                extra={
                    'provider': self._provider.value,
                    'model': model,
                    'purpose': purpose,
                    'user_id': self.user_id,
                    'prompt_length': len(prompt),
                    'duration_ms': round(duration_ms, 2),
                },
                logger_instance=logger,
            )
            raise

    def _complete_openai(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        timeout: int,
        **kwargs,
    ) -> str:
        """OpenAI completion with timeout."""
        # Model is resolved in complete() before being passed here
        model_name = model

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        # Check if this is a reasoning model
        reasoning = is_reasoning_model(model_name)

        # Build request parameters
        request_params = {
            'model': model_name,
            'messages': messages,
            'timeout': timeout,
            **kwargs,
        }

        # Add token limit with the correct parameter name
        # Reasoning models (o1, o3, gpt-5) require max_completion_tokens instead of max_tokens
        if max_tokens is not None:
            if reasoning:
                request_params['max_completion_tokens'] = max_tokens
            else:
                request_params['max_tokens'] = max_tokens

        # Add temperature (reasoning models don't support it)
        if not reasoning:
            request_params['temperature'] = temperature

        response = self._client.chat.completions.create(**request_params)

        # Store token usage for tracking
        usage_data = {}
        if hasattr(response, 'usage') and response.usage:
            usage_data = {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'total_tokens': response.usage.total_tokens,
            }

        # Capture gateway provider info (e.g., OpenRouter returns "openai/gpt-4")
        # The response.model field contains the actual model used by the gateway
        if is_using_ai_gateway() and hasattr(response, 'model') and response.model:
            gateway_provider, actual_model = parse_gateway_model(response.model)
            if gateway_provider:
                usage_data['gateway_provider'] = gateway_provider
                usage_data['gateway_model'] = actual_model
                usage_data['requested_model'] = model_name
                logger.debug(
                    f'Gateway routing detected: requested={model_name}, '
                    f'actual_provider={gateway_provider}, actual_model={actual_model}'
                )

        self.last_usage = usage_data if usage_data else None

        return response.choices[0].message.content

    def _complete_anthropic(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        timeout: int,
        **kwargs,
    ) -> str:
        """Anthropic completion with timeout."""
        # Model is resolved in complete() before being passed here
        model_name = model
        max_tokens = max_tokens or 1024  # Anthropic requires max_tokens

        # Anthropic client uses httpx which accepts timeout via client config
        # Pass timeout through kwargs for the request
        response = self._client.messages.create(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message or '',
            messages=[{'role': 'user', 'content': prompt}],
            timeout=timeout,
            **kwargs,
        )

        # Store token usage for tracking (Anthropic uses different field names)
        if hasattr(response, 'usage'):
            self.last_usage = {
                'prompt_tokens': response.usage.input_tokens,
                'completion_tokens': response.usage.output_tokens,
                'total_tokens': response.usage.input_tokens + response.usage.output_tokens,
            }

        return response.content[0].text

    def _complete_gemini(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        timeout: int,
        **kwargs,
    ) -> str:
        """Google Gemini completion with timeout."""
        # Model is resolved in complete() before being passed here
        model_name = model

        generation_config = {
            'temperature': temperature,
        }
        if max_tokens:
            generation_config['max_output_tokens'] = max_tokens

        # Handle system message if provided
        model_kwargs = {}
        if system_message:
            model_kwargs['system_instruction'] = system_message

        model_instance = self._client.GenerativeModel(model_name=model_name, **model_kwargs)

        # Gemini uses request_options for timeout
        request_options = {'timeout': timeout}
        response = model_instance.generate_content(
            prompt,
            generation_config=generation_config,
            request_options=request_options,
            **kwargs,
        )

        # Store token usage for tracking (Gemini provides usage metadata)
        if hasattr(response, 'usage_metadata'):
            self.last_usage = {
                'prompt_tokens': response.usage_metadata.prompt_token_count,
                'completion_tokens': response.usage_metadata.candidates_token_count,
                'total_tokens': response.usage_metadata.total_token_count,
            }

        return response.text

    def stream_complete(
        self,
        prompt: str,
        model: str | None = None,
        purpose: str = 'default',
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_message: str | None = None,
        **kwargs,
    ):
        """
        Generate a streaming completion using the current AI provider.

        Args:
            prompt: The user prompt/message
            model: Model name (provider-specific). If None, uses purpose-based selection.
            purpose: Purpose for model selection ('default', 'reasoning').
            temperature: Sampling temperature (0-1). Ignored for reasoning models.
            max_tokens: Maximum tokens to generate
            system_message: System message/instructions
            **kwargs: Additional provider-specific parameters

        Yields:
            Text chunks as they are generated

        Raises:
            TokenLimitExceededError: If the request exceeds the hard token limit
        """
        start_time = time.time()

        # Check token limits before making API call
        _, estimated_tokens = check_token_limits(prompt, system_message, self.user_id)

        # Resolve model from purpose if not explicitly provided
        if model is None:
            model = get_model_for_purpose(self._provider.value, purpose)

        logger.debug(
            f'AI stream started: provider={self._provider.value}, model={model}, purpose={purpose}',
            extra={
                'provider': self._provider.value,
                'model': model,
                'purpose': purpose,
                'user_id': self.user_id,
                'prompt_length': len(prompt),
                'streaming': True,
                'estimated_input_tokens': estimated_tokens,
            },
        )

        chunk_count = 0
        total_chars = 0

        try:
            if self._provider in (AIProviderType.OPENAI, AIProviderType.AZURE):
                stream = self._stream_openai(prompt, model, temperature, max_tokens, system_message, **kwargs)
            elif self._provider == AIProviderType.ANTHROPIC:
                stream = self._stream_anthropic(prompt, model, temperature, max_tokens, system_message, **kwargs)
            elif self._provider == AIProviderType.GEMINI:
                stream = self._stream_gemini(prompt, model, temperature, max_tokens, system_message, **kwargs)
            else:
                raise ValueError(f'Unsupported provider: {self._provider}')

            for chunk in stream:
                chunk_count += 1
                total_chars += len(chunk) if chunk else 0
                yield chunk

            # Log success after stream completes
            duration_ms = (time.time() - start_time) * 1000
            logger.info(
                f'AI stream complete: provider={self._provider.value}, model={model}, '
                f'chunks={chunk_count}, chars={total_chars}, duration={duration_ms:.0f}ms',
                extra={
                    'provider': self._provider.value,
                    'model': model,
                    'purpose': purpose,
                    'user_id': self.user_id,
                    'chunk_count': chunk_count,
                    'total_chars': total_chars,
                    'duration_ms': round(duration_ms, 2),
                    'streaming': True,
                },
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_error(
                message=f'AI stream failed: {self._provider.value}/{model}',
                error=e,
                extra={
                    'provider': self._provider.value,
                    'model': model,
                    'purpose': purpose,
                    'user_id': self.user_id,
                    'chunk_count': chunk_count,
                    'duration_ms': round(duration_ms, 2),
                    'streaming': True,
                },
                logger_instance=logger,
            )
            raise

    def _stream_openai(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        **kwargs,
    ):
        """OpenAI streaming completion."""
        # Model is resolved in stream_complete() before being passed here
        model_name = model

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        # Check if this is a reasoning model
        reasoning = is_reasoning_model(model_name)

        # Build request params
        request_params = {
            'model': model_name,
            'messages': messages,
            'stream': True,
            **kwargs,
        }

        # Reasoning models require max_completion_tokens instead of max_tokens
        if max_tokens is not None:
            if reasoning:
                request_params['max_completion_tokens'] = max_tokens
            else:
                request_params['max_tokens'] = max_tokens

        # Reasoning models don't support temperature
        if not reasoning:
            request_params['temperature'] = temperature

        # Request usage stats in final chunk for streaming (OpenAI feature)
        request_params['stream_options'] = {'include_usage': True}

        stream = self._client.chat.completions.create(**request_params)

        gateway_model_captured = False
        for chunk in stream:
            # Capture gateway provider info from first chunk with model field
            # OpenRouter includes provider prefix in model (e.g., "openai/gpt-4")
            if not gateway_model_captured and is_using_ai_gateway():
                if hasattr(chunk, 'model') and chunk.model:
                    gateway_provider, actual_model = parse_gateway_model(chunk.model)
                    if gateway_provider:
                        self.last_usage = self.last_usage or {}
                        self.last_usage['gateway_provider'] = gateway_provider
                        self.last_usage['gateway_model'] = actual_model
                        self.last_usage['requested_model'] = model_name
                        gateway_model_captured = True
                        logger.debug(
                            f'Gateway streaming routing: requested={model_name}, '
                            f'actual_provider={gateway_provider}, actual_model={actual_model}'
                        )

            # Capture usage from final chunk (when stream_options.include_usage=True)
            if hasattr(chunk, 'usage') and chunk.usage:
                self.last_usage = self.last_usage or {}
                self.last_usage.update(
                    {
                        'prompt_tokens': chunk.usage.prompt_tokens,
                        'completion_tokens': chunk.usage.completion_tokens,
                        'total_tokens': chunk.usage.total_tokens,
                    }
                )

            if chunk.choices and len(chunk.choices) > 0:
                if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    def _stream_anthropic(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        **kwargs,
    ):
        """Anthropic streaming completion."""
        # Model is resolved in stream_complete() before being passed here
        model_name = model
        max_tokens = max_tokens or 1024

        with self._client.messages.stream(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message or '',
            messages=[{'role': 'user', 'content': prompt}],
            **kwargs,
        ) as stream:
            yield from stream.text_stream

    def _stream_gemini(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        **kwargs,
    ):
        """Google Gemini streaming completion."""
        model_name = model or getattr(settings, 'GEMINI_MODEL_NAME', 'gemini-1.5-flash')

        generation_config = {
            'temperature': temperature,
        }
        if max_tokens:
            generation_config['max_output_tokens'] = max_tokens

        # Handle system message if provided
        model_kwargs = {}
        if system_message:
            model_kwargs['system_instruction'] = system_message

        model_instance = self._client.GenerativeModel(model_name=model_name, **model_kwargs)

        response = model_instance.generate_content(prompt, generation_config=generation_config, stream=True, **kwargs)

        for chunk in response:
            if chunk.text:
                yield chunk.text

        # Capture usage metadata after streaming completes
        # Gemini provides usage_metadata on the response object after all chunks are consumed
        try:
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = response.usage_metadata
                self.last_usage = {
                    'prompt_tokens': getattr(usage, 'prompt_token_count', 0),
                    'completion_tokens': getattr(usage, 'candidates_token_count', 0),
                    'total_tokens': getattr(usage, 'total_token_count', 0),
                }
                logger.debug(f'Gemini streaming usage: {self.last_usage}')
        except Exception as e:
            logger.debug(f'Could not capture Gemini streaming usage: {e}')

    @property
    def current_provider(self) -> str:
        """Get the current provider name."""
        return self._provider.value if self._provider else None

    @property
    def current_model(self) -> str:
        """Get the default model name for the current provider."""
        return get_model_for_purpose(self._provider.value, 'default')

    @property
    def client(self):
        """Get the underlying client for advanced usage."""
        return self._client

    def get_langchain_llm(self, temperature: float = 0.7, **kwargs):
        """
        Get a LangChain-compatible LLM instance for use with LangGraph agents.

        This provides a consistent way to get LLMs for agent workflows while
        respecting the centralized AI provider configuration.

        Args:
            temperature: Sampling temperature (0-1)
            **kwargs: Additional LLM configuration options

        Returns:
            LangChain BaseChatModel instance (ChatOpenAI, ChatAnthropic, or ChatGoogleGenerativeAI)
        """
        if self._provider == AIProviderType.OPENAI:
            from langchain_openai import ChatOpenAI

            # Support AI gateway via OPENAI_BASE_URL
            openai_kwargs = {
                'model': kwargs.pop('model', getattr(settings, 'DEFAULT_OPENAI_MODEL', 'gpt-5-mini-2025-08-07')),
                'api_key': getattr(settings, 'OPENAI_API_KEY', ''),
                'temperature': temperature,
                **kwargs,
            }
            base_url = getattr(settings, 'OPENAI_BASE_URL', '')
            if base_url:
                openai_kwargs['base_url'] = base_url

            return ChatOpenAI(**openai_kwargs)

        elif self._provider == AIProviderType.AZURE:
            from langchain_openai import AzureChatOpenAI

            return AzureChatOpenAI(
                azure_deployment=kwargs.pop('model', getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4.1')),
                api_key=getattr(settings, 'AZURE_OPENAI_API_KEY', ''),
                azure_endpoint=getattr(settings, 'AZURE_OPENAI_ENDPOINT', ''),
                api_version=getattr(settings, 'AZURE_OPENAI_API_VERSION', '2025-01-01-preview'),
                temperature=temperature,
                **kwargs,
            )

        elif self._provider == AIProviderType.ANTHROPIC:
            from langchain_anthropic import ChatAnthropic

            return ChatAnthropic(
                model=kwargs.pop('model', 'claude-3-5-sonnet-20241022'),
                api_key=getattr(settings, 'ANTHROPIC_API_KEY', ''),
                temperature=temperature,
                **kwargs,
            )

        elif self._provider == AIProviderType.GEMINI:
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                model=kwargs.pop('model', getattr(settings, 'GEMINI_MODEL_NAME', 'gemini-1.5-flash')),
                google_api_key=getattr(settings, 'GOOGLE_API_KEY', ''),
                temperature=temperature,
                **kwargs,
            )

    def generate_image(
        self,
        prompt: str,
        conversation_history: list[dict] | None = None,
        reference_images: list[bytes] | None = None,
        model: str | None = None,
        purpose: str = 'image',
        timeout: int = 120,  # Increased timeout for slow Gemini API
    ) -> tuple[bytes | None, str | None, str | None]:
        """
        Generate an image using Gemini native image generation.

        This method uses Gemini's native image generation capabilities to create
        images from text prompts. It supports multi-turn conversations for
        iterative refinement and reference images for style guidance.

        Args:
            prompt: Current user prompt describing the desired image
            conversation_history: Previous turns for multi-turn refinement.
                                 Each turn should have 'role' ('user'/'model')
                                 and 'parts' (list with text/image content)
            reference_images: List of reference image bytes for this turn
            model: Model override (default based on purpose)
            purpose: 'image' for high quality, 'avatar' for fast generation
            timeout: Request timeout in seconds (default: 60)

        Returns:
            Tuple of (image_bytes, mime_type, text_response) or (None, None, None) on error

        Raises:
            ValueError: If Gemini is not configured properly
            Exception: If image generation fails

        Example:
            ai = AIProvider(provider='gemini')
            image_bytes, mime_type, text = ai.generate_image(
                "Create an infographic about Python programming"
            )
            if image_bytes:
                with open('output.png', 'wb') as f:
                    f.write(image_bytes)
        """
        start_time = time.time()

        try:
            from google import genai
            from google.genai import types
        except ImportError as e:
            raise ImportError('Google GenAI library not installed. Install with: pip install google-genai') from e

        api_key = getattr(settings, 'GOOGLE_API_KEY', None)
        if not api_key:
            raise ValueError('Google API key not configured. Set GOOGLE_API_KEY in settings.')

        # Use the configured model based on purpose (avatar uses faster flash model)
        model_name = model or get_model_for_purpose('gemini', purpose)

        logger.info(
            f'AI image generation started: model={model_name}, purpose={purpose}',
            extra={
                'provider': 'gemini',
                'model': model_name,
                'purpose': purpose,
                'user_id': self.user_id,
                'prompt_length': len(prompt),
                'has_reference_images': bool(reference_images),
                'reference_image_count': len(reference_images) if reference_images else 0,
                'history_length': len(conversation_history) if conversation_history else 0,
            },
        )

        try:
            # Create client with API key and timeout
            # Configure HTTP timeout to prevent hanging on slow Gemini responses
            # Note: http_options.timeout is in MILLISECONDS, not seconds
            client = genai.Client(
                api_key=api_key,
                http_options={'timeout': timeout * 1000},  # Convert seconds to milliseconds
            )

            # Build content parts for the request
            contents = []

            # Add system instruction as first user message
            contents.append(
                types.Content(
                    role='user',
                    parts=[types.Part.from_text(text=NANO_BANANA_SYSTEM_PROMPT + '\n\n' + prompt)],
                )
            )

            # Add reference images if provided
            if reference_images:
                image_parts = []
                for img_bytes in reference_images:
                    image_parts.append(types.Part.from_bytes(data=img_bytes, mime_type='image/png'))
                image_parts.append(types.Part.from_text(text='Please use these reference images for style guidance.'))
                contents.append(types.Content(role='user', parts=image_parts))

            # Detect if user wants infographic (always vertical) or regular image
            is_infographic = any(
                keyword in prompt.lower()
                for keyword in ['infographic', 'infograph', 'vertical', 'portrait', 'story', 'poster']
            )

            # Build generation config with appropriate aspect ratio
            # Infographics should ALWAYS be vertical (9:16)
            # Regular images can be landscape (16:9) for better composition
            aspect_ratio = '9:16' if is_infographic else '16:9'

            try:
                gen_config = types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                    image_generation_config=types.ImageGenerationConfig(
                        aspect_ratio=aspect_ratio,
                        number_of_images=1,
                    ),
                )
                orientation = 'vertical' if is_infographic else 'horizontal'
                logger.info(
                    f'Using {aspect_ratio} ({orientation}) aspect ratio for {model_name} '
                    f'(is_infographic={is_infographic})'
                )
            except (TypeError, AttributeError) as e:
                # Fallback if ImageGenerationConfig not available in SDK version
                logger.warning(f'ImageGenerationConfig not available: {e}, using default config')
                gen_config = types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                )

            # Generate with image output enabled
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=gen_config,
            )

            # Extract image and text from response
            image_bytes = None
            mime_type = None
            text_response = None

            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if part.inline_data:
                        if part.inline_data.mime_type and part.inline_data.mime_type.startswith('image/'):
                            image_bytes = part.inline_data.data
                            mime_type = part.inline_data.mime_type
                    elif part.text:
                        text_response = part.text

            duration_ms = (time.time() - start_time) * 1000

            if image_bytes:
                StructuredLogger.log_api_call(
                    service='AI:gemini',
                    endpoint=f'/image-generation/{model_name}',
                    method='POST',
                    status_code=200,
                    duration_ms=duration_ms,
                    success=True,
                    logger_instance=logger,
                )
                logger.info(
                    f'AI image generation success: model={model_name}, '
                    f'size={len(image_bytes)} bytes, duration={duration_ms:.0f}ms',
                    extra={
                        'provider': 'gemini',
                        'model': model_name,
                        'purpose': 'image',
                        'user_id': self.user_id,
                        'image_size_bytes': len(image_bytes),
                        'mime_type': mime_type,
                        'duration_ms': round(duration_ms, 2),
                        'has_text_response': bool(text_response),
                    },
                )
            else:
                logger.warning(
                    f'AI image generation returned no image: model={model_name}, duration={duration_ms:.0f}ms',
                    extra={
                        'provider': 'gemini',
                        'model': model_name,
                        'purpose': 'image',
                        'user_id': self.user_id,
                        'duration_ms': round(duration_ms, 2),
                        'text_response_preview': text_response[:100] if text_response else None,
                    },
                )

            return image_bytes, mime_type, text_response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            StructuredLogger.log_api_call(
                service='AI:gemini',
                endpoint=f'/image-generation/{model_name}',
                method='POST',
                duration_ms=duration_ms,
                success=False,
                error=e,
                logger_instance=logger,
            )

            StructuredLogger.log_error(
                message=f'AI image generation failed: gemini/{model_name}',
                error=e,
                extra={
                    'provider': 'gemini',
                    'model': model_name,
                    'purpose': 'image',
                    'user_id': self.user_id,
                    'prompt_length': len(prompt),
                    'duration_ms': round(duration_ms, 2),
                },
                logger_instance=logger,
            )
            raise

    def generate_image_openai(
        self,
        prompt: str,
        model: str = 'gpt-image-1',
        size: str = '1024x1024',
        quality: str = 'medium',
        timeout: int = 60,
    ) -> tuple[bytes | None, str | None]:
        """
        Generate an image using OpenAI's gpt-image-1 model.

        This is faster and more reliable than Gemini for avatar generation.

        Args:
            prompt: Text description of the image to generate
            model: Model name (gpt-image-1, gpt-image-1.5, dall-e-3)
            size: Image size (1024x1024, 1536x1024, 1024x1536)
            quality: Quality level (low, medium, high)
            timeout: Request timeout in seconds

        Returns:
            Tuple of (image_bytes, mime_type) or (None, None) on error
        """
        import base64

        import httpx

        start_time = time.time()

        logger.info(
            f'OpenAI image generation started: model={model}',
            extra={
                'provider': 'openai',
                'model': model,
                'purpose': 'avatar',
                'user_id': self.user_id,
                'prompt_length': len(prompt),
                'size': size,
                'quality': quality,
            },
        )

        try:
            # Use OpenAI client for image generation
            client = self._initialize_openai_client()

            # gpt-image-1 and gpt-image-1.5 don't support response_format parameter
            # They only return URLs. DALL-E 3 supports b64_json.
            if model.startswith('gpt-image'):
                response = client.images.generate(
                    model=model,
                    prompt=prompt,
                    size=size,
                    quality=quality,
                    n=1,
                )
            else:
                # DALL-E 3 and older models support b64_json
                response = client.images.generate(
                    model=model,
                    prompt=prompt,
                    size=size,
                    quality=quality,
                    n=1,
                    response_format='b64_json',
                )

            duration_ms = (time.time() - start_time) * 1000

            if response.data and len(response.data) > 0:
                image_data = response.data[0]

                # Check for b64_json first (DALL-E 3)
                if hasattr(image_data, 'b64_json') and image_data.b64_json:
                    image_bytes = base64.b64decode(image_data.b64_json)
                    logger.info(
                        f'OpenAI image generation completed in {duration_ms:.0f}ms (b64_json)',
                        extra={
                            'provider': 'openai',
                            'model': model,
                            'duration_ms': duration_ms,
                            'image_size_bytes': len(image_bytes),
                        },
                    )
                    return image_bytes, 'image/png'

                # For gpt-image-1.x models, download from URL
                if hasattr(image_data, 'url') and image_data.url:
                    logger.info(f'Downloading image from OpenAI URL: {image_data.url[:100]}...')
                    img_response = httpx.get(image_data.url, timeout=30)
                    if img_response.status_code == 200:
                        image_bytes = img_response.content
                        logger.info(
                            f'OpenAI image generation completed in {duration_ms:.0f}ms (url download)',
                            extra={
                                'provider': 'openai',
                                'model': model,
                                'duration_ms': duration_ms,
                                'image_size_bytes': len(image_bytes),
                            },
                        )
                        return image_bytes, 'image/png'
                    else:
                        logger.error(f'Failed to download image from URL: HTTP {img_response.status_code}')
                        return None, None

            logger.warning('OpenAI image generation returned no image data')
            return None, None

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                f'OpenAI image generation failed: {e}',
                extra={
                    'provider': 'openai',
                    'model': model,
                    'purpose': 'avatar',
                    'user_id': self.user_id,
                    'duration_ms': duration_ms,
                    'error': str(e),
                },
                exc_info=True,
            )
            raise

    def complete_with_image(
        self,
        prompt: str,
        image_url: str | None = None,
        image_bytes: bytes | None = None,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: int = 60,
    ) -> str:
        """
        Generate a completion using an image as input (vision model).

        Args:
            prompt: The text prompt to send with the image
            image_url: URL of the image to analyze (optional if image_bytes provided)
            image_bytes: Raw bytes of the image (optional if image_url provided)
            model: Model name (defaults to vision-capable model for provider)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in seconds

        Returns:
            Generated text response

        Raises:
            ValueError: If neither image_url nor image_bytes provided
            Exception: If the API call fails
        """
        if not image_url and not image_bytes:
            raise ValueError('Either image_url or image_bytes must be provided')

        start_time = time.time()
        resolved_model = model or get_model_for_purpose(self._provider.value, 'vision')

        logger.debug(
            f'AI vision completion started: provider={self._provider.value}, model={resolved_model}',
            extra={
                'provider': self._provider.value,
                'model': resolved_model,
                'purpose': 'vision',
                'user_id': self.user_id,
                'prompt_length': len(prompt),
                'has_image_url': bool(image_url),
                'has_image_bytes': bool(image_bytes),
                'image_bytes_size': len(image_bytes) if image_bytes else 0,
            },
        )

        try:
            if self._provider == AIProviderType.GEMINI:
                result = self._complete_with_image_gemini(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            elif self._provider in (AIProviderType.OPENAI, AIProviderType.AZURE):
                result = self._complete_with_image_openai(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            elif self._provider == AIProviderType.ANTHROPIC:
                result = self._complete_with_image_anthropic(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            else:
                raise ValueError(f'Vision not supported for provider: {self._provider}')

            duration_ms = (time.time() - start_time) * 1000

            StructuredLogger.log_api_call(
                service=f'AI:{self._provider.value}',
                endpoint=f'/vision/{resolved_model}',
                method='POST',
                status_code=200,
                duration_ms=duration_ms,
                success=True,
                logger_instance=logger,
            )

            logger.info(
                f'AI vision completion success: provider={self._provider.value}, model={resolved_model}, '
                f'duration={duration_ms:.0f}ms',
                extra={
                    'provider': self._provider.value,
                    'model': resolved_model,
                    'purpose': 'vision',
                    'user_id': self.user_id,
                    'duration_ms': round(duration_ms, 2),
                    'response_length': len(result) if result else 0,
                    'prompt_tokens': self.last_usage.get('prompt_tokens') if self.last_usage else None,
                    'completion_tokens': self.last_usage.get('completion_tokens') if self.last_usage else None,
                },
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            StructuredLogger.log_api_call(
                service=f'AI:{self._provider.value}',
                endpoint=f'/vision/{resolved_model}',
                method='POST',
                duration_ms=duration_ms,
                success=False,
                error=e,
                logger_instance=logger,
            )

            StructuredLogger.log_error(
                message=f'AI vision completion failed: {self._provider.value}/{resolved_model}',
                error=e,
                extra={
                    'provider': self._provider.value,
                    'model': resolved_model,
                    'purpose': 'vision',
                    'user_id': self.user_id,
                    'prompt_length': len(prompt),
                    'duration_ms': round(duration_ms, 2),
                },
                logger_instance=logger,
            )
            raise

    def _complete_with_image_gemini(
        self,
        prompt: str,
        image_url: str | None,
        image_bytes: bytes | None,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        timeout: int,
    ) -> str:
        """Gemini vision completion."""
        import httpx

        # Use the configured vision model from AI_MODELS
        model_name = model or get_model_for_purpose('gemini', 'vision')

        generation_config = {'temperature': temperature}
        if max_tokens:
            generation_config['max_output_tokens'] = max_tokens

        model_instance = self._client.GenerativeModel(model_name=model_name)

        # Build content parts
        parts = []

        # Add image
        if image_bytes:
            parts.append({'mime_type': 'image/png', 'data': image_bytes})
        elif image_url:
            # Check if this is an S3 URL that needs IAM authentication
            if _is_s3_url(image_url):
                # Use storage service to fetch image with IAM credentials
                image_data, content_type = _fetch_s3_image(image_url)
                parts.append({'mime_type': content_type, 'data': image_data})
            else:
                # Fetch image from URL (convert localhost to Docker hostname if needed)
                fetch_url = _convert_url_for_docker(image_url)
                response = httpx.get(fetch_url, timeout=30)
                response.raise_for_status()
                content_type = response.headers.get('content-type', 'image/png')
                parts.append({'mime_type': content_type, 'data': response.content})

        # Add text prompt
        parts.append(prompt)

        request_options = {'timeout': timeout}
        response = model_instance.generate_content(
            parts,
            generation_config=generation_config,
            request_options=request_options,
        )

        # Store token usage
        if hasattr(response, 'usage_metadata'):
            self.last_usage = {
                'prompt_tokens': response.usage_metadata.prompt_token_count,
                'completion_tokens': response.usage_metadata.candidates_token_count,
                'total_tokens': response.usage_metadata.total_token_count,
            }

        return response.text

    def _complete_with_image_openai(
        self,
        prompt: str,
        image_url: str | None,
        image_bytes: bytes | None,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        timeout: int,
    ) -> str:
        """OpenAI vision completion."""
        import base64

        model_name = model or 'gpt-4o'

        # Build image content
        if image_bytes:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            image_content = {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{base64_image}'}}
        else:
            image_content = {'type': 'image_url', 'image_url': {'url': image_url}}

        messages = [
            {
                'role': 'user',
                'content': [
                    image_content,
                    {'type': 'text', 'text': prompt},
                ],
            }
        ]

        response = self._client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )

        if hasattr(response, 'usage'):
            self.last_usage = {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'total_tokens': response.usage.total_tokens,
            }

        return response.choices[0].message.content

    def _complete_with_image_anthropic(
        self,
        prompt: str,
        image_url: str | None,
        image_bytes: bytes | None,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        timeout: int,
    ) -> str:
        """Anthropic Claude vision completion."""
        import base64

        import httpx

        model_name = model or 'claude-3-5-sonnet-20241022'
        max_tokens = max_tokens or 1024

        # Get image data
        if image_bytes:
            image_data = base64.b64encode(image_bytes).decode('utf-8')
            media_type = 'image/png'
        else:
            # Fetch image from URL
            response = httpx.get(image_url, timeout=30)
            response.raise_for_status()
            image_data = base64.b64encode(response.content).decode('utf-8')
            media_type = response.headers.get('content-type', 'image/png')

        messages = [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {
                            'type': 'base64',
                            'media_type': media_type,
                            'data': image_data,
                        },
                    },
                    {'type': 'text', 'text': prompt},
                ],
            }
        ]

        response = self._client.messages.create(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
            timeout=timeout,
        )

        if hasattr(response, 'usage'):
            self.last_usage = {
                'prompt_tokens': response.usage.input_tokens,
                'completion_tokens': response.usage.output_tokens,
                'total_tokens': response.usage.input_tokens + response.usage.output_tokens,
            }

        return response.content[0].text
