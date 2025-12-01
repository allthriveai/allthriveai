# Reddit Curation Bots

## Overview

Reddit curation bots automatically discover and import Reddit threads as AllThrive projects using RSS feeds. Each bot represents a single subreddit community, and each thread becomes a distinct project.

## Key Features

- **RSS-based ingestion** (no Reddit API approval needed)
- **Bot users** with naming convention: `{subreddit}-reddit-bot`
- **Reddit thread projects** with URL format: `/{bot-username}/{thread-slug}`
- **Automatic sync** via scheduled jobs
- **Metadata preservation**: thumbnails, scores, comment counts, timestamps

## Architecture

### Entities

1. **RedditCommunityBot** - Configuration for each subreddit
2. **RedditThread** - Reddit-specific metadata linked to Project
3. **Project** (type: `reddit_thread`) - Standard AllThrive project
4. **User** (role: `bot`) - Bot account that owns the projects

### Data Flow

```
Reddit RSS Feed
    ↓
Sync Service (with user-agent)
    ↓
Parse Atom/RSS XML
    ↓
Create/Update RedditThread + Project
    ↓
Display in AllThrive UI
```

## Models

### RedditCommunityBot

Stores configuration for each subreddit bot:

- `name`: Display name (e.g., "ClaudeCode Reddit Bot")
- `subreddit`: Target subreddit (e.g., "ClaudeCode")
- `bot_user`: FK to User with role=BOT
- `status`: active/paused
- `settings`: JSON for filters (min_score, etc.)
- `last_synced_at`: Timestamp of last successful sync

### RedditThread

Stores Reddit-specific metadata for each thread:

- `project`: OneToOne with Project
- `reddit_post_id`: Reddit's ID (e.g., "t3_1pa4e7t")
- `subreddit`: Subreddit name
- `author`: Reddit username
- `permalink`: Full Reddit URL
- `score`: Reddit upvote score (at last sync)
- `num_comments`: Comment count (at last sync)
- `thumbnail_url`: Reddit thumbnail
- `created_utc`: When posted on Reddit
- `last_synced_at`: When we last fetched updates

## Reddit RSS Feed Structure

### Feed URL Format

- Hot posts: `https://www.reddit.com/r/{subreddit}/.rss`
- New posts: `https://www.reddit.com/r/{subreddit}/new/.rss`
- Top posts: `https://www.reddit.com/r/{subreddit}/top/.rss?t=day`

### Required User-Agent

Reddit blocks default curl/bot agents. Use:
```
User-Agent: Mozilla/5.0 (compatible; AllThrive/1.0; +https://allthrive.ai)
```

### Data Available

From RSS/Atom feeds we get:
- Post ID (from `<id>` tag)
- Title
- Author
- Body/description (may be truncated)
- Link to thread
- Thumbnail (via `<media:thumbnail>` tag)
- Timestamp

### Data NOT Available

- Individual comments (RSS only includes post)
- Real-time score updates (need to re-fetch)
- Removed/deleted status

## Sync Strategy

### Initial Sync

For a new bot:
1. Fetch last 25 posts from RSS feed
2. Create bot user if doesn't exist
3. For each post:
   - Check if `reddit_post_id` already exists
   - If new: create Project + RedditThread
   - If exists: update score, comment count, thumbnail

### Incremental Sync

On subsequent runs:
1. Fetch RSS feed
2. Process only posts newer than `last_synced_at`
3. Update existing threads' metadata (score, comments)
4. Create projects for new threads

### Sync Frequency

- Default: Every 15 minutes
- Configurable per bot
- Can be triggered manually via management command

## Bot User Naming

### Convention

- Username: `{subreddit}-reddit-bot` (lowercase, slugified)
- Examples:
  - `claudecode-reddit-bot`
  - `machinelearning-reddit-bot`
  - `localllama-reddit-bot`

### User Fields

- `role`: `UserRole.BOT`
- `first_name`: Subreddit display name
- `last_name`: "Reddit Bot"
- `bio`: "Automated curation bot for r/{subreddit}"
- `avatar_url`: Can be set to any URL (bots bypass domain validation)

## Project Structure

### URL Format

`/{bot-username}/{thread-slug}`

Example:
- Bot: `claudecode-reddit-bot`
- Thread slug: `the-new-plan-mode-is-not-good`
- URL: `/claudecode-reddit-bot/the-new-plan-mode-is-not-good`

### Project Fields

- `user`: The bot user
- `slug`: Derived from Reddit thread title
- `title`: Reddit post title (verbatim)
- `description`: Reddit post body (verbatim, may be truncated)
- `type`: `ProjectType.REDDIT_THREAD`
- `external_url`: Full Reddit permalink
- `featured_image_url`: Reddit thumbnail
- `is_showcase`: True
- `is_published`: True
- `is_private`: False

## Reddit ToS Constraints

### What We Can Do

✅ Fetch RSS feeds (public, no auth required)
✅ Store post metadata (title, author, URL)
✅ Display thumbnails
✅ Link back to original threads
✅ Rank/filter by score, date, etc.

### What We Cannot Do

❌ Modify user content (beyond formatting)
❌ Summarize posts/comments with AI
❌ Fetch individual comments (not in RSS)
❌ Train ML models on content

### Our Approach

- Display Reddit content **verbatim**
- Add "View discussion on Reddit" button
- Store metadata for ranking/filtering
- All AI/curation logic uses only metadata, not text content

## Management Commands

### Create Bot User

```bash
python manage.py create_reddit_bot --subreddit ClaudeCode
```

Creates:
- User: `claudecode-reddit-bot`
- RedditCommunityBot config
- Performs initial sync

### Sync Bots

```bash
# Sync all active bots
python manage.py sync_reddit_bots

# Sync specific bot
python manage.py sync_reddit_bots --bot claudecode-reddit-bot

# Force full re-sync
python manage.py sync_reddit_bots --full
```

## Scheduled Jobs

Use Celery or cron to run sync regularly:

```python
# celery beat schedule
@app.task
def sync_all_reddit_bots():
    call_command('sync_reddit_bots')
```

Run every 15 minutes.

## UI/UX

### Bot Profile Page

Shows:
- Bot avatar + bio
- "Curated from r/{subreddit}" badge
- List of thread projects (standard project cards)
- Filters: date, score, comments

### Reddit Thread Project Page

Sections:
1. **Header**
   - Title (from Reddit)
   - "Posted in r/{subreddit} by u/{author}"
   - Reddit score, comment count
   - Timestamp

2. **Content**
   - Post body (verbatim, formatted markdown)
   - Thumbnail/image if available

3. **Actions**
   - "View discussion on Reddit" (primary CTA)
   - Share, bookmark (AllThrive features)

4. **Metadata**
   - Tags (extracted from flair, if available)
   - Last synced timestamp

## Future Enhancements

### Phase 2
- Flair-based filtering
- Cross-post detection
- Subreddit grouping (multi-community bots)

### Phase 3
- User can "follow" specific bots
- Digest notifications
- Reddit comment mirroring (if API access granted)

## Security & Privacy

- All content is public Reddit data
- No auth tokens stored
- Respect Reddit rate limits
- Bot users clearly labeled
- Link back to original source

## Testing

Test cases:
- RSS feed parsing with various post types
- Duplicate detection (same reddit_post_id)
- Slug collision handling
- Thumbnail extraction
- Score/comment updates
- Removed/deleted thread handling

## Deployment

1. Create initial bot users
2. Configure Celery beat schedule
3. Monitor sync job logs
4. Set up alerts for sync failures

## Example: r/ClaudeCode Bot

```python
# Create bot
python manage.py create_reddit_bot --subreddit ClaudeCode

# Result:
# - User: claudecode-reddit-bot
# - Profile: /claudecode-reddit-bot
# - Projects: /claudecode-reddit-bot/the-new-plan-mode-is-not-good
# - Auto-syncs every 15 min
```
