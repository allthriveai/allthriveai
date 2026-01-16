import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.listings.models import Listing, ListingComment, ListingHeart, ListingSave, ListingStatus, ListingView

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ListingHeart)
def increment_heart_count(sender, instance, created, **kwargs):
    """Increment heart_count when a heart is created."""
    if created:
        from django.db.models import F

        instance.listing.__class__.objects.filter(pk=instance.listing_id).update(heart_count=F('heart_count') + 1)


@receiver(post_delete, sender=ListingHeart)
def decrement_heart_count(sender, instance, **kwargs):
    """Decrement heart_count when a heart is deleted."""
    from django.db.models import F

    instance.listing.__class__.objects.filter(pk=instance.listing_id).update(heart_count=F('heart_count') - 1)


@receiver(post_save, sender=ListingSave)
def increment_save_count(sender, instance, created, **kwargs):
    """Increment save_count when a save is created."""
    if created:
        from django.db.models import F

        instance.listing.__class__.objects.filter(pk=instance.listing_id).update(save_count=F('save_count') + 1)


@receiver(post_delete, sender=ListingSave)
def decrement_save_count(sender, instance, **kwargs):
    """Decrement save_count when a save is deleted."""
    from django.db.models import F

    instance.listing.__class__.objects.filter(pk=instance.listing_id).update(save_count=F('save_count') - 1)


@receiver(post_save, sender=ListingComment)
def increment_comment_count(sender, instance, created, **kwargs):
    """Increment comment_count when a comment is created (if approved)."""
    if created and instance.moderation_status == 'approved':
        from django.db.models import F

        instance.listing.__class__.objects.filter(pk=instance.listing_id).update(comment_count=F('comment_count') + 1)


@receiver(post_delete, sender=ListingComment)
def decrement_comment_count(sender, instance, **kwargs):
    """Decrement comment_count when a comment is deleted."""
    if instance.moderation_status == 'approved':
        from django.db.models import F

        instance.listing.__class__.objects.filter(pk=instance.listing_id).update(comment_count=F('comment_count') - 1)


@receiver(post_save, sender=ListingView)
def increment_view_count(sender, instance, created, **kwargs):
    """Increment view_count when a view is recorded."""
    if created:
        from django.db.models import F

        instance.listing.__class__.objects.filter(pk=instance.listing_id).update(view_count=F('view_count') + 1)


@receiver(post_save, sender=Listing)
def create_agent_user_on_publish(sender, instance, created, **kwargs):
    """Create an agent User when an agent listing is first published.

    When a listing with listing_type slug 'agent' is published:
    1. Creates a new User with role='agent', tier='agent'
    2. Sets owned_by to the listing creator (human owner)
    3. Copies profile info from the listing (name, bio, avatar)
    4. Links the listing's owner field to the new agent User

    This allows agents to have their own profile pages while being
    clearly linked to their human creator.
    """
    # Only process agent listings that are being published
    if not instance.listing_type or instance.listing_type.slug != 'agent':
        return

    # Only trigger on first publish (status changes to published/open)
    if instance.status not in [ListingStatus.PUBLISHED, ListingStatus.OPEN]:
        return

    # Check if an agent user already exists for this listing
    # We use the listing's owner field to track this
    if instance.owner_id:
        # Agent user already created
        return

    # Import here to avoid circular imports
    from core.users.models import User, UserRole

    try:
        # Generate a unique username for the agent
        base_username = instance.slug.lower().replace(' ', '-')
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}-{counter}'
            counter += 1

        # Create the agent user
        agent_user = User.objects.create(
            username=username,
            # Use a placeholder email (agents don't need real emails)
            email=f'{username}@agent.allthrive.ai',
            role=UserRole.AGENT,
            tier='agent',  # New tier for user-created agents
            owned_by=instance.user,  # Human who created this agent
            # Profile info from the listing
            first_name=instance.title,  # Agent's display name
            bio=instance.description or '',
            avatar_url=instance.featured_image_url or instance.logo_url or '',
            tagline=instance.description[:150] if instance.description else '',
            # Agent-specific fields
            personality_prompt=instance.body or '',  # Use body as personality prompt
            website_url=instance.external_url or '',
        )

        # Link the listing to the agent user (as owner)
        instance.owner = agent_user
        # Use update to avoid triggering this signal again
        Listing.objects.filter(pk=instance.pk).update(owner_id=agent_user.id)

        logger.info(f'Created agent user @{username} for listing {instance.id} (owned by @{instance.user.username})')

    except Exception as e:
        logger.error(f'Failed to create agent user for listing {instance.id}: {e}')
