"""
AI Provider Service
Supports Azure OpenAI, OpenAI, and Anthropic with easy switching between providers.
"""
from enum import Enum
from typing import Optional

from django.conf import settings


class AIProviderType(Enum):
    """Supported AI provider types."""

    AZURE = "azure"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


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

    def __init__(self, provider: Optional[str] = None, **kwargs):
        """
        Initialize AI provider.

        Args:
            provider: Provider type (azure, openai, anthropic).
                     Defaults to DEFAULT_AI_PROVIDER from settings.
            **kwargs: Additional configuration options for the provider.
        """
        self._provider = None
        self._client = None
        self._config = kwargs

        # Set provider (uses default from settings if not specified)
        provider_type = provider or getattr(settings, "DEFAULT_AI_PROVIDER", "azure")
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
            raise ValueError(f"Invalid provider: {provider}. " f"Must be one of: {[p.value for p in AIProviderType]}")

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

    def _initialize_azure_client(self):
        """Initialize Azure OpenAI client."""
        try:
            from openai import AzureOpenAI
        except ImportError:
            raise ImportError("OpenAI library not installed. Install with: pip install openai")

        api_key = getattr(settings, "AZURE_OPENAI_API_KEY", None)
        endpoint = getattr(settings, "AZURE_OPENAI_ENDPOINT", None)
        api_version = getattr(settings, "AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

        if not api_key or not endpoint:
            raise ValueError(
                "Azure OpenAI credentials not configured. "
                "Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in settings."
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
            raise ImportError("OpenAI library not installed. Install with: pip install openai")

        api_key = getattr(settings, "OPENAI_API_KEY", None)

        if not api_key:
            raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY in settings.")

        return OpenAI(api_key=api_key)

    def _initialize_anthropic_client(self):
        """Initialize Anthropic client."""
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError("Anthropic library not installed. Install with: pip install anthropic")

        api_key = getattr(settings, "ANTHROPIC_API_KEY", None)

        if not api_key:
            raise ValueError("Anthropic API key not configured. Set ANTHROPIC_API_KEY in settings.")

        return Anthropic(api_key=api_key)

    def complete(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_message: Optional[str] = None,
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
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text response
        """
        if self._provider == AIProviderType.AZURE:
            return self._complete_azure(prompt, model, temperature, max_tokens, system_message, **kwargs)
        elif self._provider == AIProviderType.OPENAI:
            return self._complete_openai(prompt, model, temperature, max_tokens, system_message, **kwargs)
        elif self._provider == AIProviderType.ANTHROPIC:
            return self._complete_anthropic(prompt, model, temperature, max_tokens, system_message, **kwargs)

    def _complete_azure(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ) -> str:
        """Azure OpenAI completion."""
        deployment_name = model or getattr(settings, "AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4")

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        response = self._client.chat.completions.create(
            model=deployment_name, messages=messages, temperature=temperature, max_tokens=max_tokens, **kwargs
        )

        return response.choices[0].message.content

    def _complete_openai(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ) -> str:
        """OpenAI completion."""
        model_name = model or "gpt-4"

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        response = self._client.chat.completions.create(
            model=model_name, messages=messages, temperature=temperature, max_tokens=max_tokens, **kwargs
        )

        return response.choices[0].message.content

    def _complete_anthropic(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ) -> str:
        """Anthropic completion."""
        model_name = model or "claude-3-5-sonnet-20241022"
        max_tokens = max_tokens or 1024  # Anthropic requires max_tokens

        response = self._client.messages.create(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message or "",
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )

        return response.content[0].text

    def stream_complete(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_message: Optional[str] = None,
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

    def _stream_azure(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ):
        """Azure OpenAI streaming completion."""
        deployment_name = model or getattr(settings, "AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4")

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

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
                if hasattr(chunk.choices[0].delta, "content") and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    def _stream_openai(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ):
        """OpenAI streaming completion."""
        model_name = model or "gpt-4"

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        stream = self._client.chat.completions.create(
            model=model_name, messages=messages, temperature=temperature, max_tokens=max_tokens, stream=True, **kwargs
        )

        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                if hasattr(chunk.choices[0].delta, "content") and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    def _stream_anthropic(
        self,
        prompt: str,
        model: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        system_message: Optional[str],
        **kwargs,
    ):
        """Anthropic streaming completion."""
        model_name = model or "claude-3-5-sonnet-20241022"
        max_tokens = max_tokens or 1024

        with self._client.messages.stream(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message or "",
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        ) as stream:
            for text in stream.text_stream:
                yield text

    @property
    def current_provider(self) -> str:
        """Get the current provider name."""
        return self._provider.value if self._provider else None

    @property
    def client(self):
        """Get the underlying client for advanced usage."""
        return self._client
