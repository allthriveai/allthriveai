#!/usr/bin/env python
"""
Test script to check the /me/activity/ endpoint response structure
"""

import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory  # noqa: E402

from core.auth.views import user_activity  # noqa: E402
from core.users.models import User  # noqa: E402

# Get a user
user = User.objects.first()
if not user:
    print('No users found in database')
    exit(1)

print(f'Testing with user: {user.username}')
print(f'User email: {user.email}')
print('User authenticated: True')

# Create a fake request
factory = RequestFactory()
request = factory.get('/api/v1/me/activity/')
request.user = user

# Call the view
try:
    response = user_activity(request)
    print(f'\nResponse status: {response.status_code}')
    print(f"Response data keys: {response.data.keys() if hasattr(response, 'data') else 'N/A'}")

    if hasattr(response, 'data'):
        data = response.data
        print('\nTop level structure:')
        print(f"  - success: {data.get('success')}")
        print(f"  - data type: {type(data.get('data'))}")

        if 'data' in data:
            inner_data = data['data']
            print(f"\nInner data keys: {inner_data.keys() if isinstance(inner_data, dict) else 'N/A'}")

            if isinstance(inner_data, dict):
                print('\nActivities:')
                activities = inner_data.get('activities', [])
                print(f'  - Count: {len(activities)}')
                if activities:
                    print(f'  - First activity keys: {activities[0].keys()}')

                print('\nStatistics:')
                stats = inner_data.get('statistics', {})
                if stats:
                    print(f'  - Keys: {stats.keys()}')
                    print(f"  - totalLogins: {stats.get('totalLogins')}")
                    print(f"  - lastLogin: {stats.get('lastLogin')}")
                    print(f"  - accountCreated: {stats.get('accountCreated')}")
                    print(f"  - quizScores count: {len(stats.get('quizScores', []))}")

                print('\nPoints Feed:')
                points_feed = inner_data.get('pointsFeed', [])
                print(f'  - Count: {len(points_feed)}')

except Exception as e:
    print(f'\nError: {e}')
    import traceback

    traceback.print_exc()
