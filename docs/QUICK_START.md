# AIProvider Quick Start

## 🚀 Import and Initialize

```python
from services import AIProvider

# Default (Azure OpenAI)
ai = AIProvider()

# Specific provider
ai = AIProvider(provider="azure")    # Azure OpenAI
ai = AIProvider(provider="openai")   # OpenAI
ai = AIProvider(provider="anthropic") # Anthropic
```

## 💬 Basic Completion

```python
response = ai.complete("What is Django?")
print(response)
```

## 🎛️ Advanced Parameters

```python
response = ai.complete(
    prompt="Explain quantum computing",
    system_message="You are a physics professor",
    temperature=0.7,      # Creativity (0-1)
    max_tokens=500,       # Response length
    model="gpt-4"         # Specific model/deployment
)
```

## 🌊 Streaming

```python
for chunk in ai.stream_complete("Tell me a story"):
    print(chunk, end="", flush=True)
```

## 🔄 Switch Providers

```python
ai.set_provider("openai")    # Switch to OpenAI
ai.set_provider("anthropic") # Switch to Anthropic
print(ai.current_provider)    # Check current provider
```

## 🎯 Django View Example

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from services import AIProvider

@api_view(['POST'])
def chat(request):
    ai = AIProvider()
    response = ai.complete(request.data['prompt'])
    return Response({'response': response})
```

## ⚡ Async with Celery

```python
from celery import shared_task
from services import AIProvider

@shared_task
def process_prompt(prompt):
    ai = AIProvider()
    return ai.complete(prompt)
```

## 🛡️ Error Handling

```python
try:
    ai = AIProvider(provider="azure")
    response = ai.complete("Hello")
except ValueError as e:
    print(f"Configuration error: {e}")
except Exception as e:
    print(f"API error: {e}")
```

## 📊 Check Configuration

```python
from django.conf import settings

print(f"Endpoint: {settings.AZURE_OPENAI_ENDPOINT}")
print(f"Version: {settings.AZURE_OPENAI_API_VERSION}")
print(f"Deployment: {settings.AZURE_OPENAI_DEPLOYMENT_NAME}")
print(f"Default: {settings.DEFAULT_AI_PROVIDER}")
```

## 🧪 Run Tests

```bash
# Functional tests
docker exec allthriveai-web-1 python services/tests/test_azure_openai.py

# Unit tests
docker exec allthriveai-web-1 python manage.py test services

# Examples
docker exec allthriveai-web-1 python examples/ai_provider_example.py
```

## 📚 Documentation

- Full docs: `docs/AI_PROVIDER_USAGE.md`
- Module docs: `services/README.md`
- Test results: `TEST_RESULTS.md`

---

**Status**: ✅ Ready to use!
