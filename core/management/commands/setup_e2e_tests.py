"""
Management command to set up test data for e2e tests.

Creates a test user and a test project specifically for Playwright e2e tests.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.projects.models import Project

User = get_user_model()


class Command(BaseCommand):
    help = 'Set up test data for e2e tests (test user and project)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='e2e-test-user',
            help='Username for test user',
        )
        parser.add_argument(
            '--email',
            type=str,
            default='e2e-test@example.com',
            help='Email for test user',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='e2eTestPass123!',
            help='Password for test user',
        )
        parser.add_argument(
            '--project-slug',
            type=str,
            default='e2e-test-project',
            help='Slug for test project',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing test user and project before creating new ones',
        )

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']
        project_slug = options['project_slug']
        reset = options['reset']

        self.stdout.write(self.style.WARNING('Setting up e2e test data...'))
        self.stdout.write('')

        # Delete existing test data if reset flag is set
        if reset:
            self.stdout.write('🗑️  Resetting existing test data...')
            User.objects.filter(username=username).delete()
            self.stdout.write(self.style.WARNING(f'  Deleted user: {username}'))

        # Create or get test user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': 'E2E',
                'last_name': 'Test User',
                'is_active': True,
            },
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'✅ Created test user: {username}'))
            self.stdout.write(f'   Email: {email}')
            self.stdout.write(f'   Password: {password}')
        else:
            # Update password in case it changed
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.WARNING(f'ℹ️  Test user already exists: {username}'))
            self.stdout.write(f'   Password updated to: {password}')

        # Delete existing test project if reset
        if reset:
            Project.objects.filter(user=user, slug=project_slug).delete()
            self.stdout.write(self.style.WARNING(f'  Deleted project: {project_slug}'))

        # Create or get test project
        project, created = Project.objects.get_or_create(
            user=user,
            slug=project_slug,
            defaults={
                'title': 'E2E Test Project',
                'description': 'This project is used for end-to-end testing with Playwright',
                'type': Project.ProjectType.OTHER,
                'is_showcase': True,
                'is_private': False,
                'thumbnail_url': 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&h=400&fit=crop',
                'featured_image_url': 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=600&fit=crop',
                'external_url': 'https://example.com',
                'content': {
                    'heroDisplayMode': 'image',
                    'blocks': [
                        {
                            'type': 'text',
                            'style': 'heading',
                            'content': 'E2E Test Project',
                        },
                        {
                            'type': 'text',
                            'style': 'body',
                            'content': 'This is a test project for e2e testing. It should have editable content.',
                        },
                    ],
                },
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'✅ Created test project: {project_slug}'))
            self.stdout.write(f'   URL: {settings.FRONTEND_URL}/{username}/{project_slug}')
        else:
            self.stdout.write(self.style.WARNING(f'ℹ️  Test project already exists: {project_slug}'))
            self.stdout.write(f'   URL: {settings.FRONTEND_URL}/{username}/{project_slug}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('═══════════════════════════════════════'))
        self.stdout.write(self.style.SUCCESS('✅ E2E Test Data Setup Complete!'))
        self.stdout.write(self.style.SUCCESS('═══════════════════════════════════════'))
        self.stdout.write('')
        self.stdout.write('📝 Update your frontend/e2e/.env file with:')
        self.stdout.write('')
        self.stdout.write(f'TEST_USER_EMAIL={email}')
        self.stdout.write(f'TEST_USER_PASSWORD={password}')
        self.stdout.write(f'TEST_USER_USERNAME={username}')
        self.stdout.write(f'TEST_PROJECT_SLUG={project_slug}')
        self.stdout.write('')
        self.stdout.write('🧪 Run e2e tests with:')
        self.stdout.write('   cd frontend && npm run test:e2e')
        self.stdout.write('')
