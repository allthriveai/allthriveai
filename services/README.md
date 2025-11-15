# Services Module

This module contains reusable service classes for the AllThrive AI application.

## AIProvider

A flexible AI provider class that supports multiple AI services with easy switching.

### Quick Start

```python
from services import AIProvider

# Use default provider (Azure OpenAI)
ai = AIProvider()
response = ai.complete("Hello, how are you?")
print(response)
```

### Supported Providers

- **Azure OpenAI** (Primary/Default)
- **OpenAI**
- **Anthropic**

### Configuration

Set these environment variables in your `.env` file:

```bash
# Azure OpenAI (Primary)
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# OpenAI
OPENAI_API_KEY=your-key-here

# Anthropic
ANTHROPIC_API_KEY=your-key-here

# Default Provider
DEFAULT_AI_PROVIDER=azure
```

### Examples

**Switch providers dynamically:**
```python
ai = AIProvider(provider="azure")
ai.set_provider("openai")  # Switch to OpenAI
ai.set_provider("anthropic")  # Switch to Anthropic
```

**Streaming responses:**
```python
for chunk in ai.stream_complete("Tell me a story"):
    print(chunk, end="", flush=True)
```

**Custom parameters:**
```python
response = ai.complete(
    prompt="Explain quantum computing",
    system_message="You are a physics professor",
    temperature=0.3,
    max_tokens=500
)
```

### Documentation

See `docs/AI_PROVIDER_USAGE.md` for comprehensive documentation and examples.

### Testing

Run tests with:
```bash
python manage.py test services
```
