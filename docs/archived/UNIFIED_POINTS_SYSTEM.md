# Unified Points System Architecture

**Date**: 2025-11-24
**Status**: ✅ Completed and Production-Ready

## Overview

AllThrive AI uses a **unified points system** with the `User` model as the single source of truth for all gamification data. This document describes the architecture, implementation, and usage of the system.

## Architecture

### Single Source of Truth: User Model

**Location**: `core/users/models.py`

All gamification state lives on the `User` model:

```python
class User(AbstractUser):
    # Points and progression
    total_points = models.IntegerField(default=0)
    tier = models.CharField(max_length=20, default='ember')  # ember, spark, blaze, beacon, phoenix
    level = models.IntegerField(default=1)

    # Streak tracking
    current_streak_days = models.IntegerField(default=0)
    longest_streak_days = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)

    # Lifetime statistics
    lifetime_quizzes_completed = models.IntegerField(default=0)
    lifetime_projects_created = models.IntegerField(default=0)
    lifetime_comments_posted = models.IntegerField(default=0)
```

### Tier Thresholds

```python
TIER_THRESHOLDS = {
    'ember': 0,        # Starting tier
    'spark': 250,      # Active learner
    'blaze': 500,      # Consistent contributor
    'beacon': 1000,    # Advanced user
    'phoenix': 2500,   # Elite member
}
```

### Level Progression

- **Levels 1-23**: Predefined thresholds (0, 50, 100, 200, 300, 500, 750, 1000...)
- **After Level 20**: +10,000 points per level

## Core API: `User.add_points()`

**The ONLY method that should be used to award points.**

```python
@transaction.atomic
def add_points(self, amount, activity_type, description=''):
    """
    Award points to user with atomic transaction and race condition protection.

    Args:
        amount (int): Points to award (must be positive)
        activity_type (str): Type of activity (quiz_complete, project_create, etc.)
        description (str): Optional human-readable description

    Returns:
        int: User's new total_points value

    Raises:
        ValueError: If amount is not positive
    """
```

### Features

1. **Atomic Transaction**: Uses `F()` expressions to prevent race conditions
2. **Auto Tier/Level Calculation**: Updates tier and level automatically
3. **Streak Tracking**: Updates daily activity streak
4. **Activity Logging**: Creates `PointActivity` record
5. **Upgrade Detection**: Logs tier and level upgrades

### Example Usage

```python
from core.users.models import User

user = User.objects.get(username='alice')

# Award points for completing a quiz
user.add_points(25, 'quiz_complete', 'Python Basics Quiz')

# Award points for creating a project
user.add_points(100, 'project_create', 'Created: AI Chatbot')

# Award streak bonus
user.add_points(50, 'streak_bonus', '7-day streak maintained!')
```

## Activity Types

```python
ACTIVITY_TYPE_CHOICES = [
    ('quiz_complete', 'Quiz Completed'),
    ('project_create', 'Project Created'),
    ('project_update', 'Project Updated'),
    ('comment', 'Comment Posted'),
    ('reaction', 'Reaction Given'),
    ('daily_login', 'Daily Login'),
    ('streak_bonus', 'Streak Bonus'),
    ('weekly_goal', 'Weekly Goal Completed'),
    ('side_quest', 'Side Quest Completed'),
    ('special_event', 'Special Event'),
    ('referral', 'Referral Bonus'),
]
```

## PointActivity Model

**Location**: `core/thrive_circle/models.py`

Tracks individual point-earning activities for audit and analytics:

```python
class PointActivity(models.Model):
    id = models.UUIDField(primary_key=True)
    user = models.ForeignKey(User, related_name='point_activities')
    amount = models.IntegerField()
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    description = models.CharField(max_length=255)
    tier_at_time = models.CharField(max_length=20)  # Historical record
    created_at = models.DateTimeField(auto_now_add=True)
```

### Querying Activities

```python
# Get user's recent activities
activities = user.point_activities.order_by('-created_at')[:20]

# Get activities by type
quiz_activities = user.point_activities.filter(activity_type='quiz_complete')

# Get total points from projects
from django.db.models import Sum
project_points = user.point_activities.filter(
    activity_type='project_create'
).aggregate(Sum('amount'))['amount__sum']
```

## API Endpoints

### Award Points

**POST** `/api/v1/me/thrive-circle/award-points/`

```json
{
  "amount": 50,
  "activity_type": "comment",
  "description": "Posted helpful comment"
}
```

**Response**:
```json
{
  "user": {
    "id": 123,
    "username": "alice",
    "total_points": 650,
    "tier": "spark",
    "tier_display": "Spark",
    "level": 4,
    "points_to_next_tier": 100,
    "points_to_next_level": 50
  },
  "point_activity": {
    "id": "uuid",
    "amount": 50,
    "activity_type": "comment",
    "description": "Posted helpful comment",
    "created_at": "2025-11-24T12:00:00Z"
  },
  "tier_upgraded": false,
  "old_tier": null,
  "new_tier": null
}
```

### Get My Status

**GET** `/api/v1/me/thrive-circle/my-status/`

Returns current user's points status with recent activities.

### Leaderboard

**GET** `/api/v1/me/thrive-circle/`

Returns all users ordered by total_points (leaderboard).

## Supporting Models

### WeeklyGoal

Tracks user progress towards weekly bonus goals:

```python
class WeeklyGoal(models.Model):
    user = models.ForeignKey(User, related_name='weekly_goals')
    goal_type = models.CharField(choices=GOAL_TYPE_CHOICES)
    week_start = models.DateField()
    week_end = models.DateField()
    current_progress = models.IntegerField(default=0)
    target_progress = models.IntegerField()
    is_completed = models.BooleanField(default=False)
    points_reward = models.IntegerField(default=30)
```

### SideQuest

Optional challenges users can complete:

```python
class SideQuest(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    quest_type = models.CharField(choices=QUEST_TYPE_CHOICES)
    difficulty = models.CharField(choices=DIFFICULTY_CHOICES)
    points_reward = models.IntegerField()
    is_active = models.BooleanField(default=True)
```

### UserSideQuest

User progress on side quests:

```python
class UserSideQuest(models.Model):
    user = models.ForeignKey(User, related_name='side_quests')
    side_quest = models.ForeignKey(SideQuest)
    status = models.CharField(choices=STATUS_CHOICES)
    current_progress = models.IntegerField(default=0)
    target_progress = models.IntegerField()
    is_completed = models.BooleanField(default=False)
    points_awarded = models.IntegerField(default=0)

    def complete(self):
        """Mark quest as completed and award points."""
        if not self.is_completed:
            self.is_completed = True
            self.status = 'completed'
            self.completed_at = timezone.now()
            self.points_awarded = self.side_quest.points_reward
            self.save()

            # Award points via unified system
            self.user.add_points(
                self.points_awarded,
                'side_quest',
                f'Completed: {self.side_quest.title}'
            )
```

## Celery Tasks

### create_weekly_goals()

**Schedule**: Every Monday at 00:00
**Purpose**: Creates weekly goals for all active users

```python
@shared_task
def create_weekly_goals():
    week_start = get_week_start()
    active_users = User.objects.filter(is_active=True)
    # Creates goals using bulk_create for performance
```

### check_streak_bonuses()

**Schedule**: Daily (end of day)
**Purpose**: Awards streak bonuses for users who maintained their streak

```python
@shared_task
def check_streak_bonuses():
    today = timezone.now().date()
    active_today = User.objects.filter(last_activity_date=today)

    for user in active_today:
        if user.current_streak_days > 0:
            bonus_points = 5 * min(user.current_streak_days, 100)
            user.add_points(bonus_points, 'streak_bonus', f'{user.current_streak_days}-day streak!')
```

## Migration History

### Removed Models

**UserTier model** was completely removed on 2025-11-24. It was a duplicate gamification system that created architectural conflicts. All functionality was consolidated into the User model.

**Deleted migrations**:
- `0002_create_user_tiers.py` (UserTier initial)
- `0006_add_level_to_usertier.py` (UserTier level field)
- `0003_weeklygoal_usertier_current_streak_days_and_more.py` (Referenced UserTier)
- `0004_sidequest_usersidequest.py` (Had xp_reward terminology)
- `0005_sidequest_skill_level_sidequest_topic_and_more.py` (Dependent on 0004)
- `0007_rename_xp_to_points.py` (Dependent on deleted 0006)

### Current Migrations

1. **0001_initial.py** - PointActivity model with User foreign key
2. **0002_sidequest_usersidequest_weeklygoal_and_more.py** - Supporting models

## Database Schema

### User Table Columns (Gamification)

```sql
-- Points and progression
total_points INTEGER DEFAULT 0
tier VARCHAR(20) DEFAULT 'ember'
level INTEGER DEFAULT 1

-- Streak tracking
current_streak_days INTEGER DEFAULT 0
longest_streak_days INTEGER DEFAULT 0
last_activity_date DATE

-- Lifetime statistics
lifetime_quizzes_completed INTEGER DEFAULT 0
lifetime_projects_created INTEGER DEFAULT 0
lifetime_comments_posted INTEGER DEFAULT 0
```

### PointActivity Table

```sql
id UUID PRIMARY KEY
user_id BIGINT REFERENCES core_user(id)
amount INTEGER
activity_type VARCHAR(30)
description VARCHAR(255)
tier_at_time VARCHAR(20)
created_at TIMESTAMP

-- Indexes
INDEX (user_id, created_at DESC)
INDEX (activity_type, created_at DESC)
INDEX (user_id, activity_type)
```

## Testing

```python
from core.users.models import User
from core.thrive_circle.models import PointActivity

# Create test user
user = User.objects.create_user(
    username='testuser',
    email='test@example.com',
    password='testpass123'
)

# Award points
result = user.add_points(150, 'project_create', 'Test project')
user.refresh_from_db()

assert user.total_points == 150
assert user.tier == 'ember'
assert user.level == 2
assert PointActivity.objects.filter(user=user).count() == 1

# Test tier upgrade
user.add_points(500, 'special_event', 'Big reward')
user.refresh_from_db()

assert user.total_points == 650
assert user.tier == 'spark'
assert user.level == 4
```

## Best Practices

### ✅ DO

- Always use `user.add_points()` to award points
- Use descriptive activity_type values from ACTIVITY_TYPE_CHOICES
- Provide meaningful descriptions for audit trail
- Query `user.point_activities` for activity history
- Use `user.tier`, `user.level`, `user.total_points` for display

### ❌ DON'T

- Modify `user.total_points` directly (bypasses tier/level updates)
- Create PointActivity records manually (add_points() does it)
- Use `UserTier` model (removed - doesn't exist)
- Use XP terminology (replaced with points)

## Performance Considerations

1. **F() Expressions**: Atomic updates prevent race conditions
2. **Bulk Operations**: Weekly goals use `bulk_create()`
3. **Prefetch Related**: ViewSets use `prefetch_related('point_activities')`
4. **Indexes**: Optimized queries on user_id, activity_type, created_at

## Monitoring

Key metrics to track:

```python
# Total points awarded today
from django.utils import timezone
from django.db.models import Sum

today = timezone.now().date()
points_today = PointActivity.objects.filter(
    created_at__date=today
).aggregate(Sum('amount'))['amount__sum']

# Tier distribution
from django.db.models import Count
tier_dist = User.objects.values('tier').annotate(count=Count('id'))

# Most active users (last 7 days)
from datetime import timedelta
week_ago = timezone.now() - timedelta(days=7)
active_users = User.objects.filter(
    point_activities__created_at__gte=week_ago
).annotate(
    recent_points=Sum('point_activities__amount')
).order_by('-recent_points')[:10]
```

## Future Enhancements

- [ ] Topic-specific point tracking
- [ ] Badge system integration
- [ ] Social features (share achievements)
- [ ] Decay system for inactive users
- [ ] Seasonal events with multipliers

---

**Last Updated**: 2025-11-24
**Maintainer**: AllThrive AI Team
