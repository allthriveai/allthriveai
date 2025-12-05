"""Enable PostgreSQL pg_trgm extension for fuzzy text search."""

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Enable pg_trgm extension for trigram similarity search."""

    dependencies = [
        ('users', '0010_user_allow_sms_invitations_and_more'),
    ]

    operations = [
        TrigramExtension(),
    ]
