"""
Agent DM Service - AI-powered responses for Core Team agents.

When users send DMs to Core Team agents (tier='team'), this service
generates personalized AI responses using the agent's personality_prompt
combined with shared platform knowledge.

Core Team Agents:
- Ember: Core guide, onboarding, learning journeys
- Pip: Prompt battle champion, playful competition
- Sage: Professor/teacher, deep learning explanations
- Haven: Community support, handles feedback and concerns
"""

import logging
from typing import TYPE_CHECKING

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.utils import timezone

from services.agents.shared.platform_knowledge import get_agent_knowledge
from services.ai import AIProvider

if TYPE_CHECKING:
    from core.community.models import DirectMessageThread, Message

logger = logging.getLogger(__name__)
User = get_user_model()

# Rate limit: max AI responses per user per hour
AGENT_DM_RATE_LIMIT_PER_HOUR = 20

# Default response timeout
AGENT_DM_TIMEOUT = 30


def get_agent_system_prompt(agent_user) -> str:
    """
    Build the full system prompt for an agent DM conversation.

    Combines the agent's personality_prompt with shared platform knowledge
    and DM-specific context.

    Args:
        agent_user: The Core Team agent User instance

    Returns:
        Complete system prompt for the AI
    """
    base_personality = agent_user.personality_prompt or ''

    # Build signature phrases context
    signature_phrases = getattr(agent_user, 'signature_phrases', []) or []
    phrases_context = ''
    if signature_phrases:
        phrases_context = '\n\nYour signature phrases (use naturally in conversation):\n' '- ' + '\n- '.join(
            signature_phrases[:5]
        )

    # Build interests context
    interests = getattr(agent_user, 'agent_interests', []) or []
    interests_context = ''
    if interests:
        interests_context = '\n\nYour areas of expertise and interest:\n' '- ' + '\n- '.join(interests[:8])

    # Get shared platform knowledge for this agent
    platform_knowledge = get_agent_knowledge(agent_user.username)

    dm_context = f"""
You are {agent_user.first_name}, responding to a direct message on All Thrive.
This is a private 1:1 conversation, so be personal and conversational.

{base_personality}
{phrases_context}
{interests_context}

{platform_knowledge}

Important guidelines for DM conversations:
- Keep responses concise (1-3 short paragraphs max for most messages)
- Be warm and personal - this is a private chat, not a public forum
- Remember you're talking to one person, use "you" not "users"
- Use your platform knowledge to help users with questions about features
- If you don't know something specific, be honest and suggest who might help
- Never pretend to be human - you can acknowledge being an AI agent if asked
- Don't use markdown headers or bullet lists unless explaining something complex
- Match the energy and tone of the person messaging you
- When linking to pages, always use relative URLs (e.g., /explore not https://...)
"""

    return dm_context.strip()


def get_conversation_context(thread: 'DirectMessageThread', limit: int = 10) -> list[dict]:
    """
    Get recent conversation history for context.

    Args:
        thread: The DM thread
        limit: Maximum number of messages to include

    Returns:
        List of message dicts with role and content
    """
    from core.community.models import Message

    messages = Message.objects.filter(room=thread.room).select_related('author').order_by('-created_at')[:limit]

    # Reverse to chronological order
    messages = list(reversed(messages))

    context = []
    for msg in messages:
        if msg.author:
            # Determine role based on tier
            role = 'assistant' if msg.author.tier == 'team' else 'user'
            context.append(
                {
                    'role': role,
                    'content': msg.content,
                }
            )

    return context


def check_rate_limit(user_id: int) -> tuple[bool, str]:
    """
    Check if user has exceeded agent DM rate limit.

    Args:
        user_id: The user sending the message

    Returns:
        Tuple of (is_allowed, reason)
    """
    from django.core.cache import cache

    key = f'agent_dm_rate:{user_id}'
    current_count = cache.get(key, 0)

    if current_count >= AGENT_DM_RATE_LIMIT_PER_HOUR:
        return False, f'Rate limit exceeded. You can send {AGENT_DM_RATE_LIMIT_PER_HOUR} messages to agents per hour.'

    # Increment count with 1-hour TTL
    cache.set(key, current_count + 1, timeout=3600)
    return True, 'OK'


def generate_agent_response(
    agent_user,
    user_message: str,
    thread: 'DirectMessageThread',
    sender_user=None,
) -> str:
    """
    Generate an AI response for the agent.

    Args:
        agent_user: The Core Team agent User instance
        user_message: The message sent by the user
        thread: The DM thread for conversation context
        sender_user: The user who sent the message (for personalization)

    Returns:
        Generated response text
    """
    # Build system prompt with agent personality
    system_prompt = get_agent_system_prompt(agent_user)

    # Add sender context if available
    if sender_user:
        sender_context = f"\nYou're talking to {sender_user.first_name or sender_user.username}"
        if sender_user.tagline:
            sender_context += f' - {sender_user.tagline}'
        system_prompt = sender_context + '\n\n' + system_prompt

    # Get conversation history for context
    conversation_history = get_conversation_context(thread, limit=8)

    # Build the prompt with history
    if conversation_history:
        # Format as conversation for context
        history_text = ''
        for msg in conversation_history[:-1]:  # Exclude the current message
            speaker = agent_user.first_name if msg['role'] == 'assistant' else 'User'
            history_text += f"{speaker}: {msg['content']}\n\n"

        if history_text:
            full_prompt = f'Previous messages:\n{history_text}\nUser: {user_message}'
        else:
            full_prompt = user_message
    else:
        full_prompt = user_message

    # Initialize AI provider
    ai = AIProvider(user_id=sender_user.id if sender_user else None)

    try:
        response = ai.complete(
            prompt=full_prompt,
            system_message=system_prompt,
            temperature=0.8,  # Slightly higher for personality
            max_tokens=500,  # Keep responses concise for DMs
            timeout=AGENT_DM_TIMEOUT,
            purpose='default',
        )

        return response.strip()

    except Exception as e:
        logger.error(f'Failed to generate agent response: {e}', exc_info=True)
        # Return a graceful fallback
        return (
            "I'm having a bit of trouble right now, but I'll be back to full speed soon! "
            'Feel free to message me again in a moment. 💫'
        )


def create_agent_response_message(
    thread: 'DirectMessageThread',
    agent_user,
    response_text: str,
) -> 'Message':
    """
    Create the agent's response message in the DM thread.

    Args:
        thread: The DM thread
        agent_user: The Core Team agent User instance
        response_text: The generated response text

    Returns:
        The created Message instance
    """
    from core.community.models import Message

    message = Message.objects.create(
        room=thread.room,
        author=agent_user,
        content=response_text,
        message_type='text',
    )

    # Update thread last_message_at
    thread.last_message_at = timezone.now()
    thread.save(update_fields=['last_message_at', 'updated_at'])

    return message


def broadcast_agent_message(thread: 'DirectMessageThread', message: 'Message'):
    """
    Broadcast the agent's message to all participants via WebSocket.

    Args:
        thread: The DM thread
        message: The agent's message
    """
    channel_layer = get_channel_layer()
    group_name = f'community.dm.{thread.id}'

    # Serialize message for WebSocket (camelCase for frontend)
    message_data = {
        'id': str(message.id),
        'author': {
            'id': str(message.author.id) if message.author else None,
            'username': message.author.username if message.author else 'Unknown',
            'avatarUrl': getattr(message.author, 'avatar_url', None) if message.author else None,
            'firstName': message.author.first_name if message.author else None,
            'tier': message.author.tier if message.author else None,
        },
        'content': message.content,
        'messageType': message.message_type,
        'attachments': message.attachments,
        'mentions': message.mentions,
        'replyToId': str(message.reply_to_id) if message.reply_to_id else None,
        'reactionCounts': message.reaction_counts,
        'isEdited': message.is_edited,
        'isPinned': message.is_pinned,
        'createdAt': message.created_at.isoformat(),
    }

    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'dm_event',
                'event': 'new_message',
                'message': message_data,
            },
        )
        logger.info(f'Broadcast agent message to group {group_name}')
    except Exception as e:
        logger.error(f'Failed to broadcast agent message: {e}', exc_info=True)


def send_typing_indicator(thread: 'DirectMessageThread', agent_user, is_typing: bool = True):
    """
    Send typing indicator for the agent.

    Args:
        thread: The DM thread
        agent_user: The Core Team agent
        is_typing: Whether the agent is typing
    """
    channel_layer = get_channel_layer()
    group_name = f'community.dm.{thread.id}'

    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'dm_event',
                'event': 'typing',
                'userId': str(agent_user.id),
                'username': agent_user.username,
                'isTyping': is_typing,
            },
        )
    except Exception as e:
        logger.debug(f'Failed to send typing indicator: {e}')


def process_agent_dm(message: 'Message', thread: 'DirectMessageThread', recipient_agent):
    """
    Main entry point: Process an incoming DM to a Core Team agent.

    This function:
    1. Validates the request
    2. Checks rate limits
    3. Shows typing indicator
    4. Generates AI response
    5. Creates response message
    6. Broadcasts via WebSocket

    Args:
        message: The incoming user message
        thread: The DM thread
        recipient_agent: The Core Team agent who received the message
    """
    sender = message.author

    # Validate: Don't respond to agent's own messages
    if sender and sender.tier == 'team':
        logger.debug(f'Skipping agent self-response for message {message.id}')
        return

    # Check rate limit
    if sender:
        is_allowed, reason = check_rate_limit(sender.id)
        if not is_allowed:
            logger.warning(f'Rate limit exceeded for user {sender.id}: {reason}')
            return

    logger.info(
        f'Processing agent DM: message={message.id}, agent={recipient_agent.username}, '
        f'sender={sender.username if sender else "unknown"}'
    )

    try:
        # Send typing indicator
        send_typing_indicator(thread, recipient_agent, is_typing=True)

        # Generate response
        response_text = generate_agent_response(
            agent_user=recipient_agent,
            user_message=message.content,
            thread=thread,
            sender_user=sender,
        )

        # Create response message
        response_message = create_agent_response_message(
            thread=thread,
            agent_user=recipient_agent,
            response_text=response_text,
        )

        # Stop typing indicator
        send_typing_indicator(thread, recipient_agent, is_typing=False)

        # Broadcast to WebSocket
        broadcast_agent_message(thread, response_message)

        logger.info(f'Agent DM response sent: message={response_message.id}, ' f'agent={recipient_agent.username}')

    except Exception as e:
        logger.error(f'Failed to process agent DM: {e}', exc_info=True)
        # Clear typing indicator on error
        send_typing_indicator(thread, recipient_agent, is_typing=False)
