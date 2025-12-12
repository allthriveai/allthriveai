"""
Celery tasks for Prompt Battles.

Handles async operations:
- AI image generation for submissions
- AI judging after both users submit
- Pip (AI opponent) delayed submissions
- Battle timeout handling
"""

import logging
from typing import Any

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.utils import timezone

from core.battles.models import BattlePhase, BattleStatus, BattleSubmission, PromptBattle
from core.battles.services import BattleService, PipBattleAI

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    time_limit=300,  # 5 minute hard limit
    soft_time_limit=240,  # 4 minute soft limit
)
def generate_submission_image_task(self, submission_id: int) -> dict[str, Any]:
    """
    Generate AI image for a battle submission.

    Called after a user submits their creative prompt.
    Notifies battle room via WebSocket when complete.

    Args:
        submission_id: ID of the BattleSubmission

    Returns:
        Dict with generation result
    """
    try:
        submission = BattleSubmission.objects.select_related('battle', 'user').get(id=submission_id)
    except BattleSubmission.DoesNotExist:
        logger.error(f'Submission not found: {submission_id}')
        return {'status': 'error', 'reason': 'submission_not_found'}

    # Idempotency check: skip if already has generated image
    if submission.generated_output_url:
        logger.info(f'Submission {submission_id} already has image, skipping generation')
        return {'status': 'skipped', 'reason': 'already_generated', 'image_url': submission.generated_output_url}

    battle = submission.battle
    channel_layer = get_channel_layer()
    group_name = f'battle_{battle.id}'

    # Notify start of generation
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'battle_event',
            'event': 'image_generating',
            'user_id': submission.user_id,
            'submission_id': submission_id,
        },
    )

    try:
        service = BattleService()
        image_url = service.generate_image_for_submission(submission)

        if image_url:
            logger.info(f'Image generated for submission {submission_id}: {image_url}')

            # Notify success
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'battle_event',
                    'event': 'image_generated',
                    'user_id': submission.user_id,
                    'submission_id': submission_id,
                    'image_url': image_url,
                },
            )

            # Check if both submissions now have images - trigger judging
            _check_and_trigger_judging(battle.id)

            return {'status': 'success', 'image_url': image_url}
        else:
            logger.error(f'Image generation failed for submission {submission_id}')

            # Notify failure
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'battle_event',
                    'event': 'image_generation_failed',
                    'user_id': submission.user_id,
                    'submission_id': submission_id,
                },
            )

            return {'status': 'error', 'reason': 'generation_failed'}

    except Exception as e:
        logger.error(f'Error generating image for submission {submission_id}: {e}', exc_info=True)

        # Notify error
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'image_generation_failed',
                'user_id': submission.user_id,
                'submission_id': submission_id,
                'error': str(e),
            },
        )

        raise self.retry(exc=e) from e


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    time_limit=180,  # 3 minute hard limit
    soft_time_limit=150,  # 2.5 minute soft limit
)
def judge_battle_task(self, battle_id: int) -> dict[str, Any]:
    """
    Have AI judge the battle and determine winner.

    Called when both submissions have generated images.
    Transitions battle to reveal phase with results.

    Args:
        battle_id: ID of the PromptBattle

    Returns:
        Dict with judging results
    """
    try:
        battle = PromptBattle.objects.select_related('challenger', 'opponent').get(id=battle_id)
    except PromptBattle.DoesNotExist:
        logger.error(f'Battle not found: {battle_id}')
        return {'status': 'error', 'reason': 'battle_not_found'}

    if battle.phase not in [BattlePhase.GENERATING, BattlePhase.JUDGING]:
        logger.warning(f'Battle {battle_id} not in judgeable phase: {battle.phase}')
        return {'status': 'skipped', 'reason': 'invalid_phase'}

    channel_layer = get_channel_layer()
    group_name = f'battle_{battle_id}'

    # Transition to judging phase and track the time
    battle.set_phase(BattlePhase.JUDGING)

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'battle_event',
            'event': 'phase_change',
            'phase': BattlePhase.JUDGING,
        },
    )

    try:
        service = BattleService()
        results = service.judge_battle(battle)

        if 'error' in results:
            logger.error(f'Judging failed for battle {battle_id}: {results["error"]}')
            return {'status': 'error', 'reason': results['error']}

        # Send judging results to room with full submission data
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'judging_complete',
                'winner_id': results.get('winner_id'),
                'results': results.get('results', []),
            },
        )

        # Transition to reveal phase - SAVE TO DATABASE so state refresh includes opponent submission
        battle.set_phase(BattlePhase.REVEAL)

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'phase_change',
                'phase': BattlePhase.REVEAL,
            },
        )

        # Tell clients to refresh their state (includes opponent submission now)
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'state_refresh',
            },
        )

        # Schedule battle completion after reveal period (2 seconds - enough for UI transition)
        complete_battle_task.apply_async(
            args=[battle_id],
            countdown=2,
        )

        logger.info(f'Battle {battle_id} judged: winner={results.get("winner_id")}')
        return {'status': 'success', 'winner_id': results.get('winner_id')}

    except Exception as e:
        logger.error(f'Error judging battle {battle_id}: {e}', exc_info=True)
        raise self.retry(exc=e) from e


@shared_task(
    bind=True,
    time_limit=60,  # 1 minute hard limit
    soft_time_limit=45,  # 45 second soft limit
)
def complete_battle_task(self, battle_id: int) -> dict[str, Any]:
    """
    Mark battle as complete and award points.

    Called after reveal phase timer expires.

    Args:
        battle_id: ID of the PromptBattle

    Returns:
        Dict with completion result
    """
    try:
        battle = PromptBattle.objects.get(id=battle_id)
    except PromptBattle.DoesNotExist:
        logger.error(f'Battle not found: {battle_id}')
        return {'status': 'error', 'reason': 'battle_not_found'}

    if battle.phase == BattlePhase.COMPLETE:
        return {'status': 'already_complete'}

    channel_layer = get_channel_layer()
    group_name = f'battle_{battle_id}'

    try:
        service = BattleService()
        service.complete_battle(battle)

        # Auto-save battle to participants' profiles (appears on explore feed)
        save_results = service.auto_save_battle_to_profiles(battle)
        logger.info(f'Battle {battle_id} auto-save results: {save_results}')

        # Notify completion
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'phase_change',
                'phase': BattlePhase.COMPLETE,
            },
        )

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'battle_complete',
                'winner_id': battle.winner_id,
            },
        )

        # Tell clients to refresh their full state (final results)
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'state_refresh',
            },
        )

        # Generate OG image for social sharing (async, non-blocking)
        generate_og_image_task.delay(battle_id)

        logger.info(f'Battle {battle_id} completed')
        return {'status': 'success', 'auto_save': save_results}

    except Exception as e:
        logger.error(f'Error completing battle {battle_id}: {e}', exc_info=True)
        return {'status': 'error', 'reason': str(e)}


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    time_limit=120,  # 2 minute hard limit
    soft_time_limit=90,  # 90 second soft limit
)
def create_pip_submission_task(self, battle_id: int) -> dict[str, Any]:
    """
    Create Pip's submission for an AI opponent battle.

    Called immediately when battle transitions to ACTIVE phase,
    allowing Pip to generate their submission in parallel while
    the user is crafting their prompt.

    Args:
        battle_id: ID of the PromptBattle

    Returns:
        Dict with submission result
    """
    try:
        battle = PromptBattle.objects.select_related('opponent').get(id=battle_id)
    except PromptBattle.DoesNotExist:
        logger.error(f'Battle not found: {battle_id}')
        return {'status': 'error', 'reason': 'battle_not_found'}

    # Verify this is a Pip battle
    if not battle.opponent or battle.opponent.username != 'pip':
        logger.warning(f'Battle {battle_id} is not a Pip battle')
        return {'status': 'skipped', 'reason': 'not_pip_battle'}

    # Check if Pip already submitted
    if BattleSubmission.objects.filter(battle=battle, user=battle.opponent).exists():
        logger.info(f'Pip already submitted to battle {battle_id}')
        return {'status': 'already_submitted'}

    channel_layer = get_channel_layer()
    group_name = f'battle_{battle_id}'

    try:
        pip_ai = PipBattleAI()
        submission = pip_ai.create_pip_submission(battle)

        if not submission:
            logger.error(f'Failed to create Pip submission for battle {battle_id}')
            return {'status': 'error', 'reason': 'submission_failed'}

        # Notify that Pip submitted
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'opponent_status',
                'status': 'submitted',
            },
        )

        # Trigger image generation for Pip's submission
        generate_submission_image_task.delay(submission.id)

        logger.info(f'Pip submitted to battle {battle_id}: submission {submission.id}')
        return {'status': 'success', 'submission_id': submission.id}

    except Exception as e:
        logger.error(f'Error creating Pip submission for battle {battle_id}: {e}', exc_info=True)
        raise self.retry(exc=e) from e


@shared_task(
    time_limit=120,  # 2 minute hard limit
    soft_time_limit=90,  # 90 second soft limit
)
def handle_battle_timeout_task(battle_id: int) -> dict[str, Any]:
    """
    Handle battle timeout - end battle if time expired.

    Called by scheduler when battle duration expires.
    Awards win to the user who submitted (if only one did).

    Args:
        battle_id: ID of the PromptBattle

    Returns:
        Dict with timeout handling result
    """
    try:
        battle = PromptBattle.objects.get(id=battle_id)
    except PromptBattle.DoesNotExist:
        logger.error(f'Battle not found: {battle_id}')
        return {'status': 'error', 'reason': 'battle_not_found'}

    # Skip if battle already completed or in later phase
    if battle.phase in [BattlePhase.JUDGING, BattlePhase.REVEAL, BattlePhase.COMPLETE]:
        return {'status': 'skipped', 'reason': 'battle_progressed'}

    channel_layer = get_channel_layer()
    group_name = f'battle_{battle_id}'

    submissions = list(battle.submissions.all())

    if len(submissions) == 0:
        # No one submitted - cancel battle
        battle.status = BattleStatus.CANCELLED
        battle.phase = BattlePhase.COMPLETE
        battle.phase_changed_at = timezone.now()
        battle.save(update_fields=['status', 'phase', 'phase_changed_at'])

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'battle_cancelled',
                'reason': 'timeout_no_submissions',
            },
        )

        logger.info(f'Battle {battle_id} cancelled: no submissions')
        return {'status': 'cancelled', 'reason': 'no_submissions'}

    elif len(submissions) == 1:
        # One user submitted - they win by forfeit
        winner = submissions[0].user
        battle.winner_id = winner.id
        battle.phase = BattlePhase.COMPLETE
        battle.phase_changed_at = timezone.now()
        battle.status = BattleStatus.COMPLETED
        battle.completed_at = timezone.now()
        battle.save(update_fields=['winner_id', 'phase', 'phase_changed_at', 'status', 'completed_at'])

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'battle_forfeit',
                'winner_id': winner.id,
                'reason': 'opponent_timeout',
            },
        )

        logger.info(f'Battle {battle_id} forfeit: winner={winner.id}')
        return {'status': 'forfeit', 'winner_id': winner.id}

    else:
        # Both submitted - proceed to generating/judging
        battle.phase = BattlePhase.GENERATING
        battle.phase_changed_at = timezone.now()
        battle.save(update_fields=['phase', 'phase_changed_at'])

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'battle_event',
                'event': 'phase_change',
                'phase': BattlePhase.GENERATING,
            },
        )

        # Trigger image generation for any submissions without images
        for submission in submissions:
            if not submission.generated_output_url:
                generate_submission_image_task.delay(submission.id)

        logger.info(f'Battle {battle_id} timeout: proceeding to generation')
        return {'status': 'proceeding', 'phase': BattlePhase.GENERATING}


def _check_and_trigger_judging(battle_id: int) -> None:
    """
    Check if both submissions have images and trigger judging if so.

    Uses select_for_update to prevent race conditions where multiple
    image generation tasks complete simultaneously and both try to
    trigger judging.

    Args:
        battle_id: ID of the battle to check
    """
    from django.db import transaction

    try:
        with transaction.atomic():
            # Lock the battle row to prevent concurrent judging triggers
            battle = PromptBattle.objects.select_for_update().get(id=battle_id)

            # Only check if in generating phase
            if battle.phase != BattlePhase.GENERATING:
                logger.debug(f'Battle {battle_id} not in generating phase, skipping judging check')
                return

            submissions = list(battle.submissions.all())

            # Need exactly 2 submissions with images
            if len(submissions) != 2:
                logger.debug(f'Battle {battle_id} has {len(submissions)} submissions, need 2')
                return

            if not all(s.generated_output_url for s in submissions):
                logger.debug(f'Battle {battle_id} not all submissions have images yet')
                return

            # Transition to judging phase ATOMICALLY before triggering task
            # This prevents duplicate judging tasks
            battle.phase = BattlePhase.JUDGING
            battle.phase_changed_at = timezone.now()
            battle.save(update_fields=['phase', 'phase_changed_at'])

            logger.info(f'Both submissions have images for battle {battle_id}, triggering judging')

        # Trigger judging task OUTSIDE the transaction (after commit)
        judge_battle_task.delay(battle_id)

    except PromptBattle.DoesNotExist:
        logger.warning(f'Battle {battle_id} not found in _check_and_trigger_judging')
        return


@shared_task(
    time_limit=60,
    soft_time_limit=45,
)
def cleanup_expired_queue_entries() -> dict[str, Any]:
    """
    Clean up expired matchmaking queue entries.

    Should be run periodically (e.g., every 5-10 minutes) via Celery Beat.
    Removes entries where expires_at has passed.

    Returns:
        Dict with cleanup results
    """
    from core.battles.models import BattleMatchmakingQueue

    expired_count = BattleMatchmakingQueue.objects.filter(expires_at__lt=timezone.now()).delete()[0]

    if expired_count > 0:
        logger.info(f'Cleaned up {expired_count} expired matchmaking queue entries')

    return {'status': 'success', 'expired_count': expired_count}


# Maximum number of judging retries before force-completing
MAX_JUDGING_RETRIES = 3


@shared_task(
    time_limit=120,
    soft_time_limit=90,
)
def cleanup_stale_battles() -> dict[str, Any]:
    """
    Clean up stale battles that got stuck in intermediate phases.

    Handles battles that:
    - Are in WAITING/ACTIVE phase but expired
    - Are in GENERATING phase but no activity for 10+ minutes
    - Are in JUDGING phase but no activity for 5+ minutes
    - Force-completes battles that have exceeded retry limits

    Should be run periodically (e.g., every 15 minutes) via Celery Beat.

    Returns:
        Dict with cleanup results
    """
    from datetime import timedelta

    from django.db.models import Q

    now = timezone.now()
    results = {
        'expired_active': 0,
        'stuck_generating': 0,
        'stuck_judging': 0,
        'force_completed': 0,
    }

    # Cancel expired battles that never completed - use bulk update for efficiency
    expired_battles_qs = PromptBattle.objects.filter(
        status=BattleStatus.ACTIVE,
        phase__in=[BattlePhase.WAITING, BattlePhase.ACTIVE],
        expires_at__lt=now,
    )
    results['expired_active'] = expired_battles_qs.update(
        status=BattleStatus.CANCELLED,
        phase=BattlePhase.COMPLETE,
        phase_changed_at=now,
    )

    # Handle battles stuck in GENERATING phase
    # Use phase_changed_at if available, fall back to created_at
    stuck_generating_cutoff = now - timedelta(minutes=10)
    stuck_generating = (
        PromptBattle.objects.filter(
            phase=BattlePhase.GENERATING,
        )
        .filter(
            Q(phase_changed_at__lt=stuck_generating_cutoff)
            | (Q(phase_changed_at__isnull=True) & Q(created_at__lt=stuck_generating_cutoff))
        )
        .prefetch_related('submissions')
    )

    battles_to_cancel = []
    for battle in stuck_generating:
        # Try to complete judging if both submissions have images
        submissions = list(battle.submissions.all())
        if len(submissions) == 2 and all(s.generated_output_url for s in submissions):
            judge_battle_task.delay(battle.id)
            logger.info(f'Cleanup: Triggering judging for stuck GENERATING battle {battle.id}')
        else:
            battles_to_cancel.append(battle.id)
            logger.info(f'Cleanup: Cancelling incomplete GENERATING battle {battle.id}')
        results['stuck_generating'] += 1

    if battles_to_cancel:
        PromptBattle.objects.filter(id__in=battles_to_cancel).update(
            status=BattleStatus.CANCELLED,
            phase=BattlePhase.COMPLETE,
            phase_changed_at=now,
        )

    # Handle battles stuck in JUDGING phase
    # Use phase_changed_at if available, fall back to created_at
    stuck_judging_cutoff = now - timedelta(minutes=5)
    stuck_judging = PromptBattle.objects.filter(
        phase=BattlePhase.JUDGING,
    ).filter(
        Q(phase_changed_at__lt=stuck_judging_cutoff)
        | (Q(phase_changed_at__isnull=True) & Q(created_at__lt=stuck_judging_cutoff))
    )

    battles_to_force_complete = []
    for battle in stuck_judging:
        if battle.judging_retry_count >= MAX_JUDGING_RETRIES:
            # Too many retries - force complete the battle
            battles_to_force_complete.append(battle.id)
            logger.warning(
                f'Cleanup: Force-completing battle {battle.id} after {battle.judging_retry_count} judging retries'
            )
        else:
            # Increment retry count and retry judging
            PromptBattle.objects.filter(id=battle.id).update(judging_retry_count=battle.judging_retry_count + 1)
            judge_battle_task.delay(battle.id)
            logger.info(
                f'Cleanup: Retrying judging for stuck battle {battle.id} (attempt {battle.judging_retry_count + 1})'
            )
        results['stuck_judging'] += 1

    # Force-complete battles that exceeded retry limits
    if battles_to_force_complete:
        # Complete as a tie (no winner) since we couldn't determine scores
        PromptBattle.objects.filter(id__in=battles_to_force_complete).update(
            status=BattleStatus.COMPLETED,
            phase=BattlePhase.COMPLETE,
            phase_changed_at=now,
            completed_at=now,
            winner=None,  # No winner - judging failed
        )
        results['force_completed'] = len(battles_to_force_complete)

        # Notify via channel layer that these battles are complete
        channel_layer = get_channel_layer()
        for battle_id in battles_to_force_complete:
            async_to_sync(channel_layer.group_send)(
                f'battle_{battle_id}',
                {
                    'type': 'battle_event',
                    'event': 'battle_complete',
                    'winner_id': None,
                    'message': 'Battle completed due to judging timeout. Result is a tie.',
                },
            )

    total_cleaned = sum(results.values())
    if total_cleaned > 0:
        logger.info(f'Cleaned up stale battles: {results}')

    return {'status': 'success', **results}


@shared_task(
    time_limit=120,
    soft_time_limit=90,
)
def cleanup_expired_guest_accounts(days_old: int = 7) -> dict[str, Any]:
    """
    Clean up expired guest accounts that weren't converted to full accounts.

    Guest accounts are created when users accept battle invitations without
    logging in. If they don't convert their account within the specified
    number of days, the account is deleted.

    Should be run periodically (e.g., daily) via Celery Beat.

    Args:
        days_old: Number of days after which to delete guest accounts (default: 7)

    Returns:
        Dict with cleanup results
    """
    from services.auth import GuestUserService

    try:
        deleted_count = GuestUserService.cleanup_expired_guests(days_old=days_old)
        logger.info(f'Cleaned up {deleted_count} expired guest accounts (older than {days_old} days)')
        return {'status': 'success', 'deleted_count': deleted_count}
    except Exception as e:
        logger.error(f'Error cleaning up guest accounts: {e}', exc_info=True)
        return {'status': 'error', 'reason': str(e)}


@shared_task(
    time_limit=120,
    soft_time_limit=90,
)
def cleanup_orphaned_invitation_battles() -> dict[str, Any]:
    """
    Clean up orphaned battles created for invitations that were never accepted.

    Handles battles where:
    - The battle was created via invitation (match_source=INVITATION)
    - The invitation expired (24+ hours) and was never accepted
    - No opponent joined the battle

    Should be run periodically (e.g., every hour) via Celery Beat.

    Returns:
        Dict with cleanup results
    """
    from datetime import timedelta

    from core.battles.models import BattleInvitation, InvitationStatus, MatchSource

    now = timezone.now()
    expiry_threshold = now - timedelta(hours=24)

    results = {
        'cancelled_battles': 0,
        'expired_invitations': 0,
    }

    # Find expired pending invitations
    expired_invitations = BattleInvitation.objects.filter(
        status=InvitationStatus.PENDING,
        expires_at__lt=now,
    ).select_related('battle')

    for invitation in expired_invitations:
        # Mark invitation as expired
        invitation.status = InvitationStatus.EXPIRED
        invitation.save(update_fields=['status'])
        results['expired_invitations'] += 1

        # Cancel the associated battle if it has no opponent
        battle = invitation.battle
        if battle and battle.opponent is None and battle.status == BattleStatus.PENDING:
            battle.status = BattleStatus.CANCELLED
            battle.phase = BattlePhase.COMPLETE
            battle.phase_changed_at = now
            battle.save(update_fields=['status', 'phase', 'phase_changed_at'])
            results['cancelled_battles'] += 1
            logger.info(f'Cancelled orphaned invitation battle {battle.id}')

    # Also cancel any invitation battles that are stuck in PENDING status
    # without an opponent for more than 24 hours (safety net)
    orphaned_battles = PromptBattle.objects.filter(
        match_source=MatchSource.INVITATION,
        status=BattleStatus.PENDING,
        opponent__isnull=True,
        created_at__lt=expiry_threshold,
    )

    orphaned_count = orphaned_battles.update(
        status=BattleStatus.CANCELLED,
        phase=BattlePhase.COMPLETE,
        phase_changed_at=now,
    )
    results['cancelled_battles'] += orphaned_count

    total_cleaned = results['cancelled_battles'] + results['expired_invitations']
    if total_cleaned > 0:
        logger.info(f'Cleaned up orphaned invitation battles: {results}')

    return {'status': 'success', **results}


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    time_limit=120,  # 2 minute hard limit
    soft_time_limit=90,  # 90 second soft limit
)
def generate_og_image_task(self, battle_id: int) -> dict[str, Any]:
    """
    Generate OG image for a completed battle for social media sharing.

    Creates a 1200x630px image showing both player images side-by-side
    with scores, winner highlight, and AllThrive branding.

    Called after battle completion.

    Args:
        battle_id: ID of the PromptBattle

    Returns:
        Dict with generation result
    """
    try:
        battle = PromptBattle.objects.get(id=battle_id)
    except PromptBattle.DoesNotExist:
        logger.error(f'Battle not found for OG image generation: {battle_id}')
        return {'status': 'error', 'reason': 'battle_not_found'}

    # Skip if already has OG image
    if battle.og_image_url:
        logger.info(f'Battle {battle_id} already has OG image, skipping generation')
        return {'status': 'skipped', 'reason': 'already_generated', 'og_image_url': battle.og_image_url}

    # Skip if battle not completed
    if battle.status != BattleStatus.COMPLETED:
        logger.warning(f'Battle {battle_id} not completed, skipping OG image generation')
        return {'status': 'skipped', 'reason': 'not_completed'}

    try:
        from core.battles.og_image_service import generate_battle_og_image

        og_image_url = generate_battle_og_image(battle)

        if og_image_url:
            # Save the OG image URL to the battle
            battle.og_image_url = og_image_url
            battle.save(update_fields=['og_image_url'])

            logger.info(f'Generated OG image for battle {battle_id}: {og_image_url}')
            return {'status': 'success', 'og_image_url': og_image_url}
        else:
            logger.error(f'Failed to generate OG image for battle {battle_id}')
            return {'status': 'error', 'reason': 'generation_failed'}

    except Exception as e:
        logger.error(f'Error generating OG image for battle {battle_id}: {e}', exc_info=True)
        raise self.retry(exc=e) from e
