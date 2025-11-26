# Project Cache Invalidation Fix

## Issue

When creating a new project via GitHub import (or any other method), the project would not appear immediately when navigating to `/{username}/{projectSlug}`. The frontend would show "Project not found" error.

### Root Cause

The `public_user_projects` endpoint caches user project lists to improve performance:
- Cache key: `projects:v2:{username}:own` (for authenticated users viewing their own profile)
- Cache key: `projects:v2:{username}:public` (for public/unauthenticated views)
- TTL: 60 seconds for own projects, 180 seconds for public projects

When a new project was created, the cache was not invalidated, so:
1. User creates project via GitHub import
2. Backend returns redirect URL: `/{username}/{project-slug}`
3. Frontend navigates to project detail page
4. Frontend calls `/api/v1/users/{username}/projects/{slug}/` endpoint
5. New direct endpoint works fine and returns the project ✅
6. BUT: If user went back to their profile, the cached project list wouldn't include the new project

## Solution

Added automatic cache invalidation after all project mutations:

### 1. GitHub Import (`core/integrations/github/views.py`)

```python
# After creating project from GitHub import
from django.core.cache import cache
username_lower = request.user.username.lower()
cache.delete(f'projects:v2:{username_lower}:own')
cache.delete(f'projects:v2:{username_lower}:public')
```

### 2. ProjectViewSet (`core/projects/views.py`)

Added cache invalidation to all CRUD operations:

**Create:**
```python
def perform_create(self, serializer):
    project = serializer.save(user=self.request.user)
    self._invalidate_user_cache(self.request.user)
```

**Update:**
```python
def perform_update(self, serializer):
    project = serializer.save()
    self._invalidate_user_cache(self.request.user)
```

**Delete:**
```python
def perform_destroy(self, instance):
    user = instance.user
    instance.delete()
    self._invalidate_user_cache(user)
```

**Bulk Delete:**
```python
def bulk_delete(self, request):
    deleted_count, _ = Project.objects.filter(...).delete()
    if deleted_count > 0:
        self._invalidate_user_cache(request.user)
```

**Helper Method:**
```python
def _invalidate_user_cache(self, user):
    """Invalidate cached project lists for a user."""
    username_lower = user.username.lower()
    cache.delete(f'projects:v2:{username_lower}:own')
    cache.delete(f'projects:v2:{username_lower}:public')
    logger.debug(f'Invalidated project cache for user {user.username}')
```

## Additional Fix: Direct Project Endpoint

Also created a new direct project endpoint to avoid relying on cached lists:

**Endpoint:** `GET /api/v1/users/{username}/projects/{slug}/`

**Location:** `core/projects/views.py` - `get_project_by_slug()`

**Features:**
- Direct database query (no cache dependency)
- Proper permission checks
- Supports private/draft projects for owner
- Returns 404 for unauthorized access

**Frontend Update:** `frontend/src/services/projects.ts`

```typescript
export async function getProjectBySlug(username: string, slug: string): Promise<Project> {
  const response = await api.get<any>(`/users/${username}/projects/${slug}/`);
  return transformProject(response.data);
}
```

## Testing

### Test Cache Invalidation

1. **Create project:**
   ```bash
   # Via GitHub import
   POST /api/v1/github/import/confirm/

   # Check cache is cleared
   # Visit profile - new project should appear immediately
   GET /api/v1/users/{username}/projects/
   ```

2. **Update project:**
   ```bash
   PATCH /api/v1/me/projects/{id}/

   # Cache should be cleared
   GET /api/v1/users/{username}/projects/
   ```

3. **Delete project:**
   ```bash
   DELETE /api/v1/me/projects/{id}/

   # Cache should be cleared
   GET /api/v1/users/{username}/projects/
   ```

### Test Direct Endpoint

```bash
# Should work immediately after project creation
GET /api/v1/users/{username}/projects/{slug}/

# Should return 404 for non-existent project
GET /api/v1/users/{username}/projects/nonexistent/
```

## Impact

✅ Projects appear immediately after creation
✅ Profile page shows latest projects
✅ No "Project not found" errors after GitHub import
✅ Cache still provides performance benefits
✅ Cache automatically invalidated on mutations

## Cache Strategy

The current cache strategy balances performance and freshness:

| Operation | Cache TTL | Invalidation |
|-----------|-----------|--------------|
| View own projects | 60s | On create/update/delete |
| View public projects | 180s | On create/update/delete |
| View single project | No cache | Direct DB query |

This ensures:
- Fast list views (cache)
- Fresh data after mutations (invalidation)
- Reliable single project views (no cache)

## Future Improvements

Potential enhancements:
- [ ] Cache warming after invalidation
- [ ] Selective cache updates (update single project in cache)
- [ ] Cache versioning for rollback
- [ ] Redis pub/sub for multi-server cache invalidation
- [ ] Cache analytics to measure hit rates

## Related Files

- `core/projects/views.py` - ProjectViewSet with cache invalidation
- `core/integrations/github/views.py` - GitHub import with cache invalidation
- `frontend/src/services/projects.ts` - Direct project endpoint usage
- `docs/GITHUB_SYNC.md` - GitHub import documentation
