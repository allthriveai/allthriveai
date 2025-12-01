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


class AIProviderType(Enum):
    """Supported AI provider types."""

    AZURE = 'azure'
    OPENAI = 'openai'
    ANTHROPIC = 'anthropic'
    GEMINI = 'gemini'


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

        # Set provider (uses default from settings if not specified)
        provider_type = provider or getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')
        self.set_provider(provider_type)

    def set_provider(self, provider: str) -> None:
        """
        Switch to a different AI provider.

        Args:
            provider: Provider type (azure, openai, anthropic)
        """
        try:
            provider_enum = AIProviderType(provider.lower())
        except ValueError:
            raise ValueError(f'Invalid provider: {provider}. Must be one of: {[p.value for p in AIProviderType]}')

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
        except ImportError:
            raise ImportError('OpenAI library not installed. Install with: pip install openai')

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
        except ImportError:
            raise ImportError('OpenAI library not installed. Install with: pip install openai')

        api_key = getattr(settings, 'OPENAI_API_KEY', None)

        if not api_key:
            raise ValueError('OpenAI API key not configured. Set OPENAI_API_KEY in settings.')

        return OpenAI(api_key=api_key)

    def _initialize_anthropic_client(self):
        """Initialize Anthropic client."""
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError('Anthropic library not installed. Install with: pip install anthropic')

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)

        if not api_key:
            raise ValueError('Anthropic API key not configured. Set ANTHROPIC_API_KEY in settings.')

        return Anthropic(api_key=api_key)

    def _initialize_gemini_client(self):
        """Initialize Google Gemini client."""
        try:
            import google.generativeai as genai
        except ImportError:
            raise ImportError(
                'Google Generative AI library not installed. Install with: pip install google-generativeai'
            )

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
        model_name = model or 'gpt-4'

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
        model_name = model or 'gpt-4'

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
            for text in stream.text_stream:
                yield text

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
            return 'gpt-4'
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
                **kwargs,
            )

        elif self._provider == AIProviderType.OPENAI:
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                model=kwargs.pop('model', 'gpt-4'),
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
