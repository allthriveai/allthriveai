# Points System Consolidation - Production Migration Plan

**Date**: 2025-11-24
**Engineer**: Senior Backend Engineer
**Status**: Phase 1 - Design
**Target Scale**: 100,000+ users

## Executive Summary

Consolidate duplicate gamification/points tracking from two separate systems (User model + UserTier model) into a single, performant system on the User model optimized for 100k+ users.

## Current State Analysis

### Duplicate Systems
1. **User Model** (core/users/models.py):
   - `total_points`, `level`, `current_streak`, `max_streak`, `last_login_date`
   - Used by old `PointsService` (services/points/)

2. **UserTier Model** (core/thrive_circle/models.py):
   - `total_points`, `level`, `tier`, `current_streak_days`, `longest_streak_days`, `last_activity_date`
   - `lifetime_quizzes_completed`, `lifetime_projects_created`, etc.
   - Used by new Thrive Circle system

### Critical Issues
- ❌ Points never sync between User.total_points and UserTier.total_points
- ❌ Quiz completion awards points to BOTH systems (double tracking)
- ❌ Inconsistent naming (current_streak vs current_streak_days)
- ❌ Extra JOIN required for all gamification queries
- ❌ Tests broken after XP → Points rename

## Target State

### Single Source of Truth: User Model
```python
class User(AbstractUser):
    # Points and progression (indexed for leaderboards)
    total_points = IntegerField(default=0, db_index=True)
    level = IntegerField(default=1, db_index=True)
    tier = CharField(max_length=20, default='ember', db_index=True, choices=TIER_CHOICES)

    # Streak tracking
    current_streak_days = IntegerField(default=0)
    longest_streak_days = IntegerField(default=0)
    last_activity_date = DateField(null=True, blank=True)

    # Lifetime stats
    lifetime_quizzes_completed = IntegerField(default=0)
    lifetime_projects_created = IntegerField(default=0)
    lifetime_side_quests_completed = IntegerField(default=0)
    lifetime_comments_posted = IntegerField(default=0)

    def add_points(self, amount, activity_type, description=''):
        """Award points with atomic transaction and race condition protection"""
        ...
```

### Benefits at Scale
- ✅ Zero JOINs for user queries (critical at 100k users)
- ✅ Faster leaderboards: `User.objects.order_by('-total_points')[:100]`
- ✅ Simple tier filtering: `User.objects.filter(tier='phoenix')`
- ✅ Better cache utilization (single table)
- ✅ Proper database indexes on points, level, tier

## Migration Strategy: Zero-Downtime, Reversible

### Phase 1: Preparation (Week 1)
1. ✅ Create migration design document (this document)
2. Add missing fields to User model (tier, lifetime stats)
3. Rename fields for consistency (current_streak → current_streak_days)
4. Add proper indexes and constraints
5. Create comprehensive tests

### Phase 2: Dual-Write Period (Week 2)
1. Implement dual-write: `add_points()` updates BOTH User and UserTier
2. Backfill User model data from UserTier (data migration)
3. Add consistency verification script
4. Monitor for discrepancies

### Phase 3: Dual-Read Verification (Week 3)
1. Update all read paths to use User model
2. Keep UserTier updated but only read from User
3. Run consistency checks daily
4. Monitor query performance improvements

### Phase 4: Cleanup (Week 4)
1. Remove UserTier write operations
2. Delete old PointsService (services/points/)
3. Remove UserTier model (keep for 1 week as safety)
4. Update all tests and documentation

### Phase 5: Final Cleanup (Week 5)
1. Drop UserTier table from database
2. Remove all legacy code references
3. Performance monitoring and optimization

## Rollback Plan

At any phase, can rollback by:
1. Re-enable UserTier writes
2. Backfill UserTier from User
3. Switch read paths back to UserTier
4. Keep both systems running in dual-write mode

## Database Changes

### New Fields on User Model
```python
# Migration 0001_add_gamification_fields_to_user.py
tier = models.CharField(
    max_length=20,
    choices=[('ember', 'Ember'), ('spark', 'Spark'), ('blaze', 'Blaze'),
             ('beacon', 'Beacon'), ('phoenix', 'Phoenix')],
    default='ember',
    db_index=True,
    help_text='User tier based on total points'
)
lifetime_quizzes_completed = models.IntegerField(default=0)
lifetime_projects_created = models.IntegerField(default=0)
lifetime_side_quests_completed = models.IntegerField(default=0)
lifetime_comments_posted = models.IntegerField(default=0)
```

### Field Renames
```python
# Migration 0002_rename_streak_fields.py
current_streak → current_streak_days
max_streak → longest_streak_days
last_login_date → last_activity_date
```

### New Indexes
```python
# Composite index for tier-based leaderboards
Index(fields=['tier', '-total_points'], name='user_tier_points_idx')
```

### Data Backfill
```python
# Migration 0003_backfill_user_from_usertier.py
# Copy all data from UserTier to User
UPDATE users_user u
SET
    total_points = ut.total_points,
    level = ut.level,
    tier = ut.tier,
    current_streak_days = ut.current_streak_days,
    longest_streak_days = ut.longest_streak_days,
    last_activity_date = ut.last_activity_date,
    lifetime_quizzes_completed = ut.lifetime_quizzes_completed,
    lifetime_projects_created = ut.lifetime_projects_created,
    lifetime_side_quests_completed = ut.lifetime_side_quests_completed,
    lifetime_comments_posted = ut.lifetime_comments_posted
FROM thrive_circle_usertier ut
WHERE u.id = ut.user_id;
```

## Code Changes

### 1. User Model Methods
```python
# core/users/models.py
class User(AbstractUser):
    TIER_CHOICES = [
        ('ember', 'Ember'),
        ('spark', 'Spark'),
        ('blaze', 'Blaze'),
        ('beacon', 'Beacon'),
        ('phoenix', 'Phoenix'),
    ]

    TIER_THRESHOLDS = {
        'ember': 0,
        'spark': 500,
        'blaze': 2000,
        'beacon': 5000,
        'phoenix': 10000,
    }

    LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, ...]  # Copy from UserTier

    @transaction.atomic
    def add_points(self, amount, activity_type, description=''):
        """Award points with race condition protection"""
        if amount <= 0:
            raise ValueError(f'Points amount must be positive, got {amount}')

        # Atomic update using F() expression
        User.objects.filter(pk=self.pk).update(
            total_points=F('total_points') + amount
        )
        self.refresh_from_db()

        # Update tier and level
        old_tier = self.tier
        old_level = self.level
        self.tier = self._calculate_tier()
        self.level = self._calculate_level()
        self.save(update_fields=['tier', 'level'])

        # Update streak
        self._update_streak()

        # Log activity
        from core.thrive_circle.models import PointActivity
        PointActivity.objects.create(
            user=self,
            amount=amount,
            activity_type=activity_type,
            description=description,
            tier_at_time=old_tier
        )

        # Check for tier/level upgrades
        tier_upgraded = old_tier != self.tier
        level_upgraded = old_level != self.level

        if tier_upgraded:
            logger.info(f'User {self.username} upgraded to {self.tier}')
        if level_upgraded:
            logger.info(f'User {self.username} reached level {self.level}')

        return self.total_points

    def _calculate_tier(self):
        """Calculate tier from total_points"""
        if self.total_points >= self.TIER_THRESHOLDS['phoenix']:
            return 'phoenix'
        elif self.total_points >= self.TIER_THRESHOLDS['beacon']:
            return 'beacon'
        elif self.total_points >= self.TIER_THRESHOLDS['blaze']:
            return 'blaze'
        elif self.total_points >= self.TIER_THRESHOLDS['spark']:
            return 'spark'
        return 'ember'

    def _calculate_level(self):
        """Calculate level from total_points"""
        for level_num, threshold in enumerate(self.LEVEL_THRESHOLDS, start=1):
            if self.total_points < threshold:
                return level_num - 1 if level_num > 1 else 1
        # After level 23, +10,000 points per level
        level_20_threshold = self.LEVEL_THRESHOLDS[19]
        points_above_20 = self.total_points - level_20_threshold
        additional_levels = points_above_20 // 10000
        return 20 + additional_levels

    def _update_streak(self):
        """Update daily activity streak"""
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        if self.last_activity_date is None:
            self.current_streak_days = 1
            self.longest_streak_days = max(self.longest_streak_days, 1)
        elif self.last_activity_date == today:
            pass  # Already earned points today
        elif self.last_activity_date == yesterday:
            self.current_streak_days += 1
            self.longest_streak_days = max(self.longest_streak_days, self.current_streak_days)
        else:
            self.current_streak_days = 1

        self.last_activity_date = today
        self.save(update_fields=['current_streak_days', 'longest_streak_days', 'last_activity_date'])
```

### 2. Remove Duplicate Quiz Points Awarding
```python
# core/quizzes/views.py (lines 185-264)
# REMOVE: Old PointsService call (lines 186-228)
# KEEP: Only UserTier.add_points() call (lines 244-263)
# UPDATE: Change to user.add_points() instead
```

### 3. Fix Weekly Goal Bug
```python
# core/thrive_circle/utils.py (line 87)
# BEFORE:
user.tier_status.add_xp(goal.xp_reward, ...)

# AFTER:
user.add_points(goal.points_reward, ...)
```

## Testing Strategy

### Unit Tests
- Test `add_points()` with various amounts
- Test tier calculation at each threshold
- Test level calculation for all ranges
- Test streak logic (consecutive days, gaps, same day)
- Test race condition handling with concurrent updates
- Test negative point validation

### Integration Tests
- Test quiz completion → points awarded
- Test project creation → points awarded
- Test comment posting → points awarded
- Test leaderboard queries with 1000+ users
- Test tier filtering with large datasets

### Performance Tests
- Benchmark leaderboard query: `User.objects.order_by('-total_points')[:100]`
- Benchmark tier filtering: `User.objects.filter(tier='phoenix').count()`
- Compare JOIN vs no-JOIN query performance
- Load test with 100k user records

### Data Consistency Tests
```python
# Script: verify_points_consistency.py
def verify_consistency():
    mismatches = []
    for user in User.objects.select_related('tier_status').all():
        if user.total_points != user.tier_status.total_points:
            mismatches.append({
                'user_id': user.id,
                'user_points': user.total_points,
                'tier_points': user.tier_status.total_points,
                'diff': abs(user.total_points - user.tier_status.total_points)
            })
    return mismatches
```

## Monitoring & Observability

### Metrics to Track
- `points.awarded` (counter by activity_type)
- `points.tier_upgrade` (counter)
- `points.level_upgrade` (counter)
- `points.consistency_errors` (counter)
- `api.leaderboard.latency` (histogram)
- `api.user_points.read_latency` (histogram)

### Alerts
- Alert if consistency errors > 0
- Alert if leaderboard query > 100ms p99
- Alert if `add_points()` fails > 1% of requests

### Logging
```python
logger.info('Points awarded', extra={
    'user_id': user.id,
    'amount': amount,
    'activity_type': activity_type,
    'total_points': user.total_points,
    'tier': user.tier,
    'level': user.level
})
```

## Risk Assessment

### High Risk
- ❌ Data loss during migration
  - **Mitigation**: Backups before each migration step
- ❌ Points awarded twice during dual-write
  - **Mitigation**: Idempotency checks on all award operations
- ❌ Performance degradation on User table
  - **Mitigation**: Proper indexes, monitoring, gradual rollout

### Medium Risk
- ⚠️ Inconsistent data during transition
  - **Mitigation**: Consistency verification script, dual-write period
- ⚠️ Tests failing after changes
  - **Mitigation**: Update tests incrementally, run CI on every change

### Low Risk
- ℹ️ Frontend display issues
  - **Mitigation**: API backward compatibility, gradual frontend updates

## Success Criteria

### Performance
- ✅ Leaderboard queries < 50ms p99 (vs current ~150ms with JOIN)
- ✅ User profile loads < 100ms p99
- ✅ Points award operations < 200ms p99

### Correctness
- ✅ Zero data consistency errors for 1 week
- ✅ All tests passing (unit, integration, e2e)
- ✅ No user-reported points discrepancies

### Scalability
- ✅ System handles 10,000 concurrent users
- ✅ Leaderboards work efficiently with 100k+ users
- ✅ Database query performance meets SLA

## Timeline

| Week | Phase | Tasks | Owner |
|------|-------|-------|-------|
| 1 | Preparation | Add fields, migrations, tests | Backend |
| 2 | Dual-Write | Implement dual-write, backfill data | Backend |
| 3 | Verification | Switch reads to User model, monitor | Backend + DevOps |
| 4 | Cleanup | Remove old system, update docs | Backend |
| 5 | Final | Drop tables, performance tuning | Backend + DBA |

## Approval Required

- [ ] Engineering Lead
- [ ] Product Manager
- [ ] DevOps Lead
- [ ] QA Lead

## Next Steps

1. Review and approve this migration plan
2. Create feature flag for gradual rollout
3. Schedule downtime window for schema changes (if needed)
4. Begin Phase 1 implementation
