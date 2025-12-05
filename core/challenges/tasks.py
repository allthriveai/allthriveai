"""Celery tasks for Weekly Challenges."""

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name='challenges.update_challenge_statuses')
def update_challenge_statuses():
    """Update challenge statuses based on timing.

    Run every minute to transition challenges between states:
    - upcoming -> active (when starts_at is reached)
    - active -> voting (when submission_deadline is reached)
    - voting -> completed (when voting_deadline is reached)
    """
    from core.challenges.models import ChallengeStatus, WeeklyChallenge

    now = timezone.now()
    updated = 0

    # Upcoming -> Active
    upcoming = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.UPCOMING,
        starts_at__lte=now,
    )
    count = upcoming.update(status=ChallengeStatus.ACTIVE)
    if count:
        logger.info(f'Activated {count} challenges')
        updated += count

    # Active -> Voting (if voting period configured)
    active_to_voting = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.ACTIVE,
        submission_deadline__lte=now,
        voting_deadline__isnull=False,
        voting_deadline__gt=now,
    )
    count = active_to_voting.update(status=ChallengeStatus.VOTING)
    if count:
        logger.info(f'Moved {count} challenges to voting period')
        updated += count

    # Active -> Completed (if no voting period)
    active_to_completed = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.ACTIVE,
        submission_deadline__lte=now,
        voting_deadline__isnull=True,
    )
    for challenge in active_to_completed:
        finalize_challenge.delay(str(challenge.id))
        updated += 1

    # Voting -> Completed
    voting_to_completed = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.VOTING,
        voting_deadline__lte=now,
    )
    for challenge in voting_to_completed:
        finalize_challenge.delay(str(challenge.id))
        updated += 1

    if updated:
        logger.info(f'Updated {updated} challenge statuses')


@shared_task(name='challenges.finalize_challenge')
def finalize_challenge(challenge_id: str):
    """Finalize a challenge - compute rankings and distribute rewards.

    This task:
    1. Computes final rankings from vote counts
    2. Awards prize points to winners
    3. Updates participant stats
    4. Syncs leaderboard to database
    5. Marks challenge as completed
    """
    from core.challenges.models import (
        ChallengeParticipant,
        ChallengeStatus,
        ChallengeSubmission,
        WeeklyChallenge,
    )

    try:
        challenge = WeeklyChallenge.objects.get(id=challenge_id)
    except WeeklyChallenge.DoesNotExist:
        logger.error(f'Challenge {challenge_id} not found')
        return

    if challenge.status == ChallengeStatus.COMPLETED:
        logger.info(f'Challenge {challenge_id} already completed')
        return

    logger.info(f'Finalizing challenge: {challenge.title}')

    with transaction.atomic():
        # Get all submissions ordered by votes
        submissions = list(
            ChallengeSubmission.objects.filter(
                challenge=challenge,
                is_disqualified=False,
            ).order_by('-vote_count', 'submitted_at')
        )

        # Assign final ranks
        for rank, submission in enumerate(submissions, 1):
            submission.final_rank = rank
            submission.save(update_fields=['final_rank'])

        # Award prize points
        points_config = challenge.points_config

        for submission in submissions:
            rank = submission.final_rank
            prize_points = 0

            # Check for rank-based prizes
            if rank == 1:
                prize_points = points_config.get('winner_1st', 500)
            elif rank == 2:
                prize_points = points_config.get('winner_2nd', 300)
            elif rank == 3:
                prize_points = points_config.get('winner_3rd', 200)
            elif rank <= 10:
                prize_points = points_config.get('top_10', 100)

            if prize_points > 0:
                submission.prize_points = prize_points
                submission.save(update_fields=['prize_points'])

                # Award points via user.add_points
                submission.user.add_points(
                    prize_points,
                    'challenge_prize',
                    f'Rank #{rank} in challenge: {challenge.title}',
                )

                logger.info(f'Awarded {prize_points} points to {submission.user.username} for rank #{rank}')

        # Update all participant stats
        participants = ChallengeParticipant.objects.filter(challenge=challenge)
        for participant in participants:
            participant.update_stats()

        # Update challenge stats
        challenge.update_stats()

        # Mark as completed
        challenge.status = ChallengeStatus.COMPLETED
        challenge.save(update_fields=['status'])

        logger.info(f'Challenge {challenge.title} finalized. {len(submissions)} submissions ranked.')


@shared_task(name='challenges.sync_leaderboard')
def sync_leaderboard(challenge_id: str):
    """Sync Redis leaderboard from database.

    Use this for recovery or if Redis data is lost.
    """
    from core.challenges.leaderboard import ChallengeLeaderboardService

    ChallengeLeaderboardService.sync_from_database(challenge_id)
    logger.info(f'Synced leaderboard for challenge {challenge_id}')


@shared_task(name='challenges.update_challenge_stats')
def update_challenge_stats():
    """Update cached stats for all active challenges.

    Run every 5 minutes to keep stats fresh.
    """
    from core.challenges.models import ChallengeStatus, WeeklyChallenge

    active = WeeklyChallenge.objects.filter(status__in=[ChallengeStatus.ACTIVE, ChallengeStatus.VOTING])

    for challenge in active:
        challenge.update_stats()

    logger.info(f'Updated stats for {active.count()} active challenges')


@shared_task(name='challenges.send_deadline_reminders')
def send_deadline_reminders():
    """Send reminders for upcoming deadlines.

    Run every hour to send reminders:
    - 24 hours before submission deadline
    - 1 hour before submission deadline
    """
    from core.challenges.models import ChallengeParticipant, ChallengeStatus, WeeklyChallenge
    from core.notifications.services import NotificationService

    now = timezone.now()

    # 24 hour reminder
    deadline_24h = now + timedelta(hours=24)
    challenges_24h = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.ACTIVE,
        submission_deadline__gte=deadline_24h - timedelta(minutes=30),
        submission_deadline__lte=deadline_24h + timedelta(minutes=30),
    )

    for challenge in challenges_24h:
        # Get participants who haven't submitted
        participants = ChallengeParticipant.objects.filter(
            challenge=challenge,
            submission_count=0,
        ).select_related('user')

        for participant in participants:
            NotificationService.create_notification(
                user=participant.user,
                notification_type='challenge_reminder',
                title=f'24 hours left: {challenge.title}',
                message='Submit your entry before the deadline!',
                data={'challenge_id': str(challenge.id), 'challenge_slug': challenge.slug},
            )

    # 1 hour reminder
    deadline_1h = now + timedelta(hours=1)
    challenges_1h = WeeklyChallenge.objects.filter(
        status=ChallengeStatus.ACTIVE,
        submission_deadline__gte=deadline_1h - timedelta(minutes=5),
        submission_deadline__lte=deadline_1h + timedelta(minutes=5),
    )

    for challenge in challenges_1h:
        participants = ChallengeParticipant.objects.filter(
            challenge=challenge,
            submission_count=0,
        ).select_related('user')

        for participant in participants:
            NotificationService.create_notification(
                user=participant.user,
                notification_type='challenge_reminder',
                title=f'1 hour left: {challenge.title}',
                message='Last chance to submit your entry!',
                data={'challenge_id': str(challenge.id), 'challenge_slug': challenge.slug},
            )
