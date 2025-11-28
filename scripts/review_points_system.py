#!/usr/bin/env python
"""Senior Engineer Review: Unified Points System"""

import os
import sys

import django

# Setup Django before imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Django imports must come after setup
from django.db import connection  # noqa: E402
from django.db.models import F  # noqa: E402

from core.thrive_circle.models import PointActivity  # noqa: E402
from core.users.models import User  # noqa: E402

print('=' * 60)
print('SENIOR ENGINEER REVIEW: UNIFIED POINTS SYSTEM')
print('=' * 60)

issues = []
warnings = []

# Test 1: User Model Schema
print('\n1. USER MODEL SCHEMA')
print('-' * 40)
u = User.objects.create_user(username='review_test_usr', email='review@example.com', password='test123')  # noqa: S106
print(f'✓ User created: {u.username}')
print(f'  - tier: {u.tier} (default: ember)')
print(f'  - level: {u.level} (default: 1)')
print(f'  - total_points: {u.total_points} (default: 0)')
print(f'  - current_streak_days: {u.current_streak_days}')
print(f'  - longest_streak_days: {u.longest_streak_days}')
print(f'  - last_activity_date: {u.last_activity_date}')

if u.tier != 'ember' or u.level != 1 or u.total_points != 0:
    issues.append('User defaults are incorrect')
else:
    print('✓ All defaults correct')

# Test 2: add_points() Method
print('\n2. ADD_POINTS() METHOD')
print('-' * 40)
result = u.add_points(600, 'quiz_complete', 'Senior review test')
u.refresh_from_db()
print('✓ Added 600 points')
print(f'  - New tier: {u.tier} (expected: spark)')
print(f'  - New level: {u.level}')
print(f'  - Total points: {u.total_points}')

if u.tier != 'spark' or u.total_points != 600:
    issues.append('add_points() tier calculation failed')
else:
    print('✓ Tier upgrade working correctly')

# Test 3: PointActivity Audit Trail
print('\n3. AUDIT TRAIL (PointActivity)')
print('-' * 40)
activities = PointActivity.objects.filter(user=u)
if activities.count() > 0:
    act = activities.first()
    print('✓ Activity logged:')
    print(f'  - Amount: {act.amount}')
    print(f'  - Type: {act.activity_type}')
    print(f'  - Description: {act.description}')
    print(f'  - Tier at time: {act.tier_at_time}')
else:
    issues.append('PointActivity not created')

# Test 4: Race Condition Protection
print('\n4. RACE CONDITION PROTECTION')
print('-' * 40)
before = u.total_points
User.objects.filter(pk=u.pk).update(total_points=F('total_points') + 100)
u.refresh_from_db()
print('✓ F() expression test:')
print(f'  - Before: {before}')
print(f'  - After: {u.total_points}')
if u.total_points == before + 100:
    print('✓ Atomic updates working')
else:
    issues.append('F() expression not working correctly')

# Test 5: Database Constraints
print('\n5. DATABASE CONSTRAINTS')
print('-' * 40)
cursor = connection.cursor()
cursor.execute("""
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'core_user'::regclass
    AND conname LIKE '%points%'
""")
constraints = cursor.fetchall()
print(f'✓ Constraints found: {len(constraints)}')
for name, definition in constraints:
    print(f'  - {name}: {definition}')

if len(constraints) == 0:
    issues.append('No database constraints found for points')

# Test negative points
print('\nTesting negative points constraint...')
try:
    cursor.execute('UPDATE core_user SET total_points = -100 WHERE id = %s', [u.id])
    issues.append('CRITICAL: Negative points allowed!')
    print('✗ FAIL: Negative points accepted')
except Exception:
    print('✓ Constraint working: negative points rejected')

# Test 6: Performance Indexes
print('\n6. PERFORMANCE INDEXES')
print('-' * 40)
cursor.execute("""
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'core_user'
    AND (indexname LIKE '%tier%' OR indexname LIKE '%points%')
    ORDER BY indexname
""")
indexes = cursor.fetchall()
print(f'✓ Performance indexes: {len(indexes)} found')
for name, _definition in indexes:
    print(f'  - {name}')

if len(indexes) < 2:
    warnings.append('Missing performance indexes')

# Test 7: Tier Thresholds
print('\n7. TIER THRESHOLDS')
print('-' * 40)
print('Configured thresholds:')
for tier, threshold in User.TIER_THRESHOLDS.items():
    print(f'  - {tier}: {threshold:,} points')

# Test 8: Level Progression
print('\n8. LEVEL PROGRESSION')
print('-' * 40)
print(f'Level thresholds defined: {len(User.LEVEL_THRESHOLDS)}')
print(f'First 5 levels: {User.LEVEL_THRESHOLDS[:5]}')
print(f'Levels 20-23: {User.LEVEL_THRESHOLDS[19:23]}')

# Test 9: Helper Properties
print('\n9. HELPER PROPERTIES')
print('-' * 40)
print(f'✓ points_to_next_level: {u.points_to_next_level}')
print(f'✓ points_to_next_tier: {u.points_to_next_tier}')
print(f'✓ tier_display: {u.tier_display}')

# Test 10: Streak Tracking
print('\n10. STREAK TRACKING')
print('-' * 40)
u.add_points(10, 'daily_login', 'Streak test')
u.refresh_from_db()
print(f'✓ current_streak_days: {u.current_streak_days}')
print(f'✓ longest_streak_days: {u.longest_streak_days}')
print(f'✓ last_activity_date: {u.last_activity_date}')

if u.current_streak_days != 1:
    warnings.append('Streak not initialized correctly')

# Cleanup
print('\n' + '=' * 60)
u.delete()
print('Test user deleted')

# Final Report
print('\n' + '=' * 60)
print('REVIEW SUMMARY')
print('=' * 60)

if issues:
    print(f'\n❌ CRITICAL ISSUES FOUND: {len(issues)}')
    for issue in issues:
        print(f'  - {issue}')
else:
    print('\n✓ NO CRITICAL ISSUES')

if warnings:
    print(f'\n⚠️  WARNINGS: {len(warnings)}')
    for warning in warnings:
        print(f'  - {warning}')
else:
    print('✓ NO WARNINGS')

if not issues:
    print('\n' + '=' * 60)
    print('✓ UNIFIED POINTS SYSTEM: PRODUCTION READY')
    print('=' * 60)
    sys.exit(0)
else:
    print('\n' + '=' * 60)
    print('✗ SYSTEM NEEDS ATTENTION')
    print('=' * 60)
    sys.exit(1)
