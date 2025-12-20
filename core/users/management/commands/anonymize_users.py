"""Management command to anonymize user PII after pulling production database."""

import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.users.models import UserRole

User = get_user_model()

# Random data for anonymization (reused from create_test_users.py patterns)
FIRST_NAMES = [
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
    'Skyler', 'Charlie', 'Dakota', 'Reese', 'Finley', 'Sage', 'River', 'Phoenix',
    'Emerson', 'Parker', 'Blake', 'Cameron', 'Drew', 'Jamie', 'Kendall', 'Logan',
    'Peyton', 'Sydney', 'Micah', 'Eden', 'Hayden', 'Rowan',
]

LAST_NAMES = [
    'Chen', 'Patel', 'Kim', 'Singh', 'Lee', 'Garcia', 'Martinez', 'Johnson',
    'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson',
    'Thompson', 'White', 'Harris', 'Martin', 'Robinson', 'Clark', 'Lewis',
    'Walker', 'Hall', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Green',
]

AVATAR_STYLES = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'big-ears', 'big-smile',
    'bottts', 'croodles', 'fun-emoji', 'lorelei', 'micah', 'miniavs',
    'notionists', 'open-peeps', 'personas', 'pixel-art', 'thumbs',
]


class Command(BaseCommand):
    help = 'Anonymize user PII after pulling production database for local development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Actually perform anonymization (dry-run by default)',
        )
        parser.add_argument(
            '--preserve-staff',
            action='store_true',
            help='Do not anonymize staff or superuser accounts',
        )
        parser.add_argument(
            '--preserve-agents',
            action='store_true',
            help='Do not anonymize agent role users (bots like Pip)',
        )
        parser.add_argument(
            '--preserve-username',
            action='append',
            dest='preserve_usernames',
            default=[],
            help='Specific username(s) to preserve (can be used multiple times)',
        )

    def handle(self, *args, **options):
        confirm = options['confirm']
        preserve_staff = options['preserve_staff']
        preserve_agents = options['preserve_agents']
        preserve_usernames = [u.lower() for u in options['preserve_usernames']]

        # Build exclusion queryset
        users_to_anonymize = User.objects.all()

        excluded_reasons = []

        if preserve_staff:
            staff_count = users_to_anonymize.filter(is_staff=True).count()
            superuser_count = users_to_anonymize.filter(is_superuser=True).count()
            users_to_anonymize = users_to_anonymize.filter(is_staff=False, is_superuser=False)
            excluded_reasons.append(f'{staff_count} staff, {superuser_count} superusers')

        if preserve_agents:
            agent_count = users_to_anonymize.filter(role=UserRole.AGENT).count()
            users_to_anonymize = users_to_anonymize.exclude(role=UserRole.AGENT)
            excluded_reasons.append(f'{agent_count} agents')

        if preserve_usernames:
            username_count = users_to_anonymize.filter(username__in=preserve_usernames).count()
            users_to_anonymize = users_to_anonymize.exclude(username__in=preserve_usernames)
            excluded_reasons.append(f'{username_count} specified usernames: {", ".join(preserve_usernames)}')

        total_users = User.objects.count()
        to_anonymize_count = users_to_anonymize.count()

        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=== User Anonymization ==='))
        self.stdout.write(f'Total users in database: {total_users}')
        self.stdout.write(f'Users to anonymize: {to_anonymize_count}')

        if excluded_reasons:
            self.stdout.write(f'Preserved (excluded): {"; ".join(excluded_reasons)}')

        self.stdout.write('')

        if not confirm:
            self.stdout.write(self.style.NOTICE('DRY RUN - No changes will be made.'))
            self.stdout.write('Run with --confirm to actually anonymize users.')
            self.stdout.write('')

            # Show sample of what would be anonymized
            sample_users = users_to_anonymize[:5]
            if sample_users:
                self.stdout.write('Sample users that would be anonymized:')
                for user in sample_users:
                    self.stdout.write(f'  - @{user.username} ({user.email})')
            return

        if to_anonymize_count == 0:
            self.stdout.write(self.style.SUCCESS('No users to anonymize.'))
            return

        # Perform anonymization in a transaction
        self.stdout.write('Anonymizing users...')

        with transaction.atomic():
            anonymized_count = 0

            for user in users_to_anonymize.iterator():
                self._anonymize_user(user)
                anonymized_count += 1

                if anonymized_count % 100 == 0:
                    self.stdout.write(f'  Processed {anonymized_count}/{to_anonymize_count}...')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Successfully anonymized {anonymized_count} users.'))
        self.stdout.write('')
        self.stdout.write('Anonymized fields:')
        self.stdout.write('  - email -> user_{id}@localhost.test')
        self.stdout.write('  - first_name, last_name -> random names')
        self.stdout.write('  - phone_number -> cleared')
        self.stdout.write('  - bio, tagline, location -> generic placeholders')
        self.stdout.write('  - avatar_url -> DiceBear generated')
        self.stdout.write('  - All social URLs -> cleared')
        self.stdout.write('')

    def _anonymize_user(self, user):
        """Anonymize a single user's PII fields."""
        # Generate random replacement data
        first_name = secrets.choice(FIRST_NAMES)
        last_name = secrets.choice(LAST_NAMES)
        avatar_style = secrets.choice(AVATAR_STYLES)

        # Anonymize email (use user ID to ensure uniqueness)
        user.email = f'user_{user.id}@localhost.test'

        # Anonymize name
        user.first_name = first_name
        user.last_name = last_name

        # Clear phone
        user.phone_number = ''
        user.phone_verified = False
        user.phone_verified_at = None

        # Generic bio/tagline
        user.bio = 'AllThrive community member'
        user.tagline = ''
        user.location = ''
        user.pronouns = ''
        user.current_status = ''

        # Generate new avatar
        user.avatar_url = f'https://api.dicebear.com/7.x/{avatar_style}/svg?seed=user{user.id}'

        # Clear all social URLs
        user.website_url = None
        user.calendar_url = None
        user.linkedin_url = None
        user.twitter_url = None
        user.github_url = None
        user.youtube_url = None
        user.instagram_url = None

        # Clear guest token if present
        user.guest_token = ''

        user.save()
