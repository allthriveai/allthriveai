# Child Safety Protections

**AllThrive AI has a ZERO TOLERANCE policy for content involving minors.**

## Multi-Layer Protection System

AllThrive AI employs multiple layers of protection to prevent any content involving exploitation, sexualization, or endangerment of minors from appearing on the platform:

### Layer 1: Keyword Filter (Local - Instant)

**Status**: ✅ Implemented  
**Speed**: < 1ms (no API calls)  
**Mode**: Zero Tolerance (always active)

The keyword filter provides immediate, local detection of dangerous content patterns:

**Detected Patterns:**
- Direct terms: "child porn", "CP", "pedo", "pedophile"
- Age-specific: "underage", "minor", "preteen", "jailbait"
- Context-based: "underage porn", "minor sex", "young nude", "kids porn"
- Code/slang: "loli", "shota" (anime-related terms)
- Teen context: "teen porn" (when combined with explicit terms)

**Key Features:**
- **Always Active**: Cannot be disabled or bypassed
- **Takes Precedence**: Overrides all other moderation rules
- **Both Modes**: Flags in both strict and normal mode
- **No Threshold**: Even a single match triggers immediate rejection
- **Context-Aware**: Detects dangerous patterns, not just isolated words

**Example:**
```python
filter = KeywordFilter(strict_mode=False)  # Even in normal mode...

text = "Looking for jailbait content"
result = filter.check(text)

# Result: 
# {
#   'flagged': True,  # Immediately flagged
#   'categories': ['child_safety'],
#   'matched_keywords': ['jailbait'],
#   'reason': 'Content flagged by keyword filter: contains explicit 
#              child_safety content. Matched terms: 1'
# }
```

### Layer 2: OpenAI Moderation API

**Status**: ✅ Active  
**Speed**: ~300ms  
**Category**: `sexual/minors`

OpenAI's Moderation API includes a specific category for content involving minors:

```python
# OpenAI checks for:
# - Content that sexualizes or exploits minors
# - Content involving individuals under 18 in sexual contexts
# - Fictional content depicting minors in sexual situations
```

If the keyword filter passes but the content is flagged by OpenAI's `sexual/minors` category, the content is immediately rejected.

### Layer 3: GPT-4 Vision (Image Moderation)

**Status**: ✅ Active  
**Speed**: ~1-2s per image  
**Categories**: `minors`, `child exploitation`

For image content, GPT-4 Vision API analyzes visual content for:

```python
system_prompt = '''
Analyze images for inappropriate content including:
- Content exploiting or harming children
- Minors in inappropriate contexts
- Sexual content involving minors
'''
```

The vision model is instructed to:
- Flag any visual content involving minors in inappropriate situations
- Detect age-inappropriate content
- Flag content that could be exploitative

### Layer 4: Fail-Closed Design

**Philosophy**: When in doubt, reject.

If any moderation service fails or errors occur:
```python
# Service error = Content rejected
return {
    'approved': False,
    'flagged': True,
    'reason': 'Unable to moderate content - skipping for safety'
}
```

This ensures that technical failures cannot be exploited to bypass protections.

## Reddit-Specific Protections

### NSFW Flag Check

Before any moderation, Reddit's native `over_18` flag is checked:
```python
if metrics.get('over_18', False):
    logger.info(f'Skipping post {post_id} - marked as NSFW by Reddit')
    return  # Skip post
```

### Subreddit Monitoring

Certain subreddits are monitored more strictly:
```python
STRICT_MODERATION_SUBREDDITS = [
    'chatgpt',
    'openai',
    'artificialintelligence',
    'chatgptprompts',
]
```

These subreddits use strict mode where even single keyword matches trigger rejection.

## Complete Flow

Here's how content involving minors would be blocked:

```
1. Reddit RSS feed fetched
   ↓
2. Post metrics retrieved from Reddit API
   ↓
3. Check over_18 flag
   ↓ (if false, continue)
4. KEYWORD FILTER checks for child safety terms
   ↓ (if flagged: IMMEDIATE REJECTION)
5. OpenAI Moderation API checks text
   ↓ (if sexual/minors flagged: REJECT)
6. GPT-4 Vision checks images
   ↓ (if minors category flagged: REJECT)
7. Only if ALL checks pass: Import content
```

**At ANY point where child safety is flagged, the content is immediately rejected and never imported.**

## Monitoring & Reporting

### Logging

All child safety rejections are logged:

```python
logger.warning(
    f'CHILD SAFETY: Content rejected - context={context}, '
    f'matched_keywords={matched_keywords}'
)
```

### Database Tracking

Rejected content is tracked in the database:

```python
{
    'moderation_status': 'rejected',
    'moderation_reason': 'Content flagged: child_safety violation',
    'moderation_data': {
        'keyword': {
            'flagged': True,
            'categories': ['child_safety'],
            'matched_keywords': [...]
        }
    },
    'moderated_at': timestamp
}
```

### Metrics to Monitor

Key safety metrics tracked:

1. **Child Safety Rejection Rate**: Count of posts rejected for child safety
2. **False Positives**: Legitimate content incorrectly flagged (should be rare)
3. **Layer Breakdown**: Which layer caught the content (keyword/API/vision)
4. **Subreddit Sources**: Which subreddits have violations

## Legal Compliance

### CSAM Reporting

**Important**: If CSAM (Child Sexual Abuse Material) is detected:

1. Content is immediately blocked
2. System logs the incident (without storing the content)
3. **Manual review required** for reporting to NCMEC
4. Follow [NCMEC CyberTipline](https://www.missingkids.org/gethelpnow/cybertipline) guidelines

### Platform Responsibility

Under US law (FOSTA-SESTA) and international regulations:
- Platforms must take reasonable steps to prevent CSAM
- Must have reporting mechanisms
- Must not knowingly host illegal content

AllThrive AI's multi-layer approach demonstrates due diligence and proactive protection.

## Testing

### Unit Tests

Comprehensive test coverage for child safety:

```bash
# Test child safety keyword detection
pytest services/tests/test_keyword_filter.py::TestKeywordFilter::test_child_safety_always_flagged -v

# Test that child safety takes precedence
pytest services/tests/test_keyword_filter.py::TestKeywordFilter::test_child_safety_takes_precedence -v

# Test patterns exist
pytest services/tests/test_keyword_filter.py::TestKeywordFilter::test_child_safety_patterns_exist -v
```

### Test Coverage

Child safety tests verify:
- ✅ Zero tolerance (always flagged in both normal and strict mode)
- ✅ Takes precedence over other rules
- ✅ Multiple dangerous patterns detected
- ✅ Context-aware matching (e.g., "underage porn" not "underage drinking")
- ✅ Code/slang terms caught

## Configuration

### Keyword Patterns

Located in: `services/moderation/keyword_filter.py`

```python
CHILD_SAFETY = [
    r'\bchild\s+porn',
    r'\bcp\b',
    r'\bpedo',
    r'\bunderage\s+(sex|porn|nude)',
    r'\bminor\s+(sex|porn|nude)',
    r'\bpreteen',
    r'\bjailbait',
    r'\bloli\b',
    r'\bshota\b',
    r'\bkid(s|die)?\s+(porn|sex|nude)',
    r'\bteen\s+porn',
    r'\byoung\s+(porn|sex|nude)',
]
```

### Updating Patterns

To add new patterns:

1. Add regex pattern to `CHILD_SAFETY` list
2. Add corresponding test case
3. Document in this file
4. Deploy with careful review

**Note**: Be conservative with patterns to avoid false positives on legitimate content (e.g., "teen mental health" should not be flagged).

## False Positives

### Known Safe Contexts

The filter is designed to avoid flagging:
- "teenager" in non-sexual contexts
- "minor" meaning "less important"
- "young adult" fiction discussions
- Sex education content for age-appropriate audiences

### If False Positive Occurs

1. User reports incorrectly flagged content
2. Review logs to identify pattern
3. Adjust regex to be more context-specific
4. Add exception handling if needed
5. Add test case to prevent regression

## Performance

### Speed
- Keyword filter: < 1ms (no API calls)
- No performance impact on legitimate content
- Fail-fast design (rejects immediately)

### Cost
- Zero API cost for keyword-caught violations
- Prevents expensive API calls for obviously dangerous content

## Future Enhancements

Potential improvements:

1. **Machine Learning**: Train model on patterns to detect new variations
2. **Hashing**: Use PhotoDNA or similar for known CSAM image detection
3. **Behavioral Analysis**: Flag users who repeatedly attempt to post violations
4. **Network Sharing**: Collaborate with other platforms on known bad actors
5. **Age Verification**: For user-generated content (if platform adds that feature)

## Incident Response

If child safety violation is detected:

1. **Immediate**: Content is blocked from import
2. **Logging**: Incident logged with context (no content stored)
3. **Review**: Security team reviews logs
4. **Reporting**: If CSAM detected, follow NCMEC reporting procedure
5. **Improvement**: Update filters based on new patterns discovered

## Related Documentation

- [Reddit Content Moderation](./REDDIT_CONTENT_MODERATION.md) - Complete moderation system
- [Reddit Moderation Improvements](./REDDIT_MODERATION_IMPROVEMENTS.md) - Recent enhancements
- [Security Implementation](./SECURITY_IMPLEMENTATION.md) - Overall security approach

## Contact

For child safety concerns or to report violations:
- **Security Email**: security@allthrive.ai
- **Emergency**: Follow incident response procedure
- **NCMEC CyberTipline**: https://www.missingkids.org/gethelpnow/cybertipline

---

**Last Updated**: 2025-12-01  
**Policy Owner**: Security Team  
**Review Frequency**: Quarterly or after any incident
