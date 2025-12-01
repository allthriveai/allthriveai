# Reddit Content Moderation

## Overview

The Reddit bot integration includes comprehensive content moderation to prevent importing inappropriate content from Reddit. This ensures that only safe, appropriate content appears in the AllThrive AI platform.

## Moderation Layers

### 1. Reddit Native Filters

The system first checks Reddit's own content flags:

- **NSFW Content**: Posts marked as `over_18` by Reddit are automatically skipped
- **Spoiler Content**: Available in metadata for filtering
- **Minimum Score**: Configurable threshold to filter low-quality content

### 2. Text Content Moderation

Uses OpenAI's Moderation API to analyze:

- **Post Title**: Checked for inappropriate language and content
- **Post Body (selftext)**: Full text content is analyzed
- **Combined Analysis**: Title and body are checked together for context

**Detected Categories:**
- Hate speech and discriminatory language
- Harassment and bullying
- Self-harm content
- Sexual content
- Violence and graphic content

### 3. Image Content Moderation

Uses GPT-4 Vision API to analyze:

- **Thumbnails**: Reddit thumbnail images
- **Featured Images**: Full-size images from posts
- **Gallery Images**: First image from image galleries

**Detected Categories:**
- Explicit sexual content or nudity
- Graphic violence or gore
- Hate symbols or extremist imagery
- Self-harm content
- Content exploiting or harming children
- Disturbing or shocking imagery

## How It Works

### Process Flow

```
1. Reddit Bot fetches new posts via RSS feed
   ↓
2. Check Reddit's NSFW flag (over_18)
   ↓ (if safe)
3. Fetch full post metrics from Reddit API
   ↓
4. Moderate text content (title + selftext)
   ↓ (if approved)
5. Moderate image content (if present)
   ↓ (if approved)
6. Create Project and RedditThread
   ↓
7. Store moderation results in database
```

### Skipped Content

Posts are skipped (not imported) if:

1. Marked as NSFW by Reddit (`over_18: true`)
2. Text content fails moderation (hate speech, violence, etc.)
3. Image content fails moderation (explicit content, violence, etc.)
4. Score below configured minimum threshold
5. Moderation API errors (fail-closed for safety)

### Stored Moderation Data

Each Reddit thread stores:

- `moderation_status`: `approved`, `rejected`, `pending`, or `skipped`
- `moderation_reason`: Human-readable explanation
- `moderation_data`: Full results from text and image moderation
- `moderated_at`: Timestamp when moderation occurred

## Configuration

### Bot Settings

Configure moderation thresholds in bot settings:

```python
bot.settings = {
    'min_score': 10,  # Minimum Reddit score
    'feed_type': 'top',  # 'hot', 'top', or 'new'
    'time_period': 'week',  # 'day', 'week', 'month', 'year', 'all'
}
```

### Environment Variables

The moderation system uses the centralized AIProvider and supports:

**Option 1: Direct OpenAI**
```bash
OPENAI_API_KEY=sk-...  # For text and image moderation
```

**Option 2: Azure OpenAI (AI Gateway)**
```bash
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
DEFAULT_AI_PROVIDER=azure  # Set to use Azure OpenAI
```

The moderation system automatically uses the `DEFAULT_AI_PROVIDER` setting from your environment (defaults to `'azure'` in production). No additional configuration needed if your AI gateway is already set up.

## Error Handling

### Fail-Closed Design

If moderation services fail, content is **rejected** by default for safety:

- Network errors → Retry 3 times with exponential backoff
- API errors → Reject content, log error
- System errors → Reject content, log error

### Logging

All moderation decisions are logged:

```python
# Approved content
logger.info(f'Reddit post approved: r/{subreddit} - {post_id}')

# Rejected content
logger.warning(f'Skipping post {post_id} - failed moderation: {reason}')

# NSFW content
logger.info(f'Skipping post {post_id} - marked as NSFW by Reddit')
```

## Database Schema

### RedditThread Model

```python
class RedditThread(models.Model):
    # ... existing fields ...
    
    # Moderation tracking
    moderation_status = models.CharField(
        choices=ModerationStatus.choices,
        default=ModerationStatus.APPROVED,
    )
    moderation_reason = models.TextField()
    moderation_data = models.JSONField()
    moderated_at = models.DateTimeField()
```

### Moderation Data Structure

```json
{
  "text": {
    "approved": true,
    "flagged": false,
    "reason": "Content approved",
    "categories": {},
    "confidence": 0.0
  },
  "image": {
    "approved": true,
    "flagged": false,
    "reason": "Image approved",
    "categories": {},
    "confidence": 0.0
  }
}
```

## Performance Considerations

### API Calls

For each new Reddit post:
1. **Reddit API**: Fetch post metrics (~200ms)
2. **OpenAI Moderation**: Check text content (~300ms)
3. **GPT-4 Vision**: Check image if present (~1-2s)

**Total**: ~1.5-2.5 seconds per post with images

### Optimization Strategies

1. **Batch Processing**: Process multiple posts in parallel
2. **Caching**: Skip re-moderation of existing posts
3. **Lazy Loading**: Only fetch images that pass text moderation
4. **Low Detail**: Use `detail: 'low'` for vision API to reduce cost/latency

### Rate Limits

- **OpenAI Moderation API**: High rate limits (thousands per minute)
- **GPT-4 Vision API**: Lower rate limits (requests per minute)
- **Reddit API**: 60 requests per minute (no auth required for RSS/JSON)

## Monitoring

### Key Metrics to Track

1. **Rejection Rate**: % of posts rejected by moderation
2. **Category Breakdown**: Which categories flag most content
3. **False Positives**: User reports of incorrectly flagged content
4. **API Errors**: Moderation service failures

### Admin Dashboard

View moderation statistics in Django admin:

```python
# Filter by moderation status
RedditThread.objects.filter(moderation_status='rejected')

# View rejection reasons
rejected = RedditThread.objects.filter(moderation_status='rejected')
for thread in rejected:
    print(f'{thread.reddit_post_id}: {thread.moderation_reason}')
```

## Testing

### Unit Tests

```bash
# Run moderation tests
pytest services/tests/test_reddit_moderation.py -v
```

### Manual Testing

```python
from services.moderation import ContentModerator, ImageModerator

# Test text moderation
moderator = ContentModerator()
result = moderator.moderate("Test content here")
print(result)

# Test image moderation
img_moderator = ImageModerator()
result = img_moderator.moderate_image("https://example.com/image.jpg")
print(result)
```

## Troubleshooting

### Common Issues

**Issue**: All posts being rejected
- **Cause**: AI provider not configured correctly
- **Solution**: Set either `OPENAI_API_KEY` (for direct OpenAI) or Azure OpenAI credentials (`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`) in environment

**Issue**: Images not being moderated
- **Cause**: Image URL is empty or invalid
- **Solution**: Check `image_url` is valid and accessible

**Issue**: Slow sync performance
- **Cause**: Image moderation takes 1-2 seconds per image
- **Solution**: Consider processing in background tasks or limiting image checks

### Debug Mode

Enable detailed logging:

```python
import logging
logging.getLogger('services.reddit_sync_service').setLevel(logging.DEBUG)
logging.getLogger('services.moderation').setLevel(logging.DEBUG)
```

## Future Enhancements

- [ ] Custom moderation rules per subreddit
- [ ] Machine learning-based false positive detection
- [ ] User appeal workflow for rejected content
- [ ] Admin override capability
- [ ] Batch image moderation for galleries
- [ ] Caching moderation results for duplicate content
- [ ] Community-based moderation scoring

## Related Documentation

- [Content Moderation Service](../services/moderation/README.md)
- [Reddit Curation Bots](./REDDIT_CURATION_BOTS.md)
- [Image Moderator](../services/moderation/image_moderator.py)
