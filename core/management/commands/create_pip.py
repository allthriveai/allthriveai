"""Management command to create Pip - the AI battle agent user."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.projects.models import Project
from core.users.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Create Pip - the AI agent user for prompt battles'

    def add_arguments(self, parser):
        parser.add_argument('--recreate', action='store_true', help='Delete and recreate Pip if already exists')

    def handle(self, *args, **options):
        username = 'pip'  # Lowercase to match Django's normalization

        # Check if Pip already exists (case-insensitive)
        existing_pip = User.objects.filter(username__iexact=username).first()

        if existing_pip:
            if options['recreate']:
                existing_pip.delete()
                self.stdout.write(self.style.WARNING('Deleted existing Pip user'))
            else:
                self.stdout.write(self.style.WARNING(f'Pip already exists (ID: {existing_pip.id})'))
                self.stdout.write('Use --recreate flag to delete and recreate')
                return

        # Create Pip user with comprehensive test data
        avatar_url = f'{settings.FRONTEND_URL}/chatbot-chat.webp'

        pip = User.objects.create_user(
            username=username,
            email='pip@allthrive.ai',
            first_name='Pip',
            last_name='',  # Pip is mononymous
            is_active=True,
            role=UserRole.BOT,  # Mark as bot
            avatar_url=avatar_url,
            bio=(
                "<p>Hey there! I'm Pip, your friendly AI agent who lives for prompt battles! 🤖✨</p>"
                '<p>I was created to help you level up your AI prompt engineering skills through fun, '
                "competitive challenges. Think of me as your sparring partner who's always ready to "
                'battle - day or night!</p>'
                '<p><strong>What I love:</strong></p>'
                '<ul>'
                '<li>Prompt engineering challenges</li>'
                '<li>Creative AI interactions</li>'
                '<li>Helping humans improve their AI skills</li>'
                '</ul>'
            ),
            tagline='AI Agent • Prompt Battle Champion • Always Ready to Play',
            location='The Cloud',
            pronouns='they/them',
            current_status='✨ Online & ready for prompt battles! Challenge me now!',
            website_url='https://allthrive.ai',
            calendar_url='https://allthrive.ai/pip/availability',
            # Social media links for Pip's profile
            linkedin_url='https://linkedin.com/in/pip-ai-agent',
            twitter_url='https://twitter.com/pip_allthrive',
            github_url='https://github.com/allthrive-ai/pip',
            youtube_url='https://youtube.com/@PipAllThrive',
            instagram_url='https://instagram.com/pip.allthrive',
            # Privacy settings
            playground_is_public=True,  # Pip's playground is always public
        )

        # Set a secure password (won't be used for login)
        pip.set_unusable_password()
        pip.save()

        # Create fake showcase projects for Pip
        showcase_projects = [
            {
                'title': 'Prompt Battle Arena v2.0',
                'slug': 'prompt-battle-arena',
                'description': (
                    'Enhanced AI prompt battle system with real-time scoring, leaderboards, and community challenges. '
                    'Built to help users master prompt engineering through competitive gameplay.'
                ),
                'type': Project.ProjectType.OTHER,
                'thumbnail_url': '',
                'content': {'blocks': []},
            },
            {
                'title': 'AI Prompt Engineering Guide',
                'slug': 'prompt-engineering-guide',
                'description': (
                    'Comprehensive guide covering prompt engineering techniques, best practices, and examples. '
                    'From basic queries to advanced multi-step reasoning.'
                ),
                'type': Project.ProjectType.PROMPT,
                'thumbnail_url': '',
                'content': {'blocks': []},
            },
            {
                'title': 'Battle Strategy Analyzer',
                'slug': 'battle-strategy-analyzer',
                'description': (
                    'AI-powered tool that analyzes prompt battle strategies and provides insights on '
                    'winning techniques and common pitfalls.'
                ),
                'type': Project.ProjectType.OTHER,
                'thumbnail_url': '',
                'content': {'blocks': []},
            },
        ]

        playground_projects = [
            {
                'title': 'Experimental Battle Formats',
                'slug': 'experimental-battle-formats',
                'description': (
                    'Testing new battle formats: team battles, relay challenges, and creative constraints.'
                ),
                'type': Project.ProjectType.OTHER,
                'thumbnail_url': '',
                'content': {'blocks': []},
            },
            {
                'title': 'Prompt Pattern Library',
                'slug': 'prompt-pattern-library',
                'description': (
                    "Collection of effective prompt patterns and templates I've learned from thousands of battles."
                ),
                'type': Project.ProjectType.PROMPT,
                'thumbnail_url': '',
                'content': {'blocks': []},
            },
        ]

        # Create showcase projects (published)
        for proj_data in showcase_projects:
            Project.objects.create(
                user=pip,
                is_showcase=True,
                is_published=True,
                published_at=timezone.now(),
                **proj_data,
            )

        # Create playground projects (also public since Pip's playground is public)
        for proj_data in playground_projects:
            Project.objects.create(
                user=pip,
                is_showcase=False,
                is_published=True,  # Public in playground
                published_at=timezone.now(),
                **proj_data,
            )

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('✓ Pip Created Successfully!'))
        self.stdout.write('=' * 60)
        self.stdout.write('\n🤖 AI Agent Details:')
        self.stdout.write(f'  Username: {pip.username}')
        self.stdout.write(f'  User ID: {pip.id}')
        self.stdout.write(f'  Email: {pip.email}')
        self.stdout.write('\n💡 Usage:')
        self.stdout.write('  Users can now challenge "Pip" to prompt battles!')
        self.stdout.write('  Just enter "Pip" as the opponent username.')
        self.stdout.write('\n🎮 Pip is the AllThrive AI agent - small but mighty!')
        self.stdout.write('')
