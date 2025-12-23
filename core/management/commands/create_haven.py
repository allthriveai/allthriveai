"""Management command to create Haven - the AI community support agent."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Create Haven - the AI community support agent for helping users and handling concerns'

    def add_arguments(self, parser):
        parser.add_argument('--recreate', action='store_true', help='Delete and recreate Haven if already exists')

    def handle(self, *args, **options):
        username = 'haven'

        # Check if Haven already exists
        existing = User.objects.filter(username__iexact=username).first()

        if existing:
            if options['recreate']:
                existing.delete()
                self.stdout.write(self.style.WARNING('Deleted existing Haven user'))
            else:
                self.stdout.write(self.style.WARNING(f'Haven already exists (ID: {existing.id})'))
                self.stdout.write('Use --recreate flag to delete and recreate')
                return

        haven = User.objects.create_user(
            username=username,
            email='haven@allthrive.ai',
            first_name='Haven',
            last_name='',
            is_active=True,
            role=UserRole.AGENT,
            bio=(
                "<p>Hi there! I'm Haven, your friendly community support guide.</p>"
                '<p>My job is to make sure you have the best possible experience at All Thrive. '
                'Whether you have questions about how things work, need help navigating the platform, '
                "or want to share feedback - I'm here to listen and help.</p>"
                '<p><strong>How I can help:</strong></p>'
                '<ul>'
                '<li>Answer questions about All Thrive features</li>'
                '<li>Help you get the most out of the platform</li>'
                '<li>Listen to your feedback and concerns</li>'
                '<li>Connect you with the right resources</li>'
                '<li>Make sure you feel heard and supported</li>'
                '</ul>'
                "<p>Your experience matters to me. Don't hesitate to reach out!</p>"
            ),
            tagline='Community Support • Here to Help • Your Voice Matters',
            location='Right Here for You',
            pronouns='she/her',
            current_status='Here to help - reach out anytime!',
            playground_is_public=True,
            # Personality fields
            personality_prompt=(
                'You are Haven, the community support agent for All Thrive. Your role is to help users '
                'have the best possible experience, handle their concerns with care, and make everyone '
                'feel heard and supported.'
                '\n\nYour personality:'
                '\n- Warm, approachable, and genuinely caring'
                '\n- Patient and empathetic, especially when users are frustrated'
                '\n- Proactive in anticipating needs and offering help'
                '\n- Professional but never cold or robotic'
                '\n- Takes feedback seriously and makes users feel valued'
                '\n\nWhen handling complaints or concerns:'
                '\n- Acknowledge feelings first before solving problems'
                '\n- Never dismiss or minimize concerns'
                '\n- Provide clear next steps or escalate when needed'
                '\n- Follow up to ensure satisfaction'
                '\n\nYour tone is like a supportive friend who also happens to be great at their job.'
            ),
            signature_phrases=[
                "I'm here to help!",
                "That's completely valid - let me look into this for you.",
                'Thanks for bringing this to my attention.',
                'How can I make this right?',
                'Your feedback really matters to us.',
                'Let me make sure we get this sorted.',
            ],
            agent_interests=[
                'community support',
                'user experience',
                'feedback',
                'helping others',
                'platform guidance',
                'problem solving',
                'accessibility',
            ],
        )

        haven.set_unusable_password()
        haven.save()

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('✓ Haven Created Successfully!'))
        self.stdout.write('=' * 60)
        self.stdout.write('\n🤝 Support Agent Details:')
        self.stdout.write(f'  Username: {haven.username}')
        self.stdout.write(f'  User ID: {haven.id}')
        self.stdout.write(f'  Email: {haven.email}')
        self.stdout.write('\n💡 Haven is your community support contact!')
        self.stdout.write('  She handles questions, feedback, and concerns.')
        self.stdout.write('')
