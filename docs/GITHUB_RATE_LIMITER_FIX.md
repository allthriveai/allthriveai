# GitHub Rate Limiter Fix - cache.ttl() Error

## Issue

GitHub repository import was failing with a 500 Internal Server Error when fetching repositories via `/api/v1/github/repos/`.

**Error**: `AttributeError: 'RedisCache' object has no attribute 'ttl'`

## Root Cause

The `GitHubRateLimiter` class in `services/github_rate_limiter.py` was calling `cache.ttl()` which is not a method available in Django's cache API. While Redis itself has a `TTL` command, Django's cache abstraction layer doesn't expose this method through its standard interface.

The error occurred in two places:
1. Line 51: `ttl = cache.ttl(cache_key) or window_seconds`
2. Line 102: `ttl = cache.ttl(cache_key)`

## Solution

Implemented manual TTL tracking using additional cache keys:

### Changes Made

1. **Added expiry timestamp tracking** (line 33-35):
   - Created `_get_expiry_cache_key()` method to generate cache keys for storing expiry timestamps
   - Each rate limit window now stores its expiration time as a Unix timestamp

2. **Updated `check_rate_limit()` method** (lines 37-87):
   - Store expiry timestamp on the first request in each window
   - Calculate `retry_after` from the stored expiry timestamp instead of calling `cache.ttl()`
   - Fallback to `window_seconds` if no expiry timestamp is found

3. **Updated `get_retry_after()` method** (lines 117-127):
   - Retrieve expiry timestamp from cache instead of using `cache.ttl()`
   - Calculate remaining time until expiry
   - Return 0 if no expiry timestamp exists

### Implementation Details

```python
# Store expiry timestamp on first request
if current_count == 0:
    expiry_timestamp = time.time() + window_seconds
    cache.set(expiry_key, expiry_timestamp, window_seconds)

# Calculate retry_after from stored timestamp
if expiry_timestamp:
    retry_after = max(0, int(expiry_timestamp - time.time()))
else:
    retry_after = window_seconds
```

## Benefits

1. **Django Cache Compatibility**: Works with any Django cache backend, not just Redis
2. **Accurate TTL Tracking**: Manual tracking provides precise expiry times
3. **Graceful Degradation**: Falls back to window_seconds if expiry key is missing
4. **No External Dependencies**: Uses only standard Django cache operations

## Testing

After the fix:
- GitHub connection check succeeds
- Repository list fetch completes without errors
- Rate limiting continues to function correctly
- Import flow proceeds to repository selection

## Rate Limit Configuration

Increased rate limits for better development experience:
- **Repo fetches**: 50 per hour per user (up from 10)
- **Imports**: 20 per hour per user (up from 5)

These can be adjusted via environment variables:
- `GITHUB_USER_REPO_FETCHES_PER_HOUR`
- `GITHUB_USER_IMPORTS_PER_HOUR`

## Files Modified

- `services/github_rate_limiter.py`: Fixed cache.ttl() calls with manual TTL tracking
- `config/settings.py`: Increased default rate limits
- `frontend/src/services/github.ts`: Added rate limit error handling
- `frontend/src/components/projects/RightAddProjectChat.tsx`: Improved rate limit error messages in chat

## Related Issues

This fix resolves the 500 error blocking GitHub repository imports when users click "Import from GitHub" in the project creation flow.
