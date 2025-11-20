"""
Management command to create test projects with thumbnails for development.
"""

from django.core.management.base import BaseCommand

from core.projects.models import Project
from core.users.models import User


class Command(BaseCommand):
    help = 'Create test projects with thumbnails for development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='allie',
            help='Username to create projects for',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of playground projects to create',
        )

    def handle(self, *args, **options):
        username = options['username']
        count = options['count']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User '{username}' not found"))
            return

        # Sample thumbnail URLs with varied aspect ratios for masonry effect
        thumbnail_options = [
            'https://picsum.photos/400/300',  # 4:3
            'https://picsum.photos/400/500',  # 4:5 (portrait)
            'https://picsum.photos/400/250',  # 16:10 (landscape)
            'https://picsum.photos/400/600',  # 2:3 (tall)
            'https://picsum.photos/400/400',  # 1:1 (square)
            'https://picsum.photos/400/350',  # 8:7
            'https://picsum.photos/400/450',  # 8:9
            'https://picsum.photos/400/280',  # 10:7
        ]

        created_count = 0

        for i in range(count):
            project = Project.objects.create(
                user=user,
                title=f'Test Project {i + 1}',
                description=f'This is a test project #{i + 1} with a thumbnail for development purposes.',
                type=Project.ProjectType.OTHER,
                is_showcase=False,  # Playground project
                is_published=True,
                thumbnail_url=thumbnail_options[i % len(thumbnail_options)],
                content={
                    'blocks': [
                        {
                            'type': 'text',
                            'text': f'This is test project #{i + 1}',
                        }
                    ],
                    'tags': ['test', 'development', f'project-{i + 1}'],
                },
            )
            created_count += 1
            self.stdout.write(f'  Created: {project.user.username}/{project.slug}')

        self.stdout.write(self.style.SUCCESS(f'Successfully created {created_count} test projects for @{username}'))
