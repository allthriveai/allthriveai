# GitHub Repository Sync

This feature automatically syncs a user's GitHub repositories to their AllThrive profile as projects when they connect their GitHub account.

## Overview

When a user connects their GitHub account via OAuth, they can:
- View all their GitHub repositories
- Sync repositories as AllThrive projects with one click
- Automatically update project metadata from GitHub
- Choose sync options (public/private, forks, star threshold)

## How It Works

### 1. User Connects GitHub
User navigates to `/account/settings/social` and connects their GitHub account via OAuth.

### 2. Sync Repositories
User clicks "Sync Repos" button to trigger synchronization.

### 3. Repository Import
Each GitHub repository is imported as a `Project` with:
- Type: `GITHUB_REPO`
- Title: Repository name
- Description: Repository description
- Content: GitHub metadata (stars, forks, language, topics, etc.)

### 4. Continuous Sync
User can re-sync at any time to update existing projects with latest GitHub data.

## Architecture

### Backend Components

**Service: `services/github_sync_service.py`**
- `GitHubSyncService` - Core sync logic
  - `fetch_repositories()` - Fetch repos from GitHub API
  - `sync_repository_to_project()` - Convert repo to project
  - `sync_all_repositories()` - Bulk sync with filters
  - `get_sync_status()` - Get current sync state

**Views: `core/github_sync_views.py`**
- `github_sync_status` - GET sync status
- `github_sync_trigger` - POST to trigger sync
- `github_repos_list` - GET list of GitHub repos
- `github_sync_single_repo` - POST to sync single repo

**Models:**
- Uses existing `Project` model with `type=GITHUB_REPO`
- Uses `SocialConnection` to store GitHub OAuth token

### Frontend Components

**UI: `frontend/src/pages/settings/SocialSettingsPage.tsx`**
- Shows "Sync Repos" button when GitHub is connected
- Displays sync status (number of synced projects)
- Triggers sync with configurable options

## API Endpoints

### Get Sync Status
```
GET /api/v1/github/sync/status/
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "synced_projects": 15,
    "github_username": "octocat",
    "last_connected": "2025-01-19T15:30:00Z"
  }
}
```

### Trigger Sync
```
POST /api/v1/github/sync/trigger/
```

**Body:**
```json
{
  "auto_publish": false,
  "add_to_showcase": false,
  "include_private": false,
  "include_forks": true,
  "min_stars": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 10,
    "updated": 5,
    "skipped": 2,
    "total_repos": 17,
    "message": "Synced 17 repositories: 10 created, 5 updated, 2 skipped"
  }
}
```

### List Repositories
```
GET /api/v1/github/repos/?include_private=false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "repositories": [
      {
        "name": "awesome-project",
        "full_name": "octocat/awesome-project",
        "description": "A cool project",
        "html_url": "https://github.com/octocat/awesome-project",
        "language": "TypeScript",
        "topics": ["react", "typescript"],
        "stars": 42,
        "forks": 7,
        "is_fork": false,
        "is_private": false,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2025-01-15T10:30:00Z"
      }
    ],
    "count": 1
  }
}
```

### Sync Single Repository
```
POST /api/v1/github/sync/repo/
```

**Body:**
```json
{
  "repo_name": "awesome-project",
  "auto_publish": false,
  "add_to_showcase": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "project_id": 123,
    "project_slug": "awesome-project",
    "was_created": true,
    "message": "Repository 'awesome-project' created as project"
  }
}
```

## Sync Options

### auto_publish
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Automatically publish synced projects (make publicly visible)

### add_to_showcase
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Add synced projects to user's showcase/portfolio

### include_private
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Include private repositories in sync

### include_forks
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Include forked repositories in sync

### min_stars
- **Type:** `integer`
- **Default:** `0`
- **Description:** Minimum star count to sync a repository

## Project Data Structure

When a GitHub repository is synced, the following data is stored in the `Project.content` field:

```python
{
    'github': {
        'url': 'https://github.com/user/repo',
        'homepage': 'https://project-site.com',
        'language': 'Python',
        'topics': ['ai', 'machine-learning', 'django'],
        'stars': 142,
        'forks': 23,
        'is_fork': False,
        'created_at': '2023-06-15T10:30:00Z',
        'updated_at': '2025-01-19T15:30:00Z'
    },
    'blocks': [],  # Can be populated later by user
    'tags': ['ai', 'machine-learning', 'django']
}
```

## Usage Examples

### Programmatic Sync

```python
from services.github_sync_service import GitHubSyncService

# Initialize service for user
sync_service = GitHubSyncService(user)

# Check if GitHub is connected
if sync_service.is_connected():
    # Sync all repositories
    result = sync_service.sync_all_repositories(
        auto_publish=False,
        add_to_showcase=True,
        include_private=False,
        include_forks=False,
        min_stars=5
    )

    print(f"Created: {result['created']}")
    print(f"Updated: {result['updated']}")
    print(f"Skipped: {result['skipped']}")
```

### Manual Single Repo Sync

```python
# Fetch repositories
repos = sync_service.fetch_repositories()

# Sync specific repo
for repo in repos:
    if repo['name'] == 'target-repo':
        project, was_created = sync_service.sync_repository_to_project(
            repo,
            auto_publish=True,
            add_to_showcase=True
        )
        if was_created:
            print(f"Created project: {project.title}")
```

### Get Sync Status

```python
status = sync_service.get_sync_status()
print(f"GitHub username: {status['github_username']}")
print(f"Synced projects: {status['synced_projects']}")
```

## Security Considerations

1. **Token Security**
   - GitHub OAuth tokens are encrypted in database
   - Tokens are only decrypted when needed for API calls
   - No tokens are exposed to frontend

2. **Rate Limiting**
   - GitHub API has rate limits (5000 req/hour with token)
   - Sync service implements pagination and limits

3. **Private Repositories**
   - By default, only public repos are synced
   - User must explicitly enable private repo sync
   - Requires appropriate OAuth scopes

4. **Data Validation**
   - All repository data is validated before creating projects
   - Existing projects are updated, not duplicated
   - Slug uniqueness is ensured per user

## Troubleshooting

### Sync Returns No Repositories
- Check that GitHub is connected: `/account/settings/social`
- Verify OAuth token hasn't expired
- Check user has at least one repository on GitHub

### Sync Fails with Error
- Check Django logs for detailed error messages
- Verify GitHub API is accessible
- Ensure GitHub OAuth scopes include `repo` or `public_repo`

### Duplicate Projects Created
- Shouldn't happen - service checks for existing projects by slug
- If it does, check for slug generation issues in logs

### Token Expired
- User needs to reconnect GitHub account
- Tokens typically expire after some period (check GitHub OAuth settings)

## Future Enhancements

Potential improvements:
- **Automatic Sync:** Background task to periodically sync repos
- **Selective Sync:** UI to choose which repos to sync
- **Webhook Integration:** Real-time sync when repos are created/updated
- **README Parsing:** Extract and display README content in project
- **Branch Selection:** Choose which branch to track
- **Commit History:** Show recent commits in project
- **CI/CD Status:** Display build/test status badges

## Related Documentation

- OAuth Setup: `docs/SOCIAL_OAUTH_SETUP.md`
- Project Model: `core/models.py`
- GitHub Service: `services/github_sync_service.py`
- API Views: `core/github_sync_views.py`
