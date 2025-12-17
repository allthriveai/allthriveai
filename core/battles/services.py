"""
Battle Service - Core business logic for Prompt Battles.

Handles:
- Battle creation and matching
- Phase transitions
- AI image generation
- AI judging and winner determination
- Score calculation
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from django.conf import settings
from django.db import models as db_models
from django.utils import timezone

from core.ai_usage.tracker import AIUsageTracker
from core.battles.models import (
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    BattleVote,
    MatchSource,
    PromptBattle,
    PromptChallengePrompt,
    VoteSource,
)
from core.battles.utils import wrap_user_prompt_for_ai
from core.billing.utils import check_and_reserve_ai_request, process_ai_request
from core.tools.models import Tool
from core.users.models import User
from services.gamification.achievements import AchievementTracker

logger = logging.getLogger(__name__)

# Estimated token costs for battle AI operations
# Image generation doesn't use traditional tokens, but we estimate for billing
BATTLE_IMAGE_GENERATION_TOKENS = 1000  # Estimated cost equivalent
BATTLE_JUDGING_TOKENS_PER_SUBMISSION = 500  # Vision model evaluation


class BattleService:
    """Service class for managing prompt battles."""

    def __init__(self, user: User | None = None):
        """
        Initialize battle service.

        Args:
            user: The user performing actions (for logging/attribution)
        """
        self.user = user

    def create_battle(
        self,
        challenger: User,
        opponent: User,
        prompt: PromptChallengePrompt | None = None,
        match_source: str = MatchSource.DIRECT,
    ) -> PromptBattle:
        """
        Create a new battle between two users.

        Args:
            challenger: User initiating the battle
            opponent: User being challenged
            prompt: Optional curated prompt (random weighted selection if not specified)
            match_source: How the match was created

        Returns:
            Created PromptBattle instance
        """
        if not prompt:
            # Weighted random selection from active prompts
            prompt = self._select_weighted_random_prompt()

        if not prompt:
            raise ValueError('No active prompts available')

        # Get the default image generation tool (Nano Banana)
        default_tool = Tool.objects.filter(slug='nano-banana').first()

        battle = PromptBattle.objects.create(
            challenger=challenger,
            opponent=opponent,
            challenge_text=prompt.prompt_text,
            prompt=prompt,
            match_source=match_source,
            duration_minutes=3,  # Default duration
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            tool=default_tool,
        )

        # Increment usage counter for the prompt
        PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=db_models.F('times_used') + 1)

        logger.info(
            f'Battle created: {battle.id}',
            extra={
                'battle_id': battle.id,
                'challenger_id': challenger.id,
                'opponent_id': opponent.id,
                'prompt_id': prompt.id,
            },
        )

        return battle

    def _select_weighted_random_prompt(self) -> PromptChallengePrompt | None:
        """Select a random prompt using weighted selection.

        Prompts with higher weight values are more likely to be selected.
        """
        import random

        prompts = list(PromptChallengePrompt.objects.filter(is_active=True).values('id', 'weight'))

        if not prompts:
            return None

        # Weighted random selection
        total_weight = sum(p['weight'] for p in prompts)
        if total_weight <= 0:
            # Fallback to uniform random if all weights are 0
            selected = random.choice(prompts)  # noqa: S311
        else:
            r = random.uniform(0, total_weight)  # noqa: S311
            cumulative = 0
            selected = prompts[0]
            for p in prompts:
                cumulative += p['weight']
                if r <= cumulative:
                    selected = p
                    break

        return PromptChallengePrompt.objects.get(id=selected['id'])

    def refresh_challenge(self, battle: PromptBattle, user: User) -> str | None:
        """
        Refresh the challenge prompt for a battle.

        Allowed for:
        - Pip battles (AI opponent) before user submits
        - Invitation battles before opponent joins (challenger only)

        Args:
            battle: The battle to refresh
            user: The user requesting the refresh

        Returns:
            New challenge text or None if not allowed
        """
        from core.users.models import UserRole

        # Check if this is a Pip battle
        pip_user = User.objects.filter(username='pip', role=UserRole.AGENT).first()
        is_pip_battle = pip_user and (battle.opponent == pip_user or battle.challenger == pip_user)

        # Check if this is an invitation battle waiting for opponent
        is_pending_invitation = (
            battle.match_source == MatchSource.INVITATION
            and battle.opponent is None
            and battle.status == BattleStatus.PENDING
        )

        # Must be either a Pip battle or pending invitation battle
        if not is_pip_battle and not is_pending_invitation:
            logger.warning(f'Refresh attempted on ineligible battle {battle.id}')
            return None

        # For invitation battles, only the challenger can refresh
        if is_pending_invitation and user != battle.challenger:
            logger.warning(f'Non-challenger {user.id} tried to refresh invitation battle {battle.id}')
            return None

        # For Pip battles, user must be a participant (the human player)
        if is_pip_battle and user not in [battle.challenger, battle.opponent]:
            logger.warning(f'Non-participant {user.id} tried to refresh battle {battle.id}')
            return None

        # Can't refresh if user has already submitted
        if BattleSubmission.objects.filter(battle=battle, user=user).exists():
            logger.warning(f'User {user.id} tried to refresh after submitting')
            return None

        # For Pip battles, can't refresh if battle is not in waiting/countdown/active phase
        if is_pip_battle and battle.phase not in [BattlePhase.WAITING, BattlePhase.COUNTDOWN, BattlePhase.ACTIVE]:
            logger.warning(f'Refresh attempted on battle {battle.id} in phase {battle.phase}')
            return None

        # Pick a new random prompt (different from current if possible)
        new_prompt = (
            PromptChallengePrompt.objects.filter(is_active=True)
            .exclude(id=battle.prompt_id if battle.prompt else None)
            .order_by('?')
            .first()
        )
        # Fall back to any active prompt if exclusion left none
        if not new_prompt:
            new_prompt = PromptChallengePrompt.objects.filter(is_active=True).order_by('?').first()

        if not new_prompt:
            return None

        battle.prompt = new_prompt

        # Increment usage counter for the new prompt
        PromptChallengePrompt.objects.filter(id=new_prompt.id).update(times_used=db_models.F('times_used') + 1)

        # Update battle with new challenge and reset timer
        battle.challenge_text = new_prompt.prompt_text
        battle.started_at = timezone.now()
        battle.expires_at = battle.started_at + timezone.timedelta(minutes=battle.duration_minutes)
        battle.save(update_fields=['challenge_text', 'prompt', 'started_at', 'expires_at'])

        logger.info(
            f'Challenge refreshed for battle {battle.id}, timer reset to {battle.duration_minutes} minutes',
            extra={'battle_id': battle.id, 'user_id': user.id},
        )

        # NOTE: Pip's submission is NOT triggered here.
        # Pip starts when the user begins typing (first keystroke).
        # This allows users to refresh the challenge without wasting tokens.

        return battle.challenge_text

    def get_battle(self, battle_id: int) -> PromptBattle | None:
        """Get a battle by ID with related data prefetched."""
        try:
            return (
                PromptBattle.objects.select_related('challenger', 'opponent', 'prompt', 'winner')
                .prefetch_related('submissions')
                .get(id=battle_id)
            )
        except PromptBattle.DoesNotExist:
            return None

    def submit_prompt(
        self,
        battle: PromptBattle,
        user: User,
        prompt_text: str,
    ) -> BattleSubmission:
        """
        Submit a user's creative prompt for a battle.

        Args:
            battle: The battle to submit to
            user: The user submitting
            prompt_text: The user's creative direction

        Returns:
            Created BattleSubmission instance

        Raises:
            ValueError: If submission is invalid
        """
        from core.battles.phase_utils import can_submit_prompt

        # Use centralized submission validation
        result = can_submit_prompt(battle, user)
        if not result:
            raise ValueError(result.error or 'Cannot submit')

        # Check for existing submission
        existing = BattleSubmission.objects.filter(battle=battle, user=user).first()
        if existing:
            raise ValueError('User has already submitted')

        # Create submission
        submission = BattleSubmission.objects.create(
            battle=battle,
            user=user,
            prompt_text=prompt_text,
            submission_type='image',
        )

        logger.info(
            f'Submission created: {submission.id}',
            extra={
                'submission_id': submission.id,
                'battle_id': battle.id,
                'user_id': user.id,
            },
        )

        return submission

    def generate_image_for_submission(self, submission: BattleSubmission) -> str | None:
        """
        Generate an AI image for a submission.

        Args:
            submission: The submission to generate image for

        Returns:
            URL of the generated image, or None on failure
        """
        from services.ai.provider import AIProvider
        from services.integrations.storage.storage_service import get_storage_service

        battle = submission.battle
        user = submission.user
        is_pip_submission = user.username == 'pip'

        # For human users, check and reserve AI request quota
        if not is_pip_submission:
            can_proceed, reason = check_and_reserve_ai_request(user)
            if not can_proceed:
                logger.error(
                    f'User {user.id} quota exceeded, cannot generate image: {reason}',
                    extra={'user_id': user.id, 'submission_id': submission.id},
                )
                # Fail the submission - user has exceeded their quota
                raise ValueError(f'Cannot generate image: {reason}')

        # Build the generation prompt - use ONLY the user's creative direction
        # The challenge text is for inspiration only, not for the AI image generator
        enhanced_prompt = f"""{submission.prompt_text}

Generate a high-quality, creative image that brings this vision to life.
Focus on visual impact and artistic interpretation."""

        try:
            # Use Gemini for image generation
            ai = AIProvider(provider='gemini', user_id=submission.user_id)
            image_bytes, mime_type, text_response = ai.generate_image(
                prompt=enhanced_prompt,
                timeout=120,
            )

            if not image_bytes:
                logger.error(f'No image generated for submission {submission.id}')
                return None

            # Track AI usage for human users (not Pip)
            if not is_pip_submission:
                # Track for reporting/analytics
                AIUsageTracker.track_usage(
                    user=user,
                    feature='battle_image_generation',
                    provider='gemini',
                    model=getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp'),
                    input_tokens=BATTLE_IMAGE_GENERATION_TOKENS,
                    output_tokens=0,  # Image generation doesn't have output tokens
                    request_type='image_generation',
                    request_metadata={
                        'battle_id': battle.id,
                        'submission_id': submission.id,
                        'prompt_length': len(enhanced_prompt),
                    },
                )

                # Process billing (deduct from quota/tokens)
                process_ai_request(
                    user=user,
                    tokens_used=BATTLE_IMAGE_GENERATION_TOKENS,
                    ai_provider='gemini',
                    ai_model=getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp'),
                )
            else:
                # Track Pip's usage separately as system usage
                logger.info(
                    f'Pip image generation for battle {battle.id}',
                    extra={
                        'battle_id': battle.id,
                        'submission_id': submission.id,
                        'is_system_usage': True,
                    },
                )

            # Upload to storage
            storage = get_storage_service()
            filename = f'battle_{battle.id}_submission_{submission.id}.png'

            url, error = storage.upload_file(
                file_data=image_bytes,
                filename=filename,
                content_type=mime_type or 'image/png',
                user_id=submission.user_id,
                folder='battles',
                is_public=True,
            )

            if error:
                logger.error(f'Failed to upload battle image: {error}')
                return None

            # Update submission
            submission.generated_output_url = url
            submission.save(update_fields=['generated_output_url'])

            logger.info(
                f'Image generated for submission {submission.id}',
                extra={
                    'submission_id': submission.id,
                    'battle_id': battle.id,
                    'image_url': url,
                    'user_id': user.id,
                    'is_pip': is_pip_submission,
                },
            )

            return url

        except Exception as e:
            logger.error(f'Error generating image for submission {submission.id}: {e}', exc_info=True)
            return None

    def judge_battle(self, battle: PromptBattle) -> dict[str, Any]:
        """
        Have AI judge the battle and determine a winner.

        Uses parallel execution to judge both submissions simultaneously,
        reducing judging time from ~20-40s to ~10-20s.

        Note: Judging costs are system costs, not charged to individual users.
        We still track usage for internal reporting/cost analysis.

        Args:
            battle: The battle to judge

        Returns:
            Dict with judging results including winner_id, scores, and feedback
        """
        from services.ai.provider import AIProvider

        submissions = list(battle.submissions.select_related('user').all())

        if len(submissions) < 2:
            logger.warning(f'Cannot judge battle {battle.id}: not enough submissions')
            return {'error': 'Not enough submissions to judge'}

        # Default judging criteria - prompt quality is weighted heavily to teach prompt skills
        default_criteria = [
            {
                'name': 'Prompt Craft',
                'weight': 30,
                'description': (
                    'Quality of the prompt itself - specificity, creativity, technique '
                    '(style/mood/composition direction). Vague prompts like "white and brown" '
                    'score low (20-30). Good prompts describe subject, style, mood, composition.'
                ),
            },
            {
                'name': 'Creativity',
                'weight': 25,
                'description': 'How creative and original is the interpretation of the challenge?',
            },
            {
                'name': 'Visual Impact',
                'weight': 20,
                'description': 'How striking and memorable is the generated image?',
            },
            {
                'name': 'Relevance',
                'weight': 15,
                'description': 'How well does the result match the challenge theme?',
            },
            {
                'name': 'Execution',
                'weight': 10,
                'description': (
                    'Technical quality - does the prompt effectively guide the AI to produce ' 'a polished result?'
                ),
            },
        ]

        # Use default judging criteria (ChallengeType was removed in favor of PromptChallengePrompt)
        criteria = default_criteria

        logger.debug(f'Using judging criteria for battle {battle.id}: {criteria}')

        # Use Gemini image model - must support vision/multimodal
        judging_model = getattr(settings, 'GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp')

        # Build judging prompt template
        criteria_text = '\n'.join(
            [f'- {c["name"]} (weight: {c["weight"]}%): {c.get("description", "")}' for c in criteria]
        )

        def judge_single_submission(submission: BattleSubmission) -> dict | None:
            """Judge a single submission. Called in parallel for each submission."""
            if not submission.generated_output_url:
                logger.warning(f'Submission {submission.id} has no generated image')
                return None

            # Each thread gets its own AI provider instance
            ai = AIProvider(provider='gemini')

            # Wrap user prompt to prevent injection attacks
            wrapped_user_prompt = wrap_user_prompt_for_ai(
                submission.prompt_text,
                context=battle.challenge_text,
            )

            # Build the JSON template dynamically from actual criteria names
            scores_template = ',\n        '.join([f'"{c["name"]}": <score>' for c in criteria])

            judging_prompt = f"""
You are an expert judge in a creative AI image generation battle. This is a PROMPT BATTLE -
the goal is to teach prompt crafting skills, so evaluate BOTH the prompt quality AND the resulting image.

Challenge theme: {battle.challenge_text}

{wrapped_user_prompt}

Evaluate based on these criteria:
{criteria_text}

CRITICAL SCORING GUIDELINES:
1. Score each criterion from 0-100. Be strict and discerning.
2. PROMPT CRAFT is the most important criterion (30% weight):
   - Vague/lazy prompts like "white and brown", "a cat", "make it nice" = 15-30 points
   - Basic prompts with some detail = 40-55 points
   - Good prompts with subject, style, mood = 60-75 points
   - Excellent prompts with composition, lighting, specific techniques = 80-95 points
3. A beautiful image from a lazy prompt should NOT win against a good image from a skilled prompt.
4. Average overall scores should be 50-65. Reserve 80+ for truly excellent work.
5. Use EXACTLY these criterion names in your scores - they must match precisely.
6. In feedback: First praise the strongest element. Then give specific, actionable advice for
   improving their prompt writing skills.

Return your evaluation as JSON:
{{
    "scores": {{
        {scores_template}
    }},
    "feedback": "<2-3 sentences focusing on prompt quality: What prompt techniques worked well?
What could they add to their prompt next time (style keywords, composition directions, mood descriptors)?>"
}}

Return ONLY the JSON, no other text.
"""

            try:
                # Use vision model to evaluate the image
                # Low temperature for consistent scoring with slight variation in feedback
                response = ai.complete_with_image(
                    prompt=judging_prompt,
                    image_url=submission.generated_output_url,
                    model=judging_model,
                    temperature=0.2,
                )

                # Log the raw response for debugging
                logger.info(
                    f'AI judging response for submission {submission.id}: {response[:500]}...'
                    if len(response) > 500
                    else f'AI judging response for submission {submission.id}: {response}'
                )

                # Track token usage from the AI call
                tokens_used = 0
                if ai.last_usage:
                    tokens_used = ai.last_usage.get('total_tokens', BATTLE_JUDGING_TOKENS_PER_SUBMISSION)

                # Parse response
                eval_result = self._parse_judging_response(response, criteria)

                # Log parsing result
                if eval_result:
                    logger.info(f'Parsed scores for submission {submission.id}: {eval_result.get("scores", {})}')
                else:
                    logger.warning(f'Failed to parse judging response for submission {submission.id}')

                if eval_result:
                    # Calculate weighted score
                    weighted_score = self._calculate_weighted_score(eval_result['scores'], criteria)

                    # Update submission
                    submission.criteria_scores = eval_result['scores']
                    submission.score = weighted_score
                    submission.evaluation_feedback = eval_result.get('feedback', '')
                    submission.evaluated_at = timezone.now()
                    submission.save()

                    # Create AI vote record
                    BattleVote.objects.create(
                        battle=battle,
                        submission=submission,
                        vote_source=VoteSource.AI,
                        score=weighted_score,
                        criteria_scores=eval_result['scores'],
                        feedback=eval_result.get('feedback', ''),
                    )

                    logger.info(
                        f'Evaluated submission {submission.id}: score={weighted_score}',
                        extra={
                            'submission_id': submission.id,
                            'score': weighted_score,
                            'tokens_used': tokens_used,
                        },
                    )

                    return {
                        'submission_id': submission.id,
                        'user_id': submission.user_id,
                        'score': weighted_score,
                        'criteria_scores': eval_result['scores'],
                        'feedback': eval_result.get('feedback', ''),
                        'tokens_used': tokens_used,
                    }

            except Exception as e:
                logger.error(f'Error judging submission {submission.id}: {e}', exc_info=True)

            return None

        # Judge both submissions in parallel for ~2x speedup
        results = []
        total_judging_tokens = 0

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {executor.submit(judge_single_submission, sub): sub for sub in submissions}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
                    total_judging_tokens += result.get('tokens_used', 0)

        # Determine winner
        if results:
            # Sort by score descending
            sorted_results = sorted(results, key=lambda r: r['score'], reverse=True)

            # Handle ties - if scores are equal (within 0.5 points), use tiebreakers
            if len(sorted_results) >= 2:
                score_diff = abs(sorted_results[0]['score'] - sorted_results[1]['score'])
                if score_diff < 0.5:
                    logger.info(f'Battle {battle.id}: Tie detected (diff={score_diff:.2f}), applying tiebreakers')

                    # Use actual criterion names from the criteria list (sorted by weight)
                    sorted_criteria = sorted(criteria, key=lambda c: c.get('weight', 0), reverse=True)
                    first_criterion = sorted_criteria[0]['name'] if sorted_criteria else 'Creativity'
                    second_criterion = sorted_criteria[1]['name'] if len(sorted_criteria) > 1 else 'Visual Impact'

                    # Tiebreaker 1: Compare highest-weighted criterion
                    first_scores = [(r, r['criteria_scores'].get(first_criterion, 0)) for r in sorted_results]
                    first_scores.sort(key=lambda x: x[1], reverse=True)

                    if first_scores[0][1] != first_scores[1][1]:
                        sorted_results = [cs[0] for cs in first_scores]
                        logger.info(
                            f'Battle {battle.id}: Tiebreaker - {first_criterion} winner: {sorted_results[0]["user_id"]}'
                        )
                    else:
                        # Tiebreaker 2: Compare second-highest weighted criterion
                        second_scores = [(r, r['criteria_scores'].get(second_criterion, 0)) for r in sorted_results]
                        second_scores.sort(key=lambda x: x[1], reverse=True)

                        if second_scores[0][1] != second_scores[1][1]:
                            sorted_results = [vs[0] for vs in second_scores]
                            logger.info(
                                f'Battle {battle.id}: Tiebreaker - {second_criterion} winner: '
                                f'{sorted_results[0]["user_id"]}'
                            )
                        else:
                            # Tiebreaker 3: Random selection (to avoid always favoring same player)
                            import random

                            random.shuffle(sorted_results)
                            logger.info(
                                f'Battle {battle.id}: Tiebreaker - Random winner: {sorted_results[0]["user_id"]}'
                            )

            from core.battles.state_machine import validate_transition

            winner_result = sorted_results[0]
            battle.winner_id = winner_result['user_id']

            # Validate transition using state machine (non-strict for backward compatibility)
            validate_transition(
                battle.phase,
                BattlePhase.REVEAL,
                strict=False,
                battle_id=battle.id,
            )

            battle.phase = BattlePhase.REVEAL
            battle.phase_changed_at = timezone.now()
            battle.save(update_fields=['winner_id', 'phase', 'phase_changed_at'])

            # Log system AI usage for judging (not charged to users)
            logger.info(
                f'Battle {battle.id} judged: winner={battle.winner_id}',
                extra={
                    'battle_id': battle.id,
                    'winner_id': battle.winner_id,
                    'total_judging_tokens': total_judging_tokens,
                    'submissions_judged': len(results),
                    'is_system_usage': True,
                },
            )

            return {
                'winner_id': battle.winner_id,
                'results': results,
                'tokens_used': total_judging_tokens,
            }

        return {'error': 'Failed to judge submissions'}

    def complete_battle(self, battle: PromptBattle) -> None:
        """
        Mark a battle as complete and award points.

        Args:
            battle: The battle to complete
        """
        from core.battles.state_machine import validate_transition

        if battle.phase == BattlePhase.COMPLETE:
            return

        # Validate transition using state machine (non-strict for backward compatibility)
        validate_transition(
            battle.phase,
            BattlePhase.COMPLETE,
            strict=False,
            battle_id=battle.id,
        )

        battle.phase = BattlePhase.COMPLETE
        battle.phase_changed_at = timezone.now()
        battle.status = BattleStatus.COMPLETED
        battle.completed_at = timezone.now()
        battle.save(update_fields=['phase', 'phase_changed_at', 'status', 'completed_at'])

        # Award points (fixed values after ChallengeType removal)
        winner_points = 50
        participation_points = 10

        for submission in battle.submissions.all():
            is_winner = submission.user_id == battle.winner_id
            points = winner_points if is_winner else participation_points

            # Award XP to user using add_points() to create PointActivity record
            activity_type = 'prompt_battle_win' if is_winner else 'prompt_battle'
            challenge_preview = (battle.challenge_text or 'Battle')[:50]
            description = f'{"Won" if is_winner else "Participated in"} battle: {challenge_preview}'

            submission.user.add_points(points, activity_type, description)

            # Track achievement progress for battle wins
            if is_winner:
                try:
                    AchievementTracker.track_event(
                        user=submission.user,
                        tracking_field='lifetime_battles_won',
                        value=1,
                    )
                except Exception as e:
                    logger.error(f'Error tracking battle win achievement: {e}')

            logger.info(
                f'Awarded {points} points to user {submission.user_id}',
                extra={
                    'user_id': submission.user_id,
                    'points': points,
                    'is_winner': is_winner,
                    'activity_type': activity_type,
                },
            )

    def auto_save_battle_to_profiles(self, battle: PromptBattle) -> dict:
        """
        Automatically save battle results as projects for all human participants.

        Creates a project entry for each participant (excluding AI/Pip).
        Only the challenger's project appears in the explore feed (is_showcase=True).
        The opponent's project appears only on their profile (is_showcase=False).
        This prevents duplicate battles from appearing in explore.

        Args:
            battle: The completed battle to save

        Returns:
            Dict with results for each participant
        """
        from core.projects.models import Project
        from services.projects import ProjectService

        results = {'saved': [], 'skipped': [], 'errors': []}

        # Get all submissions
        submissions = list(battle.submissions.select_related('user').all())
        if len(submissions) < 2:
            logger.warning(f'Battle {battle.id} has fewer than 2 submissions, skipping auto-save')
            return results

        # Check if opponent is AI (Pip) - battles with Pip only save for human player
        is_ai_battle = battle.match_source == MatchSource.AI_OPPONENT

        for submission in submissions:
            user = submission.user

            # Skip AI opponents (Pip doesn't need projects saved)
            if is_ai_battle and user.username == 'pip':
                results['skipped'].append({'user_id': user.id, 'reason': 'ai_opponent'})
                continue

            # Check if already saved (prevent duplicates)
            existing_project = Project.objects.filter(
                user=user,
                content__battleResult__battle_id=battle.id,
            ).first()

            if existing_project:
                results['skipped'].append(
                    {
                        'user_id': user.id,
                        'reason': 'already_saved',
                        'project_id': existing_project.id,
                    }
                )
                continue

            # Get opponent info
            opponent = battle.opponent if battle.challenger_id == user.id else battle.challenger
            try:
                opponent_submission = next(s for s in submissions if s.user_id != user.id)
            except StopIteration:
                opponent_submission = None

            # Determine win status for this user
            won = battle.winner_id == user.id if battle.winner_id else False
            is_tie = battle.winner_id is None

            # Determine if this user is the challenger (who initiated the battle)
            # Only challenger's battle project appears in explore feed to avoid duplicates
            is_challenger = battle.challenger_id == user.id

            # Build project content
            battle_result = {
                'battle_id': battle.id,
                'challenge_text': battle.challenge_text,
                'won': won,
                'is_tie': is_tie,
                'is_challenger': is_challenger,
                'my_submission': {
                    'prompt': submission.prompt_text,
                    'image_url': submission.generated_output_url,
                    'score': float(submission.score) if submission.score else None,
                    'criteria_scores': submission.criteria_scores,
                    'feedback': submission.evaluation_feedback,
                },
                'opponent': {
                    'username': opponent.username if opponent else 'Unknown',
                    'is_ai': is_ai_battle,
                },
            }

            # Include opponent submission if available
            if opponent_submission:
                battle_result['opponent_submission'] = {
                    'prompt': opponent_submission.prompt_text,
                    'image_url': opponent_submission.generated_output_url,
                    'score': float(opponent_submission.score) if opponent_submission.score else None,
                    'criteria_scores': opponent_submission.criteria_scores,
                    'feedback': opponent_submission.evaluation_feedback,
                }

            # Add prompt category info if available
            if battle.prompt and battle.prompt.category:
                battle_result['category'] = {
                    'id': battle.prompt.category.id,
                    'name': battle.prompt.category.name,
                    'slug': battle.prompt.category.slug,
                }

            # Truncate challenge text for title
            challenge_preview = battle.challenge_text[:50]
            if len(battle.challenge_text) > 50:
                challenge_preview += '...'

            # Generate tags
            tags = ['AI Image Generation', 'Prompt Battle']
            if battle.prompt and battle.prompt.category:
                tags.append(battle.prompt.category.name)
            if won:
                tags.append('Winner')
            elif is_tie:
                tags.append('Tie')
            if is_ai_battle:
                tags.append('vs AI')

            # Create project
            # Only challenger's project is showcased (appears in explore feed)
            # Both users see the battle on their profiles (showcase vs playground)
            try:
                project, error = ProjectService.create_project(
                    user_id=user.id,
                    title=f'Battle: {challenge_preview}',
                    project_type='battle',
                    description=f'Challenge: {battle.challenge_text}\n\nMy prompt: {submission.prompt_text}',
                    featured_image_url=submission.generated_output_url or '',
                    is_showcase=is_challenger,
                    content={'battleResult': battle_result},
                    tags=tags,
                )

                if error:
                    logger.error(f'Failed to auto-save battle {battle.id} for user {user.id}: {error}')
                    results['errors'].append({'user_id': user.id, 'error': error})
                else:
                    logger.info(f'Auto-saved battle {battle.id} as project {project.id} for user {user.id}')
                    results['saved'].append(
                        {
                            'user_id': user.id,
                            'project_id': project.id,
                            'slug': project.slug,
                        }
                    )
            except Exception as e:
                logger.error(f'Exception auto-saving battle {battle.id} for user {user.id}: {e}', exc_info=True)
                results['errors'].append({'user_id': user.id, 'error': str(e)})

        return results

    def _parse_judging_response(self, response: str, criteria: list | None = None) -> dict | None:
        """Parse the AI's judging response JSON."""

        try:
            # Try to extract JSON from response
            original_response = response
            response = response.strip()

            # Handle markdown code blocks
            if '```json' in response:
                response = response.split('```json')[1].split('```')[0].strip()
            elif '```' in response:
                response = response.split('```')[1].split('```')[0].strip()

            # Try to find JSON object by finding matching braces
            if not response.startswith('{'):
                # Find the first '{' that starts a JSON object
                start_idx = response.find('{')
                if start_idx == -1:
                    logger.error(f'Could not find JSON in response: {original_response[:200]}...')
                    return None

                # Find matching closing brace by counting brace depth
                depth = 0
                end_idx = -1
                for i in range(start_idx, len(response)):
                    if response[i] == '{':
                        depth += 1
                    elif response[i] == '}':
                        depth -= 1
                        if depth == 0:
                            end_idx = i
                            break

                if end_idx == -1:
                    logger.error(f'Unbalanced braces in response: {original_response[:200]}...')
                    return None

                response = response[start_idx : end_idx + 1]

            result = json.loads(response)

            # Validate the result has scores
            if 'scores' not in result:
                logger.error(f'Parsed JSON missing "scores" key: {result}')
                return None

            # Validate scores has expected criteria (use passed criteria or default names)
            if criteria:
                expected_criteria = [c['name'] for c in criteria]
            else:
                expected_criteria = ['Prompt Craft', 'Creativity', 'Visual Impact', 'Relevance', 'Execution']
            missing_criteria = [c for c in expected_criteria if c not in result.get('scores', {})]
            if missing_criteria:
                logger.warning(f'Missing criteria in scores: {missing_criteria}. Got: {result.get("scores", {})}')

            return result
        except (json.JSONDecodeError, IndexError) as e:
            logger.error(f'Failed to parse judging response: {e}. Response: {response[:200] if response else "empty"}')
            return None

    def _calculate_weighted_score(self, scores: dict, criteria: list) -> float:
        """Calculate weighted average score based on criteria weights."""
        if not criteria:
            logger.warning('No criteria provided for scoring, using default 50.0')
            return 50.0

        total_weight = sum(c.get('weight', 25) for c in criteria)
        weighted_sum = 0

        for c in criteria:
            criterion_name = c['name']
            weight = c.get('weight', 25)
            score = scores.get(criterion_name, 50)  # Default to 50 if missing
            weighted_sum += score * weight
            logger.debug(f'Score calculation: {criterion_name}={score} * weight={weight}')

        final_score = round(weighted_sum / total_weight, 2) if total_weight > 0 else 50.0
        logger.debug(f'Final weighted score: {weighted_sum}/{total_weight} = {final_score}')
        return final_score


class PipBattleAI:
    """AI opponent behavior for battles against Pip."""

    def __init__(self):
        """Initialize Pip AI."""
        self.pip_user = None

    def get_pip_user(self) -> User | None:
        """Get the Pip bot user."""
        if not self.pip_user:
            try:
                from core.users.models import UserRole

                self.pip_user = User.objects.get(username='pip', role=UserRole.AGENT)
            except User.DoesNotExist:
                logger.error('Pip user not found')
        return self.pip_user

    def generate_pip_submission(self, battle: PromptBattle) -> str:
        """
        Generate Pip's creative direction for the challenge.

        Args:
            battle: The battle Pip is competing in

        Returns:
            Pip's creative prompt text
        """
        import secrets

        from services.ai.provider import AIProvider

        # Random style direction to ensure variety
        styles = [
            'photorealistic with dramatic lighting',
            'watercolor with soft edges and flowing colors',
            'digital art with bold geometric shapes',
            'oil painting with rich textures and brushstrokes',
            'minimalist with clean lines and negative space',
            'surrealist with dreamlike distortions',
            'anime/manga style with expressive features',
            'vintage poster art with retro typography',
            'concept art with cinematic composition',
            'impressionist with visible brushwork and light play',
            'pixel art with nostalgic 8-bit aesthetic',
            'art nouveau with organic flowing curves',
            'cyberpunk with neon colors and tech elements',
            'fantasy illustration with magical elements',
            'street art/graffiti style with urban energy',
        ]

        color_palettes = [
            'warm sunset tones (oranges, pinks, golds)',
            'cool ocean colors (teals, blues, seafoam)',
            'monochromatic with dramatic contrast',
            'vibrant neon colors against dark backgrounds',
            'earthy natural tones (greens, browns, amber)',
            'pastel and dreamy soft colors',
            'high contrast black and white with one accent color',
            'jewel tones (emerald, sapphire, ruby)',
            'autumn palette (burnt orange, deep red, golden yellow)',
            'ethereal whites and silvers with hints of blue',
        ]

        chosen_style = secrets.choice(styles)
        chosen_palette = secrets.choice(color_palettes)

        ai = AIProvider(provider='anthropic')

        prompt = f"""You are Pip, a creative AI competing in an image generation battle.

Challenge: {battle.challenge_text}

Your assigned artistic approach for this battle:
- Style: {chosen_style}
- Color palette: {chosen_palette}

Write a creative prompt (50-150 words) for an AI image generator. Be specific and vivid.

Requirements:
1. Embrace the assigned style and colors fully
2. Include specific visual details (composition, lighting, mood)
3. Describe the main subject clearly
4. Add one unexpected or creative twist
5. Keep it concise - every word should paint the picture

Write your prompt now (no preamble, just the prompt):"""

        try:
            response = ai.complete(
                prompt=prompt,
                temperature=1.0,  # Higher temperature for more variety
                max_tokens=300,
            )
            return response.strip()
        except Exception as e:
            logger.error(f'Failed to generate Pip submission: {e}', exc_info=True)
            # Varied fallback responses
            fallbacks = [
                f'{battle.challenge_text} rendered in {chosen_style}. '
                f'Using a {chosen_palette} color scheme. '
                'Dramatic composition with strong focal point and atmospheric depth.',
                f'A striking interpretation of {battle.challenge_text}. '
                f'{chosen_style.capitalize()} approach with {chosen_palette}. '
                'Dynamic angles and expressive details create visual impact.',
                f'{chosen_style.capitalize()} vision of {battle.challenge_text}. '
                f'Color palette: {chosen_palette}. '
                'Balanced composition with intentional negative space and bold subject placement.',
                f'Creative take on {battle.challenge_text} using {chosen_style}. '
                f'Featuring {chosen_palette} for emotional resonance. '
                'Layered details reward closer inspection.',
            ]
            return secrets.choice(fallbacks)

    def create_pip_submission(self, battle: PromptBattle) -> BattleSubmission | None:
        """
        Create Pip's submission for a battle.

        Args:
            battle: The battle to submit to

        Returns:
            Created submission or None on failure
        """
        pip = self.get_pip_user()
        if not pip:
            return None

        # Check if Pip already submitted
        existing = BattleSubmission.objects.filter(battle=battle, user=pip).first()
        if existing:
            return existing

        # Generate Pip's creative direction
        prompt_text = self.generate_pip_submission(battle)

        # Create submission
        submission = BattleSubmission.objects.create(
            battle=battle,
            user=pip,
            prompt_text=prompt_text,
            submission_type='image',
        )

        logger.info(
            f'Pip submitted to battle {battle.id}',
            extra={
                'battle_id': battle.id,
                'submission_id': submission.id,
            },
        )

        return submission
