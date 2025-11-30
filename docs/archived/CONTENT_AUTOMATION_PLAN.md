# Content Automation Strategy - Planning Document

**Date:** 2025-11-28
**Status:** Planning Phase - Not Implemented
**Related:** See `CURATOR_ROLE_PLAN.md` for internal curator features

---

## Overview

Enable users to automatically sync content from external platforms to their AllThrive profiles:
- **YouTube** - Automatically import new videos from channels
- **RSS/Blogs** - Automatically import blog posts from feeds
- **TikTok** - Skipped (API too restrictive)

**Goals:**
- Keep site fresh with quality real-time content (1-2 hour sync)
- Reduce friction for adding new content
- All users can add unlimited content sources
- Opt-in automatic syncing with manual trigger option

---

## Current Codebase Analysis

### Existing Infrastructure

**Project Model** (`/core/projects/models.py`):
- Flexible JSON `content` field (100KB max) with block-based structure
- Project types: `github_repo`, `figma_design`, `image_collection`, `prompt`, `other`
- External URL tracking with duplicate prevention
- Showcase/private/archived/published states

**User Model** (`/core/users/models.py`):
- Has `youtube_url` and `instagram_url` fields
- Privacy controls: `is_profile_public`, `allow_llm_training`, `playground_is_public`

**OAuth Integration** (`/core/social/models.py`):
- 6 providers configured: GitHub, GitLab, LinkedIn, Figma, HuggingFace, Midjourney
- **Missing:** YouTube OAuth for content sync
- SocialConnection model with encrypted token storage

**Background Jobs**:
- Celery + Redis fully configured
- Existing GitHub import tasks with retry logic
- IntegrationRegistry pattern for pluggable integrations
- Rate limiting and caching infrastructure

### Key Insights

1. **Integration Pattern Exists:** GitHub import shows the pattern - OAuth → API fetch → AI analysis → Project creation
2. **Missing OAuth:** Need to add YouTube OAuth for sync
3. **No Periodic Sync:** Celery Beat is configured but not running scheduled tasks
4. **Flexible Content Model:** Project content blocks can accommodate video embeds

---

## Recommended Architecture

### Core Strategy: Hybrid Sync with ContentSource Model

**Periodic Polling (Celery Beat)** - Balanced approach for reliable sync:
- **YouTube: Every 1-2 hours** (balanced freshness vs API costs)
- **RSS/Blogs: Every 1-2 hours** (no API limits, but respect server politeness)
- **Manual trigger available** for immediate sync when needed
- **TikTok: Not in scope** (API access too restrictive)

### New ContentSource Model

**File:** `/core/integrations/models.py`

```python
class ContentSource(models.Model):
    """Track content sources for automatic syncing."""

    class PlatformType(models.TextChoices):
        YOUTUBE = 'youtube', 'YouTube'
        RSS = 'rss', 'RSS/Blog'

    class SyncFrequency(models.TextChoices):
        EVERY_HOUR = 'every_hour', 'Every Hour'
        EVERY_2_HOURS = 'every_2_hours', 'Every 2 Hours'
        EVERY_4_HOURS = 'every_4_hours', 'Every 4 Hours'
        DAILY = 'daily', 'Once Daily'
        MANUAL = 'manual', 'Manual Only'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_sources'
    )
    platform = models.CharField(max_length=20, choices=PlatformType.choices)
    source_url = models.URLField(help_text='YouTube channel URL, RSS feed URL')
    source_identifier = models.CharField(
        max_length=255,
        help_text='Platform-specific ID (channel ID, feed hash)'
    )
    display_name = models.CharField(
        max_length=255,
        help_text='User-friendly name for this source'
    )

    sync_enabled = models.BooleanField(
        default=True,
        help_text='Enable automatic syncing'
    )
    sync_frequency = models.CharField(
        max_length=20,
        choices=SyncFrequency.choices,
        default=SyncFrequency.EVERY_2_HOURS
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=20, default='pending')
    last_sync_error = models.TextField(blank=True)

    # Platform-specific settings
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['user', 'platform', 'source_identifier']]
        indexes = [
            models.Index(fields=['sync_enabled', 'last_synced_at']),
            models.Index(fields=['user', 'platform']),
        ]
```

**Benefits:**
- Users can add multiple channels/feeds per platform
- Granular control (enable/disable per source)
- Track sync history per source
- Unlimited sources for all users

### Platform-Specific Integrations

Each platform extends `BaseIntegration`:

**YouTubeIntegration** (`/core/integrations/youtube/integration.py`):
- YouTube Data API v3
- OAuth for higher quotas (10,000 units/day per user)
- Fetch channel videos, parse metadata
- Create YOUTUBE_VIDEO projects

**RSSIntegration** (`/core/integrations/rss/integration.py`):
- feedparser library
- No OAuth needed (public feeds)
- Parse RSS/Atom feeds
- Create BLOG_POST projects

### Project Type Extensions

**File:** `/core/projects/models.py`

Add to ProjectType enum:
```python
class ProjectType(models.TextChoices):
    # ... existing types ...
    YOUTUBE_VIDEO = 'youtube_video', 'YouTube Video'
    BLOG_POST = 'blog_post', 'Blog Post'
```

Add foreign key to track source:
```python
content_source = models.ForeignKey(
    'integrations.ContentSource',
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='projects',
    help_text='Content source that created this project (if auto-synced)'
)
```

---

## Implementation Phases

### Phase 1: MVP - YouTube + RSS (Weeks 1-3)

**Goals:**
- Ship both platforms together
- Prove multi-platform architecture works
- Validate UX and sync frequency

**Deliverables:**

1. **ContentSource Model**
   - Track user subscriptions to YouTube channels + RSS feeds
   - Sync status and error tracking
   - Platform-specific metadata storage

2. **YouTube Integration**
   - OAuth setup (scope: `youtube.readonly`)
   - YouTube Data API v3 client
   - Channel video fetching
   - Auto-import new videos every 1-2 hours

3. **RSS/Blog Integration**
   - feedparser library integration
   - Feed parsing and entry extraction
   - Auto-import blog posts every 1-2 hours

4. **Periodic Sync Task**
   - Celery Beat scheduler (every 1-2 hours)
   - `sync_content_sources` task
   - `sync_single_source` task with retry logic
   - Error handling and status updates

5. **Settings UI**
   - Manage content sources (add/edit/delete)
   - Enable/disable sync per source
   - Set sync frequency
   - Manual "Sync Now" button
   - View sync history/status

6. **Deduplication**
   - Check `external_url` uniqueness per user
   - Prevent duplicate imports

**Critical Files:**
- `/core/integrations/models.py` - New ContentSource model
- `/core/integrations/youtube/integration.py` - YouTube integration
- `/core/integrations/rss/integration.py` - RSS integration
- `/core/integrations/tasks.py` - Periodic sync tasks
- `/core/projects/models.py` - Add YOUTUBE_VIDEO, BLOG_POST types, content_source FK
- `/config/celery.py` - Celery Beat schedule (every 1-2 hours)
- Frontend settings page - Content source management UI

**Success Metrics:**
- 20% of active users enable sync
- >95% sync success rate
- Users satisfied with 1-2 hour freshness

### Phase 2: AI Enhancement (Weeks 4-6)

**Focus on AI improvements:**

1. **Better Descriptions**
   - Extract YouTube video transcripts (YouTube API)
   - Summarize with AI for better project descriptions

2. **Auto-Categorization**
   - Use existing AI infrastructure
   - Analyze content and assign categories

3. **Topic Extraction**
   - Auto-tag projects with relevant topics
   - Extract key highlights/quotes from content

4. **Improved Images**
   - Better featured image selection
   - Thumbnail optimization

### Phase 3: Advanced Features (Weeks 7-10)

- **YouTube PubSubHubbub webhooks** - Instant sync instead of polling
- **Content filters** - Keywords, duration, date ranges
- **Batch import** - Backfill old content from channels
- **Analytics dashboard** - Sync health monitoring
- **Multi-user curation** - Teams sharing content sources

---

## Key Technical Decisions

### OAuth Setup

**YouTube:**
- **Scope:** `youtube.readonly`
- **Token:** Use OAuth tokens (10,000 units/day per user) for higher quotas
- **Better than:** Shared API key (limited shared quota)

**RSS:**
- **No OAuth needed** (public feeds)
- **Library:** feedparser (Python)
- **Politeness:** 1 request/minute per feed

### User Permissions

**All Users:**
- Unlimited content sources (no role-based limits)
- Sync from YouTube channels, RSS feeds
- Enable/disable sync per source
- Set sync frequency (1-2 hours, daily, manual)
- Own all automated projects

---

## API Costs & Rate Limits

### YouTube Data API v3

**Free Tier:**
- 10,000 units/day per user (OAuth)
- ~3 units per video fetch

**Balanced Sync (Every 1-2 Hours):**
- 10 users × 12 checks/day = 360 units/day
- ✅ Well within quota
- Good freshness without hitting limits

**Scaling:**
- Use OAuth tokens (per-user quota)
- Cache channel metadata
- Batch video fetches (up to 50 per request)

### RSS Feeds

**Cost:** FREE
- No API keys needed
- No quotas
- Respect server politeness (1 req/min)

---

## Risk Mitigation

### Risk 1: API Rate Limits

**Mitigation:**
- Use OAuth for higher quotas
- Implement exponential backoff
- Cache aggressively
- Monitor quota usage

### Risk 2: Users Request TikTok

**Mitigation:**
- TikTok skipped due to API restrictions
- Revisit in 6-12 months if users demand it
- Alternative: Manual video URL import feature

### Risk 3: Content Quality (Spam, Duplicates)

**Mitigation:**
- Deduplication by `external_url`
- User can disable sources
- AI filters for inappropriate content
- Moderation tools

### Risk 4: Not "Real Time"

**Mitigation:**
- Set expectations (1-2 hour sync)
- Manual sync button for urgent updates
- Phase 3: Webhooks for instant sync

### Risk 5: Storage Costs

**Mitigation:**
- No source limits (monitor usage)
- Add limits if storage becomes issue
- Auto-archive old projects after 1 year
- Retention policies for inactive users

---

## Background Job Architecture

### Celery Tasks

**File:** `/core/integrations/tasks.py`

```python
@shared_task(bind=True, max_retries=3)
def sync_content_sources(self):
    """Periodic task to sync all enabled content sources."""
    sources_to_sync = ContentSource.objects.filter(sync_enabled=True)

    now = timezone.now()
    for source in sources_to_sync:
        if should_sync_now(source, now):
            sync_single_source.delay(source.id)

@shared_task(bind=True, max_retries=3)
def sync_single_source(self, source_id):
    """Sync a single content source."""
    source = ContentSource.objects.get(id=source_id)
    integration = IntegrationRegistry.get(source.platform)()

    try:
        new_items = integration.fetch_new_content(
            source_identifier=source.source_identifier,
            since=source.last_synced_at,
            metadata=source.metadata
        )

        for item in new_items:
            # Check for duplicates
            if Project.objects.filter(
                user=source.user,
                external_url=item['external_url']
            ).exists():
                continue

            # Create project
            integration.create_project_from_content(
                user=source.user,
                content_source=source,
                item=item
            )

        source.last_synced_at = timezone.now()
        source.last_sync_status = 'success'
        source.save()

    except Exception as e:
        source.last_sync_status = 'error'
        source.last_sync_error = str(e)
        source.save()
        raise
```

### Celery Beat Schedule

**File:** `/config/celery.py`

```python
app.conf.beat_schedule = {
    'sync-content-sources': {
        'task': 'core.integrations.tasks.sync_content_sources',
        'schedule': crontab(minute='*/60'),  # Every hour
        'options': {'expires': 3600},
    },
}
```

---

## User Experience

### Settings Page - Content Sources

**Route:** `/account/settings/content-sources`

**Features:**
- **List Sources:** Display all user's content sources
- **Add Source:** Modal to add YouTube channel or RSS feed
- **Edit Source:** Change display name, sync frequency
- **Enable/Disable:** Toggle sync on/off
- **Delete Source:** Remove content source
- **Manual Sync:** "Sync Now" button for immediate update
- **Sync Status:** Last synced time, status (success/error), error messages

**API Endpoints:**
```
GET    /api/integrations/content-sources/          # List user's sources
POST   /api/integrations/content-sources/          # Add new source
PATCH  /api/integrations/content-sources/{id}/     # Update settings
DELETE /api/integrations/content-sources/{id}/     # Remove source
POST   /api/integrations/content-sources/{id}/sync/ # Manual trigger
```

---

## Final Decisions Summary

**User Confirmed:**
1. ✅ **MVP Scope:** YouTube + RSS together in Phase 1 (3 weeks)
2. ✅ **TikTok:** Skip entirely - API too restrictive
3. ✅ **Sync Frequency:** Balanced 1-2 hours (good freshness, within quotas)
4. ✅ **Source Limits:** None - all users can add unlimited sources

**Implementation Priorities:**
1. ContentSource model with platform support for YouTube + RSS
2. Celery Beat periodic sync (every 1-2 hours)
3. Settings UI for content source management
4. YouTube OAuth + YouTube Data API v3 integration
5. RSS feedparser integration
6. Deduplication logic (external_url uniqueness)
7. Manual sync trigger for immediate updates

**Success Criteria:**
- Ship in 3 weeks
- 20% user adoption
- >95% sync success rate
- Users satisfied with 1-2 hour freshness

---

## Related Documents

- **`CURATOR_ROLE_PLAN.md`** - Internal curator role and project claiming feature
- **`YOUTUBE_PODCAST_SYNC.md`** - Existing YouTube sync documentation

---

**Status:** ✅ Planning Complete
**Timeline:** 3 weeks for Phase 1 MVP
**Next Step:** Implementation (when ready)
**Created:** 2025-11-28
