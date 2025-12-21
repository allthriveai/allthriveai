# Engagement Tracking System

This document describes the engagement tracking system used to measure user interactions with projects for the trending algorithm.

## Overview

The tracking system collects two types of engagement data:
1. **Views** - When a user visits a project page
2. **Clicks** - When a user clicks on a project card in a feed (Explore, Search, Profile)

This data feeds into the [Trending Engine](./PERSONALIZATION_ENGINE.md) to calculate engagement velocity.

## Data Models

### ProjectView

Tracks when users view project detail pages.

```python
class ProjectView(models.Model):
    class ViewSource(models.TextChoices):
        EXPLORE = 'explore', 'Explore Feed'
        PROFILE = 'profile', 'Profile Page'
        DIRECT = 'direct', 'Direct Link'
        SEARCH = 'search', 'Search Results'
        EMBED = 'embed', 'Embedded View'

    project = ForeignKey(Project, on_delete=CASCADE, related_name='views')
    user = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)
    session_key = CharField(max_length=40, blank=True, default='')
    source = CharField(max_length=20, choices=ViewSource.choices, default='direct')
    created_at = DateTimeField(auto_now_add=True)
```

**Key Features:**
- Supports both authenticated and anonymous tracking (via session_key)
- Tracks view source to understand traffic patterns
- Views are **deduplicated** within a 5-minute window to prevent spam

### ProjectClick

Tracks when users click on project cards in feeds.

```python
class ProjectClick(models.Model):
    class ClickSource(models.TextChoices):
        EXPLORE_FOR_YOU = 'explore_for_you', 'Explore: For You'
        EXPLORE_TRENDING = 'explore_trending', 'Explore: Trending'
        EXPLORE_NEW = 'explore_new', 'Explore: New'
        EXPLORE_NEWS = 'explore_news', 'Explore: News'
        SEARCH = 'search', 'Search Results'
        PROFILE = 'profile', 'Profile Page'
        RELATED = 'related', 'Related Projects'

    project = ForeignKey(Project, on_delete=CASCADE, related_name='clicks')
    user = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)
    session_key = CharField(max_length=40, blank=True, default='')
    source = CharField(max_length=20, choices=ClickSource.choices)
    position = PositiveIntegerField(null=True, blank=True)  # 0-indexed position in feed
    created_at = DateTimeField(auto_now_add=True)
```

**Key Features:**
- Tracks which feed/tab the click originated from
- Records position in feed (useful for CTR analysis)
- **No deduplication** - each click is counted

## API Endpoints

### Track View
```
POST /api/v1/projects/<project_id>/track-view/
```

**Request Body:**
```json
{
  "source": "explore"  // optional, defaults to "direct"
}
```

**Response:**
- `201`: View recorded
- `200`: View deduplicated (already viewed recently)
- `404`: Project not found

### Track Click
```
POST /api/v1/projects/track-click/
```

**Request Body:**
```json
{
  "project_id": 123,
  "source": "explore_trending",
  "position": 5  // optional, 0-indexed
}
```

**Response:**
- `201`: Click recorded
- `400`: Missing required fields or invalid source
- `404`: Project not found

### Batch Track Clicks
```
POST /api/v1/projects/track-clicks/
```

**Request Body:**
```json
{
  "clicks": [
    {"project_id": 123, "source": "explore_trending", "position": 0},
    {"project_id": 456, "source": "explore_trending", "position": 1}
  ]
}
```

**Response:**
- `201`: Clicks recorded with count
- `400`: Invalid request (max 50 clicks per batch)

## Frontend Integration

### View Tracking

Views are tracked automatically when a user visits a project detail page:

```typescript
// frontend/src/pages/ProjectDetailPage.tsx
import { trackProjectView, getViewSourceFromReferrer } from '@/services/tracking';

// In the project load effect:
const data = await getProjectBySlug(username, projectSlug);
setProject(data);

// Track the view (fire and forget - doesn't block UI)
if (data.id) {
  trackProjectView(data.id, getViewSourceFromReferrer());
}
```

The `getViewSourceFromReferrer()` helper determines the source based on the referrer URL.

### Click Tracking

Clicks are tracked in the Explore page when users click on project cards:

```typescript
// frontend/src/pages/ExplorePage.tsx
import { trackProjectClick, getClickSourceFromTab } from '@/services/tracking';

// Create click handler:
const handleProjectClick = useCallback((projectId: number) => {
  const position = projectPositionMap.get(projectId);
  const source = getClickSourceFromTab(activeTab);
  trackProjectClick(projectId, source, position);
}, [activeTab, projectPositionMap]);

// Pass to ProjectCard:
<ProjectCard
  project={item.data}
  onCardClick={handleProjectClick}
  // ...
/>
```

## Velocity Calculation

The tracking data feeds into the Trending Engine's velocity calculation:

```python
# Time windows
RECENT_WINDOW_HOURS = 24   # "Recent" = last 24 hours
PREVIOUS_WINDOW_HOURS = 48 # "Previous" = 24-48 hours ago

# Weights
LIKE_WEIGHT = 0.7
VIEW_WEIGHT = 0.3

# Velocity formula
like_velocity = (recent_likes - prev_likes) / max(prev_likes, 1)
view_velocity = (recent_views - prev_views) / max(prev_views, 1)
velocity = (like_velocity * LIKE_WEIGHT) + (view_velocity * VIEW_WEIGHT)

# Trending score
recency_factor = 1.0 / (1 + days_old * 0.1)
trending_score = velocity * recency_factor
```

## Database Indexes

Both models have indexes optimized for velocity calculations:

```python
# ProjectView indexes
Index(fields=['project', '-created_at'])  # Recent views by project
Index(fields=['project', 'created_at'])   # Time-range queries
Index(fields=['user', '-created_at'])     # User's recent views
Index(fields=['-created_at'])             # Global recent views

# ProjectClick indexes
Index(fields=['project', '-created_at'])  # Recent clicks by project
Index(fields=['project', 'created_at'])   # Time-range queries
Index(fields=['source', '-created_at'])   # Clicks by source
Index(fields=['-created_at'])             # Global recent clicks
```

## Privacy Considerations

1. **Anonymous Tracking**: Uses session keys for anonymous users, no PII stored
2. **View Deduplication**: Prevents tracking abuse by deduplicating within 5-minute windows
3. **Private Projects**: Views/clicks on private projects are only tracked for owners
4. **No Cross-Site Tracking**: All tracking is first-party only

## Future Enhancements

1. **Click-Through Rate (CTR) Analysis**: Position data enables CTR calculation per feed
2. **A/B Testing**: Source tracking enables comparing feed algorithm performance
3. **Engagement Heatmaps**: Time-based analysis of when users engage most
4. **User Retention Metrics**: Track return views to measure content stickiness
