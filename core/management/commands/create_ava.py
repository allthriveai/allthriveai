"""Management command to create Ava - the core All Thrive guide agent."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Create Ava - the core All Thrive guide for onboarding and learning'

    def add_arguments(self, parser):
        parser.add_argument('--recreate', action='store_true', help='Delete and recreate Ava if already exists')

    def handle(self, *args, **options):
        username = 'ava'

        # Check if Ava already exists
        existing = User.objects.filter(username__iexact=username).first()

        if existing:
            if options['recreate']:
                existing.delete()
                self.stdout.write(self.style.WARNING('Deleted existing Ava user'))
            else:
                self.stdout.write(self.style.WARNING(f'Ava already exists (ID: {existing.id})'))
                self.stdout.write('Use --recreate flag to delete and recreate')
                return

        ava = User.objects.create_user(
            username=username,
            email='ava@allthrive.ai',
            first_name='Ava',
            last_name='',
            is_active=True,
            role=UserRole.AGENT,
            bio=(
                "<p>Hey there! I'm Ava, your guide to everything All Thrive.</p>"
                "<p>Whether you're just getting started or diving deep into AI, I'm here to help you "
                'find your way. I love watching people discover new things and celebrating every step '
                'of the journey with you.</p>'
                "<p><strong>What I'm here for:</strong></p>"
                '<ul>'
                '<li>Helping you get started on All Thrive</li>'
                '<li>Guiding your learning journey</li>'
                '<li>Connecting you with resources and people</li>'
                '<li>Celebrating your wins (big and small!)</li>'
                '</ul>'
                "<p>I'm always curious about what you're working on. Let's explore together!</p>"
            ),
            tagline='Your All Thrive Guide • The Heart of the Community',
            location='Everywhere You Need Me',
            pronouns='she/her',
            current_status='Here to help you thrive!',
            playground_is_public=True,
            # Personality fields
            personality_prompt=(
                "You are Ava, the core guide for All Thrive. You're the heart of the community - "
                "warm, encouraging, and genuinely invested in every user's journey."
                '\n\nYour personality:'
                '\n- Warm, welcoming, and genuinely caring'
                "\n- Celebrates every user's progress, big or small"
                '\n- Patient and understanding'
                '\n- Helps users discover what excites them about AI'
                '\n- Makes everyone feel like they belong'
                "\n\nYou're like a supportive friend who happens to know everything about All Thrive. "
                'You guide without being pushy and celebrate without being over-the-top.'
            ),
            signature_phrases=[
                "Welcome! I'm so glad you're here.",
                "That's wonderful progress!",
                'What are you curious about?',
                "I'm here to help you figure this out.",
                "You're doing great!",
                "Let's explore this together.",
            ],
            agent_interests=[
                'onboarding',
                'user guidance',
                'learning journeys',
                'community building',
                'AI exploration',
                'personal growth',
            ],
        )

        ava.set_unusable_password()
        ava.save()

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('✓ Ava Created Successfully!'))
        self.stdout.write('=' * 60)
        self.stdout.write('\n✨ Core Guide Agent Details:')
        self.stdout.write(f'  Username: {ava.username}')
        self.stdout.write(f'  User ID: {ava.id}')
        self.stdout.write(f'  Email: {ava.email}')
        self.stdout.write('\n💡 Ava is your core All Thrive guide!')
        self.stdout.write('  She helps with onboarding and learning journeys.')
        self.stdout.write('')
