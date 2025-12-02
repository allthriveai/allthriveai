"""
Management command to create the Veo3 Reddit community agent.
Run with: python manage.py create_veo3_reddit_agent [--sync]

This agent:
- Scrapes r/VEO3 subreddit
- Only pulls posts with 50+ upvotes
- Tags with tool: veo3, category: images-video
- Sets video hero display mode for video posts
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityAgent
from core.taxonomy.models import Taxonomy
from core.tools.models import Company, Tool
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService

# Default settings for Veo3 Reddit agent
VEO3_AGENT_SETTINGS = {
    'feed_type': 'top',
    'time_period': 'week',
    'min_score': 50,  # 50+ upvotes required
    'min_comments': 0,
    'sync_interval_minutes': 30,
    'default_tools': ['veo3'],
    'default_categories': ['images-video'],
    'hero_display_mode': 'video',  # Force video hero display
}


class Command(BaseCommand):
    help = 'Create the Veo3 Reddit community curation agent'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agent',
        )

    def _ensure_veo3_tool_exists(self):
        """Create the Veo3 tool if it doesn't exist."""
        tool, created = Tool.objects.get_or_create(
            slug='veo3',
            defaults={
                'name': 'Veo 3',
                'tagline': "Google DeepMind's state-of-the-art video generation model",
                'description': (
                    "Veo 3 is Google DeepMind's advanced AI video generation model that creates "
                    'high-quality, realistic videos from text prompts. It supports various styles, '
                    'camera movements, and can generate videos with impressive temporal consistency '
                    'and visual fidelity.'
                ),
                'tool_type': Tool.ToolType.AI_TOOL,
                'category': Tool.ToolCategory.VIDEO,
                'website_url': 'https://deepmind.google/technologies/veo/',
                'logo_url': 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg',
                'tags': ['video generation', 'text-to-video', 'AI video', 'google', 'deepmind'],
                'is_active': True,
                'is_featured': False,
            },
        )

        # Try to associate with Google company if it exists
        if created:
            google_company = Company.objects.filter(slug='google').first()
            if google_company:
                tool.company = google_company
                tool.save()

        return tool, created

    def handle(self, *args, **options):
        subreddit = 'VEO3'
        run_sync = options['sync']

        # Generate agent username: {subreddit}-reddit-agent
        agent_username = f'{slugify(subreddit)}-reddit-agent'
        agent_display_name = 'Veo3'

        self.stdout.write(f'Creating Reddit agent for r/{subreddit}...')

        try:
            with transaction.atomic():
                # Ensure Veo3 tool exists
                tool, tool_created = self._ensure_veo3_tool_exists()
                if tool_created:
                    self.stdout.write(self.style.SUCCESS(f'Created Veo3 tool: {tool.name}'))
                else:
                    self.stdout.write(self.style.WARNING(f'Veo3 tool already exists: {tool.name}'))

                # Check if images-video category exists
                images_video_category = Taxonomy.objects.filter(slug='images-video', taxonomy_type='category').first()
                if not images_video_category:
                    self.stdout.write(
                        self.style.WARNING('Category "images-video" not found. Agent will not have default category.')
                    )

                # Check if agent user already exists
                try:
                    agent_user = User.objects.get(username=agent_username)
                    self.stdout.write(self.style.WARNING(f'Agent user already exists: {agent_username}'))
                except User.DoesNotExist:
                    # Create agent user
                    agent_user = User.objects.create(
                        username=agent_username,
                        email=f'{agent_username}@allthrive.ai',
                        first_name=agent_display_name,
                        last_name='Reddit Agent',
                        role=UserRole.AGENT,
                        bio=(
                            f'Automated curation agent for r/{subreddit} - '
                            + 'showcasing the best Veo 3 AI video creations'
                        ),
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    # Agents don't need passwords
                    agent_user.set_unusable_password()
                    agent_user.save()
                    self.stdout.write(self.style.SUCCESS(f'Created agent user: {agent_username}'))

                # Check if agent config already exists
                try:
                    agent_config = RedditCommunityAgent.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Agent config already exists for r/{subreddit}'))

                    # Update settings to ensure they're correct
                    agent_config.settings = VEO3_AGENT_SETTINGS
                    agent_config.save()
                    self.stdout.write(self.style.SUCCESS('Updated agent config settings'))

                except RedditCommunityAgent.DoesNotExist:
                    # Create agent configuration
                    agent_config = RedditCommunityAgent.objects.create(
                        agent_user=agent_user,
                        name=f'{agent_display_name} Reddit Agent',
                        subreddit=subreddit,
                        status=RedditCommunityAgent.Status.ACTIVE,
                        settings=VEO3_AGENT_SETTINGS,
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created agent config for r/{subreddit}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\nVeo3 Reddit agent created successfully!'))
            self.stdout.write(f'\n  Agent username: {agent_username}')
            self.stdout.write(f'  Profile URL: /{agent_username}')
            self.stdout.write(f'  RSS feed: {agent_config.rss_feed_url}')
            self.stdout.write(f'  Status: {agent_config.status}')
            self.stdout.write('\n  Settings:')
            self.stdout.write(f'    - Min upvotes: {agent_config.settings.get("min_score", 50)}')
            self.stdout.write(f'    - Default tools: {agent_config.settings.get("default_tools", [])}')
            self.stdout.write(f'    - Default categories: {agent_config.settings.get("default_categories", [])}')
            self.stdout.write(f'    - Hero display mode: {agent_config.settings.get("hero_display_mode", "video")}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\nRunning initial sync...')
                results = RedditSyncService.sync_agent(agent_config)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nSync complete: {results["created"]} created, '
                        f'{results["updated"]} updated, {results["errors"]} errors'
                    )
                )

                if results['errors'] > 0:
                    self.stdout.write(self.style.ERROR('\nErrors:'))
                    for error in results['error_messages']:
                        self.stdout.write(self.style.ERROR(f'  - {error}'))
            else:
                self.stdout.write('\nRun sync with: python manage.py sync_reddit_agents --subreddit VEO3')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nError creating agent: {e}'))
            raise
