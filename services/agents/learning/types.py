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

    exercise_type: str  # 'terminal' | 'git' | 'ai_prompt' | 'code_review' | 'code'
    scenario: str
    expected_inputs: list[str]  # Regex patterns for validation (terminal/ai_prompt)
    success_message: str
    expected_output: str
    content_by_level: dict[str, ExerciseContentByLevel]
    # Code exercise specific fields
    language: str | None  # 'python' | 'javascript' | 'html' | 'css'
    starter_code: str | None  # Initial code template for code exercises
    expected_patterns: list[str] | None  # Regex patterns for code validation


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
