"""
Question Bank for Profile Building.

Contains all profile-building questions organized by category,
with target fields that map to member_context/LearnerProfile.
"""

from dataclasses import dataclass
from enum import Enum


class QuestionCategory(Enum):
    """Categories of profile questions."""

    LEARNING_STYLE = 'learning_style'
    DIFFICULTY = 'difficulty'
    GOALS = 'goals'
    INTERESTS = 'interests'
    SKILLS = 'skills'
    PERSONALITY = 'personality'
    VIBE = 'vibe'


class QuestionFormat(Enum):
    """Visual formats for questions."""

    SINGLE_SELECT = 'single'  # Pick one pill
    MULTI_SELECT = 'multi'  # Pick multiple pills
    THIS_OR_THAT = 'this_or_that'  # Two big cards with VS


@dataclass
class QuestionOption:
    """A single answer option for a question."""

    id: str
    label: str
    emoji: str = ''
    description: str = ''


@dataclass
class ProfileQuestion:
    """A profile-building question."""

    id: str
    category: QuestionCategory
    format: QuestionFormat
    prompt: str
    options: list[QuestionOption]
    target_field: str  # e.g., "learning.learning_style"
    priority: int  # 1=high (ask early), 5=low
    follow_up_prompt: str = ''
    min_answers: int = 1
    max_answers: int | None = None  # None = unlimited for multi-select

    def to_frontend_dict(self) -> dict:
        """Convert to frontend-compatible format."""
        return {
            'questionId': self.id,
            'questionType': self.format.value,
            'prompt': self.prompt,
            'options': [
                {
                    'id': opt.id,
                    'label': opt.label,
                    'emoji': opt.emoji,
                    'description': opt.description,
                }
                for opt in self.options
            ],
            'targetField': self.target_field,
            'allowMultiple': self.format == QuestionFormat.MULTI_SELECT,
            'followUpPrompt': self.follow_up_prompt,
        }


# =============================================================================
# QUESTION DEFINITIONS
# =============================================================================

# Priority 1: Core learning preferences (ask early)
QUESTION_LEARNING_STYLE = ProfileQuestion(
    id='learning_style',
    category=QuestionCategory.LEARNING_STYLE,
    format=QuestionFormat.SINGLE_SELECT,
    prompt='Quick vibe check! How do you like to learn new stuff?',
    options=[
        QuestionOption('visual', 'Watch videos', '📺', 'Video tutorials and visual explanations'),
        QuestionOption('hands_on', 'Build things', '🔧', 'Hands-on projects and coding'),
        QuestionOption('conceptual', 'Read & research', '📚', 'Articles, docs, and deep dives'),
        QuestionOption('mixed', 'Mix of everything', '🎨', 'A balanced approach'),
    ],
    target_field='learning.learning_style',
    priority=1,
    follow_up_prompt="Got it! I'll keep that in mind when sharing resources with you.",
)

QUESTION_DIFFICULTY = ProfileQuestion(
    id='difficulty_level',
    category=QuestionCategory.DIFFICULTY,
    format=QuestionFormat.SINGLE_SELECT,
    prompt='Where are you at with AI stuff?',
    options=[
        QuestionOption('beginner', 'Just starting', '🌱', 'New to AI and excited to learn'),
        QuestionOption('intermediate', 'Getting the hang of it', '🌿', 'Know the basics, building skills'),
        QuestionOption('advanced', 'Pretty experienced', '🌳', 'Deep knowledge, want to level up'),
    ],
    target_field='learning.difficulty_level',
    priority=1,
    follow_up_prompt="Perfect! I'll adjust my explanations to match your level.",
)

# Priority 2: Goals
QUESTION_LEARNING_GOAL = ProfileQuestion(
    id='learning_goal',
    category=QuestionCategory.GOALS,
    format=QuestionFormat.SINGLE_SELECT,
    prompt="What's your main goal right now?",
    options=[
        QuestionOption('build_projects', 'Build cool projects', '🚀', 'Create real things with AI'),
        QuestionOption('understand_concepts', 'Understand concepts', '🧠', 'Master the theory and fundamentals'),
        QuestionOption('career', 'Level up career', '💼', 'Skills for work or job hunting'),
        QuestionOption('exploring', 'Just exploring', '🔍', 'Curious and seeing what sticks'),
    ],
    target_field='learning.learning_goal',
    priority=2,
    follow_up_prompt="Love it! I'll help you get there.",
)

# Priority 3: Interests (multi-select)
QUESTION_TOOL_INTERESTS = ProfileQuestion(
    id='tool_interests',
    category=QuestionCategory.INTERESTS,
    format=QuestionFormat.MULTI_SELECT,
    prompt='Which AI tools are you curious about? (Pick all that apply)',
    options=[
        QuestionOption('langchain', 'LangChain', '🦜', 'Building AI apps with chains'),
        QuestionOption('openai', 'OpenAI/GPT', '🤖', 'ChatGPT, GPT-4, APIs'),
        QuestionOption('huggingface', 'Hugging Face', '🤗', 'Open source models'),
        QuestionOption('claude', 'Claude/Anthropic', '🎭', 'Constitutional AI'),
        QuestionOption('stable-diffusion', 'Image generation', '🎨', 'Stable Diffusion, DALL-E'),
        QuestionOption('rag', 'RAG systems', '📊', 'Retrieval-augmented generation'),
    ],
    target_field='tool_preferences',
    priority=3,
    max_answers=None,
    follow_up_prompt="Great picks! I'll surface related content for you.",
)

QUESTION_TOPIC_INTERESTS = ProfileQuestion(
    id='topic_interests',
    category=QuestionCategory.INTERESTS,
    format=QuestionFormat.MULTI_SELECT,
    prompt='What topics get you excited? (Pick a few)',
    options=[
        QuestionOption('ai-agents', 'AI Agents', '🤖', 'Autonomous AI systems'),
        QuestionOption('prompt-engineering', 'Prompt Engineering', '✍️', 'Crafting effective prompts'),
        QuestionOption('fine-tuning', 'Fine-tuning', '🎯', 'Training custom models'),
        QuestionOption('embeddings', 'Embeddings & vectors', '📊', 'Semantic search and similarity'),
        QuestionOption('multimodal', 'Vision & multimodal', '👁️', 'Images, video, audio'),
        QuestionOption('ethics', 'AI ethics & safety', '⚖️', 'Responsible AI development'),
    ],
    target_field='interests',
    priority=3,
    max_answers=None,
    follow_up_prompt='Awesome! These are hot topics right now.',
)

# Priority 4: Personality/vibe (fun this-or-that)
QUESTION_BUILDER_VS_EXPLORER = ProfileQuestion(
    id='builder_vs_explorer',
    category=QuestionCategory.PERSONALITY,
    format=QuestionFormat.THIS_OR_THAT,
    prompt='Quick one - are you more of a...',
    options=[
        QuestionOption('builder', 'Builder', '🔧', 'I like making things work'),
        QuestionOption('explorer', 'Explorer', '🔍', 'I like understanding how things work'),
    ],
    target_field='personality.builder_vs_explorer',
    priority=4,
    follow_up_prompt='That tells me a lot about how you like to learn!',
)

QUESTION_THEORY_VS_PRACTICE = ProfileQuestion(
    id='theory_vs_practice',
    category=QuestionCategory.PERSONALITY,
    format=QuestionFormat.THIS_OR_THAT,
    prompt='When learning something new, do you prefer...',
    options=[
        QuestionOption('theory_first', 'Theory first', '📖', 'Understand why before how'),
        QuestionOption('practice_first', 'Dive right in', '🏊', 'Learn by doing, theory later'),
    ],
    target_field='personality.theory_vs_practice',
    priority=4,
    follow_up_prompt="Good to know! I'll structure things accordingly.",
)

QUESTION_SOLO_VS_COMMUNITY = ProfileQuestion(
    id='solo_vs_community',
    category=QuestionCategory.VIBE,
    format=QuestionFormat.THIS_OR_THAT,
    prompt='How do you prefer to learn?',
    options=[
        QuestionOption('solo', 'Solo journey', '🧘', 'Focus and self-paced'),
        QuestionOption('community', 'With others', '👥', 'Discussion and collaboration'),
    ],
    target_field='personality.solo_vs_community',
    priority=5,
    follow_up_prompt="I'll keep that in mind!",
)

QUESTION_MOTIVATION = ProfileQuestion(
    id='motivation_style',
    category=QuestionCategory.VIBE,
    format=QuestionFormat.SINGLE_SELECT,
    prompt='What keeps you motivated when learning?',
    options=[
        QuestionOption('streaks', 'Streaks & consistency', '🔥', 'Daily progress is key'),
        QuestionOption('goals', 'Clear goals', '🎯', 'Working toward something specific'),
        QuestionOption('curiosity', 'Pure curiosity', '🌟', "Learning because it's interesting"),
        QuestionOption('community', 'Community energy', '💪', 'Seeing others progress too'),
    ],
    target_field='personality.motivation_style',
    priority=5,
    follow_up_prompt='I love that energy!',
)

# Priority 5: Session preferences
QUESTION_SESSION_LENGTH = ProfileQuestion(
    id='session_length',
    category=QuestionCategory.LEARNING_STYLE,
    format=QuestionFormat.SINGLE_SELECT,
    prompt='How much time do you usually have for learning?',
    options=[
        QuestionOption('quick', '5-10 min', '⚡', 'Quick bites between tasks'),
        QuestionOption('medium', '15-30 min', '☕', 'A focused session'),
        QuestionOption('deep', '45+ min', '🎧', 'Deep work mode'),
    ],
    target_field='learning.session_length',
    priority=5,
    follow_up_prompt="I'll size content recommendations to fit!",
)


# =============================================================================
# QUESTION BANK
# =============================================================================

QUESTION_BANK: dict[str, ProfileQuestion] = {
    q.id: q
    for q in [
        # Priority 1
        QUESTION_LEARNING_STYLE,
        QUESTION_DIFFICULTY,
        # Priority 2
        QUESTION_LEARNING_GOAL,
        # Priority 3
        QUESTION_TOOL_INTERESTS,
        QUESTION_TOPIC_INTERESTS,
        # Priority 4
        QUESTION_BUILDER_VS_EXPLORER,
        QUESTION_THEORY_VS_PRACTICE,
        # Priority 5
        QUESTION_SOLO_VS_COMMUNITY,
        QUESTION_MOTIVATION,
        QUESTION_SESSION_LENGTH,
    ]
}

# Map target fields to question IDs
TARGET_TO_QUESTION: dict[str, str] = {q.target_field: q.id for q in QUESTION_BANK.values()}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_question_by_id(question_id: str) -> ProfileQuestion | None:
    """Get a question by its ID."""
    return QUESTION_BANK.get(question_id)


def get_questions_for_gaps(missing_fields: list[str]) -> list[ProfileQuestion]:
    """Get questions that can fill the given context gaps, sorted by priority."""
    questions = []
    for field in missing_fields:
        question_id = TARGET_TO_QUESTION.get(field)
        if question_id:
            question = QUESTION_BANK.get(question_id)
            if question:
                questions.append(question)

    # Sort by priority (lower = higher priority)
    return sorted(questions, key=lambda q: q.priority)


def get_next_question(
    missing_fields: list[str],
    asked_question_ids: set[str] | None = None,
) -> ProfileQuestion | None:
    """Get the next best question to ask based on gaps and what's already been asked."""
    asked = asked_question_ids or set()
    candidates = get_questions_for_gaps(missing_fields)

    for question in candidates:
        if question.id not in asked:
            return question

    # If all gap questions asked, try a random vibe question
    vibe_questions = [q for q in QUESTION_BANK.values() if q.category == QuestionCategory.VIBE and q.id not in asked]
    if vibe_questions:
        return min(vibe_questions, key=lambda q: q.priority)

    return None
