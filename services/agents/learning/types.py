"""
Type definitions for the AI Lesson Generator.

Contains TypedDict definitions for structured lesson content,
exercises, quizzes, and curriculum items.
"""

from typing import TypedDict


class ExerciseContentByLevel(TypedDict, total=False):
    """Content for a specific skill level in an exercise."""

    instructions: str
    command_hint: str | None
    hints: list[str]


class LessonExercise(TypedDict, total=False):
    """Interactive exercise for hands-on practice."""

    # 'terminal' | 'git' | 'ai_prompt' | 'code_review' | 'code'
    # | 'drag_sort' | 'connect_nodes' | 'code_walkthrough' | 'timed_challenge'
    exercise_type: str
    scenario: str
    expected_inputs: list[str]  # Regex patterns for validation (terminal/ai_prompt)
    success_message: str
    expected_output: str
    content_by_level: dict[str, ExerciseContentByLevel]
    # Code exercise specific fields
    language: str | None  # 'python' | 'javascript' | 'html' | 'css'
    starter_code: str | None  # Initial code template for code exercises
    expected_patterns: list[str] | None  # Regex patterns for code validation
    # New interactive exercise data (only one populated based on exercise_type)
    drag_sort_data: 'DragSortExerciseData | None'
    connect_nodes_data: 'ConnectNodesExerciseData | None'
    code_walkthrough_data: 'CodeWalkthroughExerciseData | None'
    timed_challenge_data: 'TimedChallengeExerciseData | None'


# =============================================================================
# NEW INTERACTIVE EXERCISE DATA TYPES
# =============================================================================


class DragSortItem(TypedDict, total=False):
    """Single item in a drag-sort exercise."""

    id: str
    content: str
    code: str | None
    code_language: str | None  # 'python' | 'javascript' | 'typescript' | 'html' | 'css'
    category: str | None


class DragSortCategory(TypedDict, total=False):
    """Category for categorize variant."""

    id: str
    label: str
    description: str | None


class DragSortExerciseData(TypedDict, total=False):
    """Data for drag and sort exercises."""

    variant: str  # 'sequence' | 'match' | 'categorize'
    items: list[DragSortItem]
    correct_order: list[str] | None  # For sequence variant
    correct_matches: dict[str, str] | None  # For match variant
    categories: list[DragSortCategory] | None  # For categorize variant
    correct_categories: dict[str, str] | None  # For categorize variant
    show_immediate_feedback: bool | None


class NodePosition(TypedDict):
    """Position in percentage (0-100) for responsive layout."""

    x: float
    y: float


class PuzzleNode(TypedDict, total=False):
    """Single node in a connect-nodes exercise."""

    id: str
    label: str
    position: NodePosition
    node_type: str  # 'concept' | 'action' | 'data' | 'decision' | 'start' | 'end'
    is_fixed: bool | None
    side: str | None  # 'left' | 'right' | 'any'


class NodeConnection(TypedDict, total=False):
    """Connection between two nodes."""

    from_id: str  # 'from' is reserved in Python
    to_id: str  # 'to' could work but keeping consistent
    label: str | None


class ConnectNodesExerciseData(TypedDict, total=False):
    """Data for connect nodes exercises."""

    nodes: list[PuzzleNode]
    expected_connections: list[NodeConnection]
    preset_connections: list[NodeConnection] | None
    show_connection_hints: bool | None
    one_to_one: bool | None


class CodeAnnotation(TypedDict, total=False):
    """Annotation to show on a specific line."""

    line: int
    text: str
    type: str  # 'info' | 'important' | 'warning'


class StepQuestion(TypedDict, total=False):
    """Optional quiz question at a walkthrough step."""

    prompt: str
    options: list[str]
    correct_index: int
    explanation: str


class CodeWalkthroughStep(TypedDict, total=False):
    """Single step in a code walkthrough."""

    step_number: int
    highlight_lines: list[int]
    explanation: str
    annotation: CodeAnnotation | None
    question: StepQuestion | None


class CodeWalkthroughExerciseData(TypedDict, total=False):
    """Data for code walkthrough exercises."""

    code: str
    language: str  # 'python' | 'javascript' | 'typescript' | 'html' | 'css'
    steps: list[CodeWalkthroughStep]
    auto_advance_ms: int | None
    show_variable_panel: bool | None
    variable_states: dict[int, dict[str, str]] | None


class ChallengeQuestion(TypedDict, total=False):
    """Single question in a timed challenge."""

    id: str
    question: str
    code: str | None
    code_language: str | None  # 'python' | 'javascript' | 'typescript'
    options: list[str]
    correct_answer: str
    points: int
    time_limit_seconds: int | None
    explanation: str | None


class TimedChallengeExerciseData(TypedDict, total=False):
    """Data for timed challenge exercises."""

    questions: list[ChallengeQuestion]
    total_time_seconds: int | None
    default_time_per_question: int | None
    passing_score: int
    max_score: int
    lives: int | None
    show_correct_on_wrong: bool | None
    enable_streak_multiplier: bool | None


class QuizQuestion(TypedDict, total=False):
    """Single quiz question for knowledge check."""

    id: str  # Unique identifier for the question
    question: str  # The question text
    question_type: str  # 'multiple_choice' | 'true_false'
    options: list[str]  # Answer options (for multiple_choice)
    correct_answer: str | list[str]  # Correct answer(s)
    explanation: str  # Why this answer is correct
    hint: str | None  # Optional hint for struggling learners


class LessonQuiz(TypedDict, total=False):
    """Inline quiz for checking understanding at the end of a lesson."""

    questions: list[QuizQuestion]
    passing_score: int  # Minimum correct answers to pass (default: all)
    encouragement_message: str  # Shown when user passes
    retry_message: str  # Shown when user needs to retry


class AILessonContent(TypedDict, total=False):
    """Structure of AI-generated lesson content."""

    title: str | None  # Optional new title (used in regeneration)
    summary: str
    key_concepts: list[str]
    explanation: str
    examples: list[dict]
    practice_prompt: str
    mermaid_diagram: str | None
    exercise: LessonExercise | None
    quiz: LessonQuiz | None


class CurriculumItem(TypedDict, total=False):
    """Structure of a curriculum item."""

    order: int
    type: str  # 'ai_lesson', 'video', 'article', 'quiz', 'game', 'code-repo', 'tool', 'related_projects'
    title: str
    content: AILessonContent | None
    estimated_minutes: int
    difficulty: str
    generated: bool
    # For existing content references
    project_id: int | None
    tool_slug: str | None
    quiz_id: int | None
    game_slug: str | None
    url: str | None
    # For related_projects type - list of project info
    projects: list[dict] | None


class TopicAnalysis(TypedDict):
    """Structure of AI-analyzed topic for multi-subject queries."""

    title: str  # Human-readable learning path title
    slug: str  # URL-friendly slug
    subjects: list[str]  # Individual subjects detected (e.g., ["Playwright", "Claude AI"])
    relationship: str  # How subjects relate: "integration", "comparison", "workflow", "single"
    description: str  # Brief description of what the learner will achieve
    concepts: list[str]  # AI-generated lesson titles in logical order
