"""Create ChatGPT Reddit bot with custom 2000 upvote minimum."""

from django.db import transaction
from django.utils.text import slugify

from core.integrations.reddit_models import RedditCommunityBot
from core.users.models import User, UserRole
from services.reddit_sync_service import RedditSyncService


def create_chatgpt_bot():
    """Create ChatGPT Reddit bot with 2000+ upvote filter."""
    subreddit = 'ChatGPT'
    bot_username = f'{slugify(subreddit)}-reddit-bot'

    with transaction.atomic():
        # Create bot user if doesn't exist
        try:
            bot_user = User.objects.get(username=bot_username)
            print(f'Bot user already exists: {bot_username}')
        except User.DoesNotExist:
            bot_user = User.objects.create(
                username=bot_username,
                email=f'{bot_username}@allthrive.ai',
                first_name=subreddit,
                last_name='Reddit Bot',
                role=UserRole.BOT,
                bio=f'Automated curation bot for r/{subreddit} - featuring top posts with 2000+ upvotes',
                avatar_url='/Reddit-logo.svg',
                is_active=True,
            )
            bot_user.set_unusable_password()
            bot_user.save()
            print(f'✅ Created bot user: {bot_username}')

        # Create bot config with custom min_score
        try:
            bot_config = RedditCommunityBot.objects.get(subreddit=subreddit)
            print(f'Bot config already exists for r/{subreddit}')
        except RedditCommunityBot.DoesNotExist:
            bot_config = RedditCommunityBot.objects.create(
                bot_user=bot_user,
                name=f'{subreddit} Reddit Bot',
                subreddit=subreddit,
                status=RedditCommunityBot.Status.ACTIVE,
                settings={
                    'feed_type': 'top',
                    'time_period': 'week',
                    'min_score': 2000,  # Custom minimum upvotes!
                    'min_comments': 5,
                    'sync_interval_minutes': 15,
                },
            )
            print(f'✅ Created bot config for r/{subreddit} with min_score=2000')

    print('\n🎉 ChatGPT Reddit bot created successfully!')
    print(f'\n  Bot username: {bot_username}')
    print(f'  Profile URL: /{bot_username}')
    print(f'  RSS feed: {bot_config.rss_feed_url}')
    print(f'  Min score filter: {bot_config.settings.get("min_score")} upvotes')
    print(f'  Status: {bot_config.status}')

    # Run initial sync
    print('\n🔄 Running initial sync...')
    results = RedditSyncService.sync_bot(bot_config)
    print(f'\n✅ Sync complete: {results["created"]} created, {results["updated"]} updated, {results["errors"]} errors')

    if results['errors'] > 0:
        print('\nErrors:')
        for error in results['error_messages']:
            print(f'  - {error}')


if __name__ == '__main__':
    create_chatgpt_bot()
