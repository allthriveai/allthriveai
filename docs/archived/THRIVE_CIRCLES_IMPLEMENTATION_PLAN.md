# Thrive Circles Implementation Plan

## Document Overview

This document provides a comprehensive phased implementation plan for **Thrive Circles**, a Duolingo-style weekly grouping and progression system that replaces traditional leaderboards with a more motivating, community-focused approach.

---

## Current System Review

### Existing Infrastructure

#### Points System (✅ Implemented)
- **Location**: `core/points/models.py`
- **Models**:
  - `PointsHistory`: Tracks all point awards/deductions
  - `ActivityType`: Enum of point-earning activities
- **User Model Fields** (`core/users/models.py`):
  - `total_points`: Total accumulated points
  - `level`: Calculated from points
  - `current_streak`: Login streak tracking
  - `max_streak`: Best streak achieved
  - `last_login_date`: For streak calculation

#### Existing XP Sources (✅ Implemented)
1. **Quizzes** (`core/quizzes/`)
   - Complete quiz: 20 points
   - Perfect score bonus
   - Streak bonuses
2. **Prompt Battles** (`core/battles/`)
   - Participate: 25 points
   - Win bonus: 20 points
   - Complete rounds: 10 points
3. **Projects** (mentioned in plans)
   - Create project: 10 points
   - Publish project: 15 points
   - Milestones: 50 points
4. **Engagement**
   - Daily login: 5 points
   - Week streak: 25 points
   - Month streak: 100 points

#### Not Yet Implemented (❌ To Build)
- **Side Quests**: Conceptual (see `docs/SIDE_QUESTS.md`)
- **Weekly Challenge**: Not implemented
- **Scavenger Hunts**: Not implemented

#### Current User Stats Display
- Shows: Total Points, Level, Projects, Streak
- **Database indexes exist** for leaderboard queries (user_points_idx, user_level_points_idx)
- **Currently has leaderboard references** in Prompt Battle system (`battle_leaderboard`)

---

## Thrive Circles Concept Summary

### What We're Building

A **weekly social grouping system** that:
- Groups ~20-30 users with similar XP into weekly **Thrive Circles**
- Resets weekly (fresh start motivation)
- Shows Circle activity feed (what others are doing)
- Provides progression toward next Circle level
- Suggests actions to earn more XP
- **NO global rankings**, **NO #1/#2 labels**, **NO permanent status**

### Key Terminology (MUST USE EXACTLY)
- System name: **Thrive Circles**
- Weekly group: **Thrive Circle**
- Page name: **Your Thrive Circle**
- User-friendly level names (NOT Bronze/Silver):
  - Seedling
  - Explorer
  - Creator
  - Catalyst
  - Luminary
  - etc.

---

## Data Models Design

### 1. ThriveCircleLevel

Represents the progression tiers users can belong to.

```python
# core/circles/models.py

class ThriveCircleLevel(models.Model):
    """Progression levels for Thrive Circles."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
    # e.g., "Seedling", "Explorer", "Creator", "Catalyst", "Luminary"

    order = models.IntegerField(unique=True)
    # Used for ordering: 1, 2, 3, 4, 5...

    description = models.TextField()
    # Friendly description of what this level represents

    min_xp = models.IntegerField()
    # Minimum total XP needed to reach this level

    color_from = models.CharField(max_length=20, default="blue-500")
    color_to = models.CharField(max_length=20, default="blue-600")
    # Gradient colors for UI display

    icon = models.CharField(max_length=50, default="faSeedling")
    # FontAwesome icon name

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} (Level {self.order})"
```

**Initial Level Data**:
```python
INITIAL_LEVELS = [
    {"name": "Seedling", "order": 1, "min_xp": 0, "icon": "faSeedling", "color_from": "green-400", "color_to": "green-600"},
    {"name": "Explorer", "order": 2, "min_xp": 500, "icon": "faCompass", "color_from": "blue-400", "color_to": "blue-600"},
    {"name": "Creator", "order": 3, "min_xp": 1500, "icon": "faWand", "color_from": "purple-400", "color_to": "purple-600"},
    {"name": "Catalyst", "order": 4, "min_xp": 3500, "icon": "faRocket", "color_from": "orange-400", "color_to": "orange-600"},
    {"name": "Luminary", "order": 5, "min_xp": 7500, "icon": "faStar", "color_from": "yellow-400", "color_to": "yellow-600"},
]
```

---

### 2. ThriveCircle

Represents a weekly group of users.

```python
# core/circles/models.py

class ThriveCircle(models.Model):
    """Weekly grouping of users with similar XP."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    level = models.ForeignKey(
        ThriveCircleLevel,
        on_delete=models.PROTECT,
        related_name='circles'
    )

    week_start = models.DateField()
    # Monday of the week this circle is active

    week_end = models.DateField()
    # Sunday of the week this circle is active

    name = models.CharField(max_length=100, blank=True)
    # Optional friendly name: "Explorer Circle A", "Creator Circle B"
    # Generated as: f"{level.name} Circle {suffix}"

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-week_start', 'level__order']
        indexes = [
            models.Index(fields=['week_start', 'week_end']),
            models.Index(fields=['level', 'week_start']),
        ]
        unique_together = [('level', 'name', 'week_start')]

    def __str__(self):
        return f"{self.name} ({self.week_start} to {self.week_end})"

    @property
    def is_current_week(self):
        """Check if this circle is for the current week."""
        from django.utils import timezone
        today = timezone.now().date()
        return self.week_start <= today <= self.week_end
```

---

### 3. UserThriveProfile

Tracks user XP and Circle membership.

```python
# core/circles/models.py

class UserThriveProfile(models.Model):
    """User's Thrive Circle profile and XP tracking."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='thrive_profile'
    )

    current_level = models.ForeignKey(
        ThriveCircleLevel,
        on_delete=models.PROTECT,
        related_name='users_at_level'
    )

    weekly_xp = models.IntegerField(default=0)
    # XP earned this week (resets weekly)

    total_xp = models.IntegerField(default=0)
    # All-time cumulative XP (never resets)

    current_circle = models.ForeignKey(
        ThriveCircle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members'
    )

    weekly_reset_at = models.DateTimeField()
    # When the next weekly reset happens

    last_activity_at = models.DateTimeField(auto_now=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-total_xp']
        indexes = [
            models.Index(fields=['current_level', '-weekly_xp']),
            models.Index(fields=['-total_xp']),
            models.Index(fields=['current_circle', '-weekly_xp']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.current_level.name} ({self.total_xp} XP)"

    def add_xp(self, amount, source=None, description=None):
        """Add XP and log the event."""
        from .services import XPService
        return XPService.add_xp(self.user, amount, source, description)

    def get_next_level(self):
        """Get the next level user can progress to."""
        try:
            return ThriveCircleLevel.objects.filter(
                order__gt=self.current_level.order
            ).first()
        except ThriveCircleLevel.DoesNotExist:
            return None

    def xp_to_next_level(self):
        """Calculate XP needed for next level."""
        next_level = self.get_next_level()
        if not next_level:
            return 0
        return max(0, next_level.min_xp - self.total_xp)
```

---

### 4. XPEvent

Log of all XP-earning activities.

```python
# core/circles/models.py

class XPSource(models.TextChoices):
    """Sources that can award XP."""
    SIDE_QUEST = 'side_quest', 'Side Quest'
    WEEKLY_CHALLENGE = 'weekly_challenge', 'Weekly Challenge'
    SCAVENGER_HUNT = 'scavenger_hunt', 'Scavenger Hunt'
    PROMPT_BATTLE = 'prompt_battle', 'Prompt Battle'
    QUIZ = 'quiz', 'Quiz'
    PROJECT = 'project', 'Project'
    DAILY_LOGIN = 'daily_login', 'Daily Login'
    STREAK = 'streak', 'Streak Bonus'
    ACHIEVEMENT = 'achievement', 'Achievement'
    OTHER = 'other', 'Other'


class XPEvent(models.Model):
    """Log of XP-earning actions for activity feed."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='xp_events'
    )

    amount = models.IntegerField()
    # XP awarded (can be negative for penalties)

    source = models.CharField(
        max_length=30,
        choices=XPSource.choices,
        default=XPSource.OTHER
    )

    description = models.TextField()
    # Human-readable description: "Completed Side Quest: AI Prompt Challenge"

    metadata = models.JSONField(default=dict, blank=True)
    # Additional context: {"quest_id": "123", "score": 95}

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['source', '-timestamp']),
            models.Index(fields=['-timestamp']),
        ]

    def __str__(self):
        return f"{self.user.username} +{self.amount} XP - {self.description}"
```

---

## Services Layer

### XPService

```python
# core/circles/services.py

from django.db import transaction
from django.utils import timezone
from .models import UserThriveProfile, XPEvent, ThriveCircleLevel, XPSource


class XPService:
    """Service for managing XP operations."""

    @staticmethod
    @transaction.atomic
    def add_xp(user, amount, source=None, description=None):
        """
        Add XP to user's profile and create event log.

        Args:
            user: User instance
            amount: Integer XP amount (can be negative)
            source: XPSource enum value
            description: Human-readable description

        Returns:
            XPEvent instance
        """
        profile, created = UserThriveProfile.objects.get_or_create(
            user=user,
            defaults={
                'current_level': ThriveCircleLevel.objects.first(),
                'weekly_reset_at': XPService.get_next_monday(),
            }
        )

        # Update XP
        profile.weekly_xp += amount
        profile.total_xp += amount

        # Check for level up
        new_level = ThriveCircleLevel.objects.filter(
            min_xp__lte=profile.total_xp
        ).order_by('-order').first()

        if new_level and new_level.order > profile.current_level.order:
            profile.current_level = new_level

        profile.save()

        # Create event log
        event = XPEvent.objects.create(
            user=user,
            amount=amount,
            source=source or XPSource.OTHER,
            description=description or f"Earned {amount} XP"
        )

        return event

    @staticmethod
    def get_next_monday():
        """Get the next Monday at midnight."""
        from datetime import timedelta
        today = timezone.now().date()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = today + timedelta(days=days_until_monday)
        return timezone.make_aware(
            timezone.datetime.combine(next_monday, timezone.datetime.min.time())
        )

    @staticmethod
    def get_circle_activity(circle, limit=20):
        """Get recent XP events from circle members."""
        if not circle:
            return []

        member_ids = circle.members.values_list('user_id', flat=True)
        return XPEvent.objects.filter(
            user_id__in=member_ids
        ).select_related('user')[:limit]
```

---

### CircleAssignmentService

```python
# core/circles/services.py

class CircleAssignmentService:
    """Service for weekly circle assignments."""

    CIRCLE_SIZE = 25  # Target members per circle
    MIN_CIRCLE_SIZE = 15  # Minimum to form a circle

    @staticmethod
    @transaction.atomic
    def assign_weekly_circles():
        """
        Main weekly assignment logic.

        1. Calculate current level for all users based on total_xp
        2. Reset weekly_xp to 0
        3. Group users by level, sort by total_xp
        4. Create circles of ~25 users
        5. Assign users to circles
        """
        from datetime import timedelta

        today = timezone.now().date()
        # Get Monday of current week
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        # Get all user profiles
        profiles = UserThriveProfile.objects.select_related(
            'user', 'current_level'
        ).all()

        # Recalculate levels based on total_xp
        levels = ThriveCircleLevel.objects.all()
        for profile in profiles:
            correct_level = levels.filter(
                min_xp__lte=profile.total_xp
            ).order_by('-order').first()

            if correct_level and correct_level != profile.current_level:
                profile.current_level = correct_level

            # Reset weekly XP
            profile.weekly_xp = 0
            profile.weekly_reset_at = XPService.get_next_monday()

        UserThriveProfile.objects.bulk_update(
            profiles,
            ['current_level', 'weekly_xp', 'weekly_reset_at']
        )

        # Group users by level and create circles
        for level in levels:
            level_users = list(
                UserThriveProfile.objects.filter(
                    current_level=level
                ).order_by('-total_xp')
            )

            if not level_users:
                continue

            # Split into circles
            circles_needed = max(1, len(level_users) // CircleAssignmentService.CIRCLE_SIZE)
            circle_groups = CircleAssignmentService._chunk_users(
                level_users, circles_needed
            )

            for idx, group in enumerate(circle_groups):
                # Create circle
                circle = ThriveCircle.objects.create(
                    level=level,
                    week_start=week_start,
                    week_end=week_end,
                    name=f"{level.name} Circle {chr(65 + idx)}"  # A, B, C...
                )

                # Assign users to circle
                for profile in group:
                    profile.current_circle = circle

                UserThriveProfile.objects.bulk_update(
                    group, ['current_circle']
                )

    @staticmethod
    def _chunk_users(users, num_chunks):
        """Split users into roughly equal chunks."""
        chunk_size = len(users) // num_chunks
        remainder = len(users) % num_chunks

        chunks = []
        start = 0

        for i in range(num_chunks):
            # Distribute remainder across first chunks
            size = chunk_size + (1 if i < remainder else 0)
            chunks.append(users[start:start + size])
            start += size

        return chunks
```

---

## Management Command

```python
# core/circles/management/commands/assign_thrive_circles.py

from django.core.management.base import BaseCommand
from core.circles.services import CircleAssignmentService


class Command(BaseCommand):
    help = 'Assign users to weekly Thrive Circles'

    def handle(self, *args, **options):
        self.stdout.write('Starting weekly Thrive Circle assignment...')

        try:
            CircleAssignmentService.assign_weekly_circles()
            self.stdout.write(
                self.style.SUCCESS('Successfully assigned Thrive Circles!')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error assigning circles: {str(e)}')
            )
            raise
```

**Cron setup** (run weekly on Sunday nights):
```bash
# In crontab or Celery beat schedule
0 23 * * 0 python manage.py assign_thrive_circles
```

---

## API Endpoints

### Views

```python
# core/circles/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import ThriveCircle, UserThriveProfile, XPEvent, ThriveCircleLevel
from .serializers import (
    ThriveCircleSerializer,
    UserThriveProfileSerializer,
    XPEventSerializer,
    ThriveCircleLevelSerializer
)
from .services import XPService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def your_thrive_circle(request):
    """
    Get user's current Thrive Circle information.

    Returns:
        - user_profile: Current user's profile
        - current_level: Current level details
        - current_circle: Circle membership info
        - circle_members: Other users in same circle
        - recent_activity: XP events from circle
        - next_level: Next progression level
        - xp_to_next_level: XP needed
        - time_until_reset: Countdown timer
        - recommended_actions: Suggested activities
    """
    profile, created = UserThriveProfile.objects.get_or_create(
        user=request.user,
        defaults={
            'current_level': ThriveCircleLevel.objects.first(),
            'weekly_reset_at': XPService.get_next_monday(),
        }
    )

    circle = profile.current_circle

    # Get circle members
    circle_members = []
    if circle:
        circle_members = UserThriveProfile.objects.filter(
            current_circle=circle
        ).select_related('user', 'current_level').exclude(
            user=request.user
        )[:30]

    # Get recent activity from circle
    recent_activity = XPService.get_circle_activity(circle, limit=20)

    # Calculate next level info
    next_level = profile.get_next_level()
    xp_to_next = profile.xp_to_next_level()

    # Time until reset
    time_until_reset = profile.weekly_reset_at - timezone.now()

    # Recommended actions
    recommended_actions = get_recommended_actions(profile)

    return Response({
        'user_profile': UserThriveProfileSerializer(profile).data,
        'current_level': ThriveCircleLevelSerializer(profile.current_level).data,
        'current_circle': ThriveCircleSerializer(circle).data if circle else None,
        'circle_members': UserThriveProfileSerializer(circle_members, many=True).data,
        'recent_activity': XPEventSerializer(recent_activity, many=True).data,
        'next_level': ThriveCircleLevelSerializer(next_level).data if next_level else None,
        'xp_to_next_level': xp_to_next,
        'time_until_reset_seconds': int(time_until_reset.total_seconds()),
        'recommended_actions': recommended_actions,
    })


def get_recommended_actions(user_profile):
    """
    Generate recommended XP-earning actions.

    Returns list of actions with labels, XP values, and URLs.
    """
    # TODO: Make this dynamic based on what user hasn't done recently
    return [
        {
            "label": "Complete a Quick Quiz",
            "xp": 20,
            "url": "/quick-quizzes",
            "icon": "faGraduationCap"
        },
        {
            "label": "Enter a Prompt Battle",
            "xp": 25,
            "url": "/play/prompt-battle",
            "icon": "faGamepad"
        },
        {
            "label": "Create a New Project",
            "xp": 10,
            "url": "/projects/new",
            "icon": "faPlus"
        },
        # Future actions:
        # {"label": "Complete a Side Quest", "xp": 30, "url": "/play/side-quests"},
        # {"label": "Join This Week's Challenge", "xp": 50, "url": "/play/weekly-challenge"},
    ]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_xp_history(request):
    """Get user's XP event history."""
    limit = int(request.query_params.get('limit', 50))
    events = XPEvent.objects.filter(
        user=request.user
    )[:limit]

    return Response({
        'events': XPEventSerializer(events, many=True).data
    })
```

---

### Serializers

```python
# core/circles/serializers.py

from rest_framework import serializers
from .models import ThriveCircle, UserThriveProfile, XPEvent, ThriveCircleLevel


class ThriveCircleLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThriveCircleLevel
        fields = [
            'id', 'name', 'order', 'description', 'min_xp',
            'color_from', 'color_to', 'icon'
        ]


class ThriveCircleSerializer(serializers.ModelSerializer):
    level = ThriveCircleLevelSerializer()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = ThriveCircle
        fields = [
            'id', 'level', 'week_start', 'week_end', 'name',
            'member_count', 'is_current_week'
        ]

    def get_member_count(self, obj):
        return obj.members.count()


class UserThriveProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar_url = serializers.URLField(source='user.avatar_url', read_only=True)
    level_name = serializers.CharField(source='current_level.name', read_only=True)
    level_icon = serializers.CharField(source='current_level.icon', read_only=True)

    class Meta:
        model = UserThriveProfile
        fields = [
            'username', 'avatar_url', 'current_level', 'level_name',
            'level_icon', 'weekly_xp', 'total_xp', 'last_activity_at'
        ]


class XPEventSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar_url = serializers.URLField(source='user.avatar_url', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = XPEvent
        fields = [
            'id', 'username', 'avatar_url', 'amount', 'source',
            'source_display', 'description', 'timestamp', 'metadata'
        ]
```

---

### URL Configuration

```python
# core/circles/urls.py

from django.urls import path
from . import views

app_name = 'circles'

urlpatterns = [
    path('thrive-circle/', views.your_thrive_circle, name='your_thrive_circle'),
    path('xp-history/', views.my_xp_history, name='xp_history'),
]
```

Add to main `core/urls.py`:
```python
path('me/', include('core.circles.urls')),
```

---

## Frontend Implementation

### TypeScript Types

```typescript
// frontend/src/types/thriveCircles.ts

export interface ThriveCircleLevel {
  id: number;
  name: string;
  order: number;
  description: string;
  min_xp: number;
  color_from: string;
  color_to: string;
  icon: string;
}

export interface ThriveCircle {
  id: string;
  level: ThriveCircleLevel;
  week_start: string;
  week_end: string;
  name: string;
  member_count: number;
  is_current_week: boolean;
}

export interface UserThriveProfile {
  username: string;
  avatar_url: string | null;
  current_level: number;
  level_name: string;
  level_icon: string;
  weekly_xp: number;
  total_xp: number;
  last_activity_at: string;
}

export interface XPEvent {
  id: string;
  username: string;
  avatar_url: string | null;
  amount: number;
  source: string;
  source_display: string;
  description: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface RecommendedAction {
  label: string;
  xp: number;
  url: string;
  icon: string;
}

export interface ThriveCircleData {
  user_profile: UserThriveProfile;
  current_level: ThriveCircleLevel;
  current_circle: ThriveCircle | null;
  circle_members: UserThriveProfile[];
  recent_activity: XPEvent[];
  next_level: ThriveCircleLevel | null;
  xp_to_next_level: number;
  time_until_reset_seconds: number;
  recommended_actions: RecommendedAction[];
}
```

---

### API Service

```typescript
// frontend/src/services/thriveCircles.ts

import { apiClient } from './api';
import type { ThriveCircleData } from '../types/thriveCircles';

export async function getYourThriveCircle(): Promise<ThriveCircleData> {
  const response = await apiClient.get('/api/v1/me/thrive-circle/');
  return response.data;
}

export async function getXPHistory(limit: number = 50) {
  const response = await apiClient.get('/api/v1/me/xp-history/', {
    params: { limit }
  });
  return response.data;
}
```

---

### Page Component

```typescript
// frontend/src/pages/play/YourThriveCirclePage.tsx

import React, { useEffect, useState } from 'react';
import { getYourThriveCircle } from '../../services/thriveCircles';
import type { ThriveCircleData } from '../../types/thriveCircles';

export default function YourThriveCirclePage() {
  const [data, setData] = useState<ThriveCircleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const result = await getYourThriveCircle();
      setData(result);
    } catch (error) {
      console.error('Failed to load Thrive Circle data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return <div>Loading your Thrive Circle...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <h1 className="text-3xl font-bold mb-6">Your Thrive Circle</h1>

      {/* User Stats Card */}
      <UserStatsCard profile={data.user_profile} level={data.current_level} />

      {/* Progress to Next Level */}
      {data.next_level && (
        <LevelProgressCard
          currentLevel={data.current_level}
          nextLevel={data.next_level}
          currentXP={data.user_profile.total_xp}
          xpNeeded={data.xp_to_next_level}
        />
      )}

      {/* Circle Info */}
      {data.current_circle && (
        <CircleInfoCard
          circle={data.current_circle}
          weeklyXP={data.user_profile.weekly_xp}
          resetSeconds={data.time_until_reset_seconds}
        />
      )}

      {/* Recommended Actions */}
      <RecommendedActionsCard actions={data.recommended_actions} />

      {/* Circle Activity Feed */}
      <CircleActivityFeed
        members={data.circle_members}
        activity={data.recent_activity}
      />
    </div>
  );
}

// ... Component implementations for cards
```

---

## Integration with Existing Points System

### Update PointsService

```python
# core/points/services.py (MODIFY EXISTING)

from core.circles.services import XPService
from core.circles.models import XPSource

class PointsService:
    @staticmethod
    def award_points(user, activity_type, metadata=None):
        """Award points for an activity."""
        # ... existing logic ...

        # Map ActivityType to XPSource
        xp_source_map = {
            ActivityType.QUIZ_COMPLETED: XPSource.QUIZ,
            ActivityType.BATTLE_WON: XPSource.PROMPT_BATTLE,
            ActivityType.BATTLE_PARTICIPATED: XPSource.PROMPT_BATTLE,
            ActivityType.PROJECT_CREATED: XPSource.PROJECT,
            ActivityType.DAILY_LOGIN: XPSource.DAILY_LOGIN,
            ActivityType.WEEK_STREAK: XPSource.STREAK,
            # ... add more mappings
        }

        xp_source = xp_source_map.get(activity_type, XPSource.OTHER)

        # Also create XP event for Thrive Circles
        XPService.add_xp(
            user=user,
            amount=points_awarded,
            source=xp_source,
            description=description
        )

        return points_history
```

---

## Phased Implementation Plan

### Phase 1: Foundation (Week 1)

**Goals**: Set up models, migrations, and basic services

**Tasks**:
1. ✅ Create Django app: `core/circles/`
2. ✅ Define models:
   - ThriveCircleLevel
   - ThriveCircle
   - UserThriveProfile
   - XPEvent
3. ✅ Create migrations
4. ✅ Create fixtures for initial levels
5. ✅ Management command: `load_thrive_levels`
6. ✅ Write XPService
7. ✅ Write CircleAssignmentService
8. ✅ Management command: `assign_thrive_circles`
9. ✅ Unit tests for services

**Deliverables**:
- Working database schema
- Services that can assign circles
- Management commands

---

### Phase 2: API & Backend Integration (Week 2)

**Goals**: Build API endpoints and integrate with existing points system

**Tasks**:
1. ✅ Create serializers
2. ✅ Build `your_thrive_circle` view
3. ✅ Build `my_xp_history` view
4. ✅ Add URL routes
5. ✅ Integrate XPService into existing PointsService
6. ✅ Update signals to create XPEvents
7. ✅ API tests
8. ✅ Test assignment command

**Deliverables**:
- Working API endpoints
- XP events being logged automatically
- Integration tests passing

---

### Phase 3: Frontend UI (Week 3)

**Goals**: Build Your Thrive Circle page

**Tasks**:
1. ✅ Define TypeScript types
2. ✅ Create API service functions
3. ✅ Build YourThriveCirclePage component
4. ✅ Build sub-components:
   - UserStatsCard
   - LevelProgressCard
   - CircleInfoCard
   - RecommendedActionsCard
   - CircleActivityFeed
   - CountdownTimer
5. ✅ Add route to frontend router
6. ✅ Update sidebar menu (already done - replaced Leaderboards & Vote)

**Deliverables**:
- Functional frontend page
- Real-time updates
- Countdown timer

---

### Phase 4: User Migration & Data Backfill (Week 4)

**Goals**: Migrate existing users and award retroactive XP

**Tasks**:
1. ✅ Create migration script to:
   - Create UserThriveProfile for all users
   - Calculate total_xp from User.total_points
   - Assign initial levels
2. ✅ Run first circle assignment
3. ✅ Backfill XPEvents from PointsHistory
4. ✅ Data validation
5. ✅ Test with production-like data

**Deliverables**:
- All users have Thrive Profiles
- Historical XP events populated
- First circles assigned

---

### Phase 5: Polish & Launch (Week 5)

**Goals**: Polish UI, add animations, prepare for launch

**Tasks**:
1. ✅ Add animations and transitions
2. ✅ Improve mobile responsiveness
3. ✅ Add onboarding tooltips
4. ✅ Performance optimization
5. ✅ Set up weekly cron job
6. ✅ Write user documentation
7. ✅ Internal testing
8. ✅ Soft launch to beta users

**Deliverables**:
- Production-ready feature
- Cron job running
- Documentation complete

---

### Phase 6: Future Enhancements (Post-Launch)

**Ideas for Later**:
1. **Side Quests** (reference: `docs/SIDE_QUESTS.md`)
   - Implement 2-3 initial quests
   - Award XP via XPService
2. **Weekly Challenge**
   - New model: WeeklyChallenge
   - Challenge submission system
   - Award 50+ XP for completion
3. **Scavenger Hunts**
   - Hidden objectives in the app
   - Clue system
   - Award bonus XP
4. **Circle Chat**
   - Group chat for circle members
   - Encourage collaboration
5. **Circle Stats**
   - Aggregate statistics
   - "Most Active Circle" badge
6. **Circle Themes**
   - Seasonal or event-based themes
   - Special challenges for circles

---

## Migration Strategy

### Data Migration Script

```python
# core/circles/management/commands/migrate_to_thrive_circles.py

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.circles.models import UserThriveProfile, ThriveCircleLevel, XPEvent, XPSource
from core.points.models import PointsHistory, ActivityType
from core.circles.services import XPService

User = get_user_model()

class Command(BaseCommand):
    help = 'Migrate existing users to Thrive Circles system'

    def handle(self, *args, **options):
        self.stdout.write('Starting migration to Thrive Circles...')

        # 1. Ensure levels exist
        if not ThriveCircleLevel.objects.exists():
            self.stdout.write(self.style.ERROR('No levels found! Run load_thrive_levels first.'))
            return

        # 2. Create UserThriveProfile for all users
        users = User.objects.all()
        created_count = 0

        for user in users:
            profile, created = UserThriveProfile.objects.get_or_create(
                user=user,
                defaults={
                    'total_xp': user.total_points,  # Copy from existing points
                    'weekly_xp': 0,
                    'current_level': ThriveCircleLevel.objects.filter(
                        min_xp__lte=user.total_points
                    ).order_by('-order').first() or ThriveCircleLevel.objects.first(),
                    'weekly_reset_at': XPService.get_next_monday(),
                }
            )

            if created:
                created_count += 1

        self.stdout.write(f'Created {created_count} new profiles')

        # 3. Backfill XPEvents from PointsHistory
        self.stdout.write('Backfilling XP events from points history...')

        activity_to_xp_source = {
            ActivityType.QUIZ_COMPLETED: XPSource.QUIZ,
            ActivityType.BATTLE_WON: XPSource.PROMPT_BATTLE,
            ActivityType.BATTLE_PARTICIPATED: XPSource.PROMPT_BATTLE,
            ActivityType.PROJECT_CREATED: XPSource.PROJECT,
            ActivityType.DAILY_LOGIN: XPSource.DAILY_LOGIN,
            ActivityType.WEEK_STREAK: XPSource.STREAK,
            ActivityType.ACHIEVEMENT_EARNED: XPSource.ACHIEVEMENT,
        }

        points_history = PointsHistory.objects.all().order_by('created_at')
        events_created = 0

        for ph in points_history:
            source = activity_to_xp_source.get(ph.activity_type, XPSource.OTHER)

            # Check if event already exists (avoid duplicates)
            exists = XPEvent.objects.filter(
                user=ph.user,
                amount=ph.points_awarded,
                timestamp=ph.created_at
            ).exists()

            if not exists:
                XPEvent.objects.create(
                    user=ph.user,
                    amount=ph.points_awarded,
                    source=source,
                    description=ph.description,
                    timestamp=ph.created_at,
                    metadata=ph.metadata
                )
                events_created += 1

        self.stdout.write(f'Created {events_created} XP events')

        self.stdout.write(self.style.SUCCESS('Migration complete!'))
```

---

## Testing Strategy

### Unit Tests

```python
# core/circles/tests/test_services.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from core.circles.models import ThriveCircleLevel, UserThriveProfile, XPEvent
from core.circles.services import XPService, CircleAssignmentService

User = get_user_model()

class XPServiceTests(TestCase):
    def setUp(self):
        # Create test level
        self.level = ThriveCircleLevel.objects.create(
            name="Test Level",
            order=1,
            min_xp=0
        )
        self.user = User.objects.create_user(username='testuser')

    def test_add_xp_creates_profile(self):
        """Test that adding XP creates profile if needed."""
        event = XPService.add_xp(self.user, 100, description="Test")

        self.assertEqual(event.amount, 100)
        profile = UserThriveProfile.objects.get(user=self.user)
        self.assertEqual(profile.total_xp, 100)

    def test_level_up(self):
        """Test that user levels up at threshold."""
        level2 = ThriveCircleLevel.objects.create(
            name="Level 2",
            order=2,
            min_xp=500
        )

        profile = UserThriveProfile.objects.create(
            user=self.user,
            current_level=self.level,
            total_xp=0
        )

        XPService.add_xp(self.user, 600, description="Big win")
        profile.refresh_from_db()

        self.assertEqual(profile.current_level, level2)


class CircleAssignmentTests(TestCase):
    def setUp(self):
        self.level = ThriveCircleLevel.objects.create(
            name="Explorer",
            order=1,
            min_xp=0
        )

        # Create 50 test users
        for i in range(50):
            user = User.objects.create_user(username=f'user{i}')
            UserThriveProfile.objects.create(
                user=user,
                current_level=self.level,
                total_xp=i * 100,
                weekly_xp=0
            )

    def test_circle_assignment(self):
        """Test that users are assigned to circles."""
        CircleAssignmentService.assign_weekly_circles()

        # Check that circles were created
        circles = ThriveCircle.objects.all()
        self.assertGreater(circles.count(), 0)

        # Check that all users are assigned
        unassigned = UserThriveProfile.objects.filter(
            current_circle__isnull=True
        ).count()
        self.assertEqual(unassigned, 0)
```

---

## Cron Job Setup

### Using Django Q or Celery Beat

```python
# config/celery.py

from celery.schedules import crontab

app.conf.beat_schedule = {
    'assign-weekly-thrive-circles': {
        'task': 'core.circles.tasks.assign_weekly_circles',
        'schedule': crontab(hour=23, minute=0, day_of_week=0),  # Sunday 11 PM
    },
}
```

```python
# core/circles/tasks.py

from celery import shared_task
from .services import CircleAssignmentService

@shared_task
def assign_weekly_circles():
    """Celery task for weekly circle assignment."""
    CircleAssignmentService.assign_weekly_circles()
```

---

## Documentation for Users

### User-Facing Help Text

**What are Thrive Circles?**

Thrive Circles are weekly groups of users at similar skill levels who learn and grow together. Each week, you'll be placed in a Circle with ~20-30 others who have similar XP (experience points).

**How do I earn XP?**
- Complete Quick Quizzes
- Participate in Prompt Battles
- Create and share Projects
- Daily login streaks
- (Future: Side Quests, Weekly Challenges, Scavenger Hunts)

**When do Circles reset?**

Every Monday at midnight. Your weekly XP resets to 0, but your total XP stays forever. You'll be placed in a new Circle based on your total XP level.

**What are the levels?**
- Seedling (0+ XP)
- Explorer (500+ XP)
- Creator (1500+ XP)
- Catalyst (3500+ XP)
- Luminary (7500+ XP)

**Is this a competition?**

Not really! We don't show rankings or #1/#2 labels. It's about finding your community and staying motivated together. Everyone in your Circle is on a similar journey.

---

## Success Metrics

### KPIs to Track

1. **Engagement**
   - % of users logging in weekly
   - Average XP per user per week
   - Activities completed per user

2. **Retention**
   - Week-over-week retention
   - Users returning to view their Circle

3. **Community**
   - Circle activity feed views
   - Time spent on Thrive Circle page

4. **Progression**
   - Users leveling up per week
   - Distribution across levels

---

## Risk Mitigation

### Potential Issues & Solutions

1. **Not enough users for balanced circles**
   - Solution: Allow smaller circles (min 5 users)
   - Combine multiple levels if needed

2. **XP farming / gaming the system**
   - Solution: Rate limits on activities
   - Diminishing returns (already in points system)
   - Human review for suspicious spikes

3. **Users feel demotivated if behind**
   - Solution: No visible rankings
   - Positive messaging: "You're growing!"
   - Focus on personal progress

4. **Cron job fails**
   - Solution: Monitoring and alerts
   - Manual trigger endpoint for admins
   - Graceful degradation (show last week's circle)

---

## Conclusion

This implementation plan provides a complete roadmap for building **Thrive Circles**, a motivating weekly grouping system that encourages community engagement without toxic competition.

### Key Success Factors

1. ✅ **Built on existing infrastructure** (Points, Users, Activities)
2. ✅ **Non-competitive design** (no rankings, positive framing)
3. ✅ **Weekly fresh starts** (reset motivation)
4. ✅ **Activity-driven** (feed shows what others are doing)
5. ✅ **Progressive** (clear path to next level)
6. ✅ **Extensible** (easy to add Side Quests, Weekly Challenges later)

### Next Steps

1. Review this plan with team
2. Adjust timeline and priorities
3. Begin Phase 1 implementation
4. Set up weekly syncs to track progress
