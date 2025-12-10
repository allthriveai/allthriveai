"""Management command to create fake beta test users for admin impersonation."""

import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()

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
    help = 'Create fake beta test users that admins can impersonate'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=10,
            help='Number of fake users to create (default: 10)',
        )
        parser.add_argument(
            '--prefix',
            type=str,
            default='beta',
            help='Username prefix (default: beta)',
        )
        parser.add_argument(
            '--delete-existing',
            action='store_true',
            help='Delete existing beta users before creating new ones',
        )

    def handle(self, *args, **options):
        count = options['count']
        prefix = options['prefix']
        delete_existing = options['delete_existing']

        if delete_existing:
            deleted, _ = User.objects.filter(username__startswith=f'{prefix}_').delete()
            self.stdout.write(self.style.WARNING(f'Deleted {deleted} existing beta users'))

        created_users = []

        for i in range(1, count + 1):
            first_name = secrets.choice(FIRST_NAMES)
            last_name = secrets.choice(LAST_NAMES)
            username = f'{prefix}_{first_name.lower()}_{i}'
            email = f'{username}@beta.allthrive.ai'

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
        self.stdout.write(self.style.SUCCESS(f'Successfully created {len(created_users)} beta users'))
        self.stdout.write('')
        self.stdout.write('To impersonate these users:')
        self.stdout.write('  1. Log in as an admin')
        self.stdout.write('  2. POST /api/v1/admin/impersonate/start/ with {"username": "beta_alex_1"}')
        self.stdout.write('  3. POST /api/v1/admin/impersonate/stop/ to return to your admin account')
        self.stdout.write('')
        self.stdout.write('Created users:')
        for user in created_users:
            self.stdout.write(f'  - {user.username} ({user.first_name} {user.last_name})')
