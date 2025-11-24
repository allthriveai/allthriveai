# Thrive Circle - Implementation Plan (Simplified MVP)

## Overview
Build an inclusive, participation-focused progression system that rewards engagement, builds community, and creates sustainable learning habits through game mechanics.

## Design Philosophy

### Core Principles
1. **Participation Over Skill**: Everyone earns XP for showing up and engaging, not just for being "the best"
2. **Always Progress**: Tiers never decrease - you always move forward
3. **No Hierarchy**: Tier names celebrate growth, not rank - an Ember can start a revolution!
4. **Community Building**: Meet people at your level, learn together, celebrate wins
5. **Habit Formation**: Daily streaks and weekly goals encourage consistent engagement

### Why This Approach?
- **Simple to understand**: One clear progression path
- **Inclusive**: No "bottom tier" shame - every tier is valuable
- **Sustainable**: Focus on long-term growth, not weekly stress
- **Expandable**: Can add competitive features later if users want them

## System Architecture

### Tier System (Permanent)

Users accumulate total XP throughout their lifetime on the platform. Tiers unlock based on milestones:

```
Ember   → 0-499 XP       (🔥 Small spark with big potential)
Spark   → 500-1,999 XP   (⚡ Igniting the fire)
Blaze   → 2,000-4,999 XP (🔥 Burning bright)
Beacon  → 5,000-9,999 XP (💡 Lighting the way for others)
Phoenix → 10,000+ XP     (🐦 Reborn stronger, inspiring transformation)
```

**Why These Names?**
- All fire/energy themed - cohesive with "Side Quests" adventure theme
- Non-hierarchical - an Ember isn't "worse" than a Phoenix, just different stage
- Positive progression - each tier celebrates growth
- Memorable and visual - easy to understand and represent

**Key Features:**
- Never lose tier progress (always moves forward)
- Visual badges and animations
- Unlocks features/content at higher tiers (advanced side quests, etc.)
- Displayed on profile and throughout app
- Celebration animations when leveling up

### Weekly Leaderboard (Simple Competition)

Within each tier, users can see weekly top performers:

**Weekly Stats:**
- Top 10 earners in your tier this week
- Your rank within your tier
- Total XP earned this week
- Streak status

**Why This Works:**
- Competition without complexity
- Fresh start every Monday
- Compare with similar-level users
- Optional - you can ignore it and just progress

**Example Display:**
```
🔥 Blaze Tier - This Week's Top Earners
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#1  Sarah Chen        +487 XP  🔥
#2  Marcus Rodriguez  +423 XP  🔥
#3  Aisha Patel       +401 XP  🔥
...
#23 You              +156 XP  ⚡
...
#48 Last             +12 XP
```

### Points & XP System

**Design Goal**: Reward diverse participation, not just quiz performance

#### Daily Activities (Unlimited)
```
Complete quiz (beginner):       10 XP
Complete quiz (intermediate):   25 XP
Complete quiz (advanced):       50 XP

Create new project:             20 XP
Update existing project:        10 XP

Comment on project/quiz:         5 XP
React to content (like/love):    2 XP

Daily login:                     5 XP
Maintain streak (consecutive):  +5 XP per day
```

#### Weekly Goals (Bonus XP)
```
Complete 3 activities:          30 XP bonus
Maintain 7-day streak:          50 XP bonus
Help 5 community members:       40 XP bonus
Try 2 new quiz topics:          25 XP bonus
```

#### Side Quests Integration (Future)
```
Complete side quest (beginner):      50 XP
Complete side quest (intermediate):  100 XP
Complete side quest (advanced):      200 XP

Achieve perfect score:               +25% bonus
Complete with efficiency bonus:      +50 XP
Earn achievements:                   25-100 XP each
```

#### Social & Special Events
```
Invite friend who joins:        100 XP
Friend completes first quest:    50 XP (both users)

Weekly challenge participation:  Variable (50-500 XP)
Special events/tournaments:      Variable (100-1000 XP)
```

### Initial Tier Assignment

**For New Users:**
- Start at Ember tier (0 XP)
- Welcome bonus: 50 XP for completing profile
- Guided onboarding quest: +30 XP

**For Existing Users (Migration):**
```python
# Calculate based on existing activity
quiz_xp = completed_quizzes * 20  # Average XP per quiz
project_xp = projects_created * 20 + projects_updated * 10
engagement_xp = (comments_count * 5) + (reactions_count * 2)

total_xp = quiz_xp + project_xp + engagement_xp

# Assign tier based on total
```

## Phase 1: Backend Foundation

### 1.1 Database Models

Create `core/thrive_circle/models.py`:

```python
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class UserTier(models.Model):
    """User's permanent tier based on total XP"""

    TIER_CHOICES = [
        ('ember', 'Ember'),
        ('spark', 'Spark'),
        ('blaze', 'Blaze'),
        ('beacon', 'Beacon'),
        ('phoenix', 'Phoenix'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tier_status')

    # Tier progress
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='ember')
    total_xp = models.IntegerField(default=0)

    # Achievements
    tier_unlocked_at = models.DateTimeField(auto_now_add=True)
    highest_tier_reached = models.CharField(max_length=20, choices=TIER_CHOICES, default='ember')

    # Stats
    lifetime_quizzes_completed = models.IntegerField(default=0)
    lifetime_projects_created = models.IntegerField(default=0)
    lifetime_side_quests_completed = models.IntegerField(default=0)
    lifetime_comments_posted = models.IntegerField(default=0)

    # Streaks
    current_streak_days = models.IntegerField(default=0)
    longest_streak_days = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)

    # Weekly stats (resets every Monday)
    weekly_xp = models.IntegerField(default=0)
    week_start = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_xp']
        indexes = [
            models.Index(fields=['tier', '-total_xp']),
            models.Index(fields=['-total_xp']),
            models.Index(fields=['tier', '-weekly_xp']),
        ]

    def update_tier(self):
        """Update tier based on total XP"""
        if self.total_xp >= 10000:
            new_tier = 'phoenix'
        elif self.total_xp >= 5000:
            new_tier = 'beacon'
        elif self.total_xp >= 2000:
            new_tier = 'blaze'
        elif self.total_xp >= 500:
            new_tier = 'spark'
        else:
            new_tier = 'ember'

        if new_tier != self.tier:
            old_tier = self.tier
            self.tier = new_tier

            # Track highest tier
            if new_tier != self.highest_tier_reached:
                self.highest_tier_reached = new_tier
                self.tier_unlocked_at = timezone.now()

            self.save()

            # Send tier up notification
            send_tier_upgrade_notification(self.user, old_tier, new_tier)

    def add_xp(self, amount, activity_type, description=''):
        """Add XP and create activity record"""
        self.total_xp += amount

        # Update weekly XP
        today = timezone.now().date()
        week_start = get_week_start()

        if self.week_start != week_start:
            # New week, reset weekly XP
            self.weekly_xp = 0
            self.week_start = week_start

        self.weekly_xp += amount

        # Update tier if threshold crossed
        self.update_tier()

        # Update daily streak
        if self.last_activity_date == today - timezone.timedelta(days=1):
            self.current_streak_days += 1
        elif self.last_activity_date != today:
            self.current_streak_days = 1

        if self.current_streak_days > self.longest_streak_days:
            self.longest_streak_days = self.current_streak_days

        self.last_activity_date = today
        self.save()

        # Create XP activity record
        XPActivity.objects.create(
            user=self.user,
            amount=amount,
            activity_type=activity_type,
            description=description,
            tier_at_time=self.tier
        )

        # Check weekly goals
        check_weekly_goals(self.user, activity_type)

        return self.total_xp


class XPActivity(models.Model):
    """Individual XP-earning activities for tracking and analytics"""

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

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='xp_activities')

    amount = models.IntegerField()
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    description = models.CharField(max_length=255, blank=True)

    # Context
    tier_at_time = models.CharField(max_length=20)

    # Reference to source object (optional)
    content_type = models.ForeignKey(
        'contenttypes.ContentType',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
        ]


class WeeklyGoal(models.Model):
    """Track user progress towards weekly bonus goals"""

    GOAL_TYPE_CHOICES = [
        ('activities_3', 'Complete 3 Activities'),
        ('streak_7', 'Maintain 7-Day Streak'),
        ('help_5', 'Help 5 Community Members'),
        ('topics_2', 'Try 2 New Topics'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_goals')
    goal_type = models.CharField(max_length=30, choices=GOAL_TYPE_CHOICES)

    week_start = models.DateField()
    week_end = models.DateField()

    current_progress = models.IntegerField(default=0)
    target_progress = models.IntegerField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    xp_reward = models.IntegerField(default=30)

    class Meta:
        unique_together = ['user', 'goal_type', 'week_start']
        indexes = [
            models.Index(fields=['user', 'week_start', 'is_completed']),
        ]


class ThriveCircleConnection(models.Model):
    """Friend/follow connections within Thrive Circle"""

    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='circle_following'
    )
    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='circle_followers'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['follower', 'following']
        indexes = [
            models.Index(fields=['follower', '-created_at']),
            models.Index(fields=['following', '-created_at']),
        ]
```

### 1.2 Helper Functions

```python
from datetime import datetime, timedelta

def get_week_start():
    """Get the Monday of current week"""
    today = timezone.now().date()
    return today - timedelta(days=today.weekday())


def get_next_tier_xp(current_tier):
    """Get XP needed for next tier"""
    tier_thresholds = {
        'ember': 500,
        'spark': 2000,
        'blaze': 5000,
        'beacon': 10000,
        'phoenix': None,  # Max tier
    }
    return tier_thresholds.get(current_tier)


def calculate_tier_progress(tier_status):
    """Calculate progress percentage to next tier"""
    current_xp = tier_status.total_xp
    current_tier = tier_status.tier

    tier_ranges = {
        'ember': (0, 500),
        'spark': (500, 2000),
        'blaze': (2000, 5000),
        'beacon': (5000, 10000),
        'phoenix': (10000, float('inf')),
    }

    if current_tier == 'phoenix':
        return 100  # Max tier

    tier_min, tier_max = tier_ranges[current_tier]
    progress = ((current_xp - tier_min) / (tier_max - tier_min)) * 100
    return min(100, max(0, progress))


def check_weekly_goals(user, activity_type):
    """Check and update weekly goals based on activity"""
    week_start = get_week_start()

    # Get or create weekly goals for this week
    goals = WeeklyGoal.objects.filter(
        user=user,
        week_start=week_start,
        is_completed=False
    )

    # Update relevant goals based on activity type
    if activity_type in ['quiz_complete', 'project_create', 'side_quest']:
        goal = goals.filter(goal_type='activities_3').first()
        if goal:
            goal.current_progress += 1
            if goal.current_progress >= goal.target_progress:
                goal.is_completed = True
                goal.completed_at = timezone.now()
                # Award bonus XP
                user.tier_status.add_xp(goal.xp_reward, 'weekly_goal', f'Completed: {goal.get_goal_type_display()}')
            goal.save()

    elif activity_type == 'comment':
        goal = goals.filter(goal_type='help_5').first()
        if goal:
            goal.current_progress += 1
            if goal.current_progress >= goal.target_progress:
                goal.is_completed = True
                goal.completed_at = timezone.now()
                user.tier_status.add_xp(goal.xp_reward, 'weekly_goal', f'Completed: {goal.get_goal_type_display()}')
            goal.save()
```

### 1.3 API Endpoints

Create `core/thrive_circle/views.py`:

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.utils import timezone


class ThriveCircleViewSet(viewsets.ViewSet):
    """Main endpoint for Thrive Circle features"""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_status(self, request):
        """Get current user's tier and stats"""
        user = request.user
        tier_status, created = UserTier.objects.get_or_create(user=user)

        # Get weekly rank within tier
        week_start = get_week_start()
        tier_users = UserTier.objects.filter(
            tier=tier_status.tier,
            week_start=week_start
        ).order_by('-weekly_xp')

        user_rank = list(tier_users.values_list('user_id', flat=True)).index(user.id) + 1 if user.id in tier_users.values_list('user_id', flat=True) else None

        # Get weekly goals
        weekly_goals = WeeklyGoal.objects.filter(
            user=user,
            week_start=week_start
        )

        return Response({
            'tier': {
                'name': tier_status.tier,
                'total_xp': tier_status.total_xp,
                'next_tier_xp': get_next_tier_xp(tier_status.tier),
                'progress_to_next': calculate_tier_progress(tier_status),
            },
            'weekly': {
                'xp': tier_status.weekly_xp,
                'rank': user_rank,
                'total_in_tier': tier_users.count(),
            },
            'streak': {
                'current': tier_status.current_streak_days,
                'longest': tier_status.longest_streak_days,
            },
            'weekly_goals': WeeklyGoalSerializer(weekly_goals, many=True).data,
            'stats': {
                'lifetime_quizzes': tier_status.lifetime_quizzes_completed,
                'lifetime_projects': tier_status.lifetime_projects_created,
                'lifetime_quests': tier_status.lifetime_side_quests_completed,
            }
        })

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get weekly leaderboard for user's tier"""
        user = request.user
        tier_status = user.tier_status
        week_start = get_week_start()

        # Get top earners in this tier this week
        top_earners = UserTier.objects.filter(
            tier=tier_status.tier,
            week_start=week_start
        ).select_related('user').order_by('-weekly_xp')[:50]

        # Find user's rank
        user_rank = None
        for idx, ts in enumerate(top_earners, 1):
            if ts.user_id == user.id:
                user_rank = idx
                break

        return Response({
            'tier': tier_status.tier,
            'week_start': week_start,
            'user_rank': user_rank,
            'user_weekly_xp': tier_status.weekly_xp,
            'top_earners': [
                {
                    'rank': idx,
                    'user': {
                        'id': ts.user.id,
                        'username': ts.user.username,
                        'display_name': getattr(ts.user, 'display_name', ts.user.username),
                        'avatar_url': getattr(ts.user, 'avatar_url', None),
                    },
                    'weekly_xp': ts.weekly_xp,
                    'streak': ts.current_streak_days,
                }
                for idx, ts in enumerate(top_earners, 1)
            ],
        })

    @action(detail=False, methods=['get'])
    def activity_feed(self, request):
        """Get recent activity from connections"""
        user = request.user

        # Get user's connections
        following = user.circle_following.values_list('following_id', flat=True)

        # Get recent activities from connections (last 7 days)
        activities = XPActivity.objects.filter(
            user_id__in=following,
            created_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).select_related('user').order_by('-created_at')[:50]

        return Response(XPActivitySerializer(activities, many=True).data)

    @action(detail=False, methods=['post'])
    def award_xp(self, request):
        """Award XP for an activity (internal use by other systems)"""
        user = request.user
        amount = request.data.get('amount')
        activity_type = request.data.get('activity_type')
        description = request.data.get('description', '')

        tier_status, created = UserTier.objects.get_or_create(user=user)
        new_total = tier_status.add_xp(amount, activity_type, description)

        return Response({
            'success': True,
            'new_total_xp': new_total,
            'tier': tier_status.tier,
            'weekly_xp': tier_status.weekly_xp,
        })

    @action(detail=False, methods=['get'])
    def global_leaderboard(self, request):
        """Get top users across all tiers"""
        timeframe = request.query_params.get('timeframe', 'all_time')
        limit = int(request.query_params.get('limit', 100))

        if timeframe == 'weekly':
            week_start = get_week_start()
            queryset = UserTier.objects.filter(
                week_start=week_start
            ).order_by('-weekly_xp')[:limit]
        else:
            queryset = UserTier.objects.order_by('-total_xp')[:limit]

        return Response(UserTierSerializer(queryset, many=True).data)

    @action(detail=False, methods=['get'])
    def xp_history(self, request):
        """Get user's XP earning history"""
        user = request.user
        days = int(request.query_params.get('days', 30))

        activities = XPActivity.objects.filter(
            user=user,
            created_at__gte=timezone.now() - timezone.timedelta(days=days)
        ).order_by('-created_at')

        return Response(XPActivitySerializer(activities, many=True).data)
```

#### Endpoint Structure
```
GET    /api/v1/thrive-circle/my-status/           # User's tier, weekly rank, stats
GET    /api/v1/thrive-circle/leaderboard/         # Weekly top earners in user's tier
GET    /api/v1/thrive-circle/activity-feed/       # Recent activity from connections
POST   /api/v1/thrive-circle/award-xp/            # Award XP (internal)
GET    /api/v1/thrive-circle/global-leaderboard/  # Top users globally (all tiers or weekly)
GET    /api/v1/thrive-circle/weekly-goals/        # User's weekly goals
GET    /api/v1/thrive-circle/xp-history/          # XP activity history
POST   /api/v1/thrive-circle/connections/follow/  # Follow a user
DELETE /api/v1/thrive-circle/connections/unfollow/ # Unfollow a user
GET    /api/v1/thrive-circle/connections/         # User's connections
```

### 1.4 Background Tasks

Create `core/thrive_circle/tasks.py`:

```python
from celery import shared_task
from django.utils import timezone
from datetime import timedelta


@shared_task
def reset_weekly_stats():
    """
    Run every Monday at 00:00 to reset weekly XP counters
    """
    week_start = get_week_start()

    # Reset all weekly XP
    UserTier.objects.all().update(
        weekly_xp=0,
        week_start=week_start
    )


@shared_task
def create_weekly_goals():
    """
    Create weekly goals for all active users at start of week
    """
    week_start = get_week_start()
    week_end = week_start + timedelta(days=6)

    active_users = User.objects.filter(is_active=True, tier_status__isnull=False)

    goal_configs = [
        ('activities_3', 3, 30),
        ('streak_7', 7, 50),
        ('help_5', 5, 40),
        ('topics_2', 2, 25),
    ]

    for user in active_users:
        for goal_type, target, xp_reward in goal_configs:
            WeeklyGoal.objects.get_or_create(
                user=user,
                goal_type=goal_type,
                week_start=week_start,
                defaults={
                    'week_end': week_end,
                    'target_progress': target,
                    'xp_reward': xp_reward,
                }
            )


@shared_task
def check_streak_bonuses():
    """
    Run daily to award streak bonuses
    """
    today = timezone.now().date()

    # Get users who logged in today
    active_today = UserTier.objects.filter(last_activity_date=today)

    for tier_status in active_today:
        # Award streak bonus XP
        if tier_status.current_streak_days > 0:
            bonus_xp = 5 * tier_status.current_streak_days
            tier_status.add_xp(bonus_xp, 'streak_bonus', f'{tier_status.current_streak_days}-day streak!')
```

## Phase 2: Frontend Core

### 2.1 TypeScript Types

Create `frontend/src/types/thriveCircle.ts`:

```typescript
export type TierName = 'ember' | 'spark' | 'blaze' | 'beacon' | 'phoenix';

export type ActivityType =
  | 'quiz_complete'
  | 'project_create'
  | 'project_update'
  | 'comment'
  | 'reaction'
  | 'daily_login'
  | 'streak_bonus'
  | 'weekly_goal'
  | 'side_quest'
  | 'special_event'
  | 'referral';

export interface TierStatus {
  name: TierName;
  total_xp: number;
  next_tier_xp: number | null;
  progress_to_next: number;
}

export interface WeeklyStatus {
  xp: number;
  rank: number | null;
  total_in_tier: number;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

export interface WeeklyGoal {
  id: number;
  goal_type: string;
  current_progress: number;
  target_progress: number;
  is_completed: boolean;
  xp_reward: number;
}

export interface UserCircleStatus {
  tier: TierStatus;
  weekly: WeeklyStatus;
  streak: StreakInfo;
  weekly_goals: WeeklyGoal[];
  stats: {
    lifetime_quizzes: number;
    lifetime_projects: number;
    lifetime_quests: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  user: {
    id: number;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  weekly_xp: number;
  streak: number;
}

export interface XPActivity {
  id: number;
  user: {
    username: string;
    display_name: string;
  };
  amount: number;
  activity_type: ActivityType;
  description: string;
  created_at: string;
}
```

### 2.2 API Service

Create `frontend/src/services/thriveCircle.ts`:

```typescript
import { api } from './api';
import type { UserCircleStatus, LeaderboardEntry, XPActivity } from '@/types/thriveCircle';

export async function getMyStatus(): Promise<UserCircleStatus> {
  const response = await api.get<UserCircleStatus>('/thrive-circle/my-status/');
  return response.data;
}

export async function getLeaderboard(): Promise<{
  tier: string;
  week_start: string;
  user_rank: number | null;
  user_weekly_xp: number;
  top_earners: LeaderboardEntry[];
}> {
  const response = await api.get('/thrive-circle/leaderboard/');
  return response.data;
}

export async function getActivityFeed(): Promise<XPActivity[]> {
  const response = await api.get<XPActivity[]>('/thrive-circle/activity-feed/');
  return response.data;
}

export async function awardXP(
  amount: number,
  activityType: ActivityType,
  description?: string
): Promise<{ success: boolean; new_total_xp: number; tier: string; weekly_xp: number }> {
  const response = await api.post('/thrive-circle/award-xp/', {
    amount,
    activity_type: activityType,
    description,
  });
  return response.data;
}
```

### 2.3 Thrive Circle Page

Create `frontend/src/pages/ThriveCirclePage.tsx`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { TierBadge } from '@/components/thrive-circle/TierBadge';
import { WeeklyLeaderboard } from '@/components/thrive-circle/WeeklyLeaderboard';
import { WeeklyGoalsPanel } from '@/components/thrive-circle/WeeklyGoalsPanel';
import { ActivityFeed } from '@/components/thrive-circle/ActivityFeed';
import { StreakDisplay } from '@/components/thrive-circle/StreakDisplay';
import { StatsPanel } from '@/components/thrive-circle/StatsPanel';
import { getMyStatus, getLeaderboard, getActivityFeed } from '@/services/thriveCircle';

export function ThriveCirclePage() {
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['thriveCircleStatus'],
    queryFn: getMyStatus,
    refetchInterval: 30000,
  });

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['thriveCircleLeaderboard'],
    queryFn: getLeaderboard,
    refetchInterval: 60000,
  });

  const { data: activityFeed, isLoading: isLoadingFeed } = useQuery({
    queryKey: ['thriveCircleActivityFeed'],
    queryFn: getActivityFeed,
    refetchInterval: 30000,
  });

  const isLoading = isLoadingStatus || isLoadingLeaderboard || isLoadingFeed;

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Thrive Circle
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Your journey from Ember to Phoenix 🔥
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Tier Status & Streak */}
                <div className="lg:col-span-1 space-y-6">
                  {status && (
                    <>
                      <TierBadge
                        tier={status.tier.name}
                        totalXP={status.tier.total_xp}
                        nextTierXP={status.tier.next_tier_xp}
                        progress={status.tier.progress_to_next}
                      />

                      <StreakDisplay
                        current={status.streak.current}
                        longest={status.streak.longest}
                      />

                      <StatsPanel stats={status.stats} />
                    </>
                  )}
                </div>

                {/* Middle Column - Leaderboard */}
                <div className="lg:col-span-1">
                  {leaderboard && status && (
                    <WeeklyLeaderboard
                      tier={leaderboard.tier}
                      topEarners={leaderboard.top_earners}
                      userRank={leaderboard.user_rank}
                      userWeeklyXP={leaderboard.user_weekly_xp}
                    />
                  )}
                </div>

                {/* Right Column - Goals & Activity */}
                <div className="lg:col-span-1 space-y-6">
                  {status && (
                    <WeeklyGoalsPanel goals={status.weekly_goals} />
                  )}

                  {activityFeed && (
                    <ActivityFeed activities={activityFeed} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
```

### 2.4 Key Components

#### TierBadge Component
```typescript
// frontend/src/components/thrive-circle/TierBadge.tsx
import type { TierName } from '@/types/thriveCircle';

const tierConfig = {
  ember: { emoji: '🔥', color: 'orange', gradient: 'from-orange-500 to-red-500', label: 'Ember' },
  spark: { emoji: '⚡', color: 'yellow', gradient: 'from-yellow-500 to-amber-500', label: 'Spark' },
  blaze: { emoji: '🔥', color: 'red', gradient: 'from-red-500 to-pink-500', label: 'Blaze' },
  beacon: { emoji: '💡', color: 'blue', gradient: 'from-blue-500 to-cyan-500', label: 'Beacon' },
  phoenix: { emoji: '🐦', color: 'purple', gradient: 'from-purple-500 to-pink-500', label: 'Phoenix' },
};

export function TierBadge({ tier, totalXP, nextTierXP, progress }: {
  tier: TierName;
  totalXP: number;
  nextTierXP: number | null;
  progress: number;
}) {
  const config = tierConfig[tier];

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4">
      <h2 className="text-xl font-bold mb-4">Your Tier</h2>

      <div className={`p-6 rounded-xl bg-gradient-to-br ${config.gradient} text-white text-center`}>
        <div className="text-6xl mb-2">{config.emoji}</div>
        <div className="text-2xl font-bold">{config.label}</div>
        <div className="text-sm opacity-90 mt-1">{totalXP.toLocaleString()} XP</div>
      </div>

      {nextTierXP && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Next tier in {(nextTierXP - totalXP).toLocaleString()} XP</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

#### WeeklyLeaderboard Component
```typescript
// frontend/src/components/thrive-circle/WeeklyLeaderboard.tsx
import type { LeaderboardEntry } from '@/types/thriveCircle';

export function WeeklyLeaderboard({ tier, topEarners, userRank, userWeeklyXP }: {
  tier: string;
  topEarners: LeaderboardEntry[];
  userRank: number | null;
  userWeeklyXP: number;
}) {
  const tierConfig = {
    ember: { emoji: '🔥', gradient: 'from-orange-500 to-red-500' },
    spark: { emoji: '⚡', gradient: 'from-yellow-500 to-amber-500' },
    blaze: { emoji: '🔥', gradient: 'from-red-500 to-pink-500' },
    beacon: { emoji: '💡', gradient: 'from-blue-500 to-cyan-500' },
    phoenix: { emoji: '🐦', gradient: 'from-purple-500 to-pink-500' },
  };

  const config = tierConfig[tier as keyof typeof tierConfig];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`p-6 bg-gradient-to-r ${config.gradient} text-white`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl">{config.emoji}</span>
          <h2 className="text-2xl font-bold capitalize">{tier} Tier</h2>
        </div>
        <p className="text-sm opacity-90">This Week's Top Earners</p>
        {userRank && (
          <div className="mt-4 flex items-center justify-between bg-white/20 rounded-lg px-4 py-2">
            <span>Your Rank: #{userRank}</span>
            <span>{userWeeklyXP} XP</span>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="p-6 space-y-2 max-h-[600px] overflow-y-auto">
        {topEarners.map((entry) => {
          const isUser = userRank === entry.rank;

          return (
            <div
              key={entry.user.id}
              className={`
                flex items-center gap-4 p-3 rounded-lg transition-colors
                ${isUser ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
              `}
            >
              {/* Rank Badge */}
              <div className={`
                w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                ${entry.rank <= 3
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}
              `}>
                {entry.rank}
              </div>

              {/* Avatar */}
              <img
                src={entry.user.avatar_url || `/default-avatar.png`}
                alt={entry.user.display_name}
                className="w-10 h-10 rounded-full"
              />

              {/* Name & Streak */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{entry.user.display_name}</div>
                {entry.streak > 0 && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    🔥 {entry.streak} day streak
                  </div>
                )}
              </div>

              {/* XP */}
              <div className="text-right">
                <div className="font-bold text-primary-600 dark:text-primary-400">
                  {entry.weekly_xp} XP
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 2.5 XP Integration Hook

Create `frontend/src/hooks/useThriveCircle.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { awardXP } from '@/services/thriveCircle';
import type { ActivityType } from '@/types/thriveCircle';
import { toast } from 'react-hot-toast';

export function useThriveCircle() {
  const queryClient = useQueryClient();

  const awardXPMutation = useMutation({
    mutationFn: ({ amount, type, description }: {
      amount: number;
      type: ActivityType;
      description?: string;
    }) => awardXP(amount, type, description),
    onSuccess: (data) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['thriveCircleStatus'] });
      queryClient.invalidateQueries({ queryKey: ['thriveCircleLeaderboard'] });

      // Show XP toast
      toast.success(`+${amount} XP!`, {
        icon: '⭐',
        duration: 2000,
      });
    },
  });

  return {
    awardXP: (amount: number, type: ActivityType, description?: string) => {
      awardXPMutation.mutate({ amount, type, description });
    },
  };
}
```

Usage example:
```typescript
// In QuizCompletionScreen.tsx
const { awardXP } = useThriveCircle();

const handleQuizComplete = () => {
  const xpAmount = quiz.difficulty === 'beginner' ? 10 : quiz.difficulty === 'intermediate' ? 25 : 50;
  awardXP(xpAmount, 'quiz_complete', `Completed ${quiz.title}`);
};
```

### 2.6 Routing & Navigation

Update `frontend/src/routes/index.tsx`:
```typescript
<Route
  path="/thrive-circle"
  element={
    <ProtectedRoute>
      <ThriveCirclePage />
    </ProtectedRoute>
  }
/>
```

Update `frontend/src/components/navigation/menuData.ts`:
```typescript
{
  title: 'COMMUNITY',
  icon: faUsers,
  items: [
    { label: 'Thrive Circle', path: '/thrive-circle' },
    { label: 'Explore', path: '/explore' },
  ],
}
```

## Phase 3: Integration & Polish

### 3.1 Integrate with Existing Features

**Quiz System:**
- Award XP on quiz completion (10/25/50 based on difficulty)
- Bonus XP for perfect scores (+25%)
- Track quiz completions in UserTier stats

**Projects:**
- Award XP on project creation (20 XP)
- Award XP on project updates (10 XP)
- Track project count in stats

**Comments & Reactions:**
- Award small XP for engagement (2-5 XP)
- Count towards weekly "Help 5 people" goal

### 3.2 Onboarding Flow

Welcome experience for new users:
1. "Welcome to Thrive Circle!"
2. Explain tier system with visual progression
3. Show first weekly goals
4. Award initial 50 XP for completing profile
5. Guide to first quest

### 3.3 Notifications

- Tier level up celebrations (confetti animation!)
- Weekly goal completions
- Streak milestones (7, 30, 100 days)
- Weekly rank notifications (Monday morning: "You finished #12 last week!")

## Implementation Checklist

### Backend
- [ ] Create `core/thrive_circle` app
- [ ] Define models (UserTier, XPActivity, WeeklyGoal, ThriveCircleConnection)
- [ ] Create migrations and run
- [ ] Build serializers
- [ ] Implement ViewSets and endpoints
- [ ] Create Celery tasks (weekly reset, goals, streaks)
- [ ] Set up weekly cron jobs
- [ ] Write XP award integration points
- [ ] Migration script for existing users
- [ ] Add tests

### Frontend
- [ ] Create TypeScript types
- [ ] Build API service layer
- [ ] Create ThriveCirclePage
- [ ] Build TierBadge component
- [ ] Build WeeklyLeaderboard component
- [ ] Build WeeklyGoalsPanel component
- [ ] Build ActivityFeed component
- [ ] Build StreakDisplay component
- [ ] Build StatsPanel component
- [ ] Create useThriveCircle hook
- [ ] Integrate XP awards in quiz/project/comment flows
- [ ] Add routing
- [ ] Update navigation menu
- [ ] Add tier-up animations
- [ ] Add XP toast notifications
- [ ] Create onboarding flow
- [ ] Add tests

### Integration
- [ ] Connect to existing quiz system
- [ ] Connect to project system
- [ ] Connect to comment/reaction system
- [ ] Set up analytics tracking
- [ ] Performance optimization
- [ ] Security audit

## Success Metrics

- ✅ Users see their tier on first visit
- ✅ XP awarded correctly for all activities
- ✅ Weekly stats reset every Monday
- ✅ Leaderboard shows accurate rankings
- ✅ Weekly goals track progress correctly
- ✅ Streaks maintain across days
- ✅ Activity feed shows connection actions
- ✅ Tier-up animations trigger correctly
- ✅ Mobile responsive design
- ✅ < 2s page load time

## Next Steps: Side Quests Integration

Once Thrive Circle is live, Side Quests will integrate naturally:

1. **Quest XP Awards**: Side quests become major XP sources (50-200 XP)
2. **Tier-Based Access**: Advanced quests unlock at higher tiers
3. **Weekly Challenges**: Bonus XP for completing featured quests
4. **Social Competition**: See what your circle is doing
5. **Quest Recommendations**: Personalized based on tier and interests

**Full System:**
- **Permanent Tiers**: Ember → Spark → Blaze → Beacon → Phoenix
- **Activities**: Side Quests, Quizzes, Projects, Community Engagement
- **Rewards**: XP, Unlocks, Achievements, Social Recognition
- **Habits**: Daily logins, Weekly goals, Streaks

The foundation is ready for the full gamified learning experience! 🔥
