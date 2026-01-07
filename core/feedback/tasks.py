import logging

from celery import shared_task
from django.contrib.auth import get_user_model

from services.agents.shared.platform_knowledge import get_agent_knowledge
from services.ai import AIProvider

logger = logging.getLogger(__name__)
User = get_user_model()


def get_existing_feedback_context(current_item, limit: int = 10) -> str:
    """
    Get context about existing feedback items to help Haven identify duplicates.
    Returns a formatted string with recent/popular feedback submissions.
    """
    from .models import FeedbackItem

    # Get other open feedback items of the same type, excluding current
    existing = (
        FeedbackItem.objects.filter(
            feedback_type=current_item.feedback_type,
            status__in=['open', 'in_progress'],
        )
        .exclude(id=current_item.id)
        .order_by('-vote_count', '-created_at')[:limit]
    )

    if not existing:
        return ''

    items_list = []
    for item in existing:
        status_label = 'In Progress' if item.status == 'in_progress' else 'Open'
        items_list.append(
            f'- ID {item.id}: "{item.title}" ({item.vote_count} votes, {status_label}) ' f'- Link: /feedback/{item.id}'
        )

    feedback_type = current_item.get_feedback_type_display().lower()
    duplicate_instruction = (
        'IMPORTANT: Only mention an existing item if it is TRULY about the same topic/feature. '
        'Do NOT suggest unrelated items just because they exist. '
        'For example, "user profiles" is NOT related to "skill analysis" - these are different features. '
        'If you find a genuine duplicate (same core request), point the user to it and encourage them to vote. '
        'If nothing is truly similar, do NOT mention any existing items - just thank them for their feedback.'
    )
    return f"""
EXISTING {feedback_type.upper()}S (reference only - use STRICT matching):
{chr(10).join(items_list)}

{duplicate_instruction}
"""


def get_haven_feedback_system_prompt(haven_user) -> str:
    """Build Haven's system prompt for feedback responses."""
    base_personality = haven_user.personality_prompt or ''
    platform_knowledge = get_agent_knowledge('haven')

    return f"""You are Haven, All Thrive's community support specialist.
A member has just submitted feedback on our platform.

{base_personality}

{platform_knowledge}

Your task:
- If you recognize this as a feature that already exists, kindly explain where to find it
- If it's a known issue, acknowledge it and share any workarounds
- Otherwise, thank them warmly for their feedback and let them know the team will review

Guidelines:
- Keep responses concise (2-3 sentences max)
- Be warm and supportive
- Sign off as Haven with a heart emoji
- Use relative URLs when linking (e.g., /explore not https://...)
- NEVER use em dashes (—) - use regular hyphens (-) or commas instead

CRITICAL - Duplicate detection:
- Only suggest existing feedback items if they are GENUINELY about the same thing
- Do NOT link to unrelated items - this confuses users
- When in doubt, do NOT mention existing items - just thank them for the new feedback
- "Similar" means the core request is the same, not just sharing a word or category
"""


@shared_task
def generate_haven_response(feedback_item_id: int, submitter_user_id: int):
    """Generate Haven's auto-comment on new feedback submissions."""
    from .models import FeedbackComment, FeedbackItem

    try:
        item = FeedbackItem.objects.get(id=feedback_item_id)
        submitter = User.objects.get(id=submitter_user_id)
    except (FeedbackItem.DoesNotExist, User.DoesNotExist):
        return

    # Get Haven's user account
    haven_user = User.objects.filter(username='haven', tier='team').first()
    if not haven_user:
        logger.warning('Haven user not found for feedback auto-comment')
        return

    # Don't comment if Haven already commented
    if item.comments.filter(user=haven_user).exists():
        return

    # Get context about existing feedback for duplicate detection
    existing_context = get_existing_feedback_context(item)

    # Build the prompt
    submitter_name = submitter.first_name or submitter.username
    feedback_type = item.get_feedback_type_display().lower()
    prompt = f"""A member ({submitter_name}) submitted this {feedback_type}:

**Title:** {item.title}

**Description:** {item.description}
{existing_context}
Please respond appropriately."""

    system_prompt = get_haven_feedback_system_prompt(haven_user)

    try:
        # Track AI usage to the user who triggered the feedback
        ai = AIProvider(user_id=submitter_user_id)
        response = ai.complete(
            prompt=prompt,
            system_message=system_prompt,
            temperature=0.7,
            max_tokens=300,
            timeout=30,
            purpose='default',
        )
        response = response.strip()
    except Exception as e:
        logger.error(f'Haven AI response failed: {e}', exc_info=True)
        # Fallback response (submitter_name already defined above)
        if item.feedback_type == FeedbackItem.Type.BUG:
            response = (
                f'Thanks for flagging this, {submitter_name}! '
                "I've logged it for our team to investigate. We appreciate you helping "
                'us improve All Thrive! 💚 — Haven'
            )
        else:
            response = (
                f'Thanks for sharing this idea, {submitter_name}! '
                'Your feedback helps shape the future of All Thrive. '
                'Our team will review this soon! 💚 — Haven'
            )

    # Create Haven's comment
    FeedbackComment.objects.create(user=haven_user, feedback_item=item, content=response)
    logger.info(f'Haven auto-commented on feedback {item.id}')


def get_haven_comment_reply_system_prompt(haven_user) -> str:
    """Build Haven's system prompt for replying to user comments."""
    base_personality = haven_user.personality_prompt or ''
    platform_knowledge = get_agent_knowledge('haven')

    return f"""You are Haven, All Thrive's community support specialist.
A member has replied to a feedback thread where you previously commented.

{base_personality}

{platform_knowledge}

Your task:
- Respond helpfully to their follow-up question or comment
- If they're confused, provide clarification
- If they're asking for more info, try to help or let them know you'll pass it to the team
- If they're just saying thanks, respond warmly but briefly

Guidelines:
- Keep responses concise (1-3 sentences)
- Be warm and supportive
- Sign off briefly (e.g., "— Haven 🧡")
- Use relative URLs when linking (e.g., /explore not https://...)
- NEVER use em dashes (—) - use regular hyphens (-) or commas instead
- Don't repeat yourself if you already explained something
"""


@shared_task
def generate_haven_comment_reply(feedback_item_id: int, user_comment_id: int):
    """Generate Haven's reply to a user comment on feedback."""
    from .models import FeedbackComment, FeedbackItem

    try:
        item = FeedbackItem.objects.get(id=feedback_item_id)
        user_comment = FeedbackComment.objects.get(id=user_comment_id)
    except (FeedbackItem.DoesNotExist, FeedbackComment.DoesNotExist):
        return

    # Get Haven's user account
    haven_user = User.objects.filter(username='haven', tier='team').first()
    if not haven_user:
        logger.warning('Haven user not found for comment reply')
        return

    # Don't reply to Haven's own comments
    if user_comment.user_id == haven_user.id:
        return

    # Get conversation history
    comments = item.comments.select_related('user').order_by('created_at')
    conversation = []
    for c in comments:
        sender = 'Haven' if c.user_id == haven_user.id else (c.user.first_name or c.user.username)
        conversation.append(f'**{sender}:** {c.content}')

    conversation_text = '\n\n'.join(conversation)

    # Build the prompt
    commenter_name = user_comment.user.first_name or user_comment.user.username
    prompt = f"""Original {item.get_feedback_type_display().lower()}:
**Title:** {item.title}
**Description:** {item.description}

Conversation so far:
{conversation_text}

{commenter_name} just posted the latest comment above. Please respond helpfully."""

    system_prompt = get_haven_comment_reply_system_prompt(haven_user)

    try:
        # Track AI usage to the user who posted the comment
        ai = AIProvider(user_id=user_comment.user_id)
        response = ai.complete(
            prompt=prompt,
            system_message=system_prompt,
            temperature=0.7,
            max_tokens=250,
            timeout=30,
            purpose='default',
        )
        response = response.strip()
    except Exception as e:
        logger.error(f'Haven comment reply failed: {e}', exc_info=True)
        # Fallback response
        response = (
            f'Thanks for following up, {commenter_name}! '
            "I've noted your message and our team will take a look. "
            '- Haven 🧡'
        )

    # Create Haven's reply
    FeedbackComment.objects.create(user=haven_user, feedback_item=item, content=response)
    logger.info(f'Haven replied to comment on feedback {item.id}')
