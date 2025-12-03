# Reddit Thread Deletion Tracking

## Overview

The system tracks Reddit threads that should not be synced:
1. **Admin Deletions**: When admins delete Reddit thread projects, preventing recreation during resync
2. **Moderation Failures**: When posts fail content moderation, preventing re-attempts on every sync

## Problem Statement

**Problem 1: Deleted posts coming back**
When an admin deleted a Reddit thread project:
1. The `Project` record was deleted
2. The associated `RedditThread` record was also deleted (CASCADE relationship)
3. During the next sync, the RSS feed would still contain the post
4. The sync service would see the thread doesn't exist and recreate it

**Problem 2: Re-moderating same content**
When a post failed content moderation:
1. The post was skipped (not created)
2. During the next sync, the same post would be checked again
3. Content moderation (especially image moderation) would run again
4. This wasted API calls and processing time on every sync

Both issues created inefficient loops.

## Solution

We now track blocked Reddit threads in a `DeletedRedditThread` table:

1. **Admin Deletions**: When an admin deletes a project, we record it with type `admin_deleted`
2. **Moderation Failures**: When a post fails moderation, we record it with type `moderation_failed`

The sync service checks this table and skips any posts that have been previously blocked.

## Database Schema

### DeletedRedditThread Model

```python
class DeletedRedditThread(models.Model):
    class DeletionType(models.TextChoices):
        ADMIN_DELETED = 'admin_deleted', 'Admin Deleted'
        MODERATION_FAILED = 'moderation_failed', 'Moderation Failed'
    
    reddit_post_id = models.CharField(max_length=50, unique=True, db_index=True)
    deletion_type = models.CharField(max_length=20, choices=DeletionType.choices)
    agent = models.ForeignKey(RedditCommunityAgent, on_delete=models.CASCADE)
    subreddit = models.CharField(max_length=100, db_index=True)
    deleted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    deleted_at = models.DateTimeField(auto_now_add=True)
    deletion_reason = models.TextField(blank=True, default='')
```

**Key Fields:**
- `reddit_post_id`: The unique Reddit post ID (e.g., "t3_123abc")
- `deletion_type`: Either `admin_deleted` or `moderation_failed`
- `agent`: Reference to the agent that originally created/attempted the thread
- `subreddit`: Subreddit name for reference
- `deleted_by`: The admin user who deleted the thread (NULL for moderation failures)
- `deleted_at`: Timestamp of deletion/rejection
- `deletion_reason`: Reason for deletion or moderation failure details

## How It Works

### 1. Project Deletion

When an admin deletes a Reddit thread project (via API or Django admin):

```python
# In ProjectViewSet.perform_destroy()
if instance.type == Project.ProjectType.REDDIT_THREAD and hasattr(instance, 'reddit_thread'):
    self._record_reddit_thread_deletion(instance, self.request.user)

instance.delete()
```

This creates a `DeletedRedditThread` record before the project is deleted.

### 2. Sync Service Check

During sync, before processing each post:

```python
# In RedditSyncService._process_post()
if DeletedRedditThread.objects.filter(reddit_post_id=reddit_post_id).exists():
    logger.debug(f'Skipping Reddit post {reddit_post_id} - was previously deleted by admin')
    return False, False  # Don't create or update
```

The sync service skips any posts that have deletion records.

### 3. Moderation Failure Tracking

When a post fails content moderation during sync:

```python
# In RedditSyncService._create_thread()
approved, reason, moderation_data = cls._moderate_content(...)

if not approved:
    # Record the failure to prevent re-attempting
    cls._record_moderation_failure(agent, post_data, reason, moderation_data)
    return
```

This creates a `DeletedRedditThread` record with type `moderation_failed`.

### 4. Bulk Deletion

The bulk delete endpoint also records deletions:

```python
# Before deleting projects
for project in queryset:
    if project.type == Project.ProjectType.REDDIT_THREAD and hasattr(project, 'reddit_thread'):
        self._record_reddit_thread_deletion(project, request.user)

deleted_count, _ = queryset.delete()
```

## Usage Examples

### Deleting a Single Reddit Thread

```bash
# Via API (requires admin authentication)
DELETE /api/v1/projects/{project_id}/
```

The deletion is automatically tracked.

### Bulk Deletion

```bash
# Via API (requires admin authentication)
POST /api/v1/projects/bulk-delete/
{
  "project_ids": [123, 456, 789]
}
```

All Reddit thread deletions are tracked.

### Viewing Deleted Threads

Access the Django admin:
```
/admin/integrations/deletedredditthread/
```

You can:
- View all deleted threads
- Filter by subreddit, agent, or deletion date
- Search by post ID or deletion reason
- Edit deletion reasons
- Delete records to allow threads back

### Manually Blocking a Thread

To prevent a thread from being synced without first creating it:

```python
from core.integrations.reddit_models import DeletedRedditThread, RedditCommunityAgent

agent = RedditCommunityAgent.objects.get(subreddit='chatgpt')

DeletedRedditThread.objects.create(
    reddit_post_id='t3_123abc',
    agent=agent,
    subreddit='chatgpt',
    deleted_by=request.user,
    deletion_reason='Manually blocked spam post'
)
```

Or via Django admin at `/admin/integrations/deletedredditthread/add/`.

### Allowing a Thread Back

If you want to allow a previously deleted thread to be synced again:

1. Go to Django admin: `/admin/integrations/deletedredditthread/`
2. Find the deletion record
3. Delete the record
4. The thread will be recreated on the next sync if it's still in the RSS feed

## Testing

Run the test suite:

```bash
pytest services/tests/test_deleted_reddit_threads.py -v
```

Tests cover:
- Admin deletion record creation
- Moderation failure tracking
- Sync service skipping both types
- Multiple sync attempts (persistence)
- Bulk deletion tracking
- Distinguishing admin deletions from moderation failures
- Normal thread creation still works

## Monitoring

### Logs

The system logs deletion tracking:

```
INFO: Recorded deletion of Reddit thread t3_123abc (r/chatgpt) by admin_user
INFO: Recorded moderation failure for t3_456def (r/chatgpt) - will not re-attempt
DEBUG: Skipping Reddit post t3_123abc - was previously deleted by admin
```

### Admin Dashboard

View deletion statistics in Django admin:
- Total blocked threads per agent (admin deleted + moderation failed)
- Filter by deletion type
- Recent deletions and rejections
- Most common deletion/failure reasons

## Migrations

To apply the database changes:

```bash
# Create the table
python manage.py migrate integrations 0005_add_deleted_reddit_threads

# Add deletion_type field
python manage.py migrate integrations 0006_add_deletion_type
```

This creates the `deleted_reddit_threads` table with appropriate indexes and fields.

## Edge Cases

### Thread Deleted Then Reddit Post Deleted

If a Reddit post is deleted from Reddit after we've tracked its deletion:
- The deletion record persists (no harm)
- The post won't appear in future RSS feeds anyway
- No action needed

### Agent Deletion

If a `RedditCommunityAgent` is deleted:
- All associated `DeletedRedditThread` records are cascade deleted
- This is intentional - if the agent is removed, its deletion history goes too

### Restoration

To restore a thread:
1. Delete the `DeletedRedditThread` record
2. Run a manual sync: `python manage.py sync_reddit_agents`
3. The thread will be recreated if still in RSS feed

## Performance Considerations

- Deletion check is a single indexed query: `O(1)` lookup
- Minimal performance impact on sync
- Indexes on `reddit_post_id` ensure fast lookups

## Benefits

### Efficiency
- **Reduced API calls**: Don't re-moderate failed posts on every sync
- **Faster syncs**: Skip blocked posts immediately
- **Cost savings**: Fewer image moderation API calls

### Admin Control
- Permanent deletion: Deleted posts stay deleted
- Clear audit trail: See why posts were blocked
- Flexible restoration: Can restore if needed

## Future Enhancements

Potential improvements:
- Auto-expire moderation failure records after X days (allow retry of borderline content)
- Bulk restoration interface
- Export deletion/failure history for analysis
- Pattern-based blocking (e.g., block all posts from specific authors)
- Different retry policies for different moderation failure reasons

## Related Documentation

- [Reddit Curation AI Agents](./REDDIT_CURATION_BOTS.md)
- [Reddit Content Moderation](./REDDIT_CONTENT_MODERATION.md)
- [Project Management API](./API_DOCUMENTATION.md)
