"""
Management command to create a test user for automated testing (Playwright/CI).

This creates a user with known credentials that can be used for E2E testing.
The command is idempotent - running it multiple times will not create duplicates.

Usage:
    python manage.py create_test_user
    python manage.py create_test_user --email custom@test.local --password custompass
"""

from django.core.management.base import BaseCommand

from core.users.models import User


class Command(BaseCommand):
    help = 'Create a test user for automated E2E testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='test@test.local',
            help='Email address for the test user (default: test@test.local)',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='testpass123',
            help='Password for the test user (default: testpass123)',
        )
        parser.add_argument(
            '--username',
            type=str,
            default='testuser',
            help='Username for the test user (default: testuser)',
        )

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        username = options['username']

        # Check if user already exists
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            # Update the password in case it changed
            existing_user.set_password(password)
            existing_user.is_active = True
            existing_user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Test user already exists: {email} (password updated)')
            )
            return

        # Create the test user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name='Test',
            last_name='User',
            is_active=True,
            tier='seedling',
            role='explorer',
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Created test user:\n'
                f'  Email: {email}\n'
                f'  Username: {username}\n'
                f'  Password: {password}\n'
                f'  ID: {user.id}'
            )
        )
