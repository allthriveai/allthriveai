# Intent Detection Testing Guide

## Quick Start

```bash
# Run all intent detection tests
pytest core/agents/tests/test_intent_detection.py core/agents/tests/test_intent_api.py -v

# Run with coverage
pytest core/agents/tests/test_intent_detection.py core/agents/tests/test_intent_api.py -v --cov=core.agents.intent_detection --cov-report=html

# Run only API tests
pytest core/agents/tests/test_intent_api.py -v

# Run only service tests
pytest core/agents/tests/test_intent_detection.py -v
```

## Test Overview

### Unit Tests (test_intent_detection.py)

**15 tests covering:**
- ✅ Support intent detection
- ✅ Project creation intent detection
- ✅ Discovery intent detection
- ✅ Integration type handling
- ✅ Invalid intent fallback
- ✅ Error handling
- ✅ Conversation history formatting
- ✅ Mode transition messages
- ✅ Singleton pattern

### API Tests (test_intent_api.py)

**10 tests covering:**
- ✅ Authentication required
- ✅ Message validation
- ✅ Intent detection (support, project-creation, discovery)
- ✅ Conversation history support
- ✅ Integration type support
- ✅ Error handling
- ✅ Response format validation

### Integration Tests

**3 tests (skipped by default):**
- Real LLM tests that cost money
- Use `@pytest.mark.skip` to prevent accidental execution
- Can be manually run by removing skip decorator

## Manual Testing

### 1. Test with Django Shell

```python
# Start Django shell
python manage.py shell

# Import service
from core.agents.intent_detection import get_intent_service

service = get_intent_service()

# Test support query
intent = service.detect_intent('How do I add a project?')
print(f'Intent: {intent}')  # Should print: support

# Test project creation
intent = service.detect_intent('Create a new project from GitHub')
print(f'Intent: {intent}')  # Should print: project-creation

# Test discovery
intent = service.detect_intent('Show me similar AI projects')
print(f'Intent: {intent}')  # Should print: discovery

# Test with integration
intent = service.detect_intent('Import this', integration_type='github')
print(f'Intent: {intent}')  # Should print: project-creation
```

### 2. Test API Endpoint with cURL

```bash
# First, get an auth token (example using test login)
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}' | jq -r '.access')

# Test support query
curl -X POST http://localhost:8000/api/v1/agents/detect-intent/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I add a project?"
  }'

# Expected response:
# {
#   "intent": "support",
#   "transition_message": "How can I help you today?"
# }

# Test project creation
curl -X POST http://localhost:8000/api/v1/agents/detect-intent/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a new project from GitHub",
    "integration_type": "github"
  }'

# Expected response:
# {
#   "intent": "project-creation",
#   "transition_message": "Great! Let's import your GitHub repository..."
# }

# Test with conversation history
curl -X POST http://localhost:8000/api/v1/agents/detect-intent/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What about AI projects?",
    "conversation_history": [
      {"sender": "user", "content": "Hi"},
      {"sender": "agent", "content": "Hello!"}
    ]
  }'
```

### 3. Test API Endpoint with HTTPie

```bash
# Install HTTPie if needed: pip install httpx

# Login
http POST localhost:8000/api/v1/auth/login/ \
  email=test@example.com \
  password=testpass

# Use the access token
TOKEN="your-access-token-here"

# Test intent detection
http POST localhost:8000/api/v1/agents/detect-intent/ \
  "Authorization: Bearer $TOKEN" \
  message="How do I create a project?"

# With integration type
http POST localhost:8000/api/v1/agents/detect-intent/ \
  "Authorization: Bearer $TOKEN" \
  message="Import my repo" \
  integration_type=github
```

### 4. Test with Python Requests

```python
import requests

BASE_URL = 'http://localhost:8000/api/v1'

# Login
login_response = requests.post(
    f'{BASE_URL}/auth/login/',
    json={'email': 'test@example.com', 'password': 'testpass'}
)
token = login_response.json()['access']

# Test intent detection
headers = {'Authorization': f'Bearer {token}'}
response = requests.post(
    f'{BASE_URL}/agents/detect-intent/',
    headers=headers,
    json={
        'message': 'How do I add a project?',
        'conversation_history': [
            {'sender': 'user', 'content': 'Hi'},
            {'sender': 'agent', 'content': 'Hello!'}
        ]
    }
)

print(response.json())
# Output: {'intent': 'support', 'transition_message': '...'}
```

## Frontend Integration Testing

### Update RouterAgent to Call Backend

```typescript
// frontend/src/services/agents/RouterAgent.ts
async detectMode(
  userMessage: string,
  conversationHistory: ChatMessage[],
  integration?: IntegrationContext
): Promise<ChatMode> {
  try {
    const response = await fetch('/api/v1/agents/detect-intent/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        conversation_history: conversationHistory.map(m => ({
          sender: m.sender,
          content: m.content
        })),
        integration_type: integration?.type
      })
    });

    const data = await response.json();
    return data.intent as ChatMode;
  } catch (error) {
    console.error('Intent detection failed:', error);
    // Fallback to support mode
    return 'support';
  }
}
```

## Test Results

Expected output from `pytest core/agents/tests/test_intent*.py -v`:

```
============================= test session starts ==============================
collected 28 items

test_intent_detection.py::test_detects_support_intent PASSED             [  3%]
test_intent_detection.py::test_detects_project_creation_intent PASSED    [  7%]
test_intent_detection.py::test_detects_discovery_intent PASSED           [ 10%]
test_intent_detection.py::test_integration_type_forces_project_creation PASSED [ 14%]
test_intent_detection.py::test_invalid_intent_fallback PASSED            [ 17%]
test_intent_detection.py::test_llm_error_fallback PASSED                 [ 21%]
test_intent_detection.py::test_format_history PASSED                     [ 25%]
test_intent_detection.py::test_format_history_empty PASSED               [ 28%]
test_intent_detection.py::test_format_history_limits_to_3 PASSED         [ 32%]
test_intent_detection.py::test_get_mode_transition_message_support PASSED [ 35%]
test_intent_detection.py::test_get_mode_transition_message_discovery PASSED [ 39%]
test_intent_detection.py::test_get_mode_transition_message_project_creation PASSED [ 42%]
test_intent_detection.py::test_get_mode_transition_message_github_integration PASSED [ 46%]
test_intent_detection.py::test_get_mode_transition_message_youtube_integration PASSED [ 50%]
test_intent_detection.py::test_singleton_instance PASSED                 [ 53%]
test_intent_detection.py::test_real_llm_support_query SKIPPED            [ 57%]
test_intent_detection.py::test_real_llm_project_creation SKIPPED         [ 60%]
test_intent_detection.py::test_real_llm_discovery SKIPPED                [ 64%]
test_intent_api.py::test_requires_authentication PASSED                  [ 67%]
test_intent_api.py::test_requires_message PASSED                         [ 71%]
test_intent_api.py::test_rejects_empty_message PASSED                    [ 75%]
test_intent_api.py::test_detects_support_intent PASSED                   [ 78%]
test_intent_api.py::test_detects_project_creation_intent PASSED          [ 82%]
test_intent_api.py::test_detects_discovery_intent PASSED                 [ 85%]
test_intent_api.py::test_with_conversation_history PASSED                [ 89%]
test_intent_api.py::test_with_integration_type PASSED                    [ 92%]
test_intent_api.py::test_handles_service_error PASSED                    [ 96%]
test_intent_api.py::test_response_format PASSED                          [100%]

================== 25 passed, 3 skipped in 4.18s ===========================
```

## CI/CD Integration

Tests are automatically run in GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`).

## Troubleshooting

### Redis Connection Error
```bash
# Ensure Redis is running
docker-compose up -d redis
```

### Authentication Error in API Tests
```bash
# Check that test user exists
python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())"
```

### LLM API Key Not Configured
```bash
# Check environment variables
echo $AZURE_OPENAI_API_KEY
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

## Summary

✅ **25 unit/integration tests** with mocked LLM
✅ **3 real LLM tests** (skipped to avoid costs)
✅ **Full API endpoint coverage**
✅ **Error handling tested**
✅ **Conversation history support**
✅ **Integration type support**

All tests pass! 🎉
