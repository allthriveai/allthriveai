"""Management command to create fake test users for admin impersonation."""

import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()

# Username format styles
USERNAME_STYLES = [
    'firstname_lastname',  # alex_chen
    'firstnamelastname',  # alexchen
    'firstname.lastname',  # alex.chen
    'firstinitial_lastname',  # a_chen
    'firstname_lastinitial',  # alex_c
]

# Sample data for generating realistic fake users
FIRST_NAMES = [
    'Alex',
    'Jordan',
    'Taylor',
    'Morgan',
    'Casey',
    'Riley',
    'Quinn',
    'Avery',
    'Skyler',
    'Charlie',
    'Dakota',
    'Reese',
    'Finley',
    'Sage',
    'River',
    'Phoenix',
    'Emerson',
    'Parker',
    'Blake',
    'Cameron',
    'Drew',
    'Jamie',
    'Kendall',
    'Logan',
    'Peyton',
    'Sydney',
    'Micah',
    'Eden',
    'Hayden',
    'Rowan',
]

LAST_NAMES = [
    'Chen',
    'Patel',
    'Kim',
    'Singh',
    'Lee',
    'Garcia',
    'Martinez',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Miller',
    'Davis',
    'Wilson',
    'Anderson',
    'Thompson',
    'White',
    'Harris',
    'Martin',
    'Robinson',
    'Clark',
    'Lewis',
    'Walker',
    'Hall',
    'Young',
    'Allen',
    'King',
    'Wright',
    'Scott',
    'Green',
]

TAGLINES = [
    'Full-stack developer passionate about AI',
    'UX Designer turning ideas into reality',
    'Data scientist exploring machine learning',
    'Product manager building the future',
    'Frontend engineer crafting beautiful UIs',
    'Backend developer scaling systems',
    'DevOps engineer automating everything',
    'Mobile developer creating apps people love',
    'Founder & startup enthusiast',
    'Student learning to code',
    'Career changer exploring tech',
    'Freelancer open to opportunities',
    'Tech lead mentoring the next generation',
    'AI researcher pushing boundaries',
    'Creative technologist blending art & code',
]

LOCATIONS = [
    'San Francisco, CA',
    'New York, NY',
    'Austin, TX',
    'Seattle, WA',
    'Los Angeles, CA',
    'Chicago, IL',
    'Boston, MA',
    'Denver, CO',
    'Portland, OR',
    'Atlanta, GA',
    'Miami, FL',
    'Remote',
    'London, UK',
    'Toronto, Canada',
    'Berlin, Germany',
    'Singapore',
    'Sydney, Australia',
]

BIOS = [
    "I'm passionate about building products that make a difference. "
    'Currently exploring the intersection of AI and human creativity.',
    'Software engineer by day, aspiring entrepreneur by night. Love collaborating on interesting problems.',
    'Started coding 2 years ago, now building full-stack applications. Always excited to learn something new!',
    "Design-focused developer who believes in the power of great UX. Let's create something beautiful together.",
    'Former teacher turned developer. I bring empathy and patience to everything I build.',
    '10+ years in tech, still learning every day. Mentoring is my way of giving back.',
    'Bootcamp grad proving that career change is possible at any age. If I can do it, so can you!',
    'Building AI tools that augment human capabilities, not replace them.',
    'Open source contributor and community builder. The best code is the code we write together.',
    'Startup founder learning in public. Follow my journey!',
]

ROLES = [
    UserRole.EXPLORER,
    UserRole.EXPLORER,
    UserRole.EXPLORER,
    UserRole.LEARNER,
    UserRole.LEARNER,
    UserRole.CREATOR,
]

AVATAR_STYLES = [
    'adventurer',
    'adventurer-neutral',
    'avataaars',
    'big-ears',
    'big-smile',
    'bottts',
    'croodles',
    'fun-emoji',
    'icons',
    'identicon',
    'lorelei',
    'micah',
    'miniavs',
    'notionists',
    'open-peeps',
    'personas',
    'pixel-art',
    'thumbs',
]


class Command(BaseCommand):
    help = 'Create fake test users that admins can impersonate'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=10,
            help='Number of fake users to create (default: 10)',
        )
        parser.add_argument(
            '--delete-existing',
            action='store_true',
            help='Delete existing test users before creating new ones',
        )
        parser.add_argument(
            '--delete-beta',
            action='store_true',
            help='Delete old beta_ prefixed users',
        )

    def _generate_username(self, first_name: str, last_name: str) -> str:
        """Generate a realistic-looking username."""
        style = secrets.choice(USERNAME_STYLES)
        fn = first_name.lower()
        ln = last_name.lower()

        if style == 'firstname_lastname':
            return f'{fn}_{ln}'
        elif style == 'firstnamelastname':
            return f'{fn}{ln}'
        elif style == 'firstname.lastname':
            return f'{fn}.{ln}'
        elif style == 'firstinitial_lastname':
            return f'{fn[0]}_{ln}'
        elif style == 'firstname_lastinitial':
            return f'{fn}_{ln[0]}'
        else:
            return f'{fn}_{ln}'

    def _get_unique_username(self, first_name: str, last_name: str) -> str:
        """Generate a unique username, adding a number suffix if needed."""
        base_username = self._generate_username(first_name, last_name)
        username = base_username

        # If username exists, add incrementing number
        counter = 1
        while User.objects.filter(username=username).exists():
            counter += 1
            username = f'{base_username}{counter}'
            if counter > 100:  # Safety limit
                # Fallback to guaranteed unique
                username = f'{base_username}_{secrets.token_hex(3)}'
                break

        return username

    def handle(self, *args, **options):
        count = options['count']
        delete_existing = options['delete_existing']
        delete_beta = options['delete_beta']

        # Delete old beta_ prefixed users if requested
        if delete_beta:
            deleted, _ = User.objects.filter(username__startswith='beta_').delete()
            self.stdout.write(self.style.WARNING(f'Deleted {deleted} old beta_ prefixed users'))

        # Delete test users created by this command (have @test.allthrive.ai email)
        if delete_existing:
            deleted, _ = User.objects.filter(email__endswith='@test.allthrive.ai').delete()
            self.stdout.write(self.style.WARNING(f'Deleted {deleted} existing test users'))

        created_users = []

        for i in range(1, count + 1):
            first_name = secrets.choice(FIRST_NAMES)
            last_name = secrets.choice(LAST_NAMES)
            username = self._get_unique_username(first_name, last_name)
            email = f'{username}@test.allthrive.ai'

            # Check if user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(self.style.WARNING(f'User {username} already exists, skipping'))
                continue

            # Generate a random avatar using DiceBear
            avatar_style = secrets.choice(AVATAR_STYLES)
            seed = f'{first_name}{last_name}{i}'
            avatar_url = f'https://api.dicebear.com/7.x/{avatar_style}/svg?seed={seed}'

            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                role=secrets.choice(ROLES),
                avatar_url=avatar_url,
                bio=secrets.choice(BIOS),
                tagline=secrets.choice(TAGLINES),
                location=secrets.choice(LOCATIONS),
                pronouns=secrets.choice(['she/her', 'he/him', 'they/them', '']),
                current_status=secrets.choice(
                    [
                        'Open to collaboration',
                        'Building something cool',
                        'Learning AI/ML',
                        'Looking for co-founders',
                        '',
                    ]
                ),
                playground_is_public=True,
                is_profile_public=True,
            )

            # Set an unusable password (these are for impersonation only)
            user.set_unusable_password()
            user.save()

            created_users.append(user)
            self.stdout.write(self.style.SUCCESS(f'Created user: {username} ({first_name} {last_name})'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Successfully created {len(created_users)} test users'))
        self.stdout.write('')
        self.stdout.write('To impersonate these users:')
        self.stdout.write('  1. Log in as an admin')
        self.stdout.write('  2. Go to /admin/impersonate and select a user')
        self.stdout.write('  3. Click "Stop" in the banner to return to your admin account')
        self.stdout.write('')
        self.stdout.write('Created users:')
        for user in created_users:
            self.stdout.write(f'  - @{user.username} ({user.first_name} {user.last_name})')
