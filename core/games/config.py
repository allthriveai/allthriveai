"""
Game definitions - Single source of truth.

All game metadata lives here. Imported by:
- seed_games.py (Weaviate indexing)
- content_finder.py (learning tool discovery)
- Ava prompts (game suggestions)

To add a new game:
1. Add entry to GAMES list below
2. Create frontend component in frontend/src/pages/games/
3. Add route in frontend/src/routes/index.tsx
4. Deploy and run `python manage.py seed_games`
"""

from typing import TypedDict


class SkillGained(TypedDict):
    """Skill awarded from playing a game."""

    slug: str
    xp: int


class GameDefinition(TypedDict, total=False):
    """Complete game definition."""

    # Required fields
    slug: str  # URL slug, e.g., 'context-snake'
    game_id: str  # Internal ID, e.g., 'context_snake'
    title: str
    description: str
    url: str  # Frontend route, e.g., '/play/context-snake'
    difficulty: str  # 'beginner', 'intermediate', 'advanced'

    # Taxonomy
    topics: list[str]  # Topic slugs for matching
    primary_topic: str  # Main topic for this game
    topic_tags: list[str]  # Human-readable tags for Weaviate

    # Learning
    learning_outcomes: list[str]
    skills_gained: list[SkillGained]

    # LLM integration - explains how game relates to each topic
    # Key: topic slug, Value: explanation connecting game mechanics to concept
    topic_explanations: dict[str, str]


# =============================================================================
# GAME DEFINITIONS
# =============================================================================

GAMES: list[GameDefinition] = [
    {
        'slug': 'context-snake',
        'game_id': 'context_snake',
        'title': 'Context Snake',
        'description': (
            'A fun snake game where you collect context tokens while avoiding obstacles. '
            'Learn about AI context windows, token limits, and how large language models '
            'process information. Collect tokens to grow your snake and increase your score!'
        ),
        'url': '/play/context-snake',
        'difficulty': 'beginner',
        # Taxonomy
        'topics': [
            'context-windows',
            'context-window',
            'tokens',
            'token-limits',
            'ai-fundamentals',
            'llm',
            'machine-learning',
        ],
        'primary_topic': 'context-windows',
        'topic_tags': [
            'AI fundamentals',
            'context windows',
            'tokens',
            'LLM',
            'machine learning',
            'arcade game',
        ],
        # Learning
        'learning_outcomes': [
            'Understanding context windows in LLMs',
            'Token limits and their importance',
            'How AI models process sequential information',
        ],
        'skills_gained': [
            {'slug': 'context-windows', 'xp': 10},
            {'slug': 'token-management', 'xp': 5},
            {'slug': 'llm-fundamentals', 'xp': 5},
        ],
        # LLM topic explanations - fun game, not a simulation
        'topic_explanations': {
            'context-windows': (
                'Context Snake is a fun arcade game themed around tokens and context. '
                'Collect tokens to grow your snake - just a fun way to engage with AI concepts!'
            ),
            'context-window': (
                'Context Snake is a fun arcade game themed around tokens and context. '
                'Collect tokens to grow your snake - just a fun way to engage with AI concepts!'
            ),
            'tokens': (
                'Context Snake is a fun arcade game where you collect tokens. '
                "It's a playful way to take a break while learning about AI!"
            ),
            'token-limits': (
                'Context Snake is a fun arcade game themed around tokens. ' 'Take a break and collect some tokens!'
            ),
            'llm': (
                'Context Snake is a fun arcade game themed around AI concepts. '
                'Collect tokens and see how long you can survive!'
            ),
            'ai-fundamentals': (
                'Context Snake is a fun arcade game themed around AI concepts like tokens. '
                'A playful break while learning!'
            ),
        },
    },
    {
        'slug': 'ethics-defender',
        'game_id': 'ethics_defender',
        'title': 'Ethics Defender',
        'description': (
            'Defend against ethical dilemmas and make responsible AI choices. '
            'Face scenarios involving AI bias, privacy, transparency, and accountability. '
            'Learn to identify ethical issues and make decisions that promote responsible AI use.'
        ),
        'url': '/play/ethics-defender',
        'difficulty': 'intermediate',
        # Taxonomy
        'topics': [
            'ai-ethics',
            'responsible-ai',
            'bias',
            'fairness',
            'privacy',
            'transparency',
            'accountability',
        ],
        'primary_topic': 'ai-ethics',
        'topic_tags': [
            'AI ethics',
            'responsible AI',
            'bias',
            'fairness',
            'privacy',
            'transparency',
            'accountability',
        ],
        # Learning
        'learning_outcomes': [
            'Identifying AI bias and fairness issues',
            'Understanding AI privacy concerns',
            'Making ethical AI decisions',
            'Responsible AI development practices',
        ],
        'skills_gained': [
            {'slug': 'ai-ethics', 'xp': 15},
        ],
        # LLM topic explanations
        'topic_explanations': {
            'ai-ethics': (
                'In Ethics Defender, you face real AI ethical dilemmas and must make '
                'responsible choices. Each scenario teaches you to identify bias, protect '
                'privacy, and promote fairness in AI systems.'
            ),
            'bias': (
                'Ethics Defender presents scenarios where AI bias can cause harm. '
                "You'll learn to spot biased outputs and understand why diverse training "
                'data and careful evaluation matter.'
            ),
            'fairness': (
                "In Ethics Defender, you'll encounter situations where AI treats groups "
                'differently. The game teaches you to recognize unfair outcomes and '
                'think about equitable AI design.'
            ),
            'responsible-ai': (
                'Ethics Defender is all about responsible AI practices. Each decision '
                'you make reflects real choices AI developers face - transparency, '
                'accountability, and user safety.'
            ),
            'privacy': (
                "Ethics Defender includes privacy scenarios where you'll decide how AI "
                'should handle sensitive data. Learn the balance between utility and '
                'protecting user information.'
            ),
        },
    },
    {
        'slug': 'prompt-battle',
        'game_id': 'prompt_battle',
        'title': 'Prompt Battle',
        'description': (
            'Compete in real-time prompt engineering challenges against other players. '
            'Craft the best prompts to generate images or text, and have them judged by AI or peers. '
            'Improve your prompt engineering skills while having fun in competitive battles!'
        ),
        'url': '/play/prompt-battles',
        'difficulty': 'intermediate',
        # Taxonomy
        'topics': [
            'prompt-engineering',
            'prompts',
            'image-generation',
            'text-generation',
        ],
        'primary_topic': 'prompt-engineering',
        'topic_tags': [
            'prompt engineering',
            'AI prompts',
            'image generation',
            'text generation',
            'competition',
            'multiplayer',
        ],
        # Learning
        'learning_outcomes': [
            'Prompt engineering techniques',
            'Crafting effective AI prompts',
            'Understanding AI image generation',
            'Competitive prompt optimization',
        ],
        'skills_gained': [
            {'slug': 'prompt-engineering', 'xp': 15},
        ],
        # LLM topic explanations
        'topic_explanations': {
            'prompt-engineering': (
                'Prompt Battle is competitive prompt engineering! Write prompts, see '
                'the AI output, and learn what makes prompts effective through direct '
                'comparison with other players.'
            ),
            'prompts': (
                "In Prompt Battle, you'll craft prompts under pressure and see exactly "
                'how wording affects AI output. The best way to learn prompting is by doing!'
            ),
            'image-generation': (
                'Prompt Battle lets you practice image generation prompts in a fun, '
                "competitive setting. You'll quickly learn what descriptors, styles, "
                'and techniques produce the best results.'
            ),
            'text-generation': (
                "Prompt Battle includes text generation challenges where you'll compete "
                'to write the most effective prompts. See how small changes dramatically '
                'affect AI outputs.'
            ),
        },
    },
]

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_game_by_slug(slug: str) -> GameDefinition | None:
    """Get a game by its slug."""
    for game in GAMES:
        if game['slug'] == slug:
            return game
    return None


def get_game_by_id(game_id: str) -> GameDefinition | None:
    """Get a game by its internal ID."""
    for game in GAMES:
        if game['game_id'] == game_id:
            return game
    return None


def get_games_for_topic(topic: str) -> list[GameDefinition]:
    """Get all games that match a topic."""
    matching = []
    topic_lower = topic.lower()
    for game in GAMES:
        if any(topic_lower in t for t in game.get('topics', [])):
            matching.append(game)
    return matching


def get_topic_explanation(game_slug: str, topic: str) -> str | None:
    """Get the topic-specific explanation for a game."""
    game = get_game_by_slug(game_slug)
    if not game:
        return None
    explanations = game.get('topic_explanations', {})
    return explanations.get(topic) or explanations.get(game.get('primary_topic', ''))
