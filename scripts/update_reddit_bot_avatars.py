"""Update existing Reddit bot users to use the Reddit logo avatar."""

from core.users.models import User, UserRole


def update_reddit_bot_avatars():
    """Update all Reddit bot users to use the Reddit logo as their avatar."""
    reddit_bots = User.objects.filter(role=UserRole.BOT, username__icontains='reddit-bot')

    updated_count = 0
    for bot in reddit_bots:
        if bot.avatar_url != '/Reddit-logo.svg':
            bot.avatar_url = '/Reddit-logo.svg'
            bot.save()
            updated_count += 1
            print(f'✅ Updated avatar for {bot.username}')
        else:
            print(f'⏭️  {bot.username} already has Reddit logo')

    print(f'\n✨ Updated {updated_count} Reddit bot avatars')


if __name__ == '__main__':
    update_reddit_bot_avatars()
