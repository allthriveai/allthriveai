"""
Celery tasks for sharing battles to Instagram.

Two workflows:
1. User Sharing - User manually shares their battle win to their connected Instagram
2. Automated @pip Posting - Any battle where @pip participates auto-posts to @pipromptbattle
"""

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)

User = get_user_model()


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=120,
    time_limit=180,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
)
def share_battle_to_user_instagram(self, battle_id: int, user_id: int) -> dict:
    """User-initiated: Share battle win to user's own Instagram.

    This task is triggered when a user clicks "Share to Instagram" after winning a battle.

    Args:
        battle_id: ID of the battle to share
        user_id: ID of the user sharing (must be the winner)

    Returns:
        dict with status and optional post_id/error
    """
    from core.battles.models import PromptBattle
    from core.social.models import SocialConnection

    from .instagram_templates import build_battle_caption, generate_battle_carousel

    try:
        battle = PromptBattle.objects.select_related('winner', 'challenger', 'opponent').get(id=battle_id)

        # Verify user is the winner
        if battle.winner_id != user_id:
            logger.warning(f'User {user_id} tried to share battle {battle_id} but is not the winner')
            return {'status': 'error', 'error': 'Only the winner can share'}

        # Get user's Instagram connection
        try:
            connection = SocialConnection.objects.get(user_id=user_id, provider='instagram', is_active=True)
        except SocialConnection.DoesNotExist:
            logger.warning(f'User {user_id} has no active Instagram connection')
            return {'status': 'error', 'error': 'Instagram not connected'}

        # Check token not expired
        if connection.is_token_expired():
            logger.warning(f'User {user_id} Instagram token expired')
            return {'status': 'error', 'error': 'Instagram token expired, please reconnect'}

        # Determine winner and loser
        winner = battle.winner
        loser = battle.opponent if battle.winner == battle.challenger else battle.challenger

        # Get submissions
        submissions = battle.submissions.select_related('user').all()
        winner_submission = next((s for s in submissions if s.user_id == winner.id), None)
        loser_submission = next((s for s in submissions if s.user_id == loser.id), None)

        # Generate carousel images
        image_urls = generate_battle_carousel(
            battle=battle,
            winner=winner,
            loser=loser,
            winner_submission=winner_submission,
            loser_submission=loser_submission,
        )

        if len(image_urls) < 3:
            logger.error(f'Failed to generate all carousel images for battle {battle_id}')
            return {'status': 'error', 'error': 'Failed to generate images'}

        # Build caption
        caption = build_battle_caption(battle, winner, loser, winner_submission)

        # Publish to user's Instagram
        from services.integrations.instagram import InstagramPublisher

        publisher = InstagramPublisher(
            access_token=connection.access_token,
            user_id=connection.provider_user_id,
        )

        result = publisher.publish_carousel(image_urls, caption)
        post_id = result.get('id')

        logger.info(f'User {user_id} shared battle {battle_id} to Instagram: {post_id}')

        return {'status': 'success', 'post_id': post_id}

    except PromptBattle.DoesNotExist:
        logger.error(f'Battle {battle_id} not found')
        return {'status': 'error', 'error': 'Battle not found'}
    except Exception as e:
        logger.error(f'Error sharing battle {battle_id} to Instagram: {e}', exc_info=True)
        raise  # Let Celery retry


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=120,
    time_limit=180,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
)
def post_pip_battle_to_instagram(self, battle_id: int) -> dict:
    """Automated: Post ALL @pip battles (win or lose) to @pipromptbattle account.

    This task is triggered automatically after a battle completes where @pip participated.

    Args:
        battle_id: ID of the battle to post

    Returns:
        dict with status and optional post_id/error
    """
    from core.battles.models import PromptBattle

    from .instagram_templates import build_battle_caption, generate_battle_carousel

    try:
        battle = PromptBattle.objects.select_related('winner', 'challenger', 'opponent').get(id=battle_id)

        # Get @pip user
        try:
            pip_user = User.objects.get(username='pip')
        except User.DoesNotExist:
            logger.warning('Pip user not found - skipping Instagram auto-post')
            return {'status': 'skipped', 'reason': 'pip user not found'}

        # Verify @pip participated in this battle
        if battle.challenger_id != pip_user.id and battle.opponent_id != pip_user.id:
            logger.warning(f'Battle {battle_id}: @pip did not participate, skipping')
            return {'status': 'skipped', 'reason': 'pip not in battle'}

        # Check if already posted (prevent duplicates)
        if battle.instagram_post_id:
            logger.info(f'Battle {battle_id} already posted to Instagram, skipping')
            return {'status': 'skipped', 'reason': 'already posted'}

        # Check if Instagram posting is enabled
        if not getattr(settings, 'PIPROMPTBATTLE_INSTAGRAM_ENABLED', False):
            logger.info('PIPROMPTBATTLE_INSTAGRAM_ENABLED is False, skipping')
            return {'status': 'skipped', 'reason': 'posting disabled'}

        # Get required credentials
        access_token = getattr(settings, 'PIPROMPTBATTLE_INSTAGRAM_ACCESS_TOKEN', '')
        ig_user_id = getattr(settings, 'PIPROMPTBATTLE_INSTAGRAM_USER_ID', '')

        if not access_token or not ig_user_id:
            logger.error('PIPROMPTBATTLE_INSTAGRAM credentials not configured')
            return {'status': 'error', 'error': 'credentials not configured'}

        # Determine winner and loser
        if battle.winner is None:
            logger.warning(f'Battle {battle_id} has no winner, skipping Instagram post')
            return {'status': 'skipped', 'reason': 'no winner'}

        winner = battle.winner
        loser = battle.opponent if battle.winner == battle.challenger else battle.challenger

        # Get submissions
        submissions = battle.submissions.select_related('user').all()
        winner_submission = next((s for s in submissions if s.user_id == winner.id), None)
        loser_submission = next((s for s in submissions if s.user_id == loser.id), None)

        # Generate carousel images
        image_urls = generate_battle_carousel(
            battle=battle,
            winner=winner,
            loser=loser,
            winner_submission=winner_submission,
            loser_submission=loser_submission,
        )

        if len(image_urls) < 3:
            logger.error(f'Failed to generate all carousel images for battle {battle_id}')
            return {'status': 'error', 'error': 'failed to generate images'}

        # Build caption
        caption = build_battle_caption(battle, winner, loser, winner_submission)

        # Publish using @pipromptbattle credentials
        from services.integrations.instagram import InstagramPublisher

        publisher = InstagramPublisher(
            access_token=access_token,
            user_id=ig_user_id,
        )

        result = publisher.publish_carousel(image_urls, caption)
        post_id = result.get('id')

        # Get permalink
        post_url = publisher.get_post_permalink(post_id) if post_id else None

        # Store Instagram post ID on battle
        battle.instagram_post_id = post_id
        battle.instagram_posted_at = timezone.now()
        if post_url:
            battle.instagram_post_url = post_url
        battle.save(update_fields=['instagram_post_id', 'instagram_posted_at', 'instagram_post_url'])

        logger.info(f'Posted battle {battle_id} to @pipromptbattle Instagram: {post_id}')

        return {'status': 'success', 'post_id': post_id, 'post_url': post_url}

    except PromptBattle.DoesNotExist:
        logger.error(f'Battle {battle_id} not found')
        return {'status': 'error', 'error': 'battle not found'}
    except Exception as e:
        logger.error(f'Error posting battle {battle_id} to Instagram: {e}', exc_info=True)
        raise  # Let Celery retry
