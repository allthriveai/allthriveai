# Thrive Circle - Implementation Plan (Simplified MVP)

## Overview
Build an inclusive, participation-focused progression system that rewards engagement, builds community, and creates sustainable learning habits through game mechanics.

## Design Philosophy

### Core Principles
1. **Participation Over Skill**: Everyone earns XP for showing up and engaging, not just for being "the best"
2. **Always Progress**: Tiers never decrease - you always move forward
3. **No Hierarchy**: Tier names celebrate growth, not rank - an Ava can start a revolution!
4. **Community Over Competition**: Thrive Circle is about **shared learning and inspiration**, NOT rankings or leaderboards
5. **Inclusive Discovery**: See what like-minded individuals are learning and celebrate everyone's journey
6. **Habit Formation**: Daily streaks and weekly goals encourage consistent engagement

### Why This Approach?
- **Simple to understand**: One clear progression path
- **Inclusive**: No "bottom tier" shame - every tier is valuable
- **Sustainable**: Focus on long-term growth, not weekly stress or competitive pressure
- **Community-Focused**: Inspiration through shared progress, not comparison through rankings
- **Non-Competitive**: NO leaderboards, NO ranks, NO percentiles - celebrate everyone's unique journey

## System Architecture

### Tier System (Permanent)

Users accumulate total XP throughout their lifetime on the platform. Tiers unlock based on milestones:

```
Ava   → 0-499 XP       (🔥 Small spark with big potential)
Spark   → 500-1,999 XP   (⚡ Igniting the fire)
Blaze   → 2,000-4,999 XP (🔥 Burning bright)
Beacon  → 5,000-9,999 XP (💡 Lighting the way for others)
Phoenix → 10,000+ XP     (🐦 Reborn stronger, inspiring transformation)
```

**Why These Names?**
- All fire/energy themed - cohesive with "Side Quests" adventure theme
- Non-hierarchical - an Ava isn't "worse" than a Phoenix, just different stage
- Positive progression - each tier celebrates growth
- Memorable and visual - easy to understand and represent

**Key Features:**
- Never lose tier progress (always moves forward)
- Visual badges and animations
- Unlocks features/content at higher tiers (advanced side quests, etc.)
- Displayed on profile and throughout app
- Celebration animations when leveling up

### Community Circle (Inclusive Discovery)

Users can discover and be inspired by what like-minded people are learning:

**Community Features:**
- See what activities peers are working on (NO XP amounts shown, NO rankings)
- Aggregate community stats ("Community earned 12,500 XP together this week!")
- Discover users by tier or learning topics
- Your personal journey panel (progress without rank/percentile)
- Activity privacy settings (choose what you share)

**Why This Works:**
- Inspiration through shared learning, not competition
- Celebrate everyone's unique journey and progress
- Find peers with similar interests or learning goals
- Community achievements foster belonging
- No stress, no comparison, no "bottom of the list" shame

**Example Display:**
```
🌟 Community Activity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sarah Chen completed "Advanced React Patterns"
Marcus Rodriguez created a new project
Aisha Patel earned Spark tier! 🎉
...

💫 Together This Week
Community earned 12,500 XP together
48 tier upgrades celebrated
156 people learning actively
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
- Start at Ava tier (0 XP)
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
        ('ember', 'Ava'),
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

    # Privacy settings for community features
    share_activities = models.BooleanField(default=True)  # Share what you're learning
    share_tier_upgrades = models.BooleanField(default=True)  # Share tier celebrations
    share_profile = models.BooleanField(default=True)  # Appear in discovery

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_xp']
        indexes = [
            models.Index(fields=['tier', '-total_xp']),
            models.Index(fields=['-total_xp']),
            models.Index(fields=['created_at']),  # For community activity feed
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

        # Update tier if threshold crossed
        self.update_tier()

        # Update daily streak
        today = timezone.now().date()
        if self.last_activity_date == today - timezone.timedelta(days=1):
            self.current_streak_days += 1
        elif self.last_activity_date != today:
            self.current_streak_days = 1

        if self.current_streak_days > self.longest_streak_days:
            self.longest_streak_days = self.current_streak_days

        self.last_activity_date = today
        self.save()

        # Create XP activity record (respects privacy settings)
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
        """Get current user's tier and stats (NO ranks, NO percentiles)"""
        user = request.user
        tier_status, created = UserTier.objects.get_or_create(user=user)

        # Get weekly goals
        week_start = get_week_start()
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
            'streak': {
                'current': tier_status.current_streak_days,
                'longest': tier_status.longest_streak_days,
            },
            'weekly_goals': WeeklyGoalSerializer(weekly_goals, many=True).data,
            'stats': {
                'lifetime_quizzes': tier_status.lifetime_quizzes_completed,
                'lifetime_projects': tier_status.lifetime_projects_created,
                'lifetime_quests': tier_status.lifetime_side_quests_completed,
            },
            'privacy': {
                'share_activities': tier_status.share_activities,
                'share_tier_upgrades': tier_status.share_tier_upgrades,
                'share_profile': tier_status.share_profile,
            }
        })

    @action(detail=False, methods=['get'])
    def community_activity(self, request):
        """Get recent community activity (NO rankings, respects privacy)"""
        # Get recent activities from all users who share publicly
        activities = XPActivity.objects.filter(
            user__tier_status__share_activities=True,
            created_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).select_related('user').order_by('-created_at')[:50]

        # Return activities WITHOUT showing XP amounts to avoid comparison
        return Response([
            {
                'id': activity.id,
                'user': {
                    'username': activity.user.username,
                    'display_name': getattr(activity.user, 'display_name', activity.user.username),
                    'avatar_url': getattr(activity.user, 'avatar_url', None),
                },
                'activity_type': activity.get_activity_type_display(),
                'description': activity.description,
                'created_at': activity.created_at,
                'tier': activity.tier_at_time,
            }
            for activity in activities
        ])

    @action(detail=False, methods=['get'])
    def community_stats(self, request):
        """Get aggregate community stats (collective achievements, NO individual comparison)"""
        week_start = get_week_start()

        # Aggregate stats - celebrating what we've accomplished together
        weekly_activities = XPActivity.objects.filter(
            created_at__gte=week_start
        )

        total_xp_this_week = weekly_activities.aggregate(Sum('amount'))['amount__sum'] or 0

        tier_upgrades_this_week = XPActivity.objects.filter(
            created_at__gte=week_start,
            activity_type='tier_upgrade',
            user__tier_status__share_tier_upgrades=True
        ).count()

        active_learners = UserTier.objects.filter(
            last_activity_date__gte=week_start
        ).count()

        return Response({
            'community_xp_this_week': total_xp_this_week,
            'tier_upgrades_this_week': tier_upgrades_this_week,
            'active_learners_this_week': active_learners,
            'message': f'Together we earned {total_xp_this_week:,} XP this week! 🎉',
        })

    @action(detail=False, methods=['get'])
    def discover(self, request):
        """Discover users by tier or learning topic (NO rankings)"""
        tier_filter = request.query_params.get('tier')
        limit = int(request.query_params.get('limit', 20))

        # Only show users who opted in to discovery
        queryset = UserTier.objects.filter(
            share_profile=True
        ).select_related('user')

        if tier_filter:
            queryset = queryset.filter(tier=tier_filter)

        # Randomize order to avoid "top users" mentality
        users = queryset.order_by('?')[:limit]

        return Response([
            {
                'user': {
                    'id': ts.user.id,
                    'username': ts.user.username,
                    'display_name': getattr(ts.user, 'display_name', ts.user.username),
                    'avatar_url': getattr(ts.user, 'avatar_url', None),
                },
                'tier': ts.tier,
                'streak': ts.current_streak_days,
            }
            for ts in users
        ])

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
        })

    @action(detail=False, methods=['get'])
    def my_journey(self, request):
        """Get user's personal XP journey (NO rank/percentile, just personal progress)"""
        user = request.user
        days = int(request.query_params.get('days', 30))

        activities = XPActivity.objects.filter(
            user=user,
            created_at__gte=timezone.now() - timezone.timedelta(days=days)
        ).order_by('-created_at')

        return Response({
            'activities': XPActivitySerializer(activities, many=True).data,
            'message': 'Your personal learning journey - every step forward counts! 🌟',
        })
```

#### Endpoint Structure (Inclusive, NO leaderboards/ranks)
```
GET    /api/v1/thrive-circle/my-status/           # User's tier, streak, stats (NO rank/percentile)
GET    /api/v1/thrive-circle/community-activity/  # Recent community learning (NO XP amounts, respects privacy)
GET    /api/v1/thrive-circle/community-stats/     # Aggregate stats (collective achievements)
GET    /api/v1/thrive-circle/discover/            # Discover users by tier/topic (randomized, NO rankings)
GET    /api/v1/thrive-circle/my-journey/          # Personal XP journey (NO comparison to others)
POST   /api/v1/thrive-circle/award-xp/            # Award XP (internal)
GET    /api/v1/thrive-circle/weekly-goals/        # User's weekly goals
POST   /api/v1/thrive-circle/connections/follow/  # Follow a user
DELETE /api/v1/thrive-circle/connections/unfollow/ # Unfollow a user
GET    /api/v1/thrive-circle/connections/         # User's connections
POST   /api/v1/thrive-circle/privacy-settings/    # Update privacy settings
```

### 1.4 Background Tasks

Create `core/thrive_circle/tasks.py`:

```python
from celery import shared_task
from django.utils import timezone
from datetime import timedelta


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

export interface PrivacySettings {
  share_activities: boolean;
  share_tier_upgrades: boolean;
  share_profile: boolean;
}

export interface UserCircleStatus {
  tier: TierStatus;
  streak: StreakInfo;
  weekly_goals: WeeklyGoal[];
  stats: {
    lifetime_quizzes: number;
    lifetime_projects: number;
    lifetime_quests: number;
  };
  privacy: PrivacySettings;
}

export interface CommunityActivity {
  id: number;
  user: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  activity_type: string;
  description: string;
  created_at: string;
  tier: string;
}

export interface CommunityStats {
  community_xp_this_week: number;
  tier_upgrades_this_week: number;
  active_learners_this_week: number;
  message: string;
}

export interface DiscoverUser {
  user: {
    id: number;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  tier: string;
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
import type {
  UserCircleStatus,
  CommunityActivity,
  CommunityStats,
  DiscoverUser,
  XPActivity
} from '@/types/thriveCircle';

export async function getMyStatus(): Promise<UserCircleStatus> {
  const response = await api.get<UserCircleStatus>('/thrive-circle/my-status/');
  return response.data;
}

export async function getCommunityActivity(): Promise<CommunityActivity[]> {
  const response = await api.get<CommunityActivity[]>('/thrive-circle/community-activity/');
  return response.data;
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const response = await api.get<CommunityStats>('/thrive-circle/community-stats/');
  return response.data;
}

export async function discoverUsers(tier?: string, limit?: number): Promise<DiscoverUser[]> {
  const params = new URLSearchParams();
  if (tier) params.append('tier', tier);
  if (limit) params.append('limit', limit.toString());

  const response = await api.get<DiscoverUser[]>(`/thrive-circle/discover/?${params}`);
  return response.data;
}

export async function getMyJourney(days?: number): Promise<{ activities: XPActivity[]; message: string }> {
  const params = new URLSearchParams();
  if (days) params.append('days', days.toString());

  const response = await api.get(`/thrive-circle/my-journey/?${params}`);
  return response.data;
}

export async function awardXP(
  amount: number,
  activityType: ActivityType,
  description?: string
): Promise<{ success: boolean; new_total_xp: number; tier: string }> {
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
import { CommunityActivityFeed } from '@/components/thrive-circle/CommunityActivityFeed';
import { CommunityStatsPanel } from '@/components/thrive-circle/CommunityStatsPanel';
import { YourJourneyPanel } from '@/components/thrive-circle/YourJourneyPanel';
import { DiscoverPanel } from '@/components/thrive-circle/DiscoverPanel';
import { WeeklyGoalsPanel } from '@/components/thrive-circle/WeeklyGoalsPanel';
import { StreakDisplay } from '@/components/thrive-circle/StreakDisplay';
import { StatsPanel } from '@/components/thrive-circle/StatsPanel';
import {
  getMyStatus,
  getCommunityActivity,
  getCommunityStats,
  discoverUsers,
} from '@/services/thriveCircle';

export function ThriveCirclePage() {
  const { data: status, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['thriveCircleStatus'],
    queryFn: getMyStatus,
    refetchInterval: 30000,
  });

  const { data: communityActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ['communityActivity'],
    queryFn: getCommunityActivity,
    refetchInterval: 60000,
  });

  const { data: communityStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['communityStats'],
    queryFn: getCommunityStats,
    refetchInterval: 60000,
  });

  const { data: discoverList, isLoading: isLoadingDiscover } = useQuery({
    queryKey: ['discoverUsers'],
    queryFn: () => discoverUsers(undefined, 10),
    refetchInterval: 120000,
  });

  const isLoading = isLoadingStatus || isLoadingActivity || isLoadingStats || isLoadingDiscover;

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
                Community learning, shared growth 🌟
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Your Journey */}
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

                {/* Middle Column - Community */}
                <div className="lg:col-span-1 space-y-6">
                  {communityStats && (
                    <CommunityStatsPanel stats={communityStats} />
                  )}

                  {communityActivity && (
                    <CommunityActivityFeed activities={communityActivity} />
                  )}
                </div>

                {/* Right Column - Goals & Discovery */}
                <div className="lg:col-span-1 space-y-6">
                  {status && (
                    <WeeklyGoalsPanel goals={status.weekly_goals} />
                  )}

                  {discoverList && (
                    <DiscoverPanel users={discoverList} />
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
  ember: { emoji: '🔥', color: 'orange', gradient: 'from-orange-500 to-red-500', label: 'Ava' },
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

#### CommunityStatsPanel Component
```typescript
// frontend/src/components/thrive-circle/CommunityStatsPanel.tsx
import type { CommunityStats } from '@/types/thriveCircle';

export function CommunityStatsPanel({ stats }: { stats: CommunityStats }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl">💫</span>
        <h2 className="text-2xl font-bold">Community This Week</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4">
          <div className="text-sm opacity-90 mb-1">Together we earned</div>
          <div className="text-3xl font-bold">
            {stats.community_xp_this_week.toLocaleString()} XP
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {stats.tier_upgrades_this_week}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Tier Upgrades 🎉
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {stats.active_learners_this_week}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Active Learners
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center">
          {stats.message}
        </p>
      </div>
    </div>
  );
}
```

#### CommunityActivityFeed Component
```typescript
// frontend/src/components/thrive-circle/CommunityActivityFeed.tsx
import type { CommunityActivity } from '@/types/thriveCircle';
import { formatDistanceToNow } from 'date-fns';

export function CommunityActivityFeed({ activities }: { activities: CommunityActivity[] }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🌟</span>
        <h2 className="text-xl font-bold">Community Activity</h2>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No recent activity yet. Be the first to start learning!
          </p>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <img
                src={activity.user.avatar_url || '/default-avatar.png'}
                alt={activity.user.display_name}
                className="w-10 h-10 rounded-full flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user.display_name}</span>
                  {' '}
                  <span className="text-gray-600 dark:text-gray-400">
                    {activity.description || activity.activity_type}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </p>
              </div>

              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {activity.tier}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

#### DiscoverPanel Component
```typescript
// frontend/src/components/thrive-circle/DiscoverPanel.tsx
import type { DiscoverUser } from '@/types/thriveCircle';

export function DiscoverPanel({ users }: { users: DiscoverUser[] }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔍</span>
        <h2 className="text-xl font-bold">Discover Learners</h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Find peers on similar learning journeys
      </p>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {users.map((discoveredUser) => (
          <div
            key={discoveredUser.user.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <img
              src={discoveredUser.user.avatar_url || '/default-avatar.png'}
              alt={discoveredUser.user.display_name}
              className="w-10 h-10 rounded-full"
            />

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {discoveredUser.user.display_name}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{discoveredUser.tier} tier</span>
                {discoveredUser.streak > 0 && (
                  <>
                    <span>•</span>
                    <span>🔥 {discoveredUser.streak} day streak</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
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
      queryClient.invalidateQueries({ queryKey: ['communityActivity'] });
      queryClient.invalidateQueries({ queryKey: ['communityStats'] });

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
- [ ] Create Celery tasks (weekly goals, streaks)
- [ ] Set up weekly cron jobs
- [ ] Write XP award integration points
- [ ] Migration script for existing users
- [ ] Add tests

### Frontend (Inclusive, NO Leaderboards)
- [ ] Create TypeScript types (with CommunityActivity, CommunityStats, DiscoverUser)
- [ ] Build API service layer (community-focused endpoints)
- [ ] Create ThriveCirclePage (community layout)
- [ ] Build TierBadge component
- [ ] Build CommunityStatsPanel component (collective achievements)
- [ ] Build CommunityActivityFeed component (NO XP amounts shown)
- [ ] Build DiscoverPanel component (randomized, NO rankings)
- [ ] Build YourJourneyPanel component (personal progress, NO comparison)
- [ ] Build WeeklyGoalsPanel component
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

## Success Metrics (Inclusive Community)

- ✅ Users see their tier on first visit (NO rank/percentile shown)
- ✅ XP awarded correctly for all activities
- ✅ Community stats show collective achievements
- ✅ Community activity feed respects privacy settings
- ✅ Discover panel shows randomized users (NO rankings)
- ✅ Weekly goals track progress correctly
- ✅ Streaks maintain across days
- ✅ Your Journey panel shows personal progress WITHOUT comparison
- ✅ NO leaderboards, NO ranks, NO percentiles anywhere
- ✅ Tier-up animations trigger correctly
- ✅ Mobile responsive design
- ✅ < 2s page load time
- ✅ Focus on inspiration, not competition

## Next Steps: Side Quests Integration

Once Thrive Circle is live, Side Quests will integrate naturally:

1. **Quest XP Awards**: Side quests become major XP sources (50-200 XP)
2. **Tier-Based Access**: Advanced quests unlock at higher tiers
3. **Weekly Challenges**: Bonus XP for completing featured quests
4. **Community Inspiration**: See what learning activities your peers are exploring
5. **Quest Recommendations**: Personalized based on tier and interests

**Full System (Inclusive Community Philosophy):**
- **Permanent Tiers**: Ava → Spark → Blaze → Beacon → Phoenix
- **Activities**: Side Quests, Quizzes, Projects, Community Engagement
- **Rewards**: XP, Unlocks, Achievements, Shared Celebrations
- **Habits**: Daily logins, Weekly goals, Streaks
- **Community**: Inspiration over competition, shared growth, peer discovery

The foundation is ready for an inclusive, community-focused gamified learning experience! 🌟
