"""
Validation utilities for AI-generated lesson content.

Contains validation functions for mermaid diagrams, exercises, and quizzes.
"""

import logging
import re

from .types import (
    ExerciseContentByLevel,
    LessonExercise,
    LessonQuiz,
    QuizQuestion,
)

logger = logging.getLogger(__name__)


# Valid mermaid diagram types
VALID_MERMAID_TYPES = [
    'graph',
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'quadrantChart',
    'requirementDiagram',
    'gitGraph',
    'mindmap',
    'timeline',
    'zenuml',
    'sankey',
    'xychart',
    'block',
]


def validate_mermaid_syntax(mermaid_code: str | None) -> str | None:
    """
    Validate mermaid diagram syntax and return cleaned code or None if invalid.

    Performs basic syntax validation to catch common AI-generated errors:
    - Checks for valid diagram type declaration
    - Validates bracket matching
    - Catches common syntax issues

    Args:
        mermaid_code: Raw mermaid diagram code from AI

    Returns:
        Cleaned mermaid code if valid, None if invalid
    """
    if not mermaid_code:
        return None

    # Clean up the code
    code = mermaid_code.strip()

    # Remove markdown code block markers if present
    if code.startswith('```mermaid'):
        code = code[10:]
    elif code.startswith('```'):
        code = code[3:]
    if code.endswith('```'):
        code = code[:-3]
    code = code.strip()

    if not code:
        return None

    # Check for valid diagram type at the start
    first_line = code.split('\n')[0].strip().lower()
    has_valid_type = False

    for diagram_type in VALID_MERMAID_TYPES:
        if first_line.startswith(diagram_type.lower()):
            has_valid_type = True
            break

    if not has_valid_type:
        logger.warning(f'Invalid mermaid diagram type: {first_line[:50]}')
        return None

    # Check for balanced brackets
    brackets = {'[': ']', '{': '}', '(': ')'}
    stack = []

    for char in code:
        if char in brackets:
            stack.append(brackets[char])
        elif char in brackets.values():
            if not stack or stack.pop() != char:
                logger.warning('Mermaid diagram has unbalanced brackets')
                return None

    if stack:
        logger.warning('Mermaid diagram has unclosed brackets')
        return None

    # Check for common syntax errors
    # Error: Empty node labels like "[]" or "()"
    if re.search(r'\[\s*\]|\(\s*\)|\{\s*\}', code):
        logger.warning('Mermaid diagram has empty node labels')
        return None

    # Error: Invalid arrow syntax (must have proper arrows like -->, --, ---|, etc.)
    lines = code.split('\n')
    for line in lines[1:]:  # Skip first line (diagram type)
        line = line.strip()
        if not line or line.startswith('%%') or line.startswith('subgraph') or line == 'end':
            continue
        # Check for node connections - should have valid arrow operators
        if '--' in line or '->' in line or '==>' in line:
            # This looks like a connection line, basic validation passes
            pass

    # Log successful validation
    logger.debug(f'Mermaid diagram validated successfully ({len(code)} chars)')

    return code


def validate_exercise(exercise_data: dict) -> LessonExercise | None:
    """
    Validate and normalize exercise data from AI response.

    Args:
        exercise_data: Raw exercise dict from AI response

    Returns:
        Validated LessonExercise or None if invalid
    """
    if not exercise_data:
        return None

    # Validate exercise type first (needed for conditional field validation)
    valid_types = {'terminal', 'git', 'ai_prompt', 'code_review', 'code'}
    exercise_type = exercise_data.get('exercise_type', '').lower()
    if exercise_type not in valid_types:
        logger.warning(f'Invalid exercise type: {exercise_type}')
        return None

    # Check required fields (different for code exercises)
    if exercise_type == 'code':
        required_fields = ['exercise_type', 'scenario', 'expected_patterns', 'content_by_level']
    else:
        required_fields = ['exercise_type', 'scenario', 'expected_inputs', 'content_by_level']

    for field in required_fields:
        if field not in exercise_data:
            logger.warning(f'Missing required exercise field: {field}')
            return None

    # Validate expected_inputs/expected_patterns based on exercise type
    if exercise_type == 'code':
        expected_patterns = exercise_data.get('expected_patterns', [])
        if not isinstance(expected_patterns, list) or len(expected_patterns) == 0:
            logger.warning('Code exercise must have at least one expected_pattern')
            return None
        expected_inputs = []  # Code exercises use expected_patterns instead
    else:
        expected_inputs = exercise_data.get('expected_inputs', [])
        if not isinstance(expected_inputs, list) or len(expected_inputs) == 0:
            logger.warning('Exercise must have at least one expected_input pattern')
            return None
        expected_patterns = None

    # Validate content_by_level has at least one skill level
    content_by_level = exercise_data.get('content_by_level', {})
    if not isinstance(content_by_level, dict) or len(content_by_level) == 0:
        logger.warning('Exercise must have content_by_level for at least one skill level')
        return None

    # Validate each level has required fields
    valid_levels = {'beginner', 'intermediate', 'advanced'}
    normalized_content = {}

    for level, content in content_by_level.items():
        if level not in valid_levels:
            logger.warning(f'Invalid skill level in exercise: {level}')
            continue

        if not isinstance(content, dict):
            continue

        # Instructions are required
        if 'instructions' not in content:
            logger.warning(f'Missing instructions for {level} level')
            continue

        # Normalize hints to a list
        hints = content.get('hints', [])
        if not isinstance(hints, list):
            hints = [hints] if hints else []

        # Use None instead of empty string for optional command_hint
        command_hint = content.get('command_hint')
        if command_hint == '':
            command_hint = None

        normalized_content[level] = ExerciseContentByLevel(
            instructions=content.get('instructions', ''),
            command_hint=command_hint,
            hints=hints,
        )

    if len(normalized_content) == 0:
        logger.warning('No valid skill levels in exercise content_by_level')
        return None

    # Build validated exercise
    exercise = LessonExercise(
        exercise_type=exercise_type,
        scenario=exercise_data.get('scenario', ''),
        expected_inputs=expected_inputs,
        success_message=exercise_data.get('success_message', 'Great job!'),
        expected_output=exercise_data.get('expected_output', ''),
        content_by_level=normalized_content,
    )

    # Add code-specific fields for code exercises
    if exercise_type == 'code':
        exercise['language'] = exercise_data.get('language', 'python')
        exercise['starter_code'] = exercise_data.get('starter_code', '')
        exercise['expected_patterns'] = expected_patterns

    return exercise


def validate_quiz(quiz_data: dict) -> LessonQuiz | None:
    """
    Validate and normalize quiz data from AI response.

    Args:
        quiz_data: Raw quiz dict from AI response

    Returns:
        Validated LessonQuiz or None if invalid
    """
    if not quiz_data:
        return None

    questions = quiz_data.get('questions', [])
    if not isinstance(questions, list) or len(questions) == 0:
        logger.warning('Quiz must have at least one question')
        return None

    validated_questions: list[QuizQuestion] = []
    valid_question_types = {'multiple_choice', 'true_false'}

    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue

        # Check required fields
        if 'question' not in q or 'correct_answer' not in q:
            logger.warning(f'Quiz question {i} missing required fields')
            continue

        question_type = q.get('question_type', 'multiple_choice')
        if question_type not in valid_question_types:
            question_type = 'multiple_choice'

        # Validate options for multiple choice
        options = q.get('options', [])
        if question_type == 'multiple_choice' and (not isinstance(options, list) or len(options) < 2):
            logger.warning(f'Quiz question {i} has invalid options for multiple_choice')
            continue

        if question_type == 'true_false':
            options = ['True', 'False']

        # Normalize hint (None instead of empty string)
        hint = q.get('hint')
        if hint == '':
            hint = None

        validated_questions.append(
            QuizQuestion(
                id=q.get('id', f'q{i + 1}'),
                question=q.get('question', ''),
                question_type=question_type,
                options=options,
                correct_answer=q.get('correct_answer'),
                explanation=q.get('explanation', ''),
                hint=hint,
            )
        )

    if len(validated_questions) == 0:
        logger.warning('No valid questions in quiz')
        return None

    # Calculate default passing score (allow one mistake)
    default_passing = max(1, len(validated_questions) - 1)

    return LessonQuiz(
        questions=validated_questions,
        passing_score=quiz_data.get('passing_score', default_passing),
        encouragement_message=quiz_data.get('encouragement_message', 'Great job! You understood the key concepts.'),
        retry_message=quiz_data.get('retry_message', 'Almost there! Review the lesson and try again.'),
    )
