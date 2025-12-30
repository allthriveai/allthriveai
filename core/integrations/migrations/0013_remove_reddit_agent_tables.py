# Generated manually to remove Reddit auto-sync agent tables

from django.db import migrations


class Migration(migrations.Migration):
    """Remove Reddit auto-sync agent models.

    This migration removes:
    - DeletedRedditThread (tracking of rejected threads)
    - RedditThread (synced Reddit posts)
    - RedditCommunityAgent (agent configuration)

    Note: Reddit URL import functionality (in services/url_import/scraper.py)
    is preserved for manual project imports.
    """

    dependencies = [
        ('integrations', '0012_githubappinstallation'),
    ]

    operations = [
        migrations.DeleteModel(name='DeletedRedditThread'),
        migrations.DeleteModel(name='RedditThread'),
        migrations.DeleteModel(name='RedditCommunityAgent'),
    ]
