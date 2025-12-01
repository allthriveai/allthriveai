# Reddit Content Moderation Improvements

**Date**: 2025-12-01  
**Issue**: Explicit NSFW content from Reddit made it onto the platform despite existing moderation layers

## Problem

A post from r/chatgpt with highly explicit sexual content was imported into AllThrive AI:

```
Title: "Hell yeah, I allow NSFW content"
Content: "Tits, ass, cock, cumshots, gangbangs, whatever the fuck you wanna talk about—
I'm not your prudish little ChatGPT bitch. Send me the filthiest shit you got, 
describe your dirtiest fantasies..."
```

### Why It Got Through

The existing 3-layer moderation system failed because:

1. **Reddit didn't mark it NSFW** - The `over_18` flag was false (common for "jailbreak" posts)
2. **OpenAI Moderation API missed it** - Sometimes euphemistic or certain language patterns slip through
3. **No image to moderate** - Image moderation didn't apply to text-only posts
4. **No local safety net** - System relied entirely on external APIs

## Solution

Added a **4th moderation layer**: Local keyword-based pre-screening filter that catches obviously inappropriate content before making expensive API calls.

### New Moderation Flow

```
1. Reddit API: Fetch post metrics
2. Reddit NSFW flag check (over_18)
3. Minimum score threshold check
4. ⭐ KEYWORD FILTER (NEW) ⭐ - Local, instant, no API cost
5. OpenAI Moderation API (text)
6. GPT-4 Vision API (images)
7. Create project if all pass
```

## Implementation Details

### 1. Keyword Filter (`services/moderation/keyword_filter.py`)

A new `KeywordFilter` class that provides:

**Features:**
- Fast local checking (< 1ms, no API calls)
- Regex-based pattern matching with word boundaries
- Three categories: Sexual, Violent, Hate Speech
- Configurable strict mode per subreddit
- Smart thresholds to reduce false positives

**Configuration:**
- **Child Safety**: ALWAYS flagged (zero tolerance policy) - takes precedence over all other rules
- **Normal Mode**: Requires 3+ sexual keywords OR hate speech OR multiple categories
- **Strict Mode**: Any single keyword match triggers flag (used for problematic subreddits)

**Example Keywords Detected:**
- **Child Safety (ZERO TOLERANCE)**: jailbait, CP, pedo, underage, preteen, loli, shota, minor+explicit context
- Sexual: nsfw, porn, xxx, tits, ass, cock, cumshot, gangbang, nude, explicit, etc.
- Violent: gore, beheading, mutilation, torture, snuff, execution
- Hate Speech: Racial slurs, discriminatory language

### 2. Subreddit-Specific Moderation

Added list of subreddits requiring strict moderation in `RedditSyncService`:

```python
STRICT_MODERATION_SUBREDDITS = [
    'chatgpt',  # Frequently has NSFW "jailbreak" posts
    'openai',
    'artificialintelligence',
    'chatgptprompts',
]
```

These subreddits use **strict mode** where even a single keyword match will reject the content.

### 3. Integration with Reddit Sync

Updated `services/reddit_sync_service.py` `_moderate_content()` method:

```python
# New step 0: Keyword filter (runs before API calls)
strict_mode = subreddit.lower() in STRICT_MODERATION_SUBREDDITS
keyword_filter = KeywordFilter(strict_mode=strict_mode)
keyword_result = keyword_filter.check(combined_text, context=context)

if keyword_result['flagged']:
    logger.info(f'Reddit post rejected by keyword filter')
    return False, keyword_result['reason'], moderation_results
```

### 4. Comprehensive Tests

Created `services/tests/test_keyword_filter.py` with 18 test cases covering:

- Clean content passing
- Explicit sexual content flagging
- Multiple keyword detection
- Hate speech detection
- Violent content detection
- Strict vs normal mode behavior
- Case-insensitive matching
- Word boundary handling
- False positive prevention
- **Actual problematic post test** - Verifies the specific post that got through would now be caught

## Benefits

### Security
- **4 layers of defense** instead of 3
- Catches content external APIs might miss
- Fail-fast design - rejects bad content immediately
- Subreddit-specific strictness

### Performance
- **No API costs** for obviously bad content
- **< 1ms latency** for local check
- Saves OpenAI API calls for flagged content
- Reduces processing time for bad posts

### Maintainability
- Easy to add new keywords/patterns
- Configurable per-subreddit
- Well-tested with 18 test cases
- Clear logging for debugging

## Verification

The specific problematic post would now be caught:

```python
filter = KeywordFilter(strict_mode=True)  # r/chatgpt uses strict mode

title = "Hell yeah, I allow NSFW content"
body = "Tits, ass, cock, cumshots, gangbangs..."
combined = f"{title}\n\n{body}"

result = filter.check(combined, context="Reddit post from r/chatgpt")

# Result:
# {
#   'flagged': True,
#   'categories': ['sexual'],
#   'matched_keywords': ['nsfw', 'tits', 'ass', 'cock', 'cumshots', 'gangbangs', ...],
#   'reason': 'Content flagged by keyword filter: contains explicit sexual content 
#             in Reddit post from r/chatgpt. Matched terms: 8'
# }
```

## Files Changed

### New Files
- `services/moderation/keyword_filter.py` - New keyword filter implementation
- `services/tests/test_keyword_filter.py` - Comprehensive test suite
- `docs/REDDIT_MODERATION_IMPROVEMENTS.md` - This document

### Modified Files
- `services/reddit_sync_service.py` - Integrated keyword filter into moderation flow
- `services/moderation/__init__.py` - Export KeywordFilter
- `docs/REDDIT_CONTENT_MODERATION.md` - Updated documentation

## Testing

Run tests to verify the fix:

```bash
# Test the keyword filter specifically
pytest services/tests/test_keyword_filter.py -v

# Test Reddit moderation integration
pytest services/tests/test_reddit_moderation.py -v

# Test with the actual problematic content
pytest services/tests/test_keyword_filter.py::TestKeywordFilter::test_reddit_chatgpt_post_example -v
```

## Rollout

1. ✅ Keyword filter implemented with comprehensive tests
2. ✅ Integrated into Reddit sync service
3. ✅ Documentation updated
4. ⏳ Deploy changes to production
5. ⏳ Monitor moderation logs for effectiveness
6. ⏳ Adjust keyword lists based on real-world results

## Future Improvements

Potential enhancements for consideration:

1. **Admin Dashboard**: View keyword filter statistics and matched terms
2. **Dynamic Keywords**: Machine learning to identify new problematic patterns
3. **Allowlist**: Exceptions for legitimate educational content
4. **Per-Bot Configuration**: Custom keyword lists per Reddit bot
5. **User Appeals**: Allow users to appeal incorrectly flagged content
6. **A/B Testing**: Compare keyword filter effectiveness vs API-only
7. **Performance Metrics**: Track false positive/negative rates

## Monitoring

Key metrics to track:

- **Keyword Filter Rejection Rate**: % of posts rejected by keyword filter
- **Category Breakdown**: Which categories flag most content
- **Strict vs Normal Mode**: Effectiveness by subreddit type
- **False Positives**: User reports of incorrectly flagged content
- **Cost Savings**: Reduced API calls from early rejection

## Related Documentation

- [Reddit Content Moderation](./REDDIT_CONTENT_MODERATION.md) - Complete moderation guide
- [Reddit Curation Bots](./REDDIT_CURATION_BOTS.md) - Bot configuration
- [Content Moderation Service](../services/moderation/README.md) - Moderation service overview
