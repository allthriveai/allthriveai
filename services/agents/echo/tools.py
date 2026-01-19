"""
LangChain tools for the Echo agent.

These tools help creators capture ideas, access content pillars,
generate attention-grabbing hooks, and expand hooks into full posts.

Tools:
- save_idea: Create ContentIdea with pillar, hook, session link
- get_content_pillars: Return user's available content pillars
- generate_hooks: Generate 3 hook variations for a topic/platform
- expand_to_post: Expand a hook into a full post draft
"""

import logging
from typing import Literal

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Supported platforms for content
Platform = Literal['twitter', 'linkedin', 'youtube']

# Platform character limits and guidelines
PLATFORM_GUIDELINES = {
    'twitter': {
        'max_chars': 280,
        'hook_style': 'punchy, direct, high-impact',
        'format': 'Single tweet or thread opener',
    },
    'linkedin': {
        'max_chars': 1300,
        'hook_style': 'storytelling, professional but personal',
        'format': 'First 3 lines visible before "see more"',
    },
    'youtube': {
        'max_chars': 100,  # Title length
        'hook_style': 'SEO-driven, clear value proposition',
        'format': 'Title + first 30 seconds hook',
    },
}

# Hook types for generation
HOOK_TYPES = [
    'pattern_interrupt',  # Challenge assumptions
    'curiosity_gap',  # Promise value without revealing
    'relatable_pain',  # Connect emotionally
    'bold_claim',  # Make a statement worth debating
]


# =============================================================================
# Input Schemas
# =============================================================================


class SaveIdeaInput(BaseModel):
    """Input for save_idea tool."""

    model_config = {'extra': 'allow'}

    title: str = Field(description='Title for the content idea')
    description: str = Field(default='', description='Description or body of the idea')
    hook: str = Field(default='', description='Attention-grabbing opener')
    pillar_id: int | None = Field(default=None, description='Content pillar taxonomy ID')
    platforms: list[str] = Field(default=[], description='Target platforms: twitter, linkedin, youtube')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GetContentPillarsInput(BaseModel):
    """Input for get_content_pillars tool."""

    model_config = {'extra': 'allow'}

    state: dict | None = Field(default=None, description='Internal - injected by agent')


class GenerateHooksInput(BaseModel):
    """Input for generate_hooks tool."""

    model_config = {'extra': 'allow'}

    topic: str = Field(description='Topic or idea to create hooks for')
    platform: str = Field(default='twitter', description='Target platform: twitter, linkedin, youtube')
    angle: str = Field(default='', description='Specific angle or perspective to use')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class ExpandToPostInput(BaseModel):
    """Input for expand_to_post tool."""

    model_config = {'extra': 'allow'}

    hook: str = Field(description='The hook to expand into a full post')
    platform: str = Field(default='twitter', description='Target platform: twitter, linkedin, youtube')
    topic: str = Field(default='', description='Topic context for expansion')
    include_cta: bool = Field(default=True, description='Include a call-to-action')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


# =============================================================================
# Tools
# =============================================================================


@tool(args_schema=SaveIdeaInput)
def save_idea(
    title: str,
    description: str = '',
    hook: str = '',
    pillar_id: int | None = None,
    platforms: list[str] | None = None,
    state: dict | None = None,
) -> dict:
    """
    Save a content idea to the user's idea bank.

    Creates a ContentIdea with the given title, hook, and pillar.
    Links it to the current brainstorm session if one is active.

    Returns:
        Dictionary with success status and idea ID
    """
    from django.contrib.auth import get_user_model

    from core.content_engine.models import BrainstormSession, ContentIdea
    from core.taxonomy.models import Taxonomy

    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    session_id = state.get('session_id')
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Validate pillar if provided
    pillar = None
    if pillar_id:
        try:
            pillar = Taxonomy.objects.get(id=pillar_id, taxonomy_type='content_pillar')
        except Taxonomy.DoesNotExist:
            return {'success': False, 'error': f'Invalid content pillar ID: {pillar_id}'}

    # Find or create brainstorm session
    brainstorm_session = None
    if session_id:
        try:
            brainstorm_session = BrainstormSession.objects.get(
                user=user,
                id=session_id,
                is_active=True,
            )
        except (BrainstormSession.DoesNotExist, ValueError):
            # Session ID might be a UUID string, not an integer
            pass

    # Create the idea
    idea = ContentIdea.objects.create(
        user=user,
        title=title,
        description=description,
        hook=hook,
        pillar=pillar,
        brainstorm_session=brainstorm_session,
        platforms=platforms or [],
        source=ContentIdea.Source.BRAINSTORM,
        status=ContentIdea.Status.SAVED,
    )

    # Link idea to brainstorm session
    if brainstorm_session:
        brainstorm_session.generated_ideas.add(idea)

    logger.info(f'Saved idea "{title}" for user {user.username} (pillar={pillar})')

    return {
        'success': True,
        'idea_id': idea.id,
        'title': idea.title,
        'message': f'Idea "{title}" saved successfully',
    }


@tool(args_schema=GetContentPillarsInput)
def get_content_pillars(
    state: dict | None = None,
) -> dict:
    """
    Get the available content pillars for the user.

    Returns all content_pillar taxonomy entries that the user can use
    for categorizing their content ideas.

    Returns:
        Dictionary with list of content pillars
    """
    from core.taxonomy.models import Taxonomy

    # Content pillars are global, no auth required to read
    pillars = Taxonomy.objects.filter(
        taxonomy_type='content_pillar',
        is_active=True,
    ).order_by('name')

    pillar_list = [
        {
            'id': p.id,
            'name': p.name,
            'slug': p.slug,
            'description': p.description or '',
        }
        for p in pillars
    ]

    return {
        'success': True,
        'pillars': pillar_list,
        'count': len(pillar_list),
    }


@tool(args_schema=GenerateHooksInput)
def generate_hooks(
    topic: str,
    platform: str = 'twitter',
    angle: str = '',
    state: dict | None = None,
) -> dict:
    """
    Generate 3 hook variations for a topic/platform.

    Creates attention-grabbing openers using different hook types:
    - Pattern interrupt: Challenge assumptions
    - Curiosity gap: Promise value without revealing everything
    - Relatable pain: Connect emotionally with a shared struggle

    Returns:
        Dictionary with 3 hook options and explanations
    """
    # Get platform guidelines
    platform_key = platform.lower() if platform.lower() in PLATFORM_GUIDELINES else 'twitter'
    guidelines = PLATFORM_GUIDELINES[platform_key]

    # Build hook templates based on platform
    hooks = []

    # Hook 1: Pattern Interrupt
    hooks.append(
        {
            'type': 'pattern_interrupt',
            'hook': _generate_pattern_interrupt_hook(topic, platform_key, angle),
            'why_it_works': 'Challenges assumptions and stops the scroll by contradicting expectations.',
            'platform_fit': f'Optimized for {platform_key}: {guidelines["hook_style"]}',
        }
    )

    # Hook 2: Curiosity Gap
    hooks.append(
        {
            'type': 'curiosity_gap',
            'hook': _generate_curiosity_gap_hook(topic, platform_key, angle),
            'why_it_works': 'Creates intrigue by promising value without revealing everything.',
            'platform_fit': f'Optimized for {platform_key}: {guidelines["hook_style"]}',
        }
    )

    # Hook 3: Relatable Pain
    hooks.append(
        {
            'type': 'relatable_pain',
            'hook': _generate_relatable_pain_hook(topic, platform_key, angle),
            'why_it_works': 'Connects emotionally by validating a shared frustration.',
            'platform_fit': f'Optimized for {platform_key}: {guidelines["hook_style"]}',
        }
    )

    return {
        'success': True,
        'topic': topic,
        'platform': platform_key,
        'angle': angle,
        'hooks': hooks,
        'guidelines': guidelines,
    }


def _generate_pattern_interrupt_hook(topic: str, platform: str, angle: str) -> str:
    """Generate a pattern interrupt hook template."""
    if platform == 'twitter':
        return f'Everything you know about {topic} is wrong.'
    elif platform == 'linkedin':
        return f'I used to believe {topic} worked one way.\n\nI was completely wrong.'
    else:  # youtube
        return f"Stop doing {topic} wrong (here's the fix)"


def _generate_curiosity_gap_hook(topic: str, platform: str, angle: str) -> str:
    """Generate a curiosity gap hook template."""
    if platform == 'twitter':
        return f'The one thing about {topic} nobody talks about:'
    elif platform == 'linkedin':
        return (
            f'After 5 years working on {topic}, I discovered something counterintuitive.'
            f"\n\nHere's what changed everything:"
        )
    else:  # youtube
        return f'The {topic} secret that changed everything'


def _generate_relatable_pain_hook(topic: str, platform: str, angle: str) -> str:
    """Generate a relatable pain hook template."""
    if platform == 'twitter':
        return f"Struggling with {topic}? You're not alone."
    elif platform == 'linkedin':
        return f"I spent months frustrated with {topic}.\n\nIf you've been there, this is for you."
    else:  # youtube
        return f'Why {topic} is so frustrating (and how to fix it)'


@tool(args_schema=ExpandToPostInput)
def expand_to_post(
    hook: str,
    platform: str = 'twitter',
    topic: str = '',
    include_cta: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Expand a hook into a full post draft.

    Takes an attention-grabbing hook and expands it into a complete
    post structure appropriate for the target platform.

    Returns:
        Dictionary with expanded post content
    """
    platform_key = platform.lower() if platform.lower() in PLATFORM_GUIDELINES else 'twitter'
    guidelines = PLATFORM_GUIDELINES[platform_key]

    # Build post structure based on platform
    if platform_key == 'twitter':
        post = _expand_for_twitter(hook, topic, include_cta)
    elif platform_key == 'linkedin':
        post = _expand_for_linkedin(hook, topic, include_cta)
    else:  # youtube
        post = _expand_for_youtube(hook, topic, include_cta)

    return {
        'success': True,
        'platform': platform_key,
        'hook': hook,
        'expanded_post': post,
        'guidelines': guidelines,
        'char_count': len(post['full_text']),
        'max_chars': guidelines['max_chars'],
    }


def _expand_for_twitter(hook: str, topic: str, include_cta: bool) -> dict:
    """Expand hook into Twitter thread structure."""
    thread = [
        hook,
        f"Here's what most people miss about {topic}:" if topic else "Here's what most people miss:",
        '[Key insight or value point]',
        '[Supporting example or proof]',
    ]

    if include_cta:
        thread.append('Follow for more insights on this.')

    return {
        'format': 'thread',
        'tweets': thread,
        'full_text': '\n\n'.join(thread),
        'tweet_count': len(thread),
    }


def _expand_for_linkedin(hook: str, topic: str, include_cta: bool) -> dict:
    """Expand hook into LinkedIn post structure."""
    sections = [
        hook,
        '',
        "Here's what I learned:",
        '',
        f'1. [First key point about {topic}]' if topic else '1. [First key point]',
        f'2. [Second key point about {topic}]' if topic else '2. [Second key point]',
        f'3. [Third key point about {topic}]' if topic else '3. [Third key point]',
        '',
        'The result?',
        '[Outcome or transformation]',
    ]

    if include_cta:
        sections.extend(['', '---', '', "What's your experience with this? Share below."])

    full_text = '\n'.join(sections)

    return {
        'format': 'story_post',
        'sections': ['hook', 'lessons', 'outcome', 'cta'] if include_cta else ['hook', 'lessons', 'outcome'],
        'full_text': full_text,
    }


def _expand_for_youtube(hook: str, topic: str, include_cta: bool) -> dict:
    """Expand hook into YouTube video structure."""
    structure = {
        'title': hook,
        'thumbnail_text': f'{topic.upper() if topic else "KEY INSIGHT"} - [Visual element]',
        'intro_hook': (
            f"In the next few minutes, I'm going to show you "
            f"{topic if topic else 'something'} that most people get completely wrong."
        ),
        'chapters': [
            '[0:00] Hook - Grab attention',
            '[0:30] Problem - What most people do wrong',
            '[2:00] Solution - The better approach',
            '[5:00] Proof - Examples and results',
            '[8:00] Action - How to implement this',
        ],
    }

    if include_cta:
        structure['outro_cta'] = 'If this was helpful, hit subscribe and turn on notifications for more.'

    return {
        'format': 'video_script',
        **structure,
        'full_text': f"{structure['title']}\n\n{structure['intro_hook']}",
    }


# =============================================================================
# Tool Registry
# =============================================================================

# All tools available to Echo agent
ECHO_TOOLS = [
    save_idea,
    get_content_pillars,
    generate_hooks,
    expand_to_post,
]

# Lookup by tool name
ECHO_TOOLS_BY_NAME = {tool.name: tool for tool in ECHO_TOOLS}

# Tools that need state injection (user_id, session_id)
TOOLS_NEEDING_STATE = {
    'save_idea',  # Needs user_id, session_id
    # get_content_pillars reads public data, state optional
    # generate_hooks is pure computation, no state needed
    # expand_to_post is pure computation, no state needed
}
