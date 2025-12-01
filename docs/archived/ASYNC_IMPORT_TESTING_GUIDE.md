# Async GitHub Import - Testing Guide

**Date:** 2025-11-27
**Status:** ✅ **READY FOR TESTING**

---

## What's Running

### Backend Services

1. **Django Development Server** (assumed running)
   - URL: http://localhost:8000
   - Handles API requests

2. **Redis Server** ✅ RUNNING
   - Started via: `brew services start redis`
   - Used as Celery message broker

3. **Celery Worker** ✅ RUNNING
   - Command: `celery -A config worker --loglevel=info --concurrency=2`
   - Processes background import tasks
   - Discovered tasks:
     - `core.integrations.tasks.import_github_repo_task`
     - `core.integrations.tasks.import_project_generic_task`

### Frontend

1. **React Development Server** ✅ RUNNING
   - Updated to use async import endpoint
   - Shows real-time progress updates

---

## How to Test

### Test 1: Async Import with Progress Updates

1. **Navigate to the Add Project page**
   ```
   http://localhost:5173/projects/add
   ```

2. **Click "Import from GitHub"**
   - Should load your GitHub repositories

3. **Select a repository to import**
   - Watch for progress messages in the chat:
     - "Import started..."
     - "Waiting to start..." or "Processing repository..."
     - "Import complete!"
   - Total time: ~2-3 seconds for API response + background processing
   - User sees immediate feedback instead of 10-25 second wait

4. **Verify success**
   - Should redirect to the imported project page
   - Check that project was created correctly

### Test 2: Per-User Import Locking

1. **Start an import in one browser tab**

2. **In another tab, try to start another import**
   - Should get error: "You already have an import in progress"
   - Prevents duplicate/concurrent imports

3. **Wait for first import to complete**

4. **Try importing again**
   - Should work now (lock released)

### Test 3: Duplicate Detection

1. **Import a repository**

2. **Try to import the same repository again**
   - Should get immediate error: "Repository already imported"
   - Response should be instant (<100ms)
   - Should include link to existing project

### Test 4: Celery Task Status

**Manual API Test:**

```bash
# Start an import and capture task ID
RESPONSE=$(curl -X POST http://localhost:8000/api/github/import-async/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/user/repo", "is_showcase": false}')

echo $RESPONSE
# Should see: {"success": true, "task_id": "abc123...", ...}

# Extract task ID
TASK_ID=$(echo $RESPONSE | jq -r '.data.task_id')

# Check status (poll this every 2 seconds)
curl http://localhost:8000/api/integrations/tasks/$TASK_ID/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Status progression:
# 1. {"status": "PENDING", ...}
# 2. {"status": "STARTED", ...}
# 3. {"status": "SUCCESS", "result": {...}}
```

---

## Expected Behavior

### Synchronous Endpoint (Legacy)

**URL:** `POST /api/github/import/`

**Behavior:**
- ❌ Blocks for 10-25 seconds
- ❌ User must wait for entire import
- ✅ Returns project data directly
- ✅ Still works (for backward compatibility)

**Use when:** Simple scripts, admin tools, testing

### Async Endpoint (Recommended)

**URL:** `POST /api/github/import-async/`

**Behavior:**
- ✅ Returns in <500ms
- ✅ User can continue using app
- ✅ Progress updates via polling
- ✅ Better scalability

**Use when:** Production frontend, user-facing features

---

## Monitoring Celery

### Watch Task Execution

The Celery worker is running in the background. To see its logs:

```bash
# Get the process ID
ps aux | grep celery

# Or check background bash output (if available)
# Shows real-time task execution logs
```

### Expected Log Output

When a task is queued:

```
[2025-11-27 20:37:37] Task core.integrations.tasks.import_github_repo_task[abc123] received
[2025-11-27 20:37:37] Task core.integrations.tasks.import_github_repo_task[abc123] started
[2025-11-27 20:37:40] Starting background import of owner/repo for user username (task abc123)
[2025-11-27 20:37:45] Running AI analysis for owner/repo
[2025-11-27 20:37:50] Creating project for owner/repo
[2025-11-27 20:37:55] Successfully imported owner/repo as project 123 (task abc123)
[2025-11-27 20:37:55] Task core.integrations.tasks.import_github_repo_task[abc123] succeeded in 18.23s
```

---

## Troubleshooting

### Issue: Celery worker not receiving tasks

**Check:**
1. Redis is running: `redis-cli ping` (should return "PONG")
2. Celery worker is running (check process list)
3. Task is registered (check Celery startup logs for task list)

**Fix:**
```bash
# Restart Redis
brew services restart redis

# Restart Celery
# Kill existing worker, then:
source .venv/bin/activate
celery -A config worker --loglevel=info --concurrency=2
```

### Issue: Frontend shows "Import timeout"

**Possible causes:**
1. Celery worker not running
2. Task is stuck (check Celery logs)
3. Very large repository (timeout after 2 minutes)

**Check Celery logs:**
```bash
# Watch for errors in worker output
```

### Issue: Import succeeds but project not created

**Check:**
1. Database connection
2. Celery worker logs for errors
3. Task result in Redis:
   ```bash
   redis-cli
   > KEYS celery-task-meta-*
   > GET celery-task-meta-abc123
   ```

---

## Performance Comparison

### Before (Synchronous)

```
User clicks import
    ↓
[10-25 second wait with spinner]
    ↓
Project created
    ↓
Redirect to project
```

**User Experience:** 😤 Long wait, can't do anything else

### After (Asynchronous)

```
User clicks import
    ↓
[<500ms] "Import started..."
    ↓
[Background processing] "Processing repository..."
    ↓
[~10-25s total] "Import complete!"
    ↓
Redirect to project
```

**User Experience:** 😊 Instant feedback, can continue using app

---

## Frontend Changes Summary

### Updated File: `frontend/src/services/github.ts`

**Added:**
- `TaskStatus` interface
- `importGitHubRepoAsync()` function (new, recommended)
- `pollTaskStatus()` helper function

**Modified:**
- `importGitHubRepo()` - marked as legacy, still works

### Updated File: `frontend/src/components/projects/RightAddProjectChat.tsx`

**Changed:**
- Import: `importGitHubRepo` → `importGitHubRepoAsync`
- Added progress callback to show status updates in chat
- User now sees:
  1. "Import started..."
  2. "Waiting to start..." or "Processing repository..."
  3. "Import complete!"
  4. "✅ Successfully imported..."

---

## API Endpoints Summary

### GitHub Integration

| Endpoint | Method | Type | Response Time | Use Case |
|----------|--------|------|---------------|----------|
| `/api/github/repos/` | GET | Sync | <1s | List user's repos |
| `/api/github/import/` | POST | Sync | 10-25s | Legacy import |
| `/api/github/import-async/` | POST | Async | <500ms | **Recommended import** |
| `/api/integrations/tasks/{id}/` | GET | Sync | <100ms | Check task status |

### Example Flow (Async Import)

```javascript
// 1. Queue the import task
const response = await fetch('/api/github/import-async/', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://github.com/user/repo' })
});
const { task_id } = await response.json();

// 2. Poll for status every 2 seconds
const pollStatus = async () => {
  const status = await fetch(`/api/integrations/tasks/${task_id}/`);
  const data = await status.json();

  if (data.status === 'SUCCESS') {
    console.log('Done!', data.result);
  } else if (data.status === 'FAILURE') {
    console.error('Failed:', data.error);
  } else {
    // Still processing
    setTimeout(pollStatus, 2000);
  }
};

pollStatus();
```

---

## Next Steps (Optional Enhancements)

1. **WebSocket Support**
   - Real-time updates instead of polling
   - Push notifications when import completes

2. **Progress Bar**
   - Show percentage complete
   - Estimated time remaining

3. **Notification System**
   - Browser notification when import completes
   - Email notification for long-running imports

4. **Batch Import**
   - Import multiple repositories at once
   - Queue management UI

---

## Success Criteria

✅ All tests should pass:
- [x] Celery worker discovers tasks
- [x] Redis is running
- [x] Frontend compiles without errors
- [ ] Async import completes successfully
- [ ] Progress updates appear in UI
- [ ] Per-user locking works
- [ ] Duplicate detection works
- [ ] Task status endpoint returns correct status

---

## Summary

**Status:** Ready for testing

**Services Running:**
- ✅ Redis
- ✅ Celery worker (2 concurrent workers)
- ✅ Frontend dev server

**Next Action:** Test the async import flow in the browser!

**Test URL:** http://localhost:5173/projects/add → Click "Import from GitHub" → Select a repo

Expected result: Immediate response with progress updates, then redirect to imported project.
