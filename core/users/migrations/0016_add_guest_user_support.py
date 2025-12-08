"""Add guest user support for battle invitations."""

from django.db import migrations, models


class Migration(migrations.Migration):
    """Add is_guest and guest_token fields for temporary battle participants."""

    dependencies = [
        ('users', '0015_user_lifetime_battles_participated_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_guest',
            field=models.BooleanField(
                default=False,
                db_index=True,
                help_text='Temporary guest user created for battle invitation. Can be converted to full account.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='guest_token',
            field=models.CharField(
                max_length=64,
                blank=True,
                db_index=True,
                help_text='Unique token for guest user session authentication',
            ),
        ),
    ]
