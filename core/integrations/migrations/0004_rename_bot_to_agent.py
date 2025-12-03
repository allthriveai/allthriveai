# Generated manually for bot -> agent rename

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def rename_bot_to_agent_in_usernames(apps, schema_editor):
    """Rename bot usernames from *-reddit-bot to *-reddit-agent."""
    User = apps.get_model('users', 'User')

    # Update usernames
    for user in User.objects.filter(username__endswith='-reddit-bot'):
        old_username = user.username
        new_username = old_username.replace('-reddit-bot', '-reddit-agent')
        user.username = new_username

        # Update bio if it mentions "bot"
        if user.bio and 'bot' in user.bio.lower():
            user.bio = user.bio.replace('bot', 'agent').replace('Bot', 'Agent')

        # Update last_name if it's "Reddit Bot"
        if user.last_name == 'Reddit Bot':
            user.last_name = 'Reddit Agent'

        user.save()
        print(f'  Renamed user: {old_username} -> {new_username}')


def rename_agent_to_bot_in_usernames(apps, schema_editor):
    """Reverse: rename agent usernames from *-reddit-agent to *-reddit-bot."""
    User = apps.get_model('users', 'User')

    for user in User.objects.filter(username__endswith='-reddit-agent'):
        old_username = user.username
        new_username = old_username.replace('-reddit-agent', '-reddit-bot')
        user.username = new_username

        if user.bio and 'agent' in user.bio.lower():
            user.bio = user.bio.replace('agent', 'bot').replace('Agent', 'Bot')

        if user.last_name == 'Reddit Agent':
            user.last_name = 'Reddit Bot'

        user.save()


def update_user_role_bot_to_agent(apps, schema_editor):
    """Update role='bot' to role='agent' for all bot users."""
    User = apps.get_model('users', 'User')
    updated = User.objects.filter(role='bot').update(role='agent')
    print(f'  Updated {updated} users from role=bot to role=agent')


def update_user_role_agent_to_bot(apps, schema_editor):
    """Reverse: update role='agent' to role='bot'."""
    User = apps.get_model('users', 'User')
    User.objects.filter(role='agent').update(role='bot')


def update_agent_names(apps, schema_editor):
    """Update RedditCommunityAgent names from 'Bot' to 'Agent'."""
    # Access the model using the NEW name after table rename
    RedditCommunityAgent = apps.get_model('integrations', 'RedditCommunityAgent')

    for agent in RedditCommunityAgent.objects.all():
        if 'Bot' in agent.name:
            old_name = agent.name
            agent.name = agent.name.replace('Bot', 'Agent')
            agent.save()
            print(f'  Renamed agent: {old_name} -> {agent.name}')


def update_agent_names_reverse(apps, schema_editor):
    """Reverse: update names from 'Agent' back to 'Bot'."""
    RedditCommunityBot = apps.get_model('integrations', 'RedditCommunityBot')

    for bot in RedditCommunityBot.objects.all():
        if 'Agent' in bot.name:
            bot.name = bot.name.replace('Agent', 'Bot')
            bot.save()


class Migration(migrations.Migration):
    dependencies = [
        ('integrations', '0003_add_reddit_moderation_fields'),
        ('users', '0004_add_similarity_matching_consent'),  # Latest users migration
    ]

    operations = [
        # 1. Rename the table first
        migrations.AlterModelTable(
            name='redditcommunitybot',
            table='reddit_community_agents',
        ),
        # 2. Rename the model
        migrations.RenameModel(
            old_name='RedditCommunityBot',
            new_name='RedditCommunityAgent',
        ),
        # 3. Rename the field on RedditCommunityAgent (bot_user -> agent_user)
        migrations.RenameField(
            model_name='redditcommunityagent',
            old_name='bot_user',
            new_name='agent_user',
        ),
        # 4. Rename the FK field on RedditThread (bot -> agent)
        migrations.RenameField(
            model_name='redditthread',
            old_name='bot',
            new_name='agent',
        ),
        # 5. Update user roles from 'bot' to 'agent'
        migrations.RunPython(
            update_user_role_bot_to_agent,
            update_user_role_agent_to_bot,
        ),
        # 6. Rename usernames from *-reddit-bot to *-reddit-agent
        migrations.RunPython(
            rename_bot_to_agent_in_usernames,
            rename_agent_to_bot_in_usernames,
        ),
        # 7. Update agent display names
        migrations.RunPython(
            update_agent_names,
            update_agent_names_reverse,
        ),
        # 8. Update related_name on agent_user field
        migrations.AlterField(
            model_name='redditcommunityagent',
            name='agent_user',
            field=models.OneToOneField(
                help_text='Agent user account (role=AGENT) that owns the projects',
                limit_choices_to={'role': 'agent'},
                on_delete=django.db.models.deletion.CASCADE,
                related_name='reddit_agent_config',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
