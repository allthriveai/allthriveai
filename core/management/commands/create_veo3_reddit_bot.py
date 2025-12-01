"""
Management command to create the Veo3 Reddit community bot.
Run with: python manage.py create_veo3_reddit_bot [--sync]

This bot:
- Scrapes r/VEO3 subreddit
- Only pulls posts with 50+ upvotes
- Tags with tool: veo3, category: images-video
- Sets video hero display mode for video posts
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityBot
from core.taxonomy.models import Taxonomy
from core.tools.models import Company, Tool
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService


class Command(BaseCommand):
    help = 'Create the Veo3 Reddit community curation bot'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating bot',
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

        # Generate bot username: {subreddit}-reddit-bot
        bot_username = f'{slugify(subreddit)}-reddit-bot'
        bot_display_name = 'Veo3'

        self.stdout.write(f'Creating Reddit bot for r/{subreddit}...')

        try:
            with transaction.atomic():
                # Ensure Veo3 tool exists
                tool, tool_created = self._ensure_veo3_tool_exists()
                if tool_created:
                    self.stdout.write(self.style.SUCCESS(f'✅ Created Veo3 tool: {tool.name}'))
                else:
                    self.stdout.write(self.style.WARNING(f'Veo3 tool already exists: {tool.name}'))

                # Check if images-video category exists
                images_video_category = Taxonomy.objects.filter(slug='images-video', taxonomy_type='category').first()
                if not images_video_category:
                    self.stdout.write(
                        self.style.WARNING('Category "images-video" not found. Bot will not have default category.')
                    )

                # Check if bot user already exists
                try:
                    bot_user = User.objects.get(username=bot_username)
                    self.stdout.write(self.style.WARNING(f'Bot user already exists: {bot_username}'))
                except User.DoesNotExist:
                    # Create bot user
                    bot_user = User.objects.create(
                        username=bot_username,
                        email=f'{bot_username}@allthrive.ai',
                        first_name=bot_display_name,
                        last_name='Reddit Bot',
                        role=UserRole.BOT,
                        bio=f'Automated curation bot for r/{subreddit} - showcasing the best Veo 3 AI video creations',
                        avatar_url='/Reddit-logo.svg',
                        is_active=True,
                    )
                    # Bots don't need passwords
                    bot_user.set_unusable_password()
                    bot_user.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Created bot user: {bot_username}'))

                # Check if bot config already exists
                try:
                    bot_config = RedditCommunityBot.objects.get(subreddit=subreddit)
                    self.stdout.write(self.style.WARNING(f'Bot config already exists for r/{subreddit}'))

                    # Update settings to ensure they're correct
                    bot_config.settings = {
                        'feed_type': 'top',
                        'time_period': 'week',
                        'min_score': 50,  # 50+ upvotes required
                        'min_comments': 0,
                        'sync_interval_minutes': 30,
                        'default_tools': ['veo3'],
                        'default_categories': ['images-video'],
                        'hero_display_mode': 'video',  # Force video hero display
                    }
                    bot_config.save()
                    self.stdout.write(self.style.SUCCESS('✅ Updated bot config settings'))

                except RedditCommunityBot.DoesNotExist:
                    # Create bot configuration
                    bot_config = RedditCommunityBot.objects.create(
                        bot_user=bot_user,
                        name=f'{bot_display_name} Reddit Bot',
                        subreddit=subreddit,
                        status=RedditCommunityBot.Status.ACTIVE,
                        settings={
                            'feed_type': 'top',
                            'time_period': 'week',
                            'min_score': 50,  # 50+ upvotes required
                            'min_comments': 0,  # No minimum comments
                            'sync_interval_minutes': 30,
                            'default_tools': ['veo3'],
                            'default_categories': ['images-video'],
                            'hero_display_mode': 'video',  # Force video hero display
                        },
                    )
                    self.stdout.write(self.style.SUCCESS(f'✅ Created bot config for r/{subreddit}'))

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n🎉 Veo3 Reddit bot created successfully!'))
            self.stdout.write(f'\n  Bot username: {bot_username}')
            self.stdout.write(f'  Profile URL: /{bot_username}')
            self.stdout.write(f'  RSS feed: {bot_config.rss_feed_url}')
            self.stdout.write(f'  Status: {bot_config.status}')
            self.stdout.write('\n  Settings:')
            self.stdout.write(f'    - Min upvotes: {bot_config.settings.get("min_score", 50)}')
            self.stdout.write(f'    - Default tools: {bot_config.settings.get("default_tools", [])}')
            self.stdout.write(f'    - Default categories: {bot_config.settings.get("default_categories", [])}')
            self.stdout.write(f'    - Hero display mode: {bot_config.settings.get("hero_display_mode", "video")}')

            # Run initial sync if requested
            if run_sync:
                self.stdout.write('\n🔄 Running initial sync...')
                results = RedditSyncService.sync_bot(bot_config)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ Sync complete: {results["created"]} created, '
                        f'{results["updated"]} updated, {results["errors"]} errors'
                    )
                )

                if results['errors'] > 0:
                    self.stdout.write(self.style.ERROR('\nErrors:'))
                    for error in results['error_messages']:
                        self.stdout.write(self.style.ERROR(f'  - {error}'))
            else:
                self.stdout.write('\n💡 Run sync with: python manage.py sync_reddit_bots --subreddit VEO3')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error creating bot: {e}'))
            raise
