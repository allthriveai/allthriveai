"""
Celery tasks for Weaviate data synchronization.

Tasks:
- sync_project_to_weaviate: Sync single project (on create/update)
- sync_user_profile_to_weaviate: Sync user profile (on UserTag change)
- update_engagement_metrics: Batch update engagement velocities (hourly)
- full_reindex_projects: Full project reindex (daily)
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Count, Q
from django.utils import timezone

from .client import WeaviateClient, WeaviateClientError
from .embeddings import get_embedding_service
from .schema import WeaviateSchema

logger = logging.getLogger(__name__)


def _calculate_promotion_score(project) -> tuple[float, bool]:
    """
    Calculate promotion score for quality training in Weaviate.

    Returns:
        tuple of (promotion_score, was_promoted)
        - promotion_score: 0.0-1.0 scale, decays over PROMOTION_DURATION_DAYS
        - was_promoted: True if project was ever promoted (for historical training)
    """
    from core.projects.constants import PROMOTION_DURATION_DAYS

    if project.is_promoted and project.promoted_at:
        # Active promotion with decay
        hours_since_promotion = (timezone.now() - project.promoted_at).total_seconds() / 3600
        max_hours = PROMOTION_DURATION_DAYS * 24

        # Score starts at 1.0 and decays to 0.3 over the promotion period
        # After expiration, maintains a baseline 0.3 for quality training
        if hours_since_promotion <= max_hours:
            score = 1.0 - (0.7 * hours_since_promotion / max_hours)
        else:
            score = 0.3  # Baseline for historically promoted content

        return (round(score, 4), True)

    elif project.promoted_at:
        # Was promoted in the past but no longer active
        return (0.3, True)

    return (0.0, False)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_project_to_weaviate(self, project_id: int):
    """
    Sync a single project to Weaviate.

    Called when a project is created or updated.
    Generates embedding and upserts to Weaviate.

    Args:
        project_id: ID of the project to sync
    """
    from core.projects.models import Project

    try:
        project = Project.objects.select_related('user').prefetch_related('tools', 'categories').get(id=project_id)
    except Project.DoesNotExist:
        logger.warning(f'Project {project_id} not found, skipping Weaviate sync')
        return {'status': 'skipped', 'reason': 'not_found'}

    # Skip private/archived projects - queue removal task instead
    if project.is_private or project.is_archived:
        logger.info(f'Project {project_id} is private/archived, queueing removal from Weaviate')
        remove_project_from_weaviate.delay(project_id)
        return {'status': 'queued_removal', 'reason': 'private_or_archived'}

    try:
        client = WeaviateClient()

        if not client.is_available():
            logger.warning('Weaviate unavailable, retrying later')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        # Generate embedding
        embedding_service = get_embedding_service()
        embedding_text = embedding_service.generate_project_embedding_text(project)
        embedding_vector = embedding_service.generate_embedding(embedding_text)

        if not embedding_vector:
            logger.warning(f'Failed to generate embedding for project {project_id}')
            return {'status': 'failed', 'reason': 'embedding_failed'}

        # Calculate promotion score for quality training
        promotion_score, was_promoted = _calculate_promotion_score(project)

        # Prepare properties
        properties = {
            'project_id': project.id,
            'title': project.title,
            'combined_text': embedding_text[:5000],  # Truncate for storage
            'tool_names': list(project.tools.values_list('name', flat=True)),
            'category_names': list(project.categories.values_list('name', flat=True)),
            'topics': project.topics or [],
            'owner_id': project.user_id,
            'owner_username': project.user.username,  # For username-based search
            'engagement_velocity': 0.0,  # Will be updated by engagement task
            'like_count': project.likes.count(),
            'view_count': 0,  # TODO: Add view tracking
            # Visibility flags - critical for search isolation
            'is_private': project.is_private,
            'is_archived': project.is_archived,
            # Promotion quality signals (already rounded in helper)
            'promotion_score': promotion_score,
            'was_promoted': was_promoted,
            'created_at': project.created_at.isoformat(),
            'updated_at': project.updated_at.isoformat(),
        }

        # Check if project already exists in Weaviate
        existing = client.get_by_property(WeaviateSchema.PROJECT_COLLECTION, 'project_id', project_id)

        if existing:
            # Update existing object
            uuid = existing['_additional']['id']
            client.update_object(
                collection=WeaviateSchema.PROJECT_COLLECTION,
                uuid=uuid,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Updated project {project_id} in Weaviate')
        else:
            # Create new object
            client.add_object(
                collection=WeaviateSchema.PROJECT_COLLECTION,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Added project {project_id} to Weaviate')

        return {'status': 'success', 'project_id': project_id}

    except WeaviateClientError as e:
        logger.error(f'Weaviate error syncing project {project_id}: {e}')
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(f'Error syncing project {project_id} to Weaviate: {e}', exc_info=True)
        return {'status': 'error', 'error': str(e)}


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def remove_project_from_weaviate(self, project_id: int) -> dict:
    """
    Remove a project from Weaviate.

    Called when:
    - Project is deleted
    - Project visibility changes to private/archived/unpublished

    This is critical for privacy - ensures private content is not searchable.
    """
    try:
        client = WeaviateClient()
        if not client.is_available():
            logger.warning(f'Weaviate unavailable, retrying project removal {project_id}')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        existing = client.get_by_property(WeaviateSchema.PROJECT_COLLECTION, 'project_id', project_id)
        if existing:
            uuid = existing['_additional']['id']
            client.delete_object(WeaviateSchema.PROJECT_COLLECTION, uuid)
            logger.info(f'Removed project {project_id} from Weaviate')
            return {'status': 'removed', 'project_id': project_id}
        else:
            logger.debug(f'Project {project_id} not found in Weaviate, nothing to remove')
            return {'status': 'not_found', 'project_id': project_id}

    except WeaviateClientError as e:
        logger.error(f'Weaviate error removing project {project_id}: {e}')
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(f'Error removing project {project_id} from Weaviate: {e}', exc_info=True)
        return {'status': 'error', 'error': str(e)}


@shared_task(bind=True, max_retries=5, default_retry_delay=10)
def remove_user_profile_from_weaviate(self, user_id: int) -> dict:
    """
    GDPR Compliance: Remove a user's profile from Weaviate.

    Called when:
    - User account is deleted
    - User requests data deletion (GDPR right to erasure)

    This task has extra retries because GDPR deletion is legally required.
    """
    try:
        client = WeaviateClient()
        if not client.is_available():
            logger.warning(f'Weaviate unavailable, retrying user profile removal {user_id}')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        existing = client.get_by_property(WeaviateSchema.USER_PROFILE_COLLECTION, 'user_id', user_id)
        if existing:
            uuid = existing['_additional']['id']
            client.delete_object(WeaviateSchema.USER_PROFILE_COLLECTION, uuid)
            logger.info(
                f'GDPR: Removed user profile {user_id} from Weaviate',
                extra={'user_id': user_id, 'gdpr_action': 'delete_complete'},
            )
            return {'status': 'removed', 'user_id': user_id}
        else:
            logger.debug(f'User profile {user_id} not found in Weaviate')
            return {'status': 'not_found', 'user_id': user_id}

    except WeaviateClientError as e:
        logger.error(
            f'GDPR: Weaviate error removing user {user_id}, will retry: {e}',
            extra={'user_id': user_id, 'gdpr_action': 'delete_retry'},
        )
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(
            f'GDPR CRITICAL: Failed to remove user {user_id} from Weaviate: {e}',
            extra={'user_id': user_id, 'gdpr_action': 'delete_failed'},
            exc_info=True,
        )
        return {'status': 'error', 'error': str(e)}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_user_profile_to_weaviate(self, user_id: int):
    """
    Sync a user's profile to Weaviate.

    Called when UserTags change or after significant activity.
    Generates preference vector and upserts to Weaviate.

    Args:
        user_id: ID of the user to sync
    """
    from django.contrib.auth import get_user_model

    from core.taxonomy.models import UserInteraction, UserTag

    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.warning(f'User {user_id} not found, skipping Weaviate sync')
        return {'status': 'skipped', 'reason': 'not_found'}

    try:
        client = WeaviateClient()

        if not client.is_available():
            logger.warning('Weaviate unavailable, retrying later')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        # Generate embedding
        embedding_service = get_embedding_service()
        embedding_text = embedding_service.generate_user_profile_embedding_text(user)

        if not embedding_text:
            logger.info(f'No profile data for user {user_id}, skipping')
            return {'status': 'skipped', 'reason': 'no_data'}

        embedding_vector = embedding_service.generate_embedding(embedding_text)

        if not embedding_vector:
            logger.warning(f'Failed to generate embedding for user {user_id}')
            return {'status': 'failed', 'reason': 'embedding_failed'}

        # Get user interests from tags
        user_tags = UserTag.objects.filter(user=user)
        tool_interests = list(user_tags.filter(taxonomy__taxonomy_type='tool').values_list('taxonomy__name', flat=True))
        category_interests = list(
            user_tags.filter(taxonomy__taxonomy_type='category').values_list('taxonomy__name', flat=True)
        )
        topic_interests = list(user_tags.filter(taxonomy__isnull=True).values_list('name', flat=True))

        # Get interaction and like counts
        interaction_count = UserInteraction.objects.filter(user=user).count()
        from core.projects.models import ProjectLike

        like_count = ProjectLike.objects.filter(user=user).count()

        # Check user's privacy preference for similarity matching
        # Field is on User model directly, defaults to True for better recommendations
        allow_similarity = getattr(user, 'allow_similarity_matching', True)

        # Prepare properties - NOTE: preference_text is NOT stored for privacy
        # Only aggregated, non-PII interests are persisted
        properties = {
            'user_id': user.id,
            # preference_text intentionally omitted - sensitive data
            'tool_interests': tool_interests,
            'category_interests': category_interests,
            'topic_interests': topic_interests,
            'interaction_count': interaction_count,
            'like_count': like_count,
            'allow_similarity_matching': allow_similarity,
            'updated_at': timezone.now().isoformat(),
        }

        # Check if user profile already exists
        existing = client.get_by_property(WeaviateSchema.USER_PROFILE_COLLECTION, 'user_id', user_id)

        if existing:
            uuid = existing['_additional']['id']
            client.update_object(
                collection=WeaviateSchema.USER_PROFILE_COLLECTION,
                uuid=uuid,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Updated user profile {user_id} in Weaviate')
        else:
            client.add_object(
                collection=WeaviateSchema.USER_PROFILE_COLLECTION,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Added user profile {user_id} to Weaviate')

        return {'status': 'success', 'user_id': user_id}

    except WeaviateClientError as e:
        logger.error(f'Weaviate error syncing user {user_id}: {e}')
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(f'Error syncing user {user_id} to Weaviate: {e}', exc_info=True)
        return {'status': 'error', 'error': str(e)}


@shared_task
def update_engagement_metrics():
    """
    Update engagement velocity metrics for all projects.

    Runs hourly via Celery beat. Splits work into chunks to avoid
    long-running tasks that exceed the schedule interval.

    This task orchestrates the work by spawning chunk tasks.
    """
    from core.projects.models import Project

    logger.info('Starting engagement metrics update orchestrator')

    try:
        # Count total projects
        total_projects = Project.objects.filter(
            is_private=False,
            is_archived=False,
        ).count()

        if total_projects == 0:
            logger.warning('No projects found for engagement metrics update')
            return {
                'status': 'skipped',
                'reason': 'no_projects',
                'total_projects': 0,
            }

        # Process in chunks of 500 projects per subtask
        # This ensures each subtask completes in ~30-60 seconds
        CHUNK_SIZE = 500
        chunk_count = (total_projects + CHUNK_SIZE - 1) // CHUNK_SIZE

        logger.info(
            f'Queueing {chunk_count} engagement update chunks for {total_projects} projects (chunk_size={CHUNK_SIZE})'
        )

        # Queue chunk tasks
        for chunk_idx in range(chunk_count):
            offset = chunk_idx * CHUNK_SIZE
            update_engagement_metrics_chunk.delay(offset, CHUNK_SIZE)

        result = {
            'status': 'queued',
            'total_projects': total_projects,
            'chunks': chunk_count,
            'chunk_size': CHUNK_SIZE,
        }
        logger.info(f'Engagement metrics orchestrator complete: {result}')
        return result

    except Exception as e:
        logger.error(f'Engagement metrics orchestrator failed: {e}', exc_info=True)
        return {
            'status': 'error',
            'error': str(e),
        }


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def update_engagement_metrics_chunk(self, offset: int, limit: int):
    """
    Update engagement metrics for a chunk of projects.

    Uses batch queries to avoid N+1 patterns. Each chunk processes
    ~500 projects in a single pass with minimal database queries.

    Args:
        offset: Starting offset for this chunk
        limit: Number of projects to process
    """
    from django.db.models import Case, IntegerField, Sum, When

    from core.projects.models import Project

    client = WeaviateClient()
    if not client.is_available():
        logger.warning('Weaviate unavailable, retrying chunk')
        raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

    now = timezone.now()
    hours_24_ago = now - timedelta(hours=24)
    hours_48_ago = now - timedelta(hours=48)

    # Get projects with engagement counts in ONE query using annotations
    # This replaces the N+1 pattern of querying per project
    projects = (
        Project.objects.filter(
            is_private=False,
            is_archived=False,
        )
        .order_by('id')  # Consistent ordering for pagination
        .annotate(
            # Recent likes (last 24 hours)
            recent_likes=Sum(
                Case(
                    When(
                        likes__created_at__gte=hours_24_ago,
                        likes__created_at__lt=now,
                        then=1,
                    ),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
            # Previous period likes (24-48 hours ago)
            prev_likes=Sum(
                Case(
                    When(
                        likes__created_at__gte=hours_48_ago,
                        likes__created_at__lt=hours_24_ago,
                        then=1,
                    ),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
            # Total likes
            total_likes=Count('likes'),
        )
        .only('id', 'created_at')[offset : offset + limit]
    )

    updated_count = 0
    error_count = 0

    # Batch updates to Weaviate
    updates = []

    for project in projects:
        try:
            recent = project.recent_likes or 0
            prev = project.prev_likes or 0

            # Calculate velocity
            like_velocity = (recent - prev) / max(prev, 1)

            # Apply recency factor
            days_old = (now - project.created_at).days
            recency_factor = 1.0 / (1 + days_old * 0.1)
            velocity = round(like_velocity * 0.7 * recency_factor, 4)

            updates.append(
                {
                    'project_id': project.id,
                    'engagement_velocity': velocity,
                    'like_count': project.total_likes or 0,
                }
            )

        except Exception as e:
            logger.error(f'Error calculating engagement for project {project.id}: {e}')
            error_count += 1

    # Batch update to Weaviate
    for update in updates:
        try:
            success = client.update_project_engagement(
                project_id=update['project_id'],
                engagement_velocity=update['engagement_velocity'],
                like_count=update['like_count'],
                view_count=0,
            )
            if success:
                updated_count += 1
        except Exception as e:
            logger.error(f'Error updating Weaviate for project {update["project_id"]}: {e}')
            error_count += 1

    logger.info(f'Engagement chunk complete (offset={offset}): {updated_count} updated, {error_count} errors')
    return {
        'status': 'complete',
        'offset': offset,
        'updated': updated_count,
        'errors': error_count,
    }


@shared_task
def full_reindex_projects():
    """
    Full reindex of all projects to Weaviate.

    Runs daily at 3 AM via Celery beat. Uses chunked batch processing
    to avoid overwhelming the task queue with 500K individual tasks.
    """
    from core.projects.models import Project

    logger.info('Starting full project reindex orchestrator')

    try:
        # Check Weaviate availability before starting
        from .client import WeaviateClient

        client = WeaviateClient()
        if not client.is_available():
            logger.error('Weaviate unavailable, aborting full reindex')
            return {
                'status': 'aborted',
                'reason': 'weaviate_unavailable',
            }

        # Count total projects
        total = Project.objects.filter(
            is_private=False,
            is_archived=False,
        ).count()

        if total == 0:
            logger.warning('No projects found for reindex')
            return {
                'status': 'skipped',
                'reason': 'no_projects',
                'total_projects': 0,
            }

        # Process in chunks of 100 projects per subtask
        # Each chunk generates embeddings and syncs to Weaviate
        CHUNK_SIZE = 100
        chunk_count = (total + CHUNK_SIZE - 1) // CHUNK_SIZE
        stagger_seconds = 2

        logger.info(
            f'Queueing {chunk_count} reindex chunks for {total} projects '
            f'(chunk_size={CHUNK_SIZE}, stagger={stagger_seconds}s)'
        )

        # Queue chunk tasks with delays to spread load
        for chunk_idx in range(chunk_count):
            offset = chunk_idx * CHUNK_SIZE
            # Stagger chunks by 2 seconds to avoid API rate limits
            reindex_projects_chunk.apply_async(
                args=[offset, CHUNK_SIZE],
                countdown=chunk_idx * stagger_seconds,
            )

        result = {
            'status': 'queued',
            'total_projects': total,
            'chunks': chunk_count,
            'chunk_size': CHUNK_SIZE,
            'estimated_duration_minutes': round(chunk_count * stagger_seconds / 60, 1),
        }
        logger.info(f'Full reindex orchestrator complete: {result}')
        return result

    except Exception as e:
        logger.error(f'Full reindex orchestrator failed: {e}', exc_info=True)
        return {
            'status': 'error',
            'error': str(e),
        }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def reindex_projects_chunk(self, offset: int, limit: int):
    """
    Reindex a chunk of projects to Weaviate.

    Processes projects in batch, generating embeddings and syncing
    to Weaviate efficiently.

    Args:
        offset: Starting offset for this chunk
        limit: Number of projects to process
    """
    from core.projects.models import Project

    try:
        client = WeaviateClient()
        if not client.is_available():
            logger.warning('Weaviate unavailable, retrying chunk')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        embedding_service = get_embedding_service()

        # Get projects for this chunk
        projects = (
            Project.objects.filter(
                is_private=False,
                is_archived=False,
            )
            .select_related('user')
            .prefetch_related('tools', 'categories', 'likes')
            .order_by('id')[offset : offset + limit]
        )

        synced_count = 0
        error_count = 0

        for project in projects:
            try:
                # Generate embedding
                embedding_text = embedding_service.generate_project_embedding_text(project)
                embedding_vector = embedding_service.generate_embedding(embedding_text)

                if not embedding_vector:
                    logger.warning(f'Failed to generate embedding for project {project.id}')
                    error_count += 1
                    continue

                # Prepare properties
                properties = {
                    'project_id': project.id,
                    'title': project.title,
                    'combined_text': embedding_text[:5000],
                    'tool_names': list(project.tools.values_list('name', flat=True)),
                    'category_names': list(project.categories.values_list('name', flat=True)),
                    'topics': project.topics or [],
                    'owner_id': project.user_id,
                    'owner_username': project.user.username,  # For username-based search
                    'engagement_velocity': project.engagement_velocity or 0.0,
                    'like_count': project.likes.count(),
                    'view_count': project.view_count or 0,
                    # Visibility flags - critical for search isolation
                    'is_private': project.is_private,
                    'is_archived': project.is_archived,
                    'created_at': project.created_at.isoformat(),
                    'updated_at': project.updated_at.isoformat(),
                }

                # Upsert to Weaviate
                existing = client.get_by_property(WeaviateSchema.PROJECT_COLLECTION, 'project_id', project.id)

                if existing:
                    uuid = existing['_additional']['id']
                    client.update_object(
                        collection=WeaviateSchema.PROJECT_COLLECTION,
                        uuid=uuid,
                        properties=properties,
                        vector=embedding_vector,
                    )
                else:
                    client.add_object(
                        collection=WeaviateSchema.PROJECT_COLLECTION,
                        properties=properties,
                        vector=embedding_vector,
                    )

                synced_count += 1

            except Exception as e:
                logger.error(f'Error reindexing project {project.id}: {e}')
                error_count += 1

        logger.info(f'Reindex chunk complete (offset={offset}): {synced_count} synced, {error_count} errors')
        return {
            'status': 'complete',
            'offset': offset,
            'synced': synced_count,
            'errors': error_count,
        }

    except WeaviateClientError as e:
        logger.error(f'Weaviate error in reindex chunk: {e}')
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(f'Error in reindex chunk (offset={offset}): {e}', exc_info=True)
        return {'status': 'error', 'offset': offset, 'error': str(e)}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_quiz_to_weaviate(self, quiz_id: str):
    """
    Sync a single quiz to Weaviate.

    Called when a quiz is created or updated.
    Generates embedding and upserts to Weaviate.

    Args:
        quiz_id: UUID of the quiz to sync (as string)
    """
    from core.quizzes.models import Quiz

    try:
        quiz = Quiz.objects.prefetch_related('tools', 'categories', 'questions').get(id=quiz_id)
    except Quiz.DoesNotExist:
        logger.warning(f'Quiz {quiz_id} not found, skipping Weaviate sync')
        return {'status': 'skipped', 'reason': 'not_found'}

    # Skip unpublished quizzes
    if not quiz.is_published:
        logger.info(f'Quiz {quiz_id} is not published, skipping Weaviate sync')
        return {'status': 'skipped', 'reason': 'not_published'}

    try:
        client = WeaviateClient()

        if not client.is_available():
            logger.warning('Weaviate unavailable, retrying later')
            raise self.retry(exc=WeaviateClientError('Weaviate unavailable'))

        # Generate embedding
        embedding_service = get_embedding_service()

        # Build embedding text from quiz content
        tool_names = list(quiz.tools.values_list('name', flat=True))
        category_names = list(quiz.categories.values_list('name', flat=True))
        topics = quiz.topics or []

        embedding_text = (
            f'{quiz.title}. {quiz.description or ""}. Topic: {quiz.topic or ""}. '
            f'Topics: {", ".join(topics)}. Tools: {", ".join(tool_names)}. '
            f'Categories: {", ".join(category_names)}.'
        )

        embedding_vector = embedding_service.generate_embedding(embedding_text)

        if not embedding_vector:
            logger.warning(f'Failed to generate embedding for quiz {quiz_id}')
            return {'status': 'failed', 'reason': 'embedding_failed'}

        # Prepare properties
        properties = {
            'quiz_id': str(quiz.id),
            'title': quiz.title,
            'combined_text': embedding_text[:5000],
            'description': quiz.description or '',
            'topic': quiz.topic or '',
            'topics': topics,
            'difficulty': quiz.difficulty or 'beginner',
            'tool_names': tool_names,
            'category_names': category_names,
            'question_count': quiz.questions.count(),
            'is_published': quiz.is_published,
            'created_at': quiz.created_at.isoformat(),
        }

        # Check if quiz already exists in Weaviate
        existing = client.get_by_property(WeaviateSchema.QUIZ_COLLECTION, 'quiz_id', str(quiz_id))

        if existing:
            uuid = existing['_additional']['id']
            client.update_object(
                collection=WeaviateSchema.QUIZ_COLLECTION,
                uuid=uuid,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Updated quiz {quiz_id} in Weaviate')
        else:
            client.add_object(
                collection=WeaviateSchema.QUIZ_COLLECTION,
                properties=properties,
                vector=embedding_vector,
            )
            logger.info(f'Added quiz {quiz_id} to Weaviate')

        return {'status': 'success', 'quiz_id': str(quiz_id)}

    except WeaviateClientError as e:
        logger.error(f'Weaviate error syncing quiz {quiz_id}: {e}')
        raise self.retry(exc=e) from e
    except Exception as e:
        logger.error(f'Error syncing quiz {quiz_id} to Weaviate: {e}', exc_info=True)
        return {'status': 'error', 'error': str(e)}


@shared_task
def full_reindex_quizzes():
    """
    Full reindex of all published quizzes to Weaviate.

    Called manually or scheduled periodically.
    """
    from core.quizzes.models import Quiz

    logger.info('Starting full quiz reindex')

    try:
        client = WeaviateClient()
        if not client.is_available():
            logger.error('Weaviate unavailable, aborting quiz reindex')
            return {'status': 'aborted', 'reason': 'weaviate_unavailable'}

        # Get published quizzes
        quizzes = Quiz.objects.filter(is_published=True).values_list('id', flat=True)
        quiz_ids = [str(q) for q in quizzes]
        total = len(quiz_ids)

        if total == 0:
            logger.warning('No published quizzes found for reindex')
            return {'status': 'skipped', 'reason': 'no_quizzes', 'total': 0}

        logger.info(f'Queueing {total} quiz reindex tasks')

        for quiz_id in quiz_ids:
            sync_quiz_to_weaviate.delay(quiz_id)

        return {'status': 'queued', 'total_quizzes': total}

    except Exception as e:
        logger.error(f'Quiz reindex failed: {e}', exc_info=True)
        return {'status': 'error', 'error': str(e)}


@shared_task
def full_reindex_users():
    """
    Full reindex of all user profiles to Weaviate.

    Called manually or scheduled periodically to ensure
    user profiles are up to date.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()

    logger.info('Starting full user profile reindex orchestrator')

    try:
        # Check Weaviate availability before starting
        from .client import WeaviateClient

        client = WeaviateClient()
        if not client.is_available():
            logger.error('Weaviate unavailable, aborting user reindex')
            return {
                'status': 'aborted',
                'reason': 'weaviate_unavailable',
            }

        # Get users who have at least some activity
        active_users = (
            User.objects.filter(Q(tags__isnull=False) | Q(interactions__isnull=False) | Q(project_likes__isnull=False))
            .distinct()
            .values_list('id', flat=True)
        )

        user_ids = list(active_users)
        total = len(user_ids)

        if total == 0:
            logger.warning('No active users found for reindex')
            return {
                'status': 'skipped',
                'reason': 'no_users',
                'total_users': 0,
            }

        logger.info(f'Queueing {total} user profile reindex tasks')

        for user_id in user_ids:
            sync_user_profile_to_weaviate.delay(user_id)

        result = {
            'status': 'queued',
            'total_users': total,
        }
        logger.info(f'User reindex orchestrator complete: {result}')
        return result

    except Exception as e:
        logger.error(f'User reindex orchestrator failed: {e}', exc_info=True)
        return {
            'status': 'error',
            'error': str(e),
        }
