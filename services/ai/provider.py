"""
AI Provider Service
Supports Azure OpenAI, OpenAI, and Anthropic with easy switching between providers.
Includes LangSmith tracing and cost tracking.
"""

import logging
from enum import Enum

from django.conf import settings
from langsmith.run_helpers import traceable

logger = logging.getLogger(__name__)

# Default timeout for AI API calls (in seconds)
DEFAULT_AI_TIMEOUT = 60

# Nano Banana system prompt for image generation
NANO_BANANA_SYSTEM_PROMPT = """You are Nano Banana, an image generation assistant.
IMPORTANT: Always generate and return an actual image in your response.
If the user's request is vague, ask a brief clarifying question BUT ALSO generate a sample
image to show what you can do.
Never just describe what you would create - always include an actual generated image."""


class AIProviderType(Enum):
    """Supported AI provider types."""

    AZURE = 'azure'
    OPENAI = 'openai'
    ANTHROPIC = 'anthropic'
    GEMINI = 'gemini'


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


class AIProvider:
    """
    Global AI provider class that can switch between Azure OpenAI, OpenAI, and Anthropic.

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
            provider: Provider type (azure, openai, anthropic).
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
            provider: Provider type (azure, openai, anthropic)
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
        if self._provider == AIProviderType.AZURE:
            return self._initialize_azure_client()
        elif self._provider == AIProviderType.OPENAI:
            return self._initialize_openai_client()
        elif self._provider == AIProviderType.ANTHROPIC:
            return self._initialize_anthropic_client()
        elif self._provider == AIProviderType.GEMINI:
            return self._initialize_gemini_client()

    def _initialize_azure_client(self):
        """Initialize Azure OpenAI client."""
        try:
            from openai import AzureOpenAI
        except ImportError as e:
            raise ImportError('OpenAI library not installed. Install with: pip install openai') from e

        api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', None)
        endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', None)
        api_version = getattr(settings, 'AZURE_OPENAI_API_VERSION', '2024-02-15-preview')

        if not api_key or not endpoint:
            raise ValueError(
                'Azure OpenAI credentials not configured. '
                'Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in settings.'
            )

        return AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version,
        )

    def _initialize_openai_client(self):
        """Initialize OpenAI client."""
        try:
            from openai import OpenAI
        except ImportError as e:
            raise ImportError('OpenAI library not installed. Install with: pip install openai') from e

        api_key = getattr(settings, 'OPENAI_API_KEY', None)

        if not api_key:
            raise ValueError('OpenAI API key not configured. Set OPENAI_API_KEY in settings.')

        return OpenAI(api_key=api_key)

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

    @traceable(name='ai_provider_complete', run_type='llm')
    def complete(
        self,
        prompt: str,
        model: str | None = None,
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
            model: Model name (provider-specific). If None, uses default for provider.
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            system_message: System message/instructions
            timeout: Request timeout in seconds (default: 60)
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text response

        Raises:
            TimeoutError: If the request times out
            Exception: If the API call fails
        """
        timeout = timeout or DEFAULT_AI_TIMEOUT

        try:
            if self._provider == AIProviderType.AZURE:
                return self._complete_azure(prompt, model, temperature, max_tokens, system_message, timeout, **kwargs)
            elif self._provider == AIProviderType.OPENAI:
                return self._complete_openai(prompt, model, temperature, max_tokens, system_message, timeout, **kwargs)
            elif self._provider == AIProviderType.ANTHROPIC:
                return self._complete_anthropic(
                    prompt, model, temperature, max_tokens, system_message, timeout, **kwargs
                )
            elif self._provider == AIProviderType.GEMINI:
                return self._complete_gemini(prompt, model, temperature, max_tokens, system_message, timeout, **kwargs)
        except Exception as e:
            logger.error(
                f'{self._provider.value} completion failed: {e}',
                extra={
                    'provider': self._provider.value,
                    'model': model or self.current_model,
                    'user_id': self.user_id,
                    'error_type': type(e).__name__,
                },
                exc_info=True,
            )
            raise

    def _complete_azure(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        timeout: int,
        **kwargs,
    ) -> str:
        """Azure OpenAI completion with timeout."""
        deployment_name = model or getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4')

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        response = self._client.chat.completions.create(
            model=deployment_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            **kwargs,
        )

        # Store token usage for tracking
        if hasattr(response, 'usage'):
            self.last_usage = {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'total_tokens': response.usage.total_tokens,
            }

        return response.choices[0].message.content

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
        model_name = model or getattr(settings, 'DEFAULT_OPENAI_MODEL', 'gpt-5-mini-2025-08-07')

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        response = self._client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            **kwargs,
        )

        # Store token usage for tracking
        if hasattr(response, 'usage'):
            self.last_usage = {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'total_tokens': response.usage.total_tokens,
            }

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
        model_name = model or 'claude-3-5-sonnet-20241022'
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
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_message: str | None = None,
        **kwargs,
    ):
        """
        Generate a streaming completion using the current AI provider.

        Args:
            prompt: The user prompt/message
            model: Model name (provider-specific)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            system_message: System message/instructions
            **kwargs: Additional provider-specific parameters

        Yields:
            Text chunks as they are generated
        """
        if self._provider == AIProviderType.AZURE:
            yield from self._stream_azure(prompt, model, temperature, max_tokens, system_message, **kwargs)
        elif self._provider == AIProviderType.OPENAI:
            yield from self._stream_openai(prompt, model, temperature, max_tokens, system_message, **kwargs)
        elif self._provider == AIProviderType.ANTHROPIC:
            yield from self._stream_anthropic(prompt, model, temperature, max_tokens, system_message, **kwargs)
        elif self._provider == AIProviderType.GEMINI:
            yield from self._stream_gemini(prompt, model, temperature, max_tokens, system_message, **kwargs)

    def _stream_azure(
        self,
        prompt: str,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        system_message: str | None,
        **kwargs,
    ):
        """Azure OpenAI streaming completion."""
        deployment_name = model or getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4')

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        stream = self._client.chat.completions.create(
            model=deployment_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )

        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

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
        model_name = model or getattr(settings, 'DEFAULT_OPENAI_MODEL', 'gpt-5-mini-2025-08-07')

        messages = []
        if system_message:
            messages.append({'role': 'system', 'content': system_message})
        messages.append({'role': 'user', 'content': prompt})

        stream = self._client.chat.completions.create(
            model=model_name, messages=messages, temperature=temperature, max_tokens=max_tokens, stream=True, **kwargs
        )

        for chunk in stream:
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
        model_name = model or 'claude-3-5-sonnet-20241022'
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

    @property
    def current_provider(self) -> str:
        """Get the current provider name."""
        return self._provider.value if self._provider else None

    @property
    def current_model(self) -> str:
        """Get the default model name for the current provider."""
        if self._provider == AIProviderType.AZURE:
            return getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4')
        elif self._provider == AIProviderType.OPENAI:
            return getattr(settings, 'DEFAULT_OPENAI_MODEL', 'gpt-5-mini-2025-08-07')
        elif self._provider == AIProviderType.ANTHROPIC:
            return 'claude-3-5-sonnet-20241022'
        elif self._provider == AIProviderType.GEMINI:
            return getattr(settings, 'GEMINI_MODEL_NAME', 'gemini-1.5-flash')
        return 'unknown'

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
            LangChain BaseChatModel instance (AzureChatOpenAI, ChatOpenAI, or ChatAnthropic)
        """
        if self._provider == AIProviderType.AZURE:
            from langchain_openai import AzureChatOpenAI

            return AzureChatOpenAI(
                azure_deployment=getattr(settings, 'AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4'),
                azure_endpoint=getattr(settings, 'AZURE_OPENAI_ENDPOINT', ''),
                api_key=getattr(settings, 'AZURE_OPENAI_API_KEY', ''),
                api_version=getattr(settings, 'AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
                temperature=temperature,
                streaming=True,  # Enable streaming for astream_events
                **kwargs,
            )

        elif self._provider == AIProviderType.OPENAI:
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                model=kwargs.pop('model', getattr(settings, 'DEFAULT_OPENAI_MODEL', 'gpt-5-mini-2025-08-07')),
                api_key=getattr(settings, 'OPENAI_API_KEY', ''),
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

    @traceable(name='ai_provider_generate_image', run_type='llm')
    def generate_image(
        self,
        prompt: str,
        conversation_history: list[dict] | None = None,
        reference_images: list[bytes] | None = None,
        model: str | None = None,
        timeout: int = 120,
    ) -> tuple[bytes | None, str | None, str | None]:
        """
        Generate an image using Gemini 2.0 Flash native image generation.

        This method uses Gemini's native image generation capabilities to create
        images from text prompts. It supports multi-turn conversations for
        iterative refinement and reference images for style guidance.

        Args:
            prompt: Current user prompt describing the desired image
            conversation_history: Previous turns for multi-turn refinement.
                                 Each turn should have 'role' ('user'/'model')
                                 and 'parts' (list with text/image content)
            reference_images: List of reference image bytes for this turn
            model: Model override (default: settings.GEMINI_IMAGE_MODEL)
            timeout: Request timeout in seconds (default: 120)

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
        try:
            from google import genai
            from google.genai import types
        except ImportError as e:
            raise ImportError('Google GenAI library not installed. Install with: pip install google-genai') from e

        api_key = getattr(settings, 'GOOGLE_API_KEY', None)
        if not api_key:
            raise ValueError('Google API key not configured. Set GOOGLE_API_KEY in settings.')

        # Use the image generation model - gemini-3-pro-image-preview for best quality
        model_name = model or getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-3-pro-image-preview')

        logger.info(
            'Generating image with Gemini',
            extra={
                'model': model_name,
                'user_id': self.user_id,
                'has_reference_images': bool(reference_images),
                'history_length': len(conversation_history) if conversation_history else 0,
            },
        )

        try:
            # Create client with API key
            client = genai.Client(api_key=api_key)

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

            if image_bytes:
                logger.info(
                    'Image generated successfully',
                    extra={
                        'model': model_name,
                        'user_id': self.user_id,
                        'image_size': len(image_bytes),
                        'mime_type': mime_type,
                    },
                )
            else:
                logger.warning(
                    'No image in response',
                    extra={
                        'model': model_name,
                        'user_id': self.user_id,
                        'text_response': text_response[:100] if text_response else None,
                    },
                )

            return image_bytes, mime_type, text_response

        except Exception as e:
            logger.error(
                f'Image generation failed: {e}',
                extra={
                    'model': model_name,
                    'user_id': self.user_id,
                    'error_type': type(e).__name__,
                },
                exc_info=True,
            )
            raise

    @traceable(name='ai_provider_complete_with_image', run_type='llm')
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

        try:
            if self._provider == AIProviderType.GEMINI:
                return self._complete_with_image_gemini(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            elif self._provider == AIProviderType.OPENAI:
                return self._complete_with_image_openai(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            elif self._provider == AIProviderType.AZURE:
                return self._complete_with_image_azure(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            elif self._provider == AIProviderType.ANTHROPIC:
                return self._complete_with_image_anthropic(
                    prompt, image_url, image_bytes, model, temperature, max_tokens, timeout
                )
            else:
                raise ValueError(f'Vision not supported for provider: {self._provider}')
        except Exception as e:
            logger.error(
                f'{self._provider.value} vision completion failed: {e}',
                extra={
                    'provider': self._provider.value,
                    'model': model or 'default',
                    'user_id': self.user_id,
                    'error_type': type(e).__name__,
                },
                exc_info=True,
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

        # Default to Gemini image model from settings (must support vision/multimodal)
        # Use GEMINI_IMAGE_MODEL as it's designed for multimodal tasks
        model_name = model or getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp')

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

    def _complete_with_image_azure(
        self,
        prompt: str,
        image_url: str | None,
        image_bytes: bytes | None,
        model: str | None,
        temperature: float,
        max_tokens: int | None,
        timeout: int,
    ) -> str:
        """Azure OpenAI vision completion."""
        import base64

        deployment_name = model or getattr(settings, 'AZURE_OPENAI_VISION_DEPLOYMENT', 'gpt-4o')

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
            model=deployment_name,
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
