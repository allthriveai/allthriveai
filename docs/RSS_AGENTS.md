# RSS Feed Agents

RSS Feed Agents automatically curate content from RSS/Atom feeds and create projects in AllThrive AI.

## Overview

Similar to Reddit agents, RSS agents monitor RSS/Atom feeds and create projects for each feed item (article, blog post, etc.). Unlike Reddit agents, RSS agents don't track social engagement metrics like upvotes or comments.

## Key Differences from Reddit Agents

| Feature | Reddit Agents | RSS Feed Agents |
|---------|---------------|-----------------|
| **Metrics** | Score, comments, author | Published date, author (optional), categories |
| **Social Features** | Yes (upvotes, comments) | No |
| **Content Type** | Discussion threads | Articles, blog posts |
| **Project Type** | `reddit_thread` | `rss_article` |
| **Engagement** | Community-driven | Publication-based |

## Models

### RSSFeedAgent

Configuration for an RSS feed source:
- `agent_user` - Agent user account (role=AGENT)
- `name` - Display name (e.g., "Google Research Blog Agent")
- `feed_url` - RSS/Atom feed URL
- `source_name` - Human-readable source name
- `status` - Active, Paused, or Error
- `settings` - JSON configuration (sync_interval_minutes, max_items)
- Sync tracking fields

### RSSFeedItem

RSS-specific metadata for article projects:
- `project` - Associated Project (type=rss_article)
- `agent` - Agent that created this item
- `feed_item_id` - Unique identifier from RSS feed (guid or link)
- `source_name` - Denormalized source name
- `author` - Article author (if available)
- `permalink` - Full URL to the article
- `thumbnail_url` - Featured image URL
- `categories` - Categories/tags from RSS feed
- `published_at` - Publication timestamp
- `rss_metadata` - Full metadata from feed

## Management Commands

### Create an RSS Agent

```bash
python manage.py create_rss_agent \
  --feed-url "https://research.google/blog/rss/" \
  --source-name "Google Research Blog" \
  --sync \
  --max-items 20
```

Options:
- `--feed-url` (required) - RSS/Atom feed URL
- `--source-name` (required) - Human-readable source name
- `--sync` - Run initial sync after creation
- `--max-items` - Maximum items to sync (default: 20)

### Sync RSS Agents

```bash
# Sync all active agents
python manage.py sync_rss_agents

# Sync specific agent by ID
python manage.py sync_rss_agents --agent-id 1

# Sync agents matching source name
python manage.py sync_rss_agents --source-name "Google Research"
```

## Docker Commands

Using Docker (recommended):

```bash
# Create agent
make shell-backend
python manage.py create_rss_agent --feed-url "URL" --source-name "NAME" --sync

# Or directly
docker-compose exec web python manage.py create_rss_agent --feed-url "URL" --source-name "NAME" --sync

# Sync agents
docker-compose exec web python manage.py sync_rss_agents
```

## Feed Format Support

The RSS parser supports:
- **Atom feeds** (e.g., Google Research Blog)
- **RSS 2.0 feeds**
- Common namespaces:
  - `atom` - Atom feeds
  - `content` - Content encoding
  - `dc` - Dublin Core (author, date)
  - `media` - Media thumbnails

## Project Creation

When an RSS item is synced:

1. **Project created** with:
   - `type` = `rss_article`
   - `title` from feed item title
   - `description` from feed content/summary (truncated to 500 chars)
   - `external_url` = article permalink
   - `featured_image_url` = thumbnail from feed
   - `is_showcased` = True
   - `is_private` = False

2. **RSSFeedItem metadata** stores:
   - Feed-specific identifiers
   - Categories from feed
   - Full RSS metadata (JSON)

3. **Agent user** owns all projects

## Example RSS Feeds

### Google Research Blog
```bash
python manage.py create_rss_agent \
  --feed-url "https://research.google/blog/rss/" \
  --source-name "Google Research Blog" \
  --sync
```

### OpenAI Blog
```bash
python manage.py create_rss_agent \
  --feed-url "https://openai.com/blog/rss/" \
  --source-name "OpenAI Blog" \
  --sync
```

### GitHub Engineering Blog
```bash
python manage.py create_rss_agent \
  --feed-url "https://github.blog/feed/" \
  --source-name "GitHub Blog" \
  --sync
```

## Admin Interface

RSS agents can be managed via Django admin:

- **RSSFeedAgent**: `/admin/integrations/rssfeedagent/`
  - View/edit agent configuration
  - Check sync status
  - Pause/activate agents

- **RSSFeedItem**: `/admin/integrations/rssfeeditem/`
  - View synced feed items
  - See associated projects
  - Check RSS metadata

## Sync Behavior

### Initial Sync
- Fetches up to `max_items` from feed (default: 20)
- Creates new projects for all items
- Stores complete RSS metadata

### Subsequent Syncs
- Checks for existing items by `feed_item_id`
- Updates existing projects if title/description/thumbnail changed
- Creates projects for new items
- Updates RSS metadata

### Deduplication
- Uses `feed_item_id` (guid or link) for uniqueness
- Prevents duplicate projects for same article

## Configuration

Agent settings (stored in `settings` JSON field):

```python
{
    'sync_interval_minutes': 60,  # How often to sync
    'max_items': 20,               # Max items to fetch per sync
}
```

## Architecture

```
RSSFeedAgent
    ↓
RSSFeedSyncService.sync_agent()
    ↓
1. Fetch RSS feed (requests)
2. Parse XML (defusedxml)
3. Extract items (RSSFeedParser)
    ↓
For each item:
    4. Check if exists (by feed_item_id)
    5. Create/update Project
    6. Create/update RSSFeedItem
```

## Services

### RSSFeedParser
- Parses Atom and RSS 2.0 feeds
- Extracts: title, link, author, content, published date, categories, thumbnail
- Handles multiple date formats (ISO 8601, RFC 822)
- Returns structured dictionaries

### RSSFeedSyncService
- `sync_agent(agent)` - Sync single agent
- `sync_all_active_agents()` - Sync all active agents
- Handles errors gracefully
- Updates agent sync status

## Testing

```bash
# Create test agent with sync
docker-compose exec web python manage.py create_rss_agent \
  --feed-url "https://research.google/blog/rss/" \
  --source-name "Google Research Blog" \
  --sync

# Check created projects
docker-compose exec web python manage.py shell
>>> from core.projects.models import Project
>>> Project.objects.filter(type='rss_article').count()
20

# Check agent status
>>> from core.integrations.rss_models import RSSFeedAgent
>>> agent = RSSFeedAgent.objects.first()
>>> agent.last_sync_status
'Success: 20 created, 0 updated'
```

## Celery Tasks (Future)

To automate RSS syncing, create a Celery periodic task:

```python
# core/integrations/rss_tasks.py
from celery import shared_task
from services.rss_sync_service import RSSFeedSyncService

@shared_task
def sync_all_rss_agents():
    """Periodic task to sync all active RSS feed agents."""
    return RSSFeedSyncService.sync_all_active_agents()
```

Add to Celery beat schedule:
```python
# config/celery.py
CELERY_BEAT_SCHEDULE = {
    'sync-rss-agents-hourly': {
        'task': 'core.integrations.rss_tasks.sync_all_rss_agents',
        'schedule': crontab(minute=0),  # Every hour
    },
}
```

## Related Files

- Models: `core/integrations/rss_models.py`
- Service: `services/rss_sync_service.py`
- Commands:
  - `core/management/commands/create_rss_agent.py`
  - `core/management/commands/sync_rss_agents.py`
- Admin: `core/integrations/admin.py`
- Migration: `core/integrations/migrations/0008_rssfeedagent_rssfeeditem_and_more.py`

## Troubleshooting

### No items created
- Check if feed URL is accessible
- Verify feed is valid XML
- Check logs: `make logs-backend`
- Look for parsing errors in agent's `last_sync_error`

### Agent in ERROR status
- Check `last_sync_error` in admin
- Common issues:
  - Invalid feed URL
  - Network timeout
  - Invalid XML format
  - JSON serialization errors

### Duplicate projects
- Check `feed_item_id` uniqueness
- RSSFeedItem model enforces unique `feed_item_id`
- Projects may appear duplicate if same article in multiple feeds

## Security

- Uses `defusedxml` for safe XML parsing (prevents XXE attacks)
- User-Agent header identifies bot traffic
- Request timeout (30 seconds) prevents hanging
- No authentication required (public RSS feeds)

## Performance

- Default limit: 20 items per sync
- Configurable via `max_items` setting
- Database queries optimized with indexes on:
  - `feed_url` (unique lookup)
  - `feed_item_id` (duplicate check)
  - `source_name, -published_at` (listing)
- Transaction-safe project creation
