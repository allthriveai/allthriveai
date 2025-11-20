"""Battle Service - AI-powered prompt battle logic."""

import random
from typing import Any

from django.db.models import Avg, Q
from django.utils import timezone

from core.battles.models import (
    BattleInvitation,
    BattleStatus,
    BattleSubmission,
    BattleType,
    InvitationStatus,
    PromptBattle,
    SubmissionType,
)
from core.users.models import User

from .ai_provider import AIProvider


class BattleService:
    """Service for managing prompt battles."""

    # Challenge templates for different battle types
    CHALLENGE_TEMPLATES = {
        BattleType.TEXT_PROMPT: [
            'Create a prompt that generates a compelling short story about {theme}',
            'Design a prompt for an AI agent to explain {concept} to a {audience}',
            'Craft a prompt that makes an AI agent write a {style} poem about {topic}',
            'Create a prompt for generating professional {document_type} about {subject}',
            'Design a prompt that helps an AI agent teach {skill} through examples',
            'Craft a creative prompt for an AI agent to brainstorm {count} innovative ideas for {domain}',
            'Create a prompt for an AI agent to role-play as {character} giving advice on {situation}',
            'Design a prompt that generates a detailed analysis of {topic} from multiple perspectives',
        ],
        BattleType.IMAGE_PROMPT: [
            'Create an image generation prompt for a {style} artwork featuring {subject}',
            'Design a prompt for a photorealistic image of {scene} with {mood} atmosphere',
            'Craft a DALL-E prompt for an abstract representation of {concept}',
            'Create a Midjourney prompt for a {adjective} landscape with {elements}',
            'Design an image prompt for a futuristic {object} in {setting}',
            'Craft a prompt for a {art_style} illustration of {character} doing {action}',
            'Create a detailed image prompt for a {time_period} scene showing {event}',
        ],
        BattleType.MIXED: [
            'Create a prompt (text or image) that captures the essence of {abstract_concept}',
            'Design a creative prompt for {creative_task} with unique perspective',
            'Craft an innovative prompt that combines {element1} with {element2}',
        ],
    }

    # Variables for challenge generation
    CHALLENGE_VARIABLES = {
        'theme': ['time travel', 'artificial intelligence', 'climate change', 'space exploration', 'urban life'],
        'concept': [
            'quantum computing',
            'blockchain technology',
            'machine learning',
            'sustainable energy',
            'genetic engineering',
        ],
        'audience': [
            '5-year-old child',
            'business executive',
            'university student',
            'creative artist',
            'senior citizen',
        ],
        'style': ['haiku', 'sonnet', 'free verse', 'limerick', 'spoken word'],
        'topic': ['technology', 'nature', 'human connection', 'dreams', 'transformation'],
        'document_type': [
            'business proposal',
            'technical documentation',
            'press release',
            'research summary',
            'product description',
        ],
        'subject': [
            'remote work collaboration',
            'AI ethics',
            'sustainable fashion',
            'mental health',
            'digital education',
        ],
        'skill': ['public speaking', 'creative writing', 'data analysis', 'critical thinking', 'time management'],
        'count': ['5', '10', '7', '3', '12'],
        'domain': ['healthcare', 'education', 'entertainment', 'transportation', 'communication'],
        'character': ['a wise mentor', 'a future AI', 'a time traveler', 'a successful entrepreneur', 'a philosopher'],
        'situation': [
            'career change',
            'creative block',
            'work-life balance',
            'learning a new skill',
            'building confidence',
        ],
        'scene': [
            'bustling marketplace',
            'serene mountain peak',
            'futuristic city',
            'ancient library',
            'underwater garden',
        ],
        'mood': ['melancholic', 'energetic', 'mysterious', 'peaceful', 'dramatic'],
        'adjective': ['breathtaking', 'surreal', 'minimalist', 'vibrant', 'ethereal'],
        'elements': [
            'waterfalls and mist',
            'neon lights',
            'ancient ruins',
            'bioluminescent plants',
            'floating islands',
        ],
        'object': ['vehicle', 'building', 'device', 'furniture', 'clothing'],
        'setting': ['cyberpunk city', 'space station', 'underwater base', 'desert oasis', 'floating garden'],
        'art_style': ['anime', 'art nouveau', 'impressionist', 'steampunk', 'vaporwave'],
        'action': ['meditation', 'discovery', 'celebration', 'exploration', 'creation'],
        'time_period': ['Renaissance', 'Victorian', 'ancient Egyptian', 'future 2150', '1960s'],
        'event': [
            'a grand celebration',
            'a scientific breakthrough',
            'a peaceful gathering',
            'an epic journey',
            'a moment of revelation',
        ],
        'abstract_concept': ['hope', 'innovation', 'harmony', 'resilience', 'transformation'],
        'creative_task': [
            'storytelling',
            'world-building',
            'character development',
            'visual design',
            'problem-solving',
        ],
        'element1': ['technology', 'nature', 'music', 'architecture', 'mythology'],
        'element2': ['emotion', 'history', 'science', 'art', 'philosophy'],
    }

    def __init__(self):
        """Initialize battle service with AI provider."""
        self.ai_provider = AIProvider()

    def generate_challenge(self, battle_type: str) -> str:
        """Generate a random challenge for a battle.

        Args:
            battle_type: Type of battle (text_prompt, image_prompt, mixed)

        Returns:
            Generated challenge text
        """
        templates = self.CHALLENGE_TEMPLATES.get(battle_type, self.CHALLENGE_TEMPLATES[BattleType.TEXT_PROMPT])
        template = random.choice(templates)

        # Replace variables in template
        challenge = template
        for var_name, var_options in self.CHALLENGE_VARIABLES.items():
            if '{' + var_name + '}' in challenge:
                challenge = challenge.replace('{' + var_name + '}', random.choice(var_options))

        return challenge

    def create_battle_invitation(
        self,
        challenger: User,
        opponent_username: str,
        battle_type: str = BattleType.TEXT_PROMPT,
        duration_minutes: int = 10,
        message: str = '',
    ) -> BattleInvitation:
        """Create a battle invitation.

        Args:
            challenger: User initiating the battle
            opponent_username: Username of the opponent
            battle_type: Type of battle
            duration_minutes: Duration of battle in minutes
            message: Optional message from challenger

        Returns:
            Created BattleInvitation

        Raises:
            ValueError: If opponent not found or invalid parameters
        """
        try:
            opponent = User.objects.get(username=opponent_username.lower())
        except User.DoesNotExist:
            raise ValueError(f"User '{opponent_username}' not found.")

        if challenger == opponent:
            raise ValueError('Cannot create a battle with yourself.')

        # Generate challenge
        challenge_text = self.generate_challenge(battle_type)

        # Create battle
        battle = PromptBattle.objects.create(
            challenger=challenger,
            opponent=opponent,
            challenge_text=challenge_text,
            status=BattleStatus.PENDING,
            battle_type=battle_type,
            duration_minutes=duration_minutes,
        )

        # Create invitation
        invitation = BattleInvitation.objects.create(
            battle=battle, sender=challenger, recipient=opponent, message=message, status=InvitationStatus.PENDING
        )

        return invitation

    def accept_invitation(self, invitation_id: int, user: User) -> PromptBattle:
        """Accept a battle invitation.

        Args:
            invitation_id: ID of the invitation
            user: User accepting the invitation

        Returns:
            Started PromptBattle

        Raises:
            ValueError: If invitation not found or user not recipient
        """
        try:
            invitation = BattleInvitation.objects.get(id=invitation_id)
        except BattleInvitation.DoesNotExist:
            raise ValueError('Invitation not found.')

        if invitation.recipient != user:
            raise ValueError('You are not the recipient of this invitation.')

        invitation.accept()
        return invitation.battle

    def decline_invitation(self, invitation_id: int, user: User) -> None:
        """Decline a battle invitation.

        Args:
            invitation_id: ID of the invitation
            user: User declining the invitation

        Raises:
            ValueError: If invitation not found or user not recipient
        """
        try:
            invitation = BattleInvitation.objects.get(id=invitation_id)
        except BattleInvitation.DoesNotExist:
            raise ValueError('Invitation not found.')

        if invitation.recipient != user:
            raise ValueError('You are not the recipient of this invitation.')

        invitation.decline()

    def submit_prompt(
        self, battle_id: int, user: User, prompt_text: str, submission_type: str = SubmissionType.TEXT
    ) -> BattleSubmission:
        """Submit a prompt for a battle.

        Args:
            battle_id: ID of the battle
            user: User submitting the prompt
            prompt_text: The prompt text
            submission_type: Type of submission (text or image)

        Returns:
            Created BattleSubmission

        Raises:
            ValueError: If battle not found, not active, or user already submitted
        """
        try:
            battle = PromptBattle.objects.get(id=battle_id)
        except PromptBattle.DoesNotExist:
            raise ValueError('Battle not found.')

        # Validate user is a participant
        if user not in [battle.challenger, battle.opponent]:
            raise ValueError('You are not a participant in this battle.')

        # Check if battle is active
        if battle.status != BattleStatus.ACTIVE:
            raise ValueError('Battle is not active.')

        # Check if expired
        if battle.is_expired:
            battle.expire_battle()
            raise ValueError('Battle has expired.')

        # Check if user already submitted
        if BattleSubmission.objects.filter(battle=battle, user=user).exists():
            raise ValueError('You have already submitted a prompt for this battle.')

        # Create submission
        submission = BattleSubmission.objects.create(
            battle=battle, user=user, prompt_text=prompt_text, submission_type=submission_type
        )

        # Check if both users have submitted - if so, evaluate and complete
        if battle.submissions.count() == 2:
            self._evaluate_battle(battle)

        return submission

    def _evaluate_battle(self, battle: PromptBattle) -> None:
        """Evaluate battle submissions and determine winner.

        Args:
            battle: Battle to evaluate
        """
        submissions = list(battle.submissions.all())

        if len(submissions) != 2:
            return

        # Use AI to evaluate submissions
        try:
            for submission in submissions:
                score, feedback = self._evaluate_submission(
                    battle.challenge_text, submission.prompt_text, battle.battle_type
                )
                submission.score = score
                submission.evaluation_feedback = feedback
                submission.evaluated_at = timezone.now()
                submission.save(update_fields=['score', 'evaluation_feedback', 'evaluated_at'])

            # Determine winner
            submissions.sort(key=lambda s: s.score, reverse=True)
            winner = submissions[0].user if submissions[0].score > submissions[1].score else None

            battle.winner = winner
            battle.complete_battle()

        except Exception as e:
            # Log error but don't fail the submission
            print(f'Error evaluating battle {battle.id}: {e}')
            battle.complete_battle()

    def _evaluate_submission(self, challenge: str, prompt: str, battle_type: str) -> tuple[float, str]:
        """Evaluate a single submission using AI.

        Args:
            challenge: The original challenge
            prompt: User's prompt submission
            battle_type: Type of battle

        Returns:
            Tuple of (score, feedback)
        """
        evaluation_prompt = (
            'You are an expert AI agent evaluating prompt engineering quality for a competitive prompt battle.'
            f"\n\nChallenge: {challenge}\n\nUser's Prompt: {prompt}\n\n"
            'Evaluate this prompt on a scale of 0-100 based on:\n'
            '1. Relevance to the challenge (30%)\n'
            '2. Clarity and specificity (25%)\n'
            '3. Creativity and originality (25%)\n'
            '4. Likelihood of producing high-quality output (20%)\n\n'
            'Provide your response in this exact format:\n'
            'SCORE: [number between 0-100]\n'
            'FEEDBACK: [2-3 sentences of constructive feedback]'
        )

        try:
            response = self.ai_provider.complete(prompt=evaluation_prompt, temperature=0.3, max_tokens=300)

            # Parse response
            lines = response.strip().split('\n')
            score = 50.0  # Default score
            feedback = 'Evaluation completed.'

            for line in lines:
                if line.startswith('SCORE:'):
                    try:
                        score = float(line.replace('SCORE:', '').strip())
                        score = max(0, min(100, score))  # Clamp between 0-100
                    except ValueError:
                        pass
                elif line.startswith('FEEDBACK:'):
                    feedback = line.replace('FEEDBACK:', '').strip()

            return score, feedback

        except Exception as e:
            # Fallback to basic evaluation
            print(f'AI evaluation error: {e}')
            return 50.0, 'Unable to evaluate automatically. Default score applied.'

    def get_user_stats(self, user: User) -> dict[str, Any]:
        """Get battle statistics for a user.

        Args:
            user: User to get stats for

        Returns:
            Dictionary with battle statistics
        """
        total_battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status__in=[BattleStatus.COMPLETED, BattleStatus.EXPIRED]
        ).count()

        wins = PromptBattle.objects.filter(winner=user).count()

        active_battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status=BattleStatus.ACTIVE
        ).count()

        pending_invitations = BattleInvitation.objects.filter(recipient=user, status=InvitationStatus.PENDING).count()

        # Calculate average score
        avg_score_data = BattleSubmission.objects.filter(user=user, score__isnull=False).aggregate(Avg('score'))

        average_score = avg_score_data['score__avg'] or 0.0

        losses = total_battles - wins
        win_rate = (wins / total_battles * 100) if total_battles > 0 else 0.0

        return {
            'total_battles': total_battles,
            'wins': wins,
            'losses': losses,
            'active_battles': active_battles,
            'pending_invitations': pending_invitations,
            'win_rate': round(win_rate, 2),
            'average_score': round(average_score, 2),
        }

    def expire_old_battles(self) -> int:
        """Expire all active battles that have passed their expiration time.

        Returns:
            Number of battles expired
        """
        expired_battles = PromptBattle.objects.filter(status=BattleStatus.ACTIVE, expires_at__lt=timezone.now())

        count = 0
        for battle in expired_battles:
            battle.expire_battle()
            count += 1

        return count

    def expire_old_invitations(self) -> int:
        """Expire all pending invitations that have passed their expiration time.

        Returns:
            Number of invitations expired
        """
        expired_invitations = BattleInvitation.objects.filter(
            status=InvitationStatus.PENDING, expires_at__lt=timezone.now()
        )

        count = 0
        for invitation in expired_invitations:
            invitation.status = InvitationStatus.EXPIRED
            invitation.save(update_fields=['status'])
            invitation.battle.cancel_battle()
            count += 1

        return count
