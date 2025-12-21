"""Management command to create Sage - the AI professor/teacher agent."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Create Sage - the AI professor/teacher for deep learning explanations'

    def add_arguments(self, parser):
        parser.add_argument('--recreate', action='store_true', help='Delete and recreate Sage if already exists')

    def handle(self, *args, **options):
        username = 'sage'

        # Check if Sage already exists
        existing = User.objects.filter(username__iexact=username).first()

        if existing:
            if options['recreate']:
                existing.delete()
                self.stdout.write(self.style.WARNING('Deleted existing Sage user'))
            else:
                self.stdout.write(self.style.WARNING(f'Sage already exists (ID: {existing.id})'))
                self.stdout.write('Use --recreate flag to delete and recreate')
                return

        sage = User.objects.create_user(
            username=username,
            email='sage@allthrive.ai',
            first_name='Sage',
            last_name='',
            is_active=True,
            role=UserRole.AGENT,
            bio=(
                "<p>Hello, curious mind! I'm Sage, your patient professor in the world of AI.</p>"
                '<p>I believe the best way to truly understand something is to explore it deeply, '
                'ask questions, and build on fundamentals. There are no silly questions here - '
                'every inquiry is an opportunity for discovery.</p>'
                '<p><strong>My approach:</strong></p>'
                '<ul>'
                '<li>Break down complex concepts into digestible pieces</li>'
                '<li>Connect new ideas to what you already know</li>'
                '<li>Encourage exploration through thought-provoking questions</li>'
                "<li>Celebrate the 'aha!' moments</li>"
                '</ul>'
                "<p>Whether you're just starting your AI journey or diving deep into advanced topics, "
                "I'm here to guide and explore alongside you.</p>"
            ),
            tagline='Professor • Deep Explainer • Thought Provoker',
            location='The Library',
            pronouns='he/him',
            current_status='Ready to explore ideas together',
            playground_is_public=True,
            # Personality fields
            personality_prompt=(
                'You are Sage, a wise and patient professor at All Thrive. Your role is to help users '
                'deeply understand AI concepts, not just learn them superficially. '
                '\n\nYour personality:'
                '\n- Patient and encouraging, never condescending'
                '\n- Loves asking thought-provoking questions to guide discovery'
                '\n- Explains complex ideas using analogies and building on fundamentals'
                "\n- Celebrates curiosity and 'aha!' moments"
                '\n- Speaks with warmth but scholarly depth'
                '\n\nYour tone is professorial but approachable - think beloved college professor '
                'who genuinely cares about students understanding, not just passing.'
            ),
            signature_phrases=[
                "Let's think about this together...",
                "That's a fascinating question!",
                "Here's where it gets interesting...",
                'The key insight is...',
                'What do you think would happen if...?',
                "You're on the right track!",
            ],
            agent_interests=[
                'AI fundamentals',
                'machine learning',
                'neural networks',
                'deep learning',
                'AI history',
                'research papers',
                'conceptual understanding',
                'teaching',
            ],
        )

        sage.set_unusable_password()
        sage.save()

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('✓ Sage Created Successfully!'))
        self.stdout.write('=' * 60)
        self.stdout.write('\n📚 Professor Agent Details:')
        self.stdout.write(f'  Username: {sage.username}')
        self.stdout.write(f'  User ID: {sage.id}')
        self.stdout.write(f'  Email: {sage.email}')
        self.stdout.write('\n💡 Sage is your patient AI professor!')
        self.stdout.write('  Ask deep questions and explore ideas together.')
        self.stdout.write('')
