# Content Moderation Service

AI-powered content moderation using OpenAI's Moderation API as a reusable LangChain tool.

## Overview

The moderation service provides:
- Real-time content moderation for user-generated content
- Detection of toxic, harmful, or inappropriate content
- Automatic retry logic with exponential backoff
- Comprehensive logging and error handling
- Reusable as a LangChain tool for AI agents

## Features

### Content Checks
- Hate speech and discriminatory language
- Harassment and bullying
- Self-harm content
- Sexual content
- Violence and graphic content
- Spam detection

### Technical Features
- **Automatic Retries**: 3 attempts with exponential backoff for transient failures
- **Timeout Protection**: 10-second timeout to prevent hanging
- **Fail-Closed**: Rejects content if moderation system fails (security-first)
- **Rate Limit Handling**: Graceful handling of API rate limits
- **Comprehensive Logging**: Warning logs for flagged content, error logs for failures

## Usage

### As a Django Service

```python
from services.moderation import ContentModerator

moderator = ContentModerator()
result = moderator.moderate(
    content="User's comment text",
    context="project comment"
)

if result['approved']:
    # Content is safe - save it
    pass
else:
    # Content flagged - show error to user
    print(result['reason'])
```

### As a LangChain Tool

```python
from services.moderation import MODERATION_TOOLS

# Add to agent's tools
agent = create_agent(tools=[...other_tools, *MODERATION_TOOLS])

# Tool will be automatically available to the agent
```

### In Serializers

```python
from services.moderation import ContentModerator

def create(self, validated_data):
    content = validated_data.get('content')

    moderator = ContentModerator()
    result = moderator.moderate(content, context='comment')

    if not result['approved']:
        raise serializers.ValidationError({
            'content': result['reason']
        })

    # Store moderation data
    validated_data['moderation_status'] = 'approved'
    validated_data['moderation_data'] = result.get('moderation_data', {})

    return super().create(validated_data)
```

## Response Format

```python
{
    'approved': True,  # Whether content passed moderation
    'flagged': False,  # Whether content was flagged for review
    'categories': {},  # Dict of flagged categories with scores
    'reason': 'Content approved',  # Human-readable explanation
    'confidence': 0.95,  # Confidence score (0-1)
    'moderation_data': {...}  # Full OpenAI API response
}
```

## Error Handling

The service handles three types of errors:

1. **Retryable Errors** (auto-retry 3x):
   - Network connection failures
   - API timeouts
   - Rate limit errors

2. **API Errors** (no retry):
   - Invalid API key
   - Malformed requests
   - Service outages

3. **System Errors** (no retry):
   - Unexpected exceptions
   - Configuration issues

All errors result in content rejection (fail-closed).

## Configuration

Required settings:
```python
# settings.py
OPENAI_API_KEY = env('OPENAI_API_KEY')
```

## Performance

- **Response Time**: 200-500ms typical
- **Timeout**: 10 seconds maximum
- **Retries**: Up to 3 attempts with exponential backoff
- **Rate Limits**: Automatically handled with retries

## Integration with Models

```python
class ProjectComment(models.Model):
    content = models.TextField()

    # Moderation fields
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING
    )
    moderation_reason = models.TextField(blank=True)
    moderation_data = models.JSONField(default=dict)
    moderated_at = models.DateTimeField(null=True, blank=True)
```

## Best Practices

1. **Always provide context** - Helps generate better user-facing messages
2. **Store full moderation data** - Useful for debugging and appeals
3. **Log flagged content** - Monitor for patterns and false positives
4. **Show clear error messages** - Help users understand why content was rejected
5. **Don't expose raw API data** - Use friendly, actionable messages

## Testing

```python
def test_moderation():
    moderator = ContentModerator()

    # Test safe content
    result = moderator.moderate("Great project!")
    assert result['approved'] is True

    # Test harmful content
    result = moderator.moderate("hate speech example")
    assert result['approved'] is False
    assert 'hate' in result['categories']
```

## Monitoring

Key metrics to monitor:
- Rejection rate by category
- Average response time
- Retry frequency
- False positive reports

## Future Enhancements

- [ ] Custom moderation rules
- [ ] Language-specific moderation
- [ ] Appeal workflow
- [ ] Admin override capability
- [ ] Batch moderation API
- [ ] Caching for identical content
- [ ] User reputation scoring
