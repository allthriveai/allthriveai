# Integration Patterns

**Source of Truth** | **Last Updated**: 2025-12-20

This document defines integration patterns for AllThrive AI, including GitHub, YouTube, and generic integration architectures for importing external content.

---

## Integration Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Connects OAuth                       │
│  (Google, GitHub, YouTube, Figma, etc.)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                OAuth Token Storage                          │
│  - SocialAccount (allauth)                                  │
│  - SocialToken (encrypted)                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Integration Registry                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   GitHub     │  │   YouTube    │  │   Figma      │      │
│  │  Integration │  │  Integration │  │  Integration │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Import Pipeline                             │
│  1. Fetch external content (API calls)                      │
│  2. Extract metadata (AI-powered)                           │
│  3. Transform to Project model                              │
│  4. Create/Update in database                               │
│  5. Award Thrive Circle points                              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│               Content Source (Auto-Sync)                    │
│  - Periodic sync (Celery beat)                              │
│  - Detect new content                                       │
│  - Update existing projects                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Models

### ContentSource

**Purpose**: Track external content sources for auto-sync.

**Location**: `core/integrations/models.py`

**Schema**:
```python
class ContentSource(models.Model):
    user = ForeignKey(User, on_delete=CASCADE)
    platform = CharField(max_length=50)  # github, youtube, figma, rss
    source_identifier = CharField(max_length=255)  # URL, channel ID, etc.
    display_name = CharField(max_length=255)
    
    # Sync settings
    sync_enabled = BooleanField(default=True)
    sync_frequency = CharField(
        max_length=20,
        choices=[
            ('manual', 'Manual only'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
        ],
        default='weekly'
    )
    last_synced_at = DateTimeField(null=True, blank=True)
    
    # OAuth token reference (optional)
    social_account = ForeignKey(SocialAccount, null=True, on_delete=SET_NULL)
    
    # Platform-specific metadata
    metadata = JSONField(default=dict)
    
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

**Metadata Examples**:

**GitHub**:
```json
{
  "repo_full_name": "alice/my-repo",
  "is_fork": false,
  "is_archived": false,
  "total_commits": 150,
  "last_commit_date": "2024-11-29T10:00:00Z"
}
```

**YouTube**:
```json
{
  "channel_id": "UC123...",
  "channel_name": "Alice's AI Channel",
  "total_videos_imported": 25,
  "subscriber_count": 5000
}
```

---

## GitHub Integration

### Architecture

**Flow**:
1. User connects GitHub account (OAuth)
2. User browses repositories
3. User imports repository as project
4. System fetches repo data via GitHub API
5. AI analyzes README, code structure
6. Project created with auto-generated description
7. ContentSource created for auto-sync (optional)

---

### OAuth Connection

**Provider**: GitHub OAuth App

**Scopes**:
- `user` - Read user profile
- `user:email` - Read email addresses
- `repo` (optional) - Access private repos

**Token Storage**:
```python
from allauth.socialaccount.models import SocialToken

def get_user_github_token(user):
    """Get user's GitHub OAuth token."""
    social_account = user.socialaccount_set.filter(provider='github').first()
    if not social_account:
        raise IntegrationAuthError('GitHub not connected')
    
    token = SocialToken.objects.get(account=social_account)
    return token.token
```

---

### Repository Import

**Endpoint**: `POST /api/v1/github/import/`

**Request**:
```json
{
  "url": "https://github.com/alice/my-chatbot",
  "is_showcase": true,
  "is_private": false
}
```

**Process**:

1. **Parse URL**:
   ```python
   def parse_github_url(url):
       # https://github.com/owner/repo
       match = re.match(r'github\.com/([^/]+)/([^/]+)', url)
       owner, repo = match.groups()
       return owner, repo
   ```

2. **Fetch Repository Data** (GitHub REST API):
   ```python
   import requests
   
   def fetch_github_repo(owner, repo, token):
       headers = {
           'Authorization': f'token {token}',
           'Accept': 'application/vnd.github.v3+json'
       }
       
       # Get repository info
       repo_response = requests.get(
           f'https://api.github.com/repos/{owner}/{repo}',
           headers=headers
       )
       repo_data = repo_response.json()
       
       # Get README
       readme_response = requests.get(
           f'https://api.github.com/repos/{owner}/{repo}/readme',
           headers=headers
       )
       readme_data = readme_response.json()
       
       return repo_data, readme_data
   ```

3. **AI-Powered Analysis**:
   ```python
   from services.ai_provider import AIProvider
   
   def analyze_github_repo(repo_data, readme_content):
       ai = AIProvider()
       prompt = f"""
       Analyze this GitHub repository and generate:
       1. A concise description (2-3 sentences)
       2. Key technologies used
       3. Project type (library, application, tool, etc.)
       
       Repository: {repo_data['full_name']}
       Description: {repo_data['description']}
       Language: {repo_data['language']}
       README: {readme_content[:1000]}
       """
       
       analysis = ai.complete(prompt, temperature=0.3)
       return parse_analysis(analysis)
   ```

4. **Create Project**:
   ```python
   def import_github_repo(user, url, is_showcase=True):
       owner, repo = parse_github_url(url)
       token = get_user_github_token(user)
       
       repo_data, readme_data = fetch_github_repo(owner, repo, token)
       analysis = analyze_github_repo(repo_data, readme_data)
       
       project = Project.objects.create(
           user=user,
           title=repo_data['name'],
           description=analysis['description'],
           type='github_repo',
           external_url=repo_data['html_url'],
           is_showcase=is_showcase,
           banner_url=repo_data.get('social_preview_url'),
           content={
               'blocks': [
                   {
                       'type': 'cover',
                       'title': repo_data['name'],
                       'banner_url': repo_data.get('social_preview_url')
                   },
                   {
                       'type': 'text',
                       'content': readme_data['content_decoded']  # Base64 decoded
                   }
               ]
           }
       )
       
       # Award points
       award_points(user, 50, 'project_create')
       
       return project
   ```

---

### Auto-Sync (Future)

**Celery Task** (runs daily):
```python
@shared_task
def sync_github_repos():
    """Sync all GitHub content sources."""
    sources = ContentSource.objects.filter(
        platform='github',
        sync_enabled=True
    )
    
    for source in sources:
        try:
            # Fetch latest commits
            token = get_user_github_token(source.user)
            repo_data = fetch_github_repo_api(source.source_identifier, token)
            
            # Check if README changed
            project = Project.objects.get(
                user=source.user,
                external_url=source.source_identifier
            )
            
            if repo_data['updated_at'] > project.updated_at:
                # Update project
                update_project_from_repo(project, repo_data)
                source.last_synced_at = timezone.now()
                source.save()
        
        except Exception as e:
            logger.error(f'Failed to sync {source.id}: {e}')
```

---

## YouTube Integration

### Architecture

**Flow**:
1. User connects YouTube account (OAuth)
2. User imports channel or individual videos
3. System fetches video data via YouTube Data API v3
4. AI generates description from video transcript (future)
5. Projects created for each video
6. ContentSource enables auto-sync for new uploads

---

### OAuth Connection

**Provider**: Google OAuth (YouTube scope)

**Scopes**:
- `https://www.googleapis.com/auth/youtube.readonly` - Read channel/video data
- `https://www.googleapis.com/auth/youtube.force-ssl` - Full access (future)

**Token Retrieval**:
```python
def get_user_youtube_token(user):
    """Get user's YouTube OAuth token from Google account."""
    social_account = user.socialaccount_set.filter(provider='google').first()
    if not social_account:
        raise IntegrationAuthError('Google/YouTube not connected')
    
    token = SocialToken.objects.get(account=social_account)
    return token.token
```

---

### YouTube Service

**Service Class** (`core/integrations/youtube/service.py`):

```python
class YouTubeService:
    BASE_URL = 'https://www.googleapis.com/youtube/v3'
    
    def __init__(self, oauth_token=None, api_key=None):
        self.oauth_token = oauth_token
        self.api_key = api_key or settings.YOUTUBE_API_KEY
    
    def _make_request(self, endpoint, params=None):
        """Make authenticated request to YouTube API."""
        headers = {}
        params = params or {}
        
        if self.oauth_token:
            headers['Authorization'] = f'Bearer {self.oauth_token}'
        elif self.api_key:
            params['key'] = self.api_key
        else:
            raise ValueError('OAuth token or API key required')
        
        response = requests.get(
            f'{self.BASE_URL}{endpoint}',
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    
    def get_user_channel(self):
        """Get authenticated user's channel."""
        return self._make_request('/channels', {
            'part': 'snippet,statistics',
            'mine': 'true'
        })
    
    def get_video(self, video_id):
        """Get video details."""
        return self._make_request('/videos', {
            'part': 'snippet,contentDetails,statistics',
            'id': video_id
        })
    
    def list_channel_videos(self, channel_id, max_results=50):
        """List videos from channel."""
        # First, get uploads playlist ID
        channel = self._make_request('/channels', {
            'part': 'contentDetails',
            'id': channel_id
        })
        
        uploads_id = channel['items'][0]['contentDetails']['relatedPlaylists']['uploads']
        
        # Get videos from playlist
        return self._make_request('/playlistItems', {
            'part': 'snippet',
            'playlistId': uploads_id,
            'maxResults': max_results
        })
```

---

### Video Import

**Endpoint**: `POST /api/v1/integrations/youtube/import/`

**Request**:
```json
{
  "video_url": "https://youtube.com/watch?v=abc123",
  "is_showcase": true
}
```

**Process**:

1. **Extract Video ID**:
   ```python
   def extract_video_id_from_url(url):
       # https://youtube.com/watch?v=abc123
       # https://youtu.be/abc123
       patterns = [
           r'youtube\.com/watch\?v=([^&]+)',
           r'youtu\.be/([^?]+)'
       ]
       for pattern in patterns:
           match = re.search(pattern, url)
           if match:
               return match.group(1)
       return None
   ```

2. **Fetch Video Data**:
   ```python
   def import_youtube_video(user, video_id, is_showcase=True):
       token = get_user_youtube_token(user)
       youtube = YouTubeService(oauth_token=token)
       
       video_data = youtube.get_video(video_id)
       video = video_data['items'][0]
       
       snippet = video['snippet']
       statistics = video['statistics']
       
       # Get best thumbnail
       thumbnails = snippet['thumbnails']
       thumbnail_url = (
           thumbnails.get('maxres') or
           thumbnails.get('high') or
           thumbnails.get('medium')
       )['url']
       
       project = Project.objects.create(
           user=user,
           title=snippet['title'],
           description=snippet['description'][:500],
           type='video',
           external_url=f'https://youtube.com/watch?v={video_id}',
           featured_image_url=thumbnail_url,
           is_showcase=is_showcase,
           content={
               'blocks': [
                   {
                       'type': 'cover',
                       'title': snippet['title'],
                       'banner_url': thumbnail_url
                   },
                   {
                       'type': 'video',
                       'provider': 'youtube',
                       'video_id': video_id
                   },
                   {
                       'type': 'text',
                       'content': f"## Description\n\n{snippet['description']}"
                   }
               ]
           },
           metadata={
               'youtube_video_id': video_id,
               'view_count': int(statistics.get('viewCount', 0)),
               'like_count': int(statistics.get('likeCount', 0)),
               'published_at': snippet['publishedAt']
           }
       )
       
       award_points(user, 50, 'project_create')
       return project
   ```

---

### Channel Import & Auto-Sync

**Endpoint**: `POST /api/v1/integrations/youtube/import-channel/`

**Process**:

1. **Create ContentSource**:
   ```python
   def import_youtube_channel(user, channel_id, max_videos=50):
       token = get_user_youtube_token(user)
       youtube = YouTubeService(oauth_token=token)
       
       # Get channel info
       channel = youtube._make_request('/channels', {
           'part': 'snippet,statistics',
           'id': channel_id
       })['items'][0]
       
       # Create ContentSource for auto-sync
       content_source = ContentSource.objects.create(
           user=user,
           platform='youtube',
           source_identifier=channel_id,
           display_name=channel['snippet']['title'],
           sync_enabled=True,
           sync_frequency='daily',
           metadata={
               'channel_id': channel_id,
               'channel_name': channel['snippet']['title'],
               'subscriber_count': channel['statistics']['subscriberCount']
           }
       )
       
       # Import recent videos
       videos = youtube.list_channel_videos(channel_id, max_videos)
       
       for item in videos['items']:
           video_id = item['snippet']['resourceId']['videoId']
           import_youtube_video(user, video_id, is_showcase=True)
       
       return content_source
   ```

2. **Auto-Sync Task** (Celery beat):
   ```python
   @shared_task
   def sync_youtube_channels():
       """Check for new videos in synced channels."""
       sources = ContentSource.objects.filter(
           platform='youtube',
           sync_enabled=True
       )
       
       for source in sources:
           try:
               youtube = YouTubeService(oauth_token=get_user_youtube_token(source.user))
               
               # Get recent videos
               videos = youtube.list_channel_videos(
                   source.source_identifier,
                   max_results=10
               )
               
               # Check for new videos
               for item in videos['items']:
                   video_id = item['snippet']['resourceId']['videoId']
                   video_url = f'https://youtube.com/watch?v={video_id}'
                   
                   # Check if already imported
                   exists = Project.objects.filter(
                       user=source.user,
                       external_url=video_url
                   ).exists()
                   
                   if not exists:
                       import_youtube_video(source.user, video_id)
                       logger.info(f'Auto-imported video {video_id} for {source.user.username}')
               
               source.last_synced_at = timezone.now()
               source.metadata['total_videos_imported'] = Project.objects.filter(
                   user=source.user,
                   external_url__contains='youtube.com/watch'
               ).count()
               source.save()
           
           except Exception as e:
               logger.error(f'Failed to sync YouTube channel {source.id}: {e}')
   ```

---

### YouTube Feed Agents

**Purpose**: Automated agents that continuously sync content from YouTube channels.

**Management Command**: `make create-youtube-agent`

**Usage**:
```bash
# Basic usage (required params)
make create-youtube-agent \
  CHANNEL_URL="https://www.youtube.com/@ChannelName" \
  SOURCE_NAME="Channel Name"

# With optional social links and avatar
make create-youtube-agent \
  CHANNEL_URL="https://www.youtube.com/@AIDailyBrief" \
  SOURCE_NAME="AI Daily Brief" \
  AVATAR="https://example.com/avatar.jpg" \
  WEBSITE="https://aidailybrief.com" \
  TWITTER="https://twitter.com/aidailybrief" \
  INSTAGRAM="https://instagram.com/aidailybrief"
```

**Optional Parameters**: `AVATAR`, `WEBSITE`, `TWITTER`, `INSTAGRAM`, `LINKEDIN`, `GITHUB`

**Agent Behavior**:
- Creates an `Agent` user with the channel name
- Automatically syncs new videos as projects
- Videos appear in the explore feed under the agent's profile
- Social links displayed on agent profile page

**Use Cases**:
- Curating AI influencer content
- Aggregating educational channels
- Building topic-specific content feeds

---

## Generic Integration Pattern

### Integration Registry

**Purpose**: Unified interface for all integrations.

**Pattern**:
```python
class BaseIntegration:
    """Base class for all integrations."""
    
    def can_handle_url(self, url: str) -> bool:
        """Check if this integration can handle the URL."""
        raise NotImplementedError
    
    def import_content(self, user, url: str, **kwargs) -> Project:
        """Import content from URL."""
        raise NotImplementedError
    
    def supports_auto_sync(self) -> bool:
        """Whether this integration supports auto-sync."""
        return False


class GitHubIntegration(BaseIntegration):
    def can_handle_url(self, url):
        return 'github.com' in url
    
    def import_content(self, user, url, **kwargs):
        return import_github_repo(user, url, **kwargs)
    
    def supports_auto_sync(self):
        return True


class YouTubeIntegration(BaseIntegration):
    def can_handle_url(self, url):
        return 'youtube.com' in url or 'youtu.be' in url
    
    def import_content(self, user, url, **kwargs):
        video_id = extract_video_id_from_url(url)
        return import_youtube_video(user, video_id, **kwargs)
    
    def supports_auto_sync(self):
        return True


class IntegrationRegistry:
    """Central registry for all integrations."""
    
    _integrations = [
        GitHubIntegration(),
        YouTubeIntegration(),
        # Add more integrations here
    ]
    
    @classmethod
    def get_for_url(cls, url: str) -> BaseIntegration:
        """Get integration handler for URL."""
        for integration in cls._integrations:
            if integration.can_handle_url(url):
                return integration
        raise ValueError(f'No integration found for URL: {url}')
    
    @classmethod
    def list_all(cls) -> list[BaseIntegration]:
        """List all registered integrations."""
        return cls._integrations
```

**Usage**:
```python
@api_view(['POST'])
def import_from_url(request):
    """Generic import endpoint for any supported URL."""
    url = request.data.get('url')
    
    try:
        integration = IntegrationRegistry.get_for_url(url)
        project = integration.import_content(
            user=request.user,
            url=url,
            is_showcase=request.data.get('is_showcase', True)
        )
        
        return Response({
            'success': True,
            'project': ProjectSerializer(project).data
        })
    
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
```

---

## Async Import with Celery

### Task Pattern

**Benefits**:
- Non-blocking HTTP requests (fast response)
- Progress tracking via task ID
- Error handling and retries
- Scalability

**Implementation**:

```python
from celery import shared_task

@shared_task(bind=True, max_retries=3)
def import_content_task(self, user_id, url, **kwargs):
    """Background task for content import."""
    try:
        user = User.objects.get(id=user_id)
        integration = IntegrationRegistry.get_for_url(url)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Fetching content...', 'progress': 25}
        )
        
        project = integration.import_content(user, url, **kwargs)
        
        return {
            'status': 'completed',
            'project_id': project.id,
            'project_slug': project.slug,
            'url': f'/{user.username}/{project.slug}'
        }
    
    except Exception as e:
        logger.error(f'Import failed: {e}', exc_info=True)
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
```

**View**:
```python
@api_view(['POST'])
def import_from_url_async(request):
    """Queue import task."""
    url = request.data.get('url')
    
    task = import_content_task.delay(
        user_id=request.user.id,
        url=url,
        is_showcase=request.data.get('is_showcase', True)
    )
    
    return Response({
        'success': True,
        'task_id': task.id,
        'status_url': f'/api/v1/integrations/tasks/{task.id}/'
    }, status=status.HTTP_202_ACCEPTED)
```

**Status Check**:
```python
@api_view(['GET'])
def get_task_status(request, task_id):
    """Check task progress."""
    from celery.result import AsyncResult
    
    result = AsyncResult(task_id)
    
    if result.state == 'PENDING':
        response = {'status': 'pending'}
    elif result.state == 'PROGRESS':
        response = {
            'status': 'processing',
            'progress': result.info.get('progress', 0),
            'message': result.info.get('status', '')
        }
    elif result.state == 'SUCCESS':
        response = {
            'status': 'completed',
            'result': result.info
        }
    elif result.state == 'FAILURE':
        response = {
            'status': 'failed',
            'error': str(result.info)
        }
    else:
        response = {'status': result.state}
    
    return Response(response)
```

---

## Rate Limiting

### Per-Integration Limits

**GitHub**:
- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour
- **Import limit**: 10 repos/hour per user

**YouTube**:
- **Quota**: 10,000 units/day (default)
- **Video import**: 20/hour per user
- **Channel import**: 5/hour per user

### Implementation

```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='user', rate='10/h', method='POST')
@api_view(['POST'])
def import_github_repo_async(request):
    if getattr(request, 'limited', False):
        return Response(
            {'error': 'Rate limit exceeded. Max 10 imports per hour.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    # ... import logic
```

**Cache-Based** (for fine-grained control):
```python
def check_import_rate_limit(user, platform):
    cache_key = f'import_limit:{user.id}:{platform}'
    count = cache.get(cache_key, 0)
    
    if count >= 10:
        return False, f'Import limit reached for {platform}'
    
    cache.set(cache_key, count + 1, 3600)  # 1 hour
    return True, None
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `IntegrationAuthError` | OAuth token expired/invalid | Reconnect account |
| `RateLimitError` | API rate limit hit | Wait and retry |
| `ContentNotFoundError` | URL points to deleted content | Show error to user |
| `InvalidURLError` | Malformed URL | Validate on frontend |
| `ImportDuplicateError` | Content already imported | Show existing project |

### Error Response Format

```json
{
  "success": false,
  "error": "YouTube not connected",
  "error_code": "AUTH_ERROR",
  "action": "connect_youtube",
  "suggestion": "Please connect your YouTube account in Settings."
}
```

---

## Testing

### Unit Tests

```python
def test_github_integration():
    integration = GitHubIntegration()
    assert integration.can_handle_url('https://github.com/alice/repo')
    assert not integration.can_handle_url('https://youtube.com/watch?v=123')

def test_import_github_repo_mock():
    with patch('requests.get') as mock_get:
        mock_get.return_value.json.return_value = {
            'name': 'test-repo',
            'description': 'Test repository'
        }
        
        project = import_github_repo(user, 'https://github.com/alice/test-repo')
        assert project.title == 'test-repo'
```

### Integration Tests

```python
def test_youtube_import_real_api():
    """Test with real YouTube API (dev environment)."""
    user = create_test_user_with_youtube_oauth()
    
    project = import_youtube_video(
        user,
        video_id='dQw4w9WgXcQ',  # Famous test video
        is_showcase=True
    )
    
    assert project.type == 'video'
    assert 'youtube.com' in project.external_url
```

---

## Future Integrations

### Planned Platforms

1. **Figma**: Import design files as projects
2. **GitLab**: Alternative to GitHub
3. **Dribbble**: Design portfolios
4. **Medium**: Blog post imports
5. **Dev.to**: Technical articles
6. **HuggingFace**: ML model showcase
7. **RSS Feeds**: Generic blog/podcast imports

### Integration Checklist

For each new integration:
- [ ] OAuth setup (if required)
- [ ] API client implementation
- [ ] Integration class (implements `BaseIntegration`)
- [ ] Import endpoint
- [ ] Auto-sync support (optional)
- [ ] Rate limiting
- [ ] Error handling
- [ ] Tests (unit + integration)
- [ ] Documentation

---

**Version**: 1.1
**Status**: Stable
**Review Cadence**: Quarterly
