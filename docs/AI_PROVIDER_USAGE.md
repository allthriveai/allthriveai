# AI Provider Usage Guide

The `AIProvider` class provides a unified interface for working with multiple AI providers (Azure OpenAI, OpenAI, and Anthropic) in your Django application.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Azure OpenAI (Primary Provider)
AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# OpenAI (Alternative)
OPENAI_API_KEY=your-openai-api-key-here

# Anthropic (Alternative)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Default Provider
DEFAULT_AI_PROVIDER=azure
```

### Install Required Packages

```bash
pip install openai anthropic
```

## Basic Usage

### Using the Default Provider

```python
from services import AIProvider

# Initialize with default provider (from settings)
ai = AIProvider()

# Generate a completion
response = ai.complete("What is Django?")
print(response)
```

### Specifying a Provider

```python
from services import AIProvider

# Use Azure OpenAI
ai = AIProvider(provider="azure")
response = ai.complete("Explain machine learning")

# Use OpenAI
ai = AIProvider(provider="openai")
response = ai.complete("Explain machine learning")

# Use Anthropic
ai = AIProvider(provider="anthropic")
response = ai.complete("Explain machine learning")
```

### Switching Providers Dynamically

```python
from services import AIProvider

ai = AIProvider()

# Start with Azure
print(f"Current provider: {ai.current_provider}")  # azure
response = ai.complete("Hello!")

# Switch to OpenAI
ai.set_provider("openai")
response = ai.complete("Hello!")

# Switch to Anthropic
ai.set_provider("anthropic")
response = ai.complete("Hello!")
```

## Advanced Usage

### With System Messages

```python
from services import AIProvider

ai = AIProvider()

response = ai.complete(
    prompt="Write a Python function to calculate fibonacci numbers",
    system_message="You are an expert Python developer. Write clean, efficient code.",
    temperature=0.3
)
```

### Streaming Responses

```python
from services import AIProvider

ai = AIProvider()

for chunk in ai.stream_complete(
    prompt="Write a story about AI",
    temperature=0.8
):
    print(chunk, end="", flush=True)
```

### Specifying Models

```python
from services import AIProvider

# Azure (uses deployment name)
ai = AIProvider(provider="azure")
response = ai.complete("Hello", model="gpt-4-turbo")

# OpenAI
ai = AIProvider(provider="openai")
response = ai.complete("Hello", model="gpt-4-turbo-preview")

# Anthropic
ai = AIProvider(provider="anthropic")
response = ai.complete("Hello", model="claude-3-5-sonnet-20241022")
```

### Custom Parameters

```python
from services import AIProvider

ai = AIProvider()

response = ai.complete(
    prompt="Summarize this text: ...",
    temperature=0.2,
    max_tokens=500,
    system_message="You are a professional summarizer."
)
```

## Django View Examples

### Simple API Endpoint

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from services import AIProvider

@api_view(['POST'])
def chat_completion(request):
    prompt = request.data.get('prompt')
    provider = request.data.get('provider', None)  # Optional

    ai = AIProvider(provider=provider)
    response = ai.complete(prompt)

    return Response({
        'response': response,
        'provider': ai.current_provider
    })
```

### Streaming Response View

```python
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view
from services import AIProvider

@api_view(['POST'])
def chat_stream(request):
    prompt = request.data.get('prompt')

    ai = AIProvider()

    def generate():
        for chunk in ai.stream_complete(prompt):
            yield chunk

    return StreamingHttpResponse(generate(), content_type='text/plain')
```

### Multi-Provider Comparison

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from services import AIProvider

@api_view(['POST'])
def compare_providers(request):
    prompt = request.data.get('prompt')
    providers = ['azure', 'openai', 'anthropic']

    results = {}

    for provider_name in providers:
        try:
            ai = AIProvider(provider=provider_name)
            response = ai.complete(prompt, temperature=0.7)
            results[provider_name] = response
        except Exception as e:
            results[provider_name] = f"Error: {str(e)}"

    return Response(results)
```

### Class-Based View with Caching

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.cache import cache
from services import AIProvider
import hashlib

class AICompletionView(APIView):
    def post(self, request):
        prompt = request.data.get('prompt')
        provider = request.data.get('provider', None)
        use_cache = request.data.get('use_cache', True)

        # Create cache key
        cache_key = hashlib.md5(
            f"{provider or 'default'}:{prompt}".encode()
        ).hexdigest()

        # Check cache
        if use_cache:
            cached_response = cache.get(cache_key)
            if cached_response:
                return Response({
                    'response': cached_response,
                    'cached': True
                })

        # Generate response
        ai = AIProvider(provider=provider)
        response = ai.complete(prompt)

        # Cache for 1 hour
        if use_cache:
            cache.set(cache_key, response, 3600)

        return Response({
            'response': response,
            'provider': ai.current_provider,
            'cached': False
        })
```

## Celery Task Example

```python
from celery import shared_task
from services import AIProvider

@shared_task
def process_ai_request(prompt, provider=None):
    """
    Process AI request asynchronously.
    """
    ai = AIProvider(provider=provider)
    response = ai.complete(prompt)
    return {
        'response': response,
        'provider': ai.current_provider
    }

# Usage in views
from .tasks import process_ai_request

@api_view(['POST'])
def async_chat(request):
    prompt = request.data.get('prompt')
    task = process_ai_request.delay(prompt)
    return Response({
        'task_id': task.id,
        'status': 'processing'
    })
```

## Error Handling

```python
from services import AIProvider

def safe_ai_completion(prompt, fallback_providers=['azure', 'openai', 'anthropic']):
    """
    Try multiple providers with fallback.
    """
    for provider in fallback_providers:
        try:
            ai = AIProvider(provider=provider)
            response = ai.complete(prompt)
            return {
                'response': response,
                'provider': provider,
                'success': True
            }
        except Exception as e:
            print(f"Provider {provider} failed: {e}")
            continue

    return {
        'response': None,
        'provider': None,
        'success': False,
        'error': 'All providers failed'
    }
```

## Best Practices

1. **Use Environment Variables**: Always configure API keys via environment variables, never hardcode them.

2. **Handle Errors Gracefully**: Wrap AI calls in try-except blocks and provide fallbacks.

3. **Implement Caching**: Cache responses for repeated queries to reduce costs and latency.

4. **Use Async Tasks**: For long-running AI operations, use Celery tasks.

5. **Monitor Usage**: Track which provider and model is used for cost optimization.

6. **Set Reasonable Defaults**: Configure temperature and max_tokens based on your use case.

7. **Provider Selection**: Use Azure OpenAI as primary for enterprise features, fallback to others as needed.

## Troubleshooting

### Import Error
```python
# Make sure services module is in PYTHONPATH
import sys
sys.path.append('/path/to/project')
from services import AIProvider
```

### Missing API Keys
```python
# Check if keys are loaded
from django.conf import settings
print(settings.AZURE_OPENAI_API_KEY)
```

### Provider Not Available
```python
# Verify installed packages
pip list | grep -E "openai|anthropic"
```
