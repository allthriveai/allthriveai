"""Management command to create test users and battle for development/testing."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.battles.models import BattleInvitation

User = get_user_model()


class Command(BaseCommand):
    help = "Create test users and a prompt battle for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user1", type=str, default="testuser1", help="Username for first test user (default: testuser1)"
        )
        parser.add_argument(
            "--user2", type=str, default="testuser2", help="Username for second test user (default: testuser2)"
        )
        parser.add_argument(
            "--password", type=str, default="testpass123", help="Password for test users (default: testpass123)"
        )
        parser.add_argument(
            "--battle-type",
            type=str,
            default="text_prompt",
            choices=["text_prompt", "image_prompt", "mixed"],
            help="Type of battle to create",
        )
        parser.add_argument("--duration", type=int, default=10, help="Battle duration in minutes (default: 10)")
        parser.add_argument(
            "--auto-accept", action="store_true", help="Automatically accept the invitation and start the battle"
        )
        parser.add_argument("--clean", action="store_true", help="Delete existing test users before creating new ones")

    def handle(self, *args, **options):
        user1_name = options["user1"]
        user2_name = options["user2"]
        password = options["password"]
        battle_type = options["battle_type"]
        duration = options["duration"]
        auto_accept = options["auto_accept"]
        clean = options["clean"]

        # Clean up existing test users if requested
        if clean:
            for username in [user1_name, user2_name]:
                deleted_count = User.objects.filter(username=username).delete()[0]
                if deleted_count:
                    self.stdout.write(self.style.WARNING(f"Deleted existing user: {username}"))

        # Create or get test users
        user1, created1 = self._create_user(user1_name, password)
        user2, created2 = self._create_user(user2_name, password)

        if created1:
            self.stdout.write(self.style.SUCCESS(f"✓ Created user: {user1.username}"))
        else:
            self.stdout.write(f"→ Using existing user: {user1.username}")

        if created2:
            self.stdout.write(self.style.SUCCESS(f"✓ Created user: {user2.username}"))
        else:
            self.stdout.write(f"→ Using existing user: {user2.username}")

        # Generate challenge text based on battle type
        challenge_text = self._generate_challenge(battle_type)

        # Create battle invitation
        invitation = BattleInvitation.objects.create(
            sender=user1,
            recipient=user2,
            battle_type=battle_type,
            duration_minutes=duration,
            challenge_text=challenge_text,
            message=f"Test battle invitation from {user1.username}",
        )

        self.stdout.write(self.style.SUCCESS(f"✓ Created battle invitation (ID: {invitation.id})"))
        self.stdout.write(f"  Challenge: {challenge_text}")

        # Auto-accept if requested
        if auto_accept:
            battle = invitation.accept()
            self.stdout.write(self.style.SUCCESS(f"✓ Invitation accepted - Battle started (ID: {battle.id})"))
            self.stdout.write(self.style.WARNING(f"  Battle expires in {duration} minutes"))
        else:
            self.stdout.write(self.style.WARNING(f"  Invitation pending - login as {user2.username} to accept"))

        # Print login info
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("Test Battle Setup Complete!"))
        self.stdout.write("=" * 60)
        self.stdout.write(f"\n📝 Login credentials (password: {password}):")
        self.stdout.write(f"  User 1 (challenger): {user1.username}")
        self.stdout.write(f"  User 2 (opponent):   {user2.username}")
        self.stdout.write("\n🎮 Battle details:")
        self.stdout.write(f"  Type: {battle_type}")
        self.stdout.write(f"  Duration: {duration} minutes")
        if auto_accept:
            self.stdout.write("  Status: ACTIVE")
            self.stdout.write(f"  Battle ID: {battle.id}")
        else:
            self.stdout.write("  Status: PENDING")
            self.stdout.write(f"  Invitation ID: {invitation.id}")
        self.stdout.write("\n🌐 Access at: {{FRONTEND_URL}}/play/prompt-battle")
        self.stdout.write("")

    def _create_user(self, username, password):
        """Create or get a test user."""
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{username}@test.com",
            },
        )
        if created:
            user.set_password(password)
            user.save()
        return user, created

    def _generate_challenge(self, battle_type):
        """Generate appropriate challenge text based on battle type."""
        challenges = {
            "text_prompt": [
                "Create a prompt that generates a compelling short story about AI discovering emotions",
                "Write a prompt to generate code for a recursive fibonacci function with memoization",
                "Design a prompt that produces a detailed product description for a smart home device",
                "Craft a prompt to generate a creative marketing email for a new fitness app",
            ],
            "image_prompt": [
                "Create a prompt to generate a cyberpunk cityscape at sunset with flying vehicles",
                "Write a prompt for a mystical forest scene with bioluminescent plants and creatures",
                "Design a prompt to generate a futuristic AI robot in a minimalist white room",
                "Craft a prompt for a steampunk laboratory filled with brass gadgets and inventions",
            ],
            "mixed": [
                "Create prompts for both text and image: A sci-fi character concept with backstory",
                "Design prompts for text and visual: An innovative product idea with packaging",
                "Craft prompts for both: A fantasy creature with description and illustration",
                "Create prompts for text and image: A new recipe with an appetizing photo",
            ],
        }

        import random

        return random.choice(challenges.get(battle_type, challenges["text_prompt"]))
