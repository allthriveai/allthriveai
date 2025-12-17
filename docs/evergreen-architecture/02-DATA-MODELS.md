# Data Models

**Source of Truth** | **Last Updated**: 2025-12-01

This document defines the core data models for AllThrive AI, their relationships, and schema design principles.

---

## Entity Relationship Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     User (AUTH_USER_MODEL)                    │
│  - username, email, bio, avatar                               │
│  - thrive_circle_tier, total_points                          │
└─┬────────────────────────────────────────────────────────────┘
  │
  ├── Projects (1:N)
  ├── ThriveCircle Membership (1:1)
  ├── Achievements (M:N via UserAchievement)
  ├── Quiz Attempts (1:N)
  ├── Likes/Comments (1:N)
  ├── Integrations (1:N)
  └── PointActivities (1:N)
```

---

## Core Models

### 1. User (`users.User`)

**Purpose**: Central user model extending Django's AbstractUser.

**Key Fields**:
```python
username: str (unique, slugified)
email: str (unique)
bio: text
avatar_url: str
github_username: str
linkedin_url: str
website_url: str

# Gamification
thrive_circle_tier: str  # seedling, sprout, blossom, bloom, evergreen
total_points: int
daily_streak: int
last_active_date: date

# Settings
notification_preferences: json
privacy_settings: json

# Metadata
is_active: bool
date_joined: datetime
last_login: datetime
```

**Relationships**:
- `projects` (1:N) → Project
- `earned_achievements` (1:N) → UserAchievement
- `point_activities` (1:N) → PointActivity
- `quiz_attempts` (1:N) → QuizAttempt
- `social_accounts` (1:N) → SocialAccount
- `integrations` (1:N) → Integration

**Constraints**:
- Username must be unique and URL-safe
- Email required for authentication
- Default Thrive Circle tier: "seedling"

---

### 2. Project (`projects.Project`)

**Purpose**: User-created portfolio items with rich media and metadata.

**Key Fields**:
```python
user: ForeignKey(User)
slug: str (unique per user)
title: str
description: text
type: enum  # github_repo, figma_design, image_collection, prompt, video, reddit_thread, other

# Visibility (see "Project Visibility Logic" section below)
is_showcased: bool   # Featured on user's profile showcase section (default: True)
is_highlighted: bool # Featured at top of profile, only one per user (default: False)
is_private: bool     # Hidden from explore feed and public views (default: False)
is_archived: bool    # Soft delete - hidden from all views (default: False)

# Media
banner_url: str
featured_image_url: str
external_url: url  # GitHub repo, live demo, etc.

# Categorization
tools: ManyToMany(Tool)
categories: ManyToMany(Taxonomy)
topics: array<str>  # User-generated tags

# Content
content: json  # Structured layout blocks
content_source: ForeignKey(ContentSource, nullable)

# Personalization metrics
engagement_velocity: float  # For trending algorithm
view_count: int
last_velocity_update: datetime (nullable)

# Timestamps
created_at: datetime
updated_at: datetime
```

**Relationships**:
- `user` (N:1) → User
- `tools` (M:N) → Tool
- `categories` (M:N) → Taxonomy
- `likes` (1:N) → ProjectLike
- `comments` (1:N) → Comment
- `content_source` (N:1) → ContentSource

**Constraints**:
- Unique constraint: (user, slug)
- Unique constraint: (user, external_url) when external_url is not empty
- Only one `is_highlighted=true` per user

**Indexes**:
- (user, slug) - Primary lookup
- (user, external_url) - Duplicate detection
- (is_private, is_archived, -created_at) - Primary explore filter
- (is_showcased, is_archived, -created_at) - Profile showcase

**URL Structure**: `/{username}/{slug}`

#### Project Visibility Logic

The visibility system uses a simplified 3-field model:

| Field | Default | Purpose |
|-------|---------|---------|
| `is_private` | `False` | **Primary visibility control**. When `True`, project is hidden from explore feed, search, and all public views. Only the owner can see it. |
| `is_showcased` | `True` | Controls display on user's profile. `True` = appears in showcase section, `False` = only in playground (but still public in explore if not private). |
| `is_archived` | `False` | Soft delete. Hidden from ALL views including owner's profile. |

**Key Rules**:

1. **Explore Feed**: Shows all projects where `is_private=False AND is_archived=False`
   - `is_showcased` does NOT affect explore visibility
   - All playground projects appear in explore (unless private)

2. **User Profile Showcase**: Shows projects where `is_showcased=True AND is_archived=False`
   - Private projects only visible to owner
   - Public users see only non-private showcase projects

3. **User Playground**: Shows ALL of user's non-archived projects
   - Only visible to the project owner
   - Includes both showcased and non-showcased projects

4. **Direct URL Access**: Any project can be viewed by direct URL if:
   - User is the owner, OR
   - Project is `is_private=False AND is_archived=False`

**Why This Design**:
- **Simplicity**: One field (`is_private`) controls public visibility
- **No Redundancy**: Removed `is_published` which was redundant with `is_private`
- **Separation of Concerns**: `is_showcased` only affects profile display, not discoverability
- **Default Public**: All projects are public by default, encouraging sharing

---

### 3. ThriveCircle (`thrive_circle.PointActivity`)

**Purpose**: Track point-earning activities for gamification.

**Key Fields**:
```python
id: uuid (primary key)
user: ForeignKey(User)
amount: int
activity_type: enum  # quiz_complete, project_create, comment, daily_login, etc.
description: str
tier_at_time: str  # User's tier when earned
created_at: datetime
```

**Activity Types**:
- `quiz_complete` - Completed a quiz
- `project_create` - Created a project
- `project_update` - Updated a project
- `comment` - Posted a comment
- `reaction` - Gave a like/reaction
- `daily_login` - Daily login streak
- `streak_bonus` - Streak milestone bonus
- `weekly_goal` - Completed weekly goal
- `side_quest` - Completed side quest
- `special_event` - Event participation
- `referral` - Referral bonus

**Indexes**:
- (user, -created_at) - User activity history
- (activity_type, -created_at) - Analytics
- (user, activity_type) - User-specific analytics

---

### 4. Achievement (`achievements.Achievement`)

**Purpose**: Definition of unlockable achievements (master data).

**Key Fields**:
```python
key: str (unique)  # e.g., 'first_project'
name: str
description: text

# Visual
icon: str  # FontAwesome icon name
color_from: str  # Gradient start
color_to: str    # Gradient end

# Categorization
category: enum  # projects, battles, community, engagement, streaks
points: int     # Points awarded

# Unlock Criteria
criteria_type: enum  # count, threshold, streak, first_time, cumulative
criteria_value: int
tracking_field: str  # Field to track progress

# Dependencies
requires_achievements: ManyToMany(Achievement)

# Metadata
is_secret: bool
rarity: enum  # common, rare, epic, legendary
order: int
is_active: bool
```

**Relationships**:
- `earned_by` (1:N) → UserAchievement
- `user_progress` (1:N) → AchievementProgress
- `requires_achievements` (M:N self-reference)

**Example**:
```python
Achievement(
    key='first_project',
    name='First Steps',
    description='Create your first project',
    category='projects',
    criteria_type='first_time',
    criteria_value=1,
    tracking_field='project_count',
    points=50
)
```

---

### 5. Quiz (`quizzes.Quiz`)

**Purpose**: Interactive learning quizzes on AI/ML topics.

**Key Fields**:
```python
slug: str (unique)
title: str
description: text
difficulty: enum  # beginner, intermediate, advanced
category: str

# Gamification
points_reward: int
xp_reward: int

# Questions
questions: reverse ForeignKey → QuizQuestion

# Metadata
is_active: bool
created_at: datetime
updated_at: datetime
```

**Related Models**:

**QuizQuestion**:
```python
quiz: ForeignKey(Quiz)
question_text: text
question_type: enum  # multiple_choice, true_false
options: json  # Array of choice objects
correct_answer: str
explanation: text
order: int
```

**QuizAttempt**:
```python
id: uuid
user: ForeignKey(User)
quiz: ForeignKey(Quiz)
score: int
answers: json  # User's answers
completed_at: datetime
time_taken_seconds: int
```

**URL Structure**: `/quick-quizzes/{slug}`

---

### 6. Tool (`tools.Tool`)

**Purpose**: Curated directory of AI tools with metadata.

**Key Fields**:
```python
slug: str (unique)
name: str
short_description: text
long_description: text
category: enum  # text, image, video, code, design, etc.

# Links
website_url: url
docs_url: url
pricing_url: url

# Media
logo_url: str
banner_url: str
demo_video_url: str

# Metadata
pricing_model: enum  # free, freemium, paid, api
is_featured: bool
popularity_score: int

# Examples
examples: ManyToMany(ToolExample)
```

**Relationships**:
- `projects` (M:N via Project.tools)
- `examples` (1:N) → ToolExample
- `categories` (M:N) → ToolCategory
- `tags` (M:N) → ToolTag

**URL Structure**: `/tools/{slug}`

---

### 7. Comment (`projects.Comment`)

**Purpose**: Threaded comments on projects.

**Key Fields**:
```python
id: uuid
user: ForeignKey(User)
project: ForeignKey(Project)
parent: ForeignKey(Comment, nullable)  # For threading
content: text (markdown)
is_edited: bool
edited_at: datetime (nullable)
created_at: datetime

# Moderation
is_deleted: bool
is_flagged: bool
```

**Relationships**:
- `user` (N:1) → User
- `project` (N:1) → Project
- `parent` (N:1) → Comment (self-reference)
- `replies` (1:N) → Comment
- `likes` (1:N) → CommentLike

**Constraints**:
- Markdown content with XSS protection
- Max nesting depth: 3 levels

---

### 8. Integration (`integrations.ContentSource`)

**Purpose**: External content sources (GitHub, YouTube, etc.).

**Key Fields**:
```python
user: ForeignKey(User)
source_type: enum  # github, youtube, rss, figma
source_identifier: str  # e.g., repo URL, channel ID
is_active: bool
last_synced_at: datetime
sync_frequency: enum  # manual, daily, weekly
auto_create_projects: bool
credentials: json (encrypted)
```

**Supported Types**:
- `github` - Repository sync
- `youtube` - Video imports
- `rss` - Blog/podcast feeds (future)
- `figma` - Design file imports (future)

---

## Supporting Models

### Taxonomy (`taxonomy.Taxonomy`)

**Purpose**: Controlled vocabulary for categorization.

```python
name: str
slug: str (unique)
taxonomy_type: enum  # category, topic, tag
parent: ForeignKey(Taxonomy, nullable)
is_active: bool
```

**Hierarchy**:
- Categories: Predefined (e.g., "Chatbots", "Image Generation")
- Topics: Community-driven (e.g., "stable-diffusion", "gpt-4")
- Tags: Free-form user tags

---

### Event (`events.Event`)

**Purpose**: Community events, webinars, challenges.

```python
title: str
description: text
event_type: enum  # webinar, workshop, challenge, office_hours
start_time: datetime
end_time: datetime
registration_url: url
is_featured: bool
max_attendees: int (nullable)
```

---

### Battle (`battles.Battle`)

**Purpose**: Competitive prompt battles (future feature).

```python
title: str
theme: str
participants: ManyToMany(User)
start_time: datetime
end_time: datetime
voting_end_time: datetime
status: enum  # upcoming, active, voting, completed
prize_pool: decimal
```

---

## Data Relationships

### One-to-Many Relationships

| Parent | Child | Cascade Behavior |
|--------|-------|-----------------|
| User → Project | CASCADE | Delete user → delete all projects |
| User → PointActivity | CASCADE | Delete user → delete all activities |
| User → QuizAttempt | CASCADE | Delete user → delete all attempts |
| Project → Comment | CASCADE | Delete project → delete all comments |
| Quiz → QuizQuestion | CASCADE | Delete quiz → delete all questions |

### Many-to-Many Relationships

| Entity A | Entity B | Through Table | Notes |
|----------|----------|---------------|-------|
| User ↔ Achievement | UserAchievement | Tracks earned_at timestamp |
| Project ↔ Tool | Project.tools | Standard M:N |
| Project ↔ Taxonomy | Project.categories | Standard M:N |
| User ↔ User | Follow | Asymmetric follow relationship |

---

## Privacy & Visibility

### Project Privacy Levels

| Level | Visibility | Feed | Search | Direct Link |
|-------|-----------|------|--------|-------------|
| **Public** (`is_private=false, is_showcase=true`) | Everyone | ✅ | ✅ | ✅ |
| **Unlisted** (`is_private=false, is_showcase=false`) | Anyone with link | ❌ | ❌ | ✅ |
| **Private** (`is_private=true`) | Owner only | ❌ | ❌ | Owner only |
| **Archived** (`is_archived=true`) | Owner only | ❌ | ❌ | Owner only |

### User Privacy Settings

```python
{
    "profile_visibility": "public" | "private",
    "show_email": bool,
    "show_github": bool,
    "show_activity": bool,
    "allow_comments": bool,
    "allow_follows": bool
}
```

---

## Indexing Strategy

### Primary Indexes

**High-traffic lookups**:
- User: `username` (unique), `email` (unique)
- Project: `(user, slug)` (unique), `(is_showcase, -created_at)`
- Quiz: `slug` (unique)
- Tool: `slug` (unique)

### Performance Indexes

**Browse/explore pages**:
- Project: `(is_private, -created_at)`
- Project: `(is_showcase, is_archived, -created_at)`
- PointActivity: `(user, -created_at)`

### Analytics Indexes

**Reporting queries**:
- PointActivity: `(activity_type, -created_at)`
- UserAchievement: `(achievement, earned_at)`
- QuizAttempt: `(quiz, -completed_at)`

---

## Data Constraints

### Business Rules

1. **One Highlighted Project**: Only one `Project.is_highlighted=true` per user
2. **Unique Slugs**: Slugs are unique within user namespace
3. **Point Minimums**: All point values must be positive integers
4. **Quiz Attempts**: Users can retake quizzes unlimited times
5. **Achievement Unlocks**: Once earned, achievements cannot be revoked

### Data Integrity

1. **Referential Integrity**: All foreign keys use `on_delete` policies
2. **Validation**: Models use Django validators (e.g., `MinValueValidator`)
3. **Atomic Operations**: Thrive Circle point awards are transactional
4. **Soft Deletes**: Projects use `is_archived` instead of hard deletes

---

## Schema Migration Strategy

### Versioning

- **Major Version** (1.x → 2.x): Breaking schema changes
- **Minor Version** (1.1 → 1.2): Additive changes (new fields, indexes)
- **Patch** (1.1.0 → 1.1.1): Data migrations, fixes

### Backward Compatibility

- New fields must have defaults or be nullable
- Deprecate before removing (grace period: 3 months)
- Use Django migrations for all schema changes

### Zero-Downtime Migrations

1. Add new field with default
2. Deploy code using new field
3. Backfill historical data (if needed)
4. Remove old field after validation

---

## Performance Considerations

### Query Optimization

**Select Related**: Pre-fetch foreign keys
```python
Project.objects.select_related('user', 'content_source')
```

**Prefetch Related**: Pre-fetch M:N relationships
```python
Project.objects.prefetch_related('tools', 'categories')
```

**Database Indexes**: See indexing strategy above

### Caching Strategy

| Model | Cache TTL | Invalidation |
|-------|-----------|--------------|
| Tool | 1 hour | On admin update |
| Taxonomy | 1 hour | On admin update |
| Quiz | 30 min | On admin update |
| User Profile | 5 min | On user update |
| Project List | None | Real-time |

---

## JSON Field Schemas

### Project.content

```json
{
  "blocks": [
    {
      "type": "cover",
      "banner_url": "string",
      "title": "string"
    },
    {
      "type": "text",
      "content": "markdown string"
    },
    {
      "type": "image",
      "url": "string",
      "caption": "string"
    },
    {
      "type": "video",
      "provider": "youtube",
      "video_id": "string"
    },
    {
      "type": "mermaid",
      "diagram": "mermaid syntax string"
    }
  ]
}
```

### User.privacy_settings

```json
{
  "profile_visibility": "public",
  "show_email": false,
  "show_github": true,
  "show_activity": true,
  "allow_comments": true,
  "allow_follows": true
}
```

### SideQuest.requirements

```json
{
  "target": 5,
  "timeframe": "week",
  "criteria": "perfect_score",
  "topic": "optional_topic_slug"
}
```

---

## Future Enhancements

### Planned Models

1. **Marketplace**: Product, Purchase, License
2. **Notifications**: InAppNotification, EmailQueue
3. **Analytics**: UserActivity, ProjectView, Engagement
4. **Moderation**: FlaggedContent, ModerationAction
5. **Webhooks**: WebhookEndpoint, WebhookDelivery

### Schema Evolution

- Explore JSONB indexes for `Project.content` queries
- Consider time-series database for `PointActivity` (high volume)
- Evaluate read replicas for browse/explore queries
- Archive old `QuizAttempt` data (retention: 1 year)

---

**Version**: 1.0  
**Status**: Stable  
**Review Cadence**: Quarterly
