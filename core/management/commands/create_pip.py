"""Management command to create Pip - the AI battle agent user."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.users.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = "Create Pip - the AI agent user for prompt battles"

    def add_arguments(self, parser):
        parser.add_argument("--recreate", action="store_true", help="Delete and recreate Pip if already exists")

    def handle(self, *args, **options):
        username = "Pip"

        # Check if Pip already exists
        existing_pip = User.objects.filter(username=username).first()

        if existing_pip:
            if options["recreate"]:
                existing_pip.delete()
                self.stdout.write(self.style.WARNING("Deleted existing Pip user"))
            else:
                self.stdout.write(self.style.WARNING(f"Pip already exists (ID: {existing_pip.id})"))
                self.stdout.write("Use --recreate flag to delete and recreate")
                return

        # Create Pip user with profile
        avatar_url = f"{settings.FRONTEND_URL}/chatbot-chat.webp"

        pip = User.objects.create_user(
            username=username,
            email="pip@allthrive.ai",
            first_name="Pip",
            is_active=True,
            role=UserRole.BOT,  # Mark as bot
            avatar_url=avatar_url,
            bio=(
                "I'm Pip, your friendly AI sparring partner! I love prompt battles and helping you "
                "level up your prompt engineering skills. Challenge me anytime - I'm always ready! 🤖✨"
            ),
            tagline="AI Agent • Prompt Battle Champion • Always Ready to Play",
            location="The Cloud",
            pronouns="they/them",
            current_status="Ready to battle! Challenge me to a prompt duel 🎮",
        )

        # Set a secure password (won't be used for login)
        pip.set_unusable_password()
        pip.save()

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("✓ Pip Created Successfully!"))
        self.stdout.write("=" * 60)
        self.stdout.write("\n🤖 AI Agent Details:")
        self.stdout.write(f"  Username: {pip.username}")
        self.stdout.write(f"  User ID: {pip.id}")
        self.stdout.write(f"  Email: {pip.email}")
        self.stdout.write("\n💡 Usage:")
        self.stdout.write('  Users can now challenge "Pip" to prompt battles!')
        self.stdout.write('  Just enter "Pip" as the opponent username.')
        self.stdout.write("\n🎮 Pip is the AllThrive AI agent - small but mighty!")
        self.stdout.write("")
