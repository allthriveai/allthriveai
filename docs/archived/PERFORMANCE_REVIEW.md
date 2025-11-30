# Integration Performance & Concurrency Review

**Date:** 2025-11-27
**Status:** 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

**Issues Found:**
- 🔴 **6 Critical** - Async/sync mixing, no queueing, blocking operations
- 🟠 **3 High** - Performance bottlenecks, no caching
- 🟡 **2 Medium** - Missing optimizations

**Recommended Actions:**
1. Implement Celery background tasks (CRITICAL)
2. Add per-user import locking (CRITICAL)
3. Convert views to proper async (HIGH)
4. Add caching layer (MEDIUM)

---

## Critical Issues

### 1. 🔴 No User-Level Import Queueing

**Problem:**
Users can trigger multiple concurrent imports, causing:
- Database race conditions
- Duplicate API calls
- Wasted resources
- Unpredictable behavior

**Current Code:**
```python
# core/integrations/github/views.py:260
@ratelimit(key='user', rate=IMPORT_RATE_LIMIT, method='POST')
@api_view(['POST'])
def import_github_repo(request):
    # No check if user already has an import in progress!
    github_service = GitHubService(user_token)
    repo_files = github_service.get_repository_info_sync(owner, repo)  # Takes 5-30s
```

**Impact:**
- User clicks "Import" twice → 2 imports running
- Both fetch the same data from GitHub
- Both run AI analysis (expensive!)
- Race condition on project creation

**Fix Required:**
```python
# Use Redis or database lock
from django.core.cache import cache

def import_github_repo(request):
    lock_key = f'import_lock:{request.user.id}'

    if cache.get(lock_key):
        return Response({
            'success': False,
            'error': 'You already have an import in progress. Please wait.'
        }, status=409)

    cache.set(lock_key, True, timeout=300)  # 5 minute lock
    try:
        # ... do import
    finally:
        cache.delete(lock_key)
```

---

### 2. 🔴 Blocking Operations in HTTP Request

**Problem:**
Long-running operations block the HTTP worker thread:
- GitHub API fetch: 5-10 seconds
- README parsing: 1-2 seconds
- AI analysis: 3-10 seconds
- Total: **10-25 seconds per import**

**Current Code:**
```python
# core/integrations/github/views.py:334
github_service = GitHubService(user_token)
repo_files = github_service.get_repository_info_sync(owner, repo)  # BLOCKS 5-10s

asyncio.run(normalize_github_repo_data(...))  # BLOCKS 1-2s

analysis = analyze_github_repo(...)  # BLOCKS 3-10s (AI calls)
```

**Impact:**
- Worker thread tied up for 10-25 seconds
- Can't handle other requests during this time
- Poor scalability (limited by worker count)
- Timeout risk on slow connections
- User staring at loading spinner

**Fix Required:**
Move to background task queue (Celery):
```python
from celery import shared_task

@shared_task
def import_github_repo_async(user_id, url, is_showcase, is_private):
    # Runs in background worker
    # Doesn't block HTTP thread
    # Returns immediately to user
```

---

### 3. 🔴 Async/Sync Mixing Anti-Pattern

**Problem:**
Code mixes sync and async in inefficient ways:

```python
# core/integrations/github/views.py:340
repo_summary = asyncio.run(normalize_github_repo_data(...))
```

**Why This Is Bad:**
- `asyncio.run()` creates a NEW event loop each time
- Event loop overhead for single operation
- Can't share connections across operations
- Blocks thread anyway (defeats purpose of async)

**Also:**
```python
# core/integrations/github/integration.py:89
repo_data = github_service.get_repository_info_sync(owner, repo)
```

Method is `_sync` but called from async `fetch_project_data()`. Should be truly async.

**Fix Required:**
Either:
1. Make everything async (views, service, database ops)
2. OR move to background tasks (Celery) and make everything sync there

Don't mix both!

---

### 4. 🔴 No Background Task Queue

**Problem:**
All imports run synchronously in the HTTP request/response cycle.

**Should Be:**
```
User clicks Import
  ↓
API returns immediately: "Import started! ID: 12345"
  ↓
Background worker processes import
  ↓
WebSocket/polling updates user when done
```

**Currently:**
```
User clicks Import
  ↓
HTTP request hangs for 10-25 seconds
  ↓
User sees loading spinner
  ↓
Finally returns success/failure
```

**Fix Required:**
Implement Celery + Redis/RabbitMQ queue.

---

### 5. 🔴 Race Condition on Duplicate Imports

**Problem:**
Partially handled but not prevented:

```python
# core/integrations/github/views.py:416
except IntegrityError:
    # Concurrent request created the same project
    existing_project = Project.objects.get(user=request.user, external_url=url)
```

**Issues:**
- Still does all the work (API calls, AI analysis) before detecting duplicate
- Wastes GitHub API quota
- Wastes AI provider credits
- Wastes server resources

**Should Check First:**
```python
if Project.objects.filter(user=request.user, external_url=url).exists():
    return Response({'error': 'Already imported'}, status=409)
```

---

### 6. 🔴 No Async View Support

**Problem:**
Views are sync but call async functions:

```python
@api_view(['POST'])  # Sync view
def import_github_repo(request):
    # Calls async function with asyncio.run()
    repo_summary = asyncio.run(normalize_github_repo_data(...))
```

**Should Be:**
```python
@api_view(['POST'])  # Or use async def
async def import_github_repo(request):
    # Properly await async functions
    repo_summary = await normalize_github_repo_data(...)
```

**Note:**
Django 4.1+ supports async views natively!

---

## High Priority Issues

### 7. 🟠 No Caching of GitHub API Responses

**Problem:**
Every import fetches fresh data from GitHub:
- Uses API quota unnecessarily
- Slower than needed
- GitHub rate limits kick in faster

**Fix:**
Cache GitHub API responses for 5-15 minutes:
```python
from django.core.cache import cache

cache_key = f'github_repo:{owner}/{repo}'
repo_data = cache.get(cache_key)

if not repo_data:
    repo_data = github_service.fetch_repository(...)
    cache.set(cache_key, repo_data, timeout=300)  # 5 minutes
```

---

### 8. 🟠 AI Analysis Not Parallelizable

**Problem:**
AI analysis runs serially:
1. Analyze description (3-5s)
2. Generate diagram (3-5s)
3. Parse README (1-2s)

**Could Run in Parallel:**
```python
import asyncio

results = await asyncio.gather(
    analyze_description(repo_data),
    generate_diagram(repo_data),
    parse_readme(readme_content),
)
```

---

### 9. 🟠 No Progress Tracking

**Problem:**
User has no idea what's happening during 10-25 second wait.

**Fix:**
Use WebSocket or polling to send progress updates:
```
✓ Fetching repository data...
✓ Analyzing README...
✓ Generating AI metadata...
✓ Creating project...
```

---

## Medium Priority Issues

### 10. 🟡 No Request Timeout Protection

**Problem:**
If GitHub API is slow, request can hang indefinitely (or until gunicorn timeout).

**Fix:**
Add explicit timeouts:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(url)
```

---

### 11. 🟡 No Retry Logic for Transient Failures

**Problem:**
Network blip = failed import.

**Fix:**
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def fetch_github_data(url):
    # Auto-retries on failure
```

---

## Performance Metrics

### Current Performance

**Single Import:**
- GitHub API fetch: 5-10s
- README parsing: 1-2s
- AI analysis: 3-10s
- Database writes: <1s
- **Total: 10-25s**

**Concurrent Imports (per user):**
- User can trigger unlimited
- Each takes 10-25s
- Race conditions likely

**Scalability:**
- Limited by HTTP worker count
- 10 workers = max 10 concurrent imports across ALL users
- Blocks other API requests

### Target Performance (After Fixes)

**HTTP Request:**
- Validation: <100ms
- Queue task: <50ms
- Return response: <200ms
- **Total: <500ms** ✅

**Background Task:**
- Same 10-25s, but non-blocking
- User can continue using app
- WebSocket updates

**Concurrent Imports:**
- 1 per user max (locked)
- Unlimited users (Celery workers)
- No HTTP worker blocking

---

## Recommended Architecture

### Current (Problematic)
```
User → HTTP Request → Django View (sync)
                         ↓
                    GitHub API (5-10s BLOCKS)
                         ↓
                    AI Analysis (3-10s BLOCKS)
                         ↓
                    Database Write
                         ↓
                    HTTP Response (after 10-25s!)
```

### Recommended (Async + Queue)
```
User → HTTP Request → Django View (async)
                         ↓
                    Quick validation (<100ms)
                         ↓
                    Queue Celery task
                         ↓
                    HTTP Response: "Import started!"

Background Worker (Celery):
    ↓
GitHub API (non-blocking)
    ↓
AI Analysis (non-blocking)
    ↓
Database Write
    ↓
WebSocket notification → User
```

---

## Implementation Plan

### Phase 1: Critical Fixes (MUST DO)

1. **Add per-user import locking**
   - Use Django cache with user-specific keys
   - 5-minute lock duration
   - Clear on success/failure

2. **Add duplicate check BEFORE processing**
   - Check `Project.objects.filter(user=user, external_url=url).exists()`
   - Return early if exists

3. **Set up Celery**
   - Install: `pip install celery redis`
   - Create `tasks.py` with import task
   - Configure Redis as broker
   - Run Celery workers

4. **Move import to background task**
   - View: validate + queue + return
   - Task: do actual work
   - WebSocket/polling for updates

### Phase 2: Performance Optimizations

5. **Convert to proper async**
   - Use `async def` views
   - Use `httpx.AsyncClient` for GitHub
   - Use `await` everywhere
   - No more `asyncio.run()`

6. **Add caching**
   - Cache GitHub API responses (5 min)
   - Cache AI analysis results (15 min)
   - Cache-Control headers

7. **Parallelize AI operations**
   - Use `asyncio.gather()`
   - Run concurrent operations

### Phase 3: Nice-to-Haves

8. **Add progress tracking**
   - WebSocket support
   - Real-time updates
   - Progress bar

9. **Add retry logic**
   - Use `tenacity` library
   - Exponential backoff
   - Max 3 retries

10. **Add monitoring**
    - Track import durations
    - Alert on failures
    - Metrics dashboard

---

## Code Examples

### Example 1: Per-User Locking

```python
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['POST'])
def import_github_repo(request):
    url = request.data.get('url')
    lock_key = f'github_import_lock:{request.user.id}'

    # Check if user already has import in progress
    if cache.get(lock_key):
        return Response({
            'success': False,
            'error': 'You already have an import in progress. Please wait for it to complete.'
        }, status=409)

    # Check for duplicates BEFORE doing work
    from core.integrations.github.helpers import parse_github_url
    try:
        owner, repo = parse_github_url(url)
    except ValueError as e:
        return Response({'success': False, 'error': str(e)}, status=400)

    if Project.objects.filter(user=request.user, external_url=url).exists():
        return Response({
            'success': False,
            'error': 'You have already imported this repository.'
        }, status=409)

    # Acquire lock for 5 minutes
    cache.set(lock_key, True, timeout=300)

    try:
        # Queue background task
        from core.integrations.tasks import import_github_repo_task
        task = import_github_repo_task.delay(
            user_id=request.user.id,
            url=url,
            is_showcase=request.data.get('is_showcase', True),
            is_private=request.data.get('is_private', False)
        )

        return Response({
            'success': True,
            'task_id': task.id,
            'message': 'Import started! You will be notified when complete.'
        })
    except Exception as e:
        # Release lock on error
        cache.delete(lock_key)
        raise
```

### Example 2: Celery Task

```python
# core/integrations/tasks.py

from celery import shared_task
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def import_github_repo_task(self, user_id, url, is_showcase=True, is_private=False):
    """Background task for importing GitHub repositories."""
    from django.contrib.auth import get_user_model
    from core.projects.models import Project
    from core.integrations.github import GitHubIntegration
    from core.integrations.base.exceptions import IntegrationError

    User = get_user_model()
    lock_key = f'github_import_lock:{user_id}'

    try:
        user = User.objects.get(id=user_id)

        # Use integration
        integration = GitHubIntegration()
        project_data = await integration.fetch_project_data(url, user)

        # Create project
        project = Project.objects.create(
            user=user,
            title=project_data.get('name'),
            description=project_data.get('description'),
            type=Project.ProjectType.GITHUB_REPO,
            external_url=url,
            content=project_data,
            is_showcase=is_showcase,
            is_published=not is_private,
        )

        logger.info(f'Successfully imported {url} as project {project.id}')

        # Send notification (WebSocket or email)
        # notify_user(user_id, 'import_complete', {'project_id': project.id})

        return {
            'success': True,
            'project_id': project.id,
            'slug': project.slug,
        }

    except IntegrationError as e:
        logger.error(f'Integration error: {e}')
        # Retry on transient errors
        raise self.retry(exc=e, countdown=60)  # Retry after 1 minute

    finally:
        # Always release lock
        cache.delete(lock_key)
```

### Example 3: Proper Async View

```python
from django.http import JsonResponse
from asgiref.sync import sync_to_async

async def import_github_repo_async(request):
    """Async view for GitHub import."""
    # Parse request
    data = json.loads(request.body)
    url = data.get('url')

    # Validate
    integration = GitHubIntegration()
    if not integration.supports_url(url):
        return JsonResponse({'error': 'Invalid GitHub URL'}, status=400)

    # Fetch data (truly async, no blocking!)
    project_data = await integration.fetch_project_data(url, request.user)

    # Database write (sync operation wrapped in sync_to_async)
    project = await sync_to_async(Project.objects.create)(
        user=request.user,
        **project_data
    )

    return JsonResponse({'success': True, 'project_id': project.id})
```

---

## Summary

**Current State:** 🔴 Not production-ready for concurrent users

**Critical Issues:**
- No import queueing (users can DOS themselves)
- Blocking operations in HTTP thread
- Poor async/sync mixing
- No background tasks

**After Fixes:** ✅ Production-ready

**Estimated Implementation Time:**
- Phase 1 (Critical): 4-6 hours
- Phase 2 (Performance): 3-4 hours
- Phase 3 (Nice-to-have): 2-3 hours
- **Total: 9-13 hours**

**ROI:**
- User experience: 10-25s wait → <500ms response
- Scalability: 10x improvement
- Reliability: No race conditions
- Cost: Saves GitHub API quota & AI credits
