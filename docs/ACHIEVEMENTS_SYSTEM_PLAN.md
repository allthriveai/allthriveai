# Achievement System Implementation Plan

## Overview
Build a comprehensive, trackable achievement system where users earn badges for completing various actions and milestones on the platform.

## Architecture

### 1. Data Models (`core/achievements/models.py`)

#### Achievement Model
Defines the achievement itself (master data)
```python
class AchievementCategory(TextChoices):
    PROJECTS = "projects", "Projects"
    BATTLES = "battles", "Battles"
    COMMUNITY = "community", "Community"
    ENGAGEMENT = "engagement", "Engagement"
    STREAKS = "streaks", "Streaks"

class CriteriaType(TextChoices):
    COUNT = "count", "Count"  # e.g., "Create 10 projects"
    THRESHOLD = "threshold", "Threshold"  # e.g., "Get 100 stars"
    STREAK = "streak", "Streak"  # e.g., "7 day streak"
    FIRST_TIME = "first_time", "First Time"  # e.g., "First project"
    CUMULATIVE = "cumulative", "Cumulative"  # e.g., "1000 total points"

class Achievement(models.Model):
    key = models.CharField(max_length=100, unique=True)  # e.g., "first_project"
    name = models.CharField(max_length=200)
    description = models.TextField()

    # Display
    icon = models.CharField(max_length=50)  # FontAwesome icon name (e.g., "faRocket")
    color_from = models.CharField(max_length=20)  # Gradient start (e.g., "blue-500")
    color_to = models.CharField(max_length=20)  # Gradient end (e.g., "blue-600")

    # Categorization
    category = models.CharField(max_length=20, choices=AchievementCategory.choices)
    points = models.IntegerField(default=10)

    # Unlock Logic
    criteria_type = models.CharField(max_length=20, choices=CriteriaType.choices)
    criteria_value = models.IntegerField()  # The target (e.g., 10 for "10 projects")
    tracking_field = models.CharField(max_length=100)  # What to track (e.g., "project_count")

    # Optional: dependencies
    requires_achievements = models.ManyToManyField('self', blank=True, symmetrical=False)

    # Metadata
    is_secret = models.BooleanField(default=False)  # Hidden until earned
    rarity = models.CharField(max_length=20, default="common")  # common, rare, epic, legendary
    order = models.IntegerField(default=0)  # Display order within category
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
```

#### UserAchievement Model
Tracks which achievements a user has earned
```python
class UserAchievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='earned_achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)

    earned_at = models.DateTimeField(auto_now_add=True)
    progress_at_unlock = models.IntegerField(null=True)  # The value when unlocked

    class Meta:
        unique_together = ('user', 'achievement')
        ordering = ['-earned_at']
```

#### AchievementProgress Model
Tracks current progress toward achievements
```python
class AchievementProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievement_progress')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)

    current_value = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'achievement')
```

### 2. Achievement Tracking Service (`services/achievements/`)

#### `tracker.py`
Core tracking logic
```python
class AchievementTracker:
    @staticmethod
    def track_event(user, event_type, value=1):
        """Track an event and check for achievement unlocks"""

    @staticmethod
    def check_and_unlock(user, achievement):
        """Check if user meets criteria and unlock if ready"""

    @staticmethod
    def calculate_progress(user, achievement):
        """Calculate current progress percentage"""

    @staticmethod
    def award_retroactive_achievements(user):
        """Award achievements for past actions"""
```

#### `signals.py`
Django signals to automatically track events
```python
@receiver(post_save, sender=Project)
def track_project_created(sender, instance, created, **kwargs):
    if created:
        AchievementTracker.track_event(
            user=instance.user,
            event_type='project_created',
            value=1
        )

@receiver(post_save, sender=Battle)
def track_battle_won(sender, instance, created, **kwargs):
    # Check if user won and track
    pass
```

### 3. Event Types to Track

| Event | Trigger | Tracking Field |
|-------|---------|---------------|
| `project_created` | Project post_save | `project_count` |
| `project_published` | Project.is_published = True | `published_project_count` |
| `battle_won` | Battle completed with win | `battle_wins` |
| `battle_participated` | Battle completed | `battle_count` |
| `login_streak` | User login daily | `current_streak`, `max_streak` |
| `community_help` | Upvote/comment | `helpful_actions` |
| `quiz_completed` | Quiz finished | `quiz_count` |
| `points_earned` | Any point-earning action | `total_points` |

### 4. Initial Achievement Definitions

#### Projects Category
- **First Launch** (first_project) - Create your first project
- **Getting Started** (5_projects) - Create 5 projects
- **Power User** (10_projects) - Create 10 projects
- **Portfolio Master** (25_projects) - Create 25 projects
- **Prolific Creator** (50_projects) - Create 50 projects
- **First Publish** (first_published) - Publish your first project

#### Battles Category
- **Battle Ready** (first_battle) - Participate in first prompt battle
- **Battle Tested** (5_battles) - Participate in 5 battles
- **Battle Champion** (5_wins) - Win 5 prompt battles
- **Battle Master** (10_wins) - Win 10 battles

#### Community Category
- **Community Helper** (help_5) - Help 5 community members
- **Supportive** (help_25) - Help 25 community members
- **Community Leader** (help_100) - Help 100 community members

#### Engagement Category
- **Welcome** (first_login) - First time logging in
- **Week Streak** (7_day_streak) - 7 day login streak
- **Month Streak** (30_day_streak) - 30 day login streak
- **Quiz Master** (10_quizzes) - Complete 10 quizzes

#### Milestones Category
- **Point Collector** (100_points) - Earn 100 points
- **Rising Star** (500_points) - Earn 500 points
- **Platform Expert** (1000_points) - Earn 1000 points

### 5. API Endpoints (`core/achievements/views.py`)

```python
# GET /api/v1/achievements/
# List all achievements (with user progress if authenticated)

# GET /api/v1/achievements/earned/
# Get user's earned achievements

# GET /api/v1/achievements/{key}/
# Get specific achievement detail with progress

# GET /api/v1/achievements/categories/
# Get achievements grouped by category

# POST /api/v1/achievements/check/
# Manually trigger achievement check (for debugging)
```

### 6. Frontend Integration

#### API Service (`frontend/src/services/achievements.ts`)
```typescript
export interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  category: string;
  points: number;
  isEarned: boolean;
  earnedAt?: string;
  progress?: number;
  progressValue?: number;
  targetValue?: number;
  isSecret?: boolean;
  rarity?: string;
}

export async function getAchievements(): Promise<Achievement[]>
export async function getEarnedAchievements(): Promise<Achievement[]>
export async function getAchievementProgress(key: string): Promise<Progress>
```

#### Achievement Notification Component
Toast/modal that appears when user earns achievement

### 7. Database Migration Strategy

1. Create new app: `python manage.py startapp achievements` within `core/`
2. Add models to `core/achievements/models.py`
3. Create migrations: `python manage.py makemigrations achievements`
4. Create fixture file: `core/fixtures/achievements.json`
5. Create management command: `python manage.py load_achievements`
6. Award retroactive achievements: `python manage.py award_retroactive_achievements`

### 8. Management Commands

```bash
# Initialize achievement definitions
python manage.py load_achievements

# Award retroactive achievements to all users
python manage.py award_retroactive_achievements

# Recalculate progress for specific user
python manage.py recalculate_achievements --user=username

# Check achievement unlock status
python manage.py check_achievements --user=username

# Debug achievement system
python manage.py debug_achievements --user=username --achievement=first_project
```

### 9. Testing Strategy

- Unit tests for achievement unlock logic
- Tests for each event signal
- Test retroactive achievement awards
- API endpoint tests
- Edge cases (already earned, missing criteria, etc.)

### 10. Future Enhancements

- Achievement sharing to social media
- Leaderboards showing who earned what first
- Rare/secret achievements
- Time-limited achievements (events)
- Achievement collections/sets
- Profile badge display customization
- Achievement-based profile flair/themes
- Point-based rewards/perks

## Implementation Order

1. ✅ Plan and document (this file)
2. Create Django app structure
3. Define models and migrations
4. Create achievement fixtures
5. Implement tracking service
6. Set up signals
7. Create API endpoints
8. Build management commands
9. Test retroactive awards
10. Update frontend to fetch real data
11. Add notification system
12. Write tests
13. Deploy and monitor

## Technical Considerations

- **Performance**: Cache achievement definitions, batch progress updates
- **Scalability**: Use Celery for background achievement checks on large operations
- **Data Integrity**: Use transactions for achievement unlocks
- **Audit Trail**: Log all achievement unlocks for debugging
- **Notifications**: Queue notifications to avoid blocking requests

## Success Metrics

- % of users who earn at least one achievement
- Average achievements per user
- Most/least earned achievements
- Time to first achievement
- Achievement unlock rate over time
