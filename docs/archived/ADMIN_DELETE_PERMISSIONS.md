# Admin Delete Permissions - Implementation Summary

## Overview
Admin users can now delete any project or comment from any user (including bot users) from any page, including explore pages and comment sections.

## Changes Made

### Backend Changes

#### Projects

#### 1. Project ViewSet Permissions (`core/projects/views.py`)

**Updated `get_queryset()` method:**
- Admin users can now see all projects in the queryset (not just their own)
- Regular users continue to see only their own projects
- Optimized with `select_related` and `prefetch_related` to prevent N+1 queries

**Updated `perform_destroy()` method:**
- Added permission check: Admins can delete any project, regular users can only delete their own
- Raises `PermissionDenied` if a non-admin tries to delete someone else's project
- Properly invalidates cache after deletion

**Updated `bulk_delete()` action:**
- Admin users can bulk delete any projects
- Regular users can only bulk delete their own projects
- Invalidates cache for all affected users after bulk deletion

#### 2. New Delete Endpoint (`core/projects/views.py`)

**Added `delete_project_by_id()` view:**
- DELETE endpoint at `/api/v1/projects/<id>/delete/`
- Authenticated users only
- Admin users can delete any project
- Regular users can only delete their own projects
- Returns 404 if project not found
- Returns 403 if user doesn't have permission
- Properly invalidates cache after deletion

#### 3. URL Routing (`core/urls.py`)

**Added new route:**
```python
path('projects/<int:project_id>/delete/', delete_project_by_id, name='delete_project_by_id')
```

#### Comments

**Updated `delete_comment()` view (`core/projects/comment_views.py`):**
- Changed from checking `is_staff` to checking `UserRole.ADMIN`
- Admin users can delete any comment
- Regular users can only delete their own comments
- Returns 403 Forbidden if user doesn't have permission
- Properly logs all deletion attempts

### Frontend Changes

#### Projects

#### 1. Project Service (`frontend/src/services/projects.ts`)

**Added `deleteProjectById()` function:**
- New service function for admin deletion
- Uses the `/api/v1/projects/<id>/delete/` endpoint
- Works for any project (admin permission checked on backend)

#### 2. Type Definitions (`frontend/src/types/models.ts`)

**Updated `UserRole` type:**
- Added all missing roles: `'learner'`, `'creator'`, and `'bot'`
- Complete type: `'explorer' | 'learner' | 'expert' | 'creator' | 'mentor' | 'patron' | 'admin' | 'bot'`

#### 3. ProjectCard Component (`frontend/src/components/projects/ProjectCard.tsx`)

**Added admin delete functionality:**
- Imports `deleteProjectById` from services
- Retrieves current user from `useAuth()` hook
- Checks if user is admin: `const isAdmin = user?.role === 'admin'`
- Determines delete permission: `const canDelete = isOwner || isAdmin`
- Added `handleDeleteClick()` function with confirmation dialog
- Shows delete button in masonry variant (explore pages) for admins
- Shows delete button in default variant menu for admins
- Delete button has red styling and shows admin indicator in tooltip
- Automatically reloads page after successful deletion

**Visual indicators:**
- Delete button appears in the overlay footer (masonry variant)
- Red background with red trash icon to indicate destructive action
- Tooltip shows "Delete project (Admin)" for admin deletions vs "Delete project" for owner deletions

#### Comments

**Updated CommentTray Component (`frontend/src/components/projects/CommentTray.tsx`):**
- Imports `deleteComment` from services and `useAuth` hook
- Retrieves current user and checks if user is admin
- Added `handleDeleteComment()` function with confirmation dialog
- Shows delete button (trash icon) for comment owners and admins
- Delete button appears in the comment header
- Red hover state to indicate destructive action
- Tooltip shows "Delete comment (Admin)" for admin deletions vs "Delete your comment" for owner deletions
- Automatically removes comment from list after successful deletion

**Visual indicators:**
- Trash icon appears in the top-right of each comment card
- Gray by default, red on hover
- Only visible to comment owner or admin users
- Confirmation dialog prevents accidental deletions

### Testing

#### Project Tests

#### Added Test Cases (`core/projects/tests/test_projects.py`)

1. **`test_admin_can_delete_any_project()`**
   - Verifies admin can delete any user's project
   - Uses the new delete_by_id endpoint

2. **`test_admin_can_delete_bot_project()`**
   - Verifies admin can delete bot-created projects
   - Tests with UserRole.BOT

3. **`test_non_admin_cannot_delete_using_delete_by_id()`**
   - Ensures regular users get 403 Forbidden
   - Verifies project still exists after failed attempt

4. **`test_admin_bulk_delete_any_projects()`**
   - Tests bulk deletion of projects from multiple users
   - Verifies all projects are deleted
   - Tests cache invalidation for multiple users

#### Comment Tests (New Test Class: `CommentPermissionsTest`)

1. **`test_owner_can_delete_own_comment()`**
   - Verifies comment owner can delete their own comment
   - Checks 204 No Content response
   - Confirms comment is deleted from database

2. **`test_non_owner_cannot_delete_comment()`**
   - Ensures regular users cannot delete others' comments
   - Verifies 403 Forbidden response
   - Confirms comment still exists after failed attempt

3. **`test_admin_can_delete_any_comment()`**
   - Verifies admin can delete any user's comment
   - Tests with different comment owners

4. **`test_admin_can_delete_bot_comment()`**
   - Verifies admin can delete bot-created comments
   - Tests with UserRole.BOT

5. **`test_unauthenticated_cannot_delete_comment()`**
   - Ensures unauthenticated users get 401 Unauthorized
   - Verifies comment still exists after failed attempt

## Security Considerations

### Permission Checks
- All delete operations check user role on the backend
- Frontend UI only provides convenience - backend enforces all permissions
- Non-admin users receive 403 Forbidden if they attempt unauthorized deletions
- All endpoints require authentication

### Cache Invalidation
- Single deletes invalidate cache for the project owner
- Bulk deletes invalidate cache for all affected users
- Cache keys: `projects:v2:{username}:own` and `projects:v2:{username}:public`

## User Experience

### For Admins

**Projects:**
- Delete button appears on all projects in explore pages
- Delete button appears on all projects in profile pages
- Visual indicator shows it's an admin action
- Confirmation dialog prevents accidental deletions
- Page automatically refreshes after deletion

**Comments:**
- Delete button (trash icon) appears on all comments
- Shows "Delete comment (Admin)" in tooltip for other users' comments
- Confirmation dialog shows "(Admin action)" message
- Comment is immediately removed from the list after deletion

### For Regular Users

**Projects:**
- Delete button only appears on their own projects
- Same confirmation dialog
- No visual changes to existing functionality

**Comments:**
- Delete button only appears on their own comments
- Shows "Delete your comment" in tooltip
- Standard confirmation dialog
- Comment is removed after deletion

## API Endpoints

### Delete Project by ID (New Endpoint)
```
DELETE /api/v1/projects/<project_id>/delete/
```

**Authentication:** Required

**Permissions:**
- Owner can delete their own project
- Admin can delete any project

**Response (Success - 200 OK):**
```json
{
  "message": "Project deleted successfully"
}
```

**Response (Not Found - 404):**
```json
{
  "detail": "Project not found"
}
```

**Response (Forbidden - 403):**
```json
{
  "detail": "You do not have permission to delete this project."
}
```

### Delete Comment (Updated Endpoint)
```
DELETE /api/v1/projects/<project_id>/comments/<comment_id>/
```

**Authentication:** Required

**Permissions:**
- Comment owner can delete their own comment
- Admin can delete any comment

**Response (Success - 204 No Content):**
```json
{
  "message": "Comment deleted successfully"
}
```

**Response (Not Found - 404):**
```json
{
  "detail": "Not found."
}
```

**Response (Forbidden - 403):**
```json
{
  "error": "You do not have permission to delete this comment"
}
```

## Configuration

No configuration required. The feature works automatically for users with the `admin` role.

## Future Enhancements

Potential improvements for future iterations:

1. **Audit Logging**
   - Log all admin deletions with timestamp and reason
   - Track which admin deleted which project

2. **Soft Deletes**
   - Implement soft deletion for admin actions
   - Allow restoration within a grace period

3. **Delete Reasons**
   - Require admins to provide a reason for deletion
   - Notify project owner when admin deletes their project

4. **Moderation Queue**
   - Add flagging system for inappropriate content
   - Queue flagged projects for admin review

5. **Batch Moderation UI**
   - Dedicated admin panel for content moderation
   - Bulk actions with filtering and search

## Rollback Instructions

If this feature needs to be rolled back:

1. **Backend:**
   - Revert changes to `core/projects/views.py`
   - Remove the delete_by_id endpoint from `core/urls.py`
   - Revert test changes in `core/projects/tests/test_projects.py`

2. **Frontend:**
   - Revert changes to `frontend/src/components/projects/ProjectCard.tsx`
   - Remove `deleteProjectById` from `frontend/src/services/projects.ts`
   - Revert UserRole type changes in `frontend/src/types/models.ts`

## Testing Checklist

### Projects
- [x] Admin can delete their own projects
- [x] Admin can delete other users' projects
- [x] Admin can delete bot-created projects
- [x] Regular users cannot delete others' projects
- [x] Delete button appears for admins on explore pages
- [x] Delete button appears for admins on profile pages
- [x] Confirmation dialog works
- [x] Page refreshes after deletion
- [x] Cache is properly invalidated
- [x] Bulk delete works for admins
- [x] Backend tests pass
- [x] API returns correct status codes
- [x] Proper error messages are shown

### Comments
- [x] Admin can delete their own comments
- [x] Admin can delete other users' comments
- [x] Admin can delete bot-created comments
- [x] Regular users cannot delete others' comments
- [x] Delete button appears for admins on all comments
- [x] Delete button appears for users on their own comments
- [x] Confirmation dialog works with admin indicator
- [x] Comment is removed from UI after deletion
- [x] Unauthenticated users cannot delete comments
- [x] Backend tests pass
- [x] API returns correct status codes

## Related Files

### Backend
- `core/projects/views.py` - Project deletion implementation
- `core/projects/comment_views.py` - Comment deletion implementation
- `core/urls.py` - URL routing
- `core/projects/tests/test_projects.py` - Test cases for both projects and comments
- `core/permissions.py` - Permission classes (reference)
- `core/users/models.py` - User and UserRole definitions
- `core/projects/models.py` - Project and Comment models

### Frontend
- `frontend/src/components/projects/ProjectCard.tsx` - Project card with delete button
- `frontend/src/components/projects/CommentTray.tsx` - Comment tray with delete buttons
- `frontend/src/services/projects.ts` - Project API service
- `frontend/src/services/comments.ts` - Comment API service
- `frontend/src/types/models.ts` - Type definitions
- `frontend/src/hooks/useAuth.ts` - Authentication hook
- `frontend/src/context/AuthContext.tsx` - Auth context
