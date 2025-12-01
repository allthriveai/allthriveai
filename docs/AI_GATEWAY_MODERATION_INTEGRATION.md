# AI Gateway Integration for Content Moderation

## Summary

The Reddit content moderation system now uses the centralized **AIProvider** service instead of directly accessing OpenAI API keys. This provides several benefits:

## Benefits

### 1. Centralized Configuration
- All AI API access goes through the `AIProvider` service
- Single point of configuration for API keys and endpoints
- Consistent error handling and retry logic across the application

### 2. Multi-Provider Support
- **Azure OpenAI** (default in production)
- **OpenAI** (direct access)
- Automatic fallback capabilities
- No code changes needed to switch providers

### 3. Cost Tracking & Observability
- All API calls tracked through LangSmith
- Usage and cost monitoring built-in
- Centralized logging and debugging

### 4. Security
- API keys managed in one place
- No scattered API key usage throughout codebase
- Easy to rotate credentials

## How It Works

### Before (Direct API Access)
```python
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)
response = client.moderations.create(input=content)
```

### After (AI Gateway)
```python
from services.ai_provider import AIProvider

ai_provider = AIProvider()  # Uses DEFAULT_AI_PROVIDER from settings
client = ai_provider.client  # Returns OpenAI or AzureOpenAI client
response = client.moderations.create(input=content)
```

## Configuration

The moderation system respects the `DEFAULT_AI_PROVIDER` setting:

```python
# config/settings.py
DEFAULT_AI_PROVIDER = config('DEFAULT_AI_PROVIDER', default='azure')
```

### Using Azure OpenAI (Recommended)

```bash
# .env
DEFAULT_AI_PROVIDER=azure
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### Using Direct OpenAI

```bash
# .env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Components Updated

### 1. ContentModerator (`services/moderation/moderator.py`)
- Text content moderation using OpenAI Moderation API
- Now uses `AIProvider()` instead of direct OpenAI client

### 2. ImageModerator (`services/moderation/image_moderator.py`)
- Image content moderation using GPT-4 Vision API
- Now uses `AIProvider()` instead of direct OpenAI client

### 3. RedditSyncService (`services/reddit_sync_service.py`)
- Imports both moderators which now use AI Gateway
- No changes needed - works transparently

## Migration Notes

### What Changed
- ✅ No API changes - moderation works the same way
- ✅ No new environment variables required
- ✅ Automatically uses existing AI Gateway configuration
- ✅ Backwards compatible with existing `.env` files

### What Stayed the Same
- Same moderation results
- Same error handling
- Same retry logic
- Same logging

## Testing

Both moderation services still work with the same interfaces:

```python
from services.moderation import ContentModerator, ImageModerator

# Text moderation
moderator = ContentModerator()
result = moderator.moderate("User content", context="reddit post")

# Image moderation
img_moderator = ImageModerator()
result = img_moderator.moderate_image("https://example.com/image.jpg")
```

## Monitoring

All moderation API calls are now tracked in:
- **LangSmith Dashboard**: View all moderation API calls
- **AI Cost Tracking**: Monitor spending on moderation
- **Application Logs**: Same logging as before

## Future Enhancements

- [ ] Provider-specific optimizations (e.g., Azure content safety endpoints)
- [ ] Caching moderation results to reduce API calls
- [ ] Custom fine-tuned moderation models
- [ ] Multi-provider failover (try Azure, fallback to OpenAI)

## Related Documentation

- [AI Provider Service](../services/ai_provider.py)
- [Content Moderation](../services/moderation/README.md)
- [Reddit Content Moderation](./REDDIT_CONTENT_MODERATION.md)
