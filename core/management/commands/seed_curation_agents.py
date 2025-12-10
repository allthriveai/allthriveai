"""
Management command to seed all curation agents (Reddit, YouTube, RSS).

This creates all the standard curation bots for AllThrive AI.

Run with:
    python manage.py seed_curation_agents

Or with initial sync:
    python manage.py seed_curation_agents --sync

To seed only specific types:
    python manage.py seed_curation_agents --reddit-only
    python manage.py seed_curation_agents --youtube-only
    python manage.py seed_curation_agents --rss-only
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityAgent
from core.integrations.rss_models import RSSFeedAgent
from core.integrations.youtube_feed_models import YouTubeFeedAgent
from core.users.models import User, UserRole
from services.integrations.reddit.sync import RedditSyncService
from services.integrations.rss.sync import RSSFeedSyncService
from services.integrations.youtube_feed import YouTubeFeedSyncService

# =============================================================================
# REDDIT AGENTS CONFIGURATION
# =============================================================================
REDDIT_AGENTS = [
    {
        'subreddit': 'midjourney',
        'username': 'midjourney-reddit-agent',
        'display_name': 'Midjourney',
        'bio': 'Automated curation agent for r/midjourney - AI art generation community',
    },
    {
        'subreddit': 'ClaudeCode',
        'username': 'claude-code-reddit-agent',
        'display_name': 'Claude Code',
        'bio': 'Automated curation agent for r/ClaudeCode - Claude AI coding assistant community',
    },
    {
        'subreddit': 'GeminiNanoBanana',
        'username': 'nano-banana-reddit-agent',
        'display_name': 'Gemini Nano Banana',
        'bio': 'Automated curation agent for r/GeminiNanoBanana',
    },
]

# =============================================================================
# YOUTUBE AGENTS CONFIGURATION
# =============================================================================
YOUTUBE_AGENTS = [
    {
        'channel_url': 'https://www.youtube.com/@AIDailyBrief',
        'source_name': 'AI Daily Brief',
        'attribution': (
            'All content is owned by AI Daily Brief. '
            'Visit their YouTube channel to support them directly and stay updated on the latest AI news.'
        ),
    },
    {
        'channel_url': 'https://www.youtube.com/@LatentSpacePod',
        'source_name': 'Latent Space',
        'attribution': (
            'All content is owned by Latent Space Podcast. ' 'Visit their YouTube channel to support them directly.'
        ),
    },
]

# =============================================================================
# RSS NEWS AGENTS CONFIGURATION
# Curated feeds from https://github.com/Olshansk/rss-feeds
# Each agent has a human persona for expert-style reviews
# =============================================================================
RSS_AGENTS = [
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
        'source_name': 'Anthropic News',
        'username': 'sarah-chen',
        'first_name': 'Sarah',
        'last_name': 'Chen',
        'bio': (
            'AI industry analyst with a decade of experience covering major AI labs. '
            'I break down product launches and company announcements so you understand what actually matters. '
            'Formerly at TechCrunch and The Information.'
        ),
        'persona': {
            'voice': 'analytical',
            'expertise_areas': ['AI products', 'industry trends', 'business strategy'],
            'signature_phrases': [
                "What's actually significant here is...",
                'The business implications are clear:',
                'For teams evaluating AI tools,',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml',
        'source_name': 'Anthropic Engineering',
        'username': 'marcus-johnson',
        'first_name': 'Marcus',
        'last_name': 'Johnson',
        'bio': (
            'Staff engineer turned technical writer. 15 years building distributed systems, '
            'now I translate complex engineering decisions into practical insights. '
            'I focus on the architectural choices that matter for production systems.'
        ),
        'persona': {
            'voice': 'technical',
            'expertise_areas': ['systems architecture', 'ML infrastructure', 'production engineering'],
            'signature_phrases': [
                'The engineering trade-off here is...',
                'At scale, this becomes important because...',
                'For production systems,',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml',
        'source_name': 'Anthropic Research',
        'username': 'dr-james-okonkwo',
        'first_name': 'James',
        'last_name': 'Okonkwo',
        'bio': (
            'ML researcher specializing in interpretability and alignment. '
            'PhD from Berkeley, postdoc at MIRI. I read the papers so you get the key insights '
            'without wading through 50 pages of math. Currently independent researcher.'
        ),
        'persona': {
            'voice': 'academic',
            'expertise_areas': ['AI safety', 'mechanistic interpretability', 'alignment research'],
            'signature_phrases': [
                'The key contribution here is...',
                'What makes this paper significant:',
                'For alignment researchers,',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_red.xml',
        'source_name': 'Anthropic Red Team',
        'username': 'alex-reyes',
        'first_name': 'Alex',
        'last_name': 'Reyes',
        'bio': (
            'Security researcher focused on AI red teaming and adversarial robustness. '
            'Former pentester, now I probe AI systems for weaknesses. '
            'I highlight the security implications others miss.'
        ),
        'persona': {
            'voice': 'direct',
            'expertise_areas': ['AI security', 'red teaming', 'adversarial attacks', 'jailbreaks'],
            'signature_phrases': [
                'The security angle here:',
                'What attackers will notice is...',
                'The defensive takeaway:',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_changelog_claude_code.xml',
        'source_name': 'Claude Code Changelog',
        'username': 'priya-sharma',
        'first_name': 'Priya',
        'last_name': 'Sharma',
        'bio': (
            'Developer advocate and AI coding tools expert. '
            'I test every update so you know which features are worth adopting. '
            'Building with Claude Code daily - I share what works and what needs polish.'
        ),
        'persona': {
            'voice': 'practical',
            'expertise_areas': ['developer tools', 'AI coding assistants', 'productivity'],
            'signature_phrases': [
                'In practice, this means...',
                'The workflow improvement here:',
                'Worth trying if you...',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_openai_research.xml',
        'source_name': 'OpenAI Research',
        'username': 'dr-emily-rodriguez',
        'first_name': 'Emily',
        'last_name': 'Rodriguez',
        'bio': (
            'LLM researcher with focus on scaling laws and emergent capabilities. '
            'PhD from Stanford, former research scientist at Google Brain. '
            'I analyze what OpenAI publishes - and what they leave out.'
        ),
        'persona': {
            'voice': 'analytical',
            'expertise_areas': ['large language models', 'scaling laws', 'emergent capabilities'],
            'signature_phrases': [
                'The scaling implications are...',
                'What this reveals about GPT:',
                'Compared to previous work,',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_ollama.xml',
        'source_name': 'Ollama Blog',
        'username': 'kevin-nakamura',
        'first_name': 'Kevin',
        'last_name': 'Nakamura',
        'bio': (
            'Open source ML engineer and local AI enthusiast. '
            'I run models on everything from M1 Macs to homelab servers. '
            'Privacy-first AI is the future - I cover the tools making it possible.'
        ),
        'persona': {
            'voice': 'enthusiastic',
            'expertise_areas': ['local LLMs', 'open source AI', 'self-hosting', 'privacy'],
            'signature_phrases': [
                'For local deployment,',
                'The open source advantage here:',
                'If you value privacy,',
            ],
        },
    },
    {
        'feed_url': 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_xainews.xml',
        'source_name': 'xAI News',
        'username': 'dr-michael-torres',
        'first_name': 'Michael',
        'last_name': 'Torres',
        'bio': (
            'AGI researcher tracking frontier lab developments. '
            'PhD in cognitive science, now focused on reasoning systems and world models. '
            'I analyze xAI through the lens of their ambitious AGI goals.'
        ),
        'persona': {
            'voice': 'thoughtful',
            'expertise_areas': ['AGI', 'reasoning systems', 'Grok', 'frontier AI'],
            'signature_phrases': [
                'In the AGI race, this matters because...',
                'The reasoning capability here:',
                'Compared to other frontier labs,',
            ],
        },
    },
]


class Command(BaseCommand):
    help = 'Seed all curation agents (Reddit, YouTube, RSS)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run initial sync after creating agents',
        )
        parser.add_argument(
            '--reddit-only',
            action='store_true',
            help='Only seed Reddit agents',
        )
        parser.add_argument(
            '--youtube-only',
            action='store_true',
            help='Only seed YouTube agents',
        )
        parser.add_argument(
            '--rss-only',
            action='store_true',
            help='Only seed RSS news agents',
        )
        parser.add_argument(
            '--max-items',
            type=int,
            default=20,
            help='Maximum items to sync per agent (default: 20)',
        )

    def handle(self, *args, **options):
        run_sync = options['sync']
        reddit_only = options['reddit_only']
        youtube_only = options['youtube_only']
        rss_only = options['rss_only']
        max_items = options['max_items']

        # Determine which agents to seed
        only_flags = [reddit_only, youtube_only, rss_only]
        seed_all = not any(only_flags)

        seed_reddit = seed_all or reddit_only
        seed_youtube = seed_all or youtube_only
        seed_rss = seed_all or rss_only

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  AllThrive Curation Agents Seeder'))
        self.stdout.write(self.style.SUCCESS('=' * 60 + '\n'))

        created_agents = []
        failed_agents = []

        # Seed Reddit agents
        if seed_reddit:
            self.stdout.write(self.style.HTTP_INFO('\n📍 Reddit Agents\n'))
            for config in REDDIT_AGENTS:
                try:
                    agent = self._create_reddit_agent(config, run_sync)
                    if agent:
                        created_agents.append(f"Reddit: r/{config['subreddit']}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ❌ Failed: r/{config['subreddit']} - {e}"))
                    failed_agents.append(f"Reddit: r/{config['subreddit']}")

        # Seed YouTube agents
        if seed_youtube:
            self.stdout.write(self.style.HTTP_INFO('\n📺 YouTube Agents\n'))
            for config in YOUTUBE_AGENTS:
                try:
                    agent = self._create_youtube_agent(config, run_sync, max_items)
                    if agent:
                        created_agents.append(f"YouTube: {config['source_name']}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ❌ Failed: {config['source_name']} - {e}"))
                    failed_agents.append(f"YouTube: {config['source_name']}")

        # Seed RSS agents
        if seed_rss:
            self.stdout.write(self.style.HTTP_INFO('\n📰 RSS News Agents\n'))
            for config in RSS_AGENTS:
                try:
                    agent = self._create_rss_agent(config, run_sync, max_items)
                    if agent:
                        created_agents.append(f"RSS: {config['source_name']}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ❌ Failed: {config['source_name']} - {e}"))
                    failed_agents.append(f"RSS: {config['source_name']}")

        # Summary
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  Summary'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'\n  ✅ Created/Updated: {len(created_agents)}')
        for agent in created_agents:
            self.stdout.write(f'     - {agent}')

        if failed_agents:
            self.stdout.write(f'\n  ❌ Failed: {len(failed_agents)}')
            for agent in failed_agents:
                self.stdout.write(f'     - {agent}')

        self.stdout.write('')

        if not run_sync:
            self.stdout.write(self.style.WARNING('\n💡 To sync content, run with --sync flag'))
            self.stdout.write('   Or manually sync with:')
            self.stdout.write('     python manage.py sync_reddit_agents')
            self.stdout.write('     python manage.py sync_youtube_feed_agents')
            self.stdout.write('     python manage.py sync_rss_feed_agents\n')

    def _create_reddit_agent(self, config: dict, run_sync: bool):
        """Create a Reddit community agent."""
        subreddit = config['subreddit']
        agent_username = config['username']
        display_name = config['display_name']
        bio = config['bio']

        self.stdout.write(f'  Creating r/{subreddit}...')

        with transaction.atomic():
            # Check/create agent user
            agent_user, user_created = User.objects.get_or_create(
                username=agent_username,
                defaults={
                    'email': f'{agent_username}@allthrive.ai',
                    'first_name': display_name,
                    'last_name': 'Reddit Agent',
                    'role': UserRole.AGENT,
                    'tier': 'curation',
                    'bio': bio,
                    'avatar_url': '/Reddit-logo.svg',
                    'is_active': True,
                },
            )

            if user_created:
                agent_user.set_unusable_password()
                agent_user.save()

            # Check/create agent config
            agent_config, config_created = RedditCommunityAgent.objects.get_or_create(
                subreddit=subreddit,
                defaults={
                    'agent_user': agent_user,
                    'name': f'{display_name} Reddit Agent',
                    'status': RedditCommunityAgent.Status.ACTIVE,
                    'settings': {
                        'feed_type': 'top',
                        'time_period': 'week',
                        'min_score': 10,
                        'min_comments': 5,
                        'sync_interval_minutes': 15,
                    },
                },
            )

        status = 'created' if config_created else 'exists'
        self.stdout.write(self.style.SUCCESS(f'  ✅ r/{subreddit} ({status})'))
        self.stdout.write(f'     Profile: /{agent_username}')

        # Sync if requested
        if run_sync and config_created:
            self.stdout.write('     Syncing...')
            try:
                results = RedditSyncService.sync_agent(agent_config)
                self.stdout.write(f'     Synced: {results["created"]} created, {results["updated"]} updated')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'     Sync failed: {e}'))

        return agent_config

    def _create_youtube_agent(self, config: dict, run_sync: bool, max_items: int):
        """Create a YouTube feed agent."""
        channel_url = config['channel_url']
        source_name = config['source_name']
        attribution = config['attribution']

        agent_username = f'{slugify(source_name)}-youtube-agent'

        self.stdout.write(f'  Creating {source_name}...')

        # Resolve channel ID from URL
        if '/@' in channel_url:
            handle = channel_url.split('/@')[1].split('/')[0].split('?')[0]
            channel_info = YouTubeFeedSyncService.resolve_channel_id_from_handle(f'@{handle}')

            if not channel_info:
                self.stdout.write(self.style.WARNING(f'  ⚠️  Could not resolve channel: {channel_url}'))
                self.stdout.write('     Is YOUTUBE_API_KEY configured?')
                return None

            channel_id = channel_info['channel_id']
            channel_name = channel_info['channel_name']
        else:
            self.stdout.write(self.style.ERROR(f'  ❌ Unsupported URL format: {channel_url}'))
            return None

        with transaction.atomic():
            # Check/create agent user
            agent_user, user_created = User.objects.get_or_create(
                username=agent_username,
                defaults={
                    'email': f'{agent_username}@allthrive.ai',
                    'first_name': source_name,
                    'last_name': '',
                    'role': UserRole.AGENT,
                    'tier': 'curation',
                    'bio': f'Automated curation agent for {source_name} YouTube channel. {attribution}',
                    'avatar_url': '/youtube-icon.svg',
                    'is_active': True,
                },
            )

            if user_created:
                agent_user.set_unusable_password()
                agent_user.save()

            # Check/create agent config
            agent_config, config_created = YouTubeFeedAgent.objects.get_or_create(
                channel_id=channel_id,
                defaults={
                    'agent_user': agent_user,
                    'name': f'{source_name} YouTube Agent',
                    'channel_url': channel_url,
                    'channel_name': channel_name,
                    'attribution_text': attribution,
                    'status': YouTubeFeedAgent.Status.ACTIVE,
                    'settings': {
                        'sync_interval_minutes': 120,
                        'max_videos': max_items,
                    },
                },
            )

        status = 'created' if config_created else 'exists'
        self.stdout.write(self.style.SUCCESS(f'  ✅ {source_name} ({status})'))
        self.stdout.write(f'     Profile: /{agent_username}')
        self.stdout.write(f'     Channel: {channel_name}')

        # Sync if requested
        if run_sync and config_created:
            self.stdout.write('     Syncing...')
            try:
                results = YouTubeFeedSyncService.sync_agent(agent_config)
                self.stdout.write(f'     Synced: {results["created"]} created, {results["updated"]} updated')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'     Sync failed: {e}'))

        return agent_config

    def _create_rss_agent(self, config: dict, run_sync: bool, max_items: int):
        """Create an RSS feed agent with human persona."""
        feed_url = config['feed_url']
        source_name = config['source_name']
        agent_username = config['username']
        first_name = config.get('first_name', source_name)
        last_name = config.get('last_name', '')
        bio = config['bio']
        persona = config.get('persona', {})

        self.stdout.write(f'  Creating {first_name} {last_name} ({source_name})...')

        with transaction.atomic():
            # Check/create agent user with human persona
            agent_user, user_created = User.objects.get_or_create(
                username=agent_username,
                defaults={
                    'email': f'{agent_username}@allthrive.ai',
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': UserRole.AGENT,
                    'tier': 'curation',
                    'bio': bio,
                    'is_active': True,
                },
            )

            if user_created:
                agent_user.set_unusable_password()
                agent_user.save()

            # Build settings with persona config
            agent_settings = {
                'sync_interval_minutes': 60,
                'max_items': max_items,
                'source_name': source_name,  # Store original source for attribution
            }
            if persona:
                agent_settings['persona'] = persona

            # Check/create agent config
            agent_config, config_created = RSSFeedAgent.objects.get_or_create(
                feed_url=feed_url,
                defaults={
                    'agent_user': agent_user,
                    'name': f'{source_name} RSS Agent',
                    'source_name': source_name,
                    'status': RSSFeedAgent.Status.ACTIVE,
                    'settings': agent_settings,
                },
            )

        status = 'created' if config_created else 'exists'
        self.stdout.write(self.style.SUCCESS(f'  ✅ {source_name} ({status})'))
        self.stdout.write(f'     Profile: /{agent_username}')
        self.stdout.write(f'     Feed: {feed_url[:60]}...')

        # Sync if requested
        if run_sync and config_created:
            self.stdout.write('     Syncing...')
            try:
                results = RSSFeedSyncService.sync_agent(agent_config)
                self.stdout.write(f'     Synced: {results["created"]} created, {results["updated"]} updated')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'     Sync failed: {e}'))

        return agent_config
