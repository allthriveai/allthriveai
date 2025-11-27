# GitHub MCP Logging Analysis

## Current State

### ✅ Good Logging Coverage

1. **MCP Service Operations**
   - `get_readme()` - Logs warnings on failures: `Failed to fetch README for {owner}/{repo}`
   - `get_repository_tree()` - Logs warnings on failures: `Failed to fetch tree for {owner}/{repo}`
   - `get_repository_info()` - Logs info on start/completion
   - Token validation - Raises `ValueError` immediately (fail-fast)

2. **Helper Functions**
   - `normalize_mcp_repo_data()` - Logs warnings: `Failed to fetch repo metadata for {owner}/{repo}`
   - `apply_ai_metadata()` - Logs warnings: `Category {cat_id} not found`
   - `get_user_github_token()` - Logs warnings: `No GitHub connection found for user {user.id}`

3. **AI Analysis**
   - Differentiates between expected errors (OpenAIError, JSONDecodeError) and unexpected
   - Logs at appropriate levels (warning vs error)
   - Uses `exc_info=True` for unexpected errors

4. **Import View**
   - Logs import start: `Importing GitHub repo {owner}/{repo} for user {request.user.id}`
   - Logs AI analysis results with metrics
   - Logs race conditions: `Race condition detected: project {id} already exists`
   - Logs completion: `Successfully imported GitHub repo {owner}/{repo} as project {project.id}`
   - Logs errors: `Failed to import GitHub repo: {e}` with exc_info

### 🟡 Silent Failures

1. **Dependency File Fetching** (`services/github_mcp_service.py:166`)
   ```python
   except Exception:
       files[path] = None
   ```
   **Issue:** No logging when individual dependency file fetch fails
   
   **Impact:** Low - dependency files are optional, but still useful for debugging
   
   **Recommendation:**
   ```python
   except Exception as e:
       logger.debug(f'Failed to fetch {path} for {owner}/{repo}: {e}')
       files[path] = None
   ```

2. **Django-Allauth Token Lookup** (`services/github_helpers.py:61-62`)
   ```python
   except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist):
       pass
   ```
   **Issue:** Silent pass before trying SocialConnection
   
   **Impact:** Very low - this is expected flow, just trying two sources
   
   **Recommendation:** Already logs at warning level if both fail (line 70)

3. **AI Analysis Missing Return** (`services/github_ai_analyzer.py:150-158`)
   ```python
   except (OpenAIError, AnthropicError) as e:
       logger.warning(f'AI provider error for {name}: {e}, using fallback metadata')
   except json.JSONDecodeError as e:
       logger.warning(f'AI returned invalid JSON for {name}: {e}, using fallback metadata')
   except Exception as e:
       logger.error(f'Unexpected error in AI analysis for {name}: {e}', exc_info=True)
       # Falls through to fallback...
   ```
   **Issue:** No explicit return after logging, relies on fall-through to fallback block
   
   **Impact:** Low - works but unclear flow
   
   **Recommendation:** Explicitly handle fallback in each except block or add comment

## Logging Levels Used

| Level | Usage |
|-------|-------|
| `DEBUG` | OAuth token source selection |
| `INFO` | Import flow milestones, AI analysis metrics, successful operations |
| `WARNING` | Expected failures (README not found, category not found, AI errors) |
| `ERROR` | Unexpected exceptions with full stack traces |

## Metrics & Observability

### Currently Logged Metrics

1. **Import Flow**
   - Repository being imported (owner/repo)
   - User ID performing import
   - AI analysis results (description length, categories count, topics count)
   - Hero image presence
   - Project ID after creation

2. **MCP Operations**
   - Start/completion of repository info fetch
   - Individual operation failures (README, tree, deps)

3. **Race Conditions**
   - When duplicate project creation is detected

### Missing Metrics

1. **Performance**
   - Time taken for MCP operations
   - Time taken for AI analysis
   - Total import duration

2. **Success Rates**
   - README fetch success rate
   - AI analysis success rate  
   - Overall import success rate

3. **Retry Statistics**
   - Number of retries performed
   - Which operations required retries

### Recommendations for Metrics

```python
import time
from django.core.cache import cache

# Track success rates
def track_import_success(success: bool):
    key = f'github_import_{"success" if success else "failure"}_count'
    cache.incr(key, default=0)

# Track timing
start_time = time.time()
# ... operation ...
duration = time.time() - start_time
logger.info(f'MCP fetch completed in {duration:.2f}s')
```

## Rate Limiting Logs

- Rate limit hits are now logged via view: `Rate limit exceeded`
- HTTP 429 returned to user
- No metrics on rate limit hits (could add)

## Error Tracking

### Covered Scenarios

✅ Invalid GitHub URL  
✅ GitHub token missing  
✅ GitHub token invalid (would fail in MCP call)  
✅ Repository not found  
✅ Network errors (with retries)  
✅ Duplicate imports (race condition)  
✅ AI analysis failures  
✅ README parsing failures  

### Edge Cases to Consider

⚠️ GitHub API rate limit exceeded (logged via 403 response)  
⚠️ MCP server down (would be caught by retry logic)  
⚠️ Very large READMEs (no size limit check)  
⚠️ Malformed JSON from MCP (would be caught by json.loads)  
⚠️ Database connection issues during import (Django handles)  

## Best Practices Followed

✅ Structured logging with context (owner/repo, user_id)  
✅ Appropriate log levels  
✅ Stack traces for unexpected errors (`exc_info=True`)  
✅ Fail-fast with clear errors (token validation)  
✅ Graceful degradation (fallback metadata)  
✅ User-friendly error messages (separate from logs)  

## Recommendations

### P0 (Critical)
None - logging coverage is good

### P1 (Should Add)
1. Add debug logging for dependency file fetch failures
2. Track import duration metrics
3. Track AI analysis success rate

### P2 (Nice to Have)
1. Add structured logging (JSON format) for easier parsing
2. Add correlation IDs for request tracing
3. Add Sentry/error tracking integration
4. Add performance monitoring (APM)

## Example Enhanced Logging

```python
import logging
import time
from contextlib import contextmanager

logger = logging.getLogger(__name__)

@contextmanager
def log_operation(operation_name, **context):
    """Context manager for consistent operation logging."""
    start_time = time.time()
    logger.info(f'Starting {operation_name}', extra=context)
    
    try:
        yield
        duration = time.time() - start_time
        logger.info(
            f'Completed {operation_name} in {duration:.2f}s',
            extra={**context, 'duration': duration, 'success': True}
        )
    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f'Failed {operation_name} after {duration:.2f}s: {e}',
            extra={**context, 'duration': duration, 'success': False},
            exc_info=True
        )
        raise

# Usage
with log_operation('github_import', user_id=user.id, repo=f'{owner}/{repo}'):
    # ... import logic ...
```

## Conclusion

The GitHub MCP integration has **good logging coverage** with:
- Appropriate log levels
- Contextual information
- Error handling with stack traces
- User-friendly error messages

Main improvement opportunity is adding **metrics/observability** for monitoring success rates and performance in production.
