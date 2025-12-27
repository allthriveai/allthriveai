"""
JSON parsing utilities for AI-generated lesson content.

Contains functions to parse AI responses into structured types.
"""

import json
import logging

from django.utils.text import slugify

from .types import (
    AILessonContent,
    LessonExercise,
    TopicAnalysis,
)
from .validators import (
    validate_exercise,
    validate_mermaid_syntax,
    validate_quiz,
)

logger = logging.getLogger(__name__)


def clean_json_response(response: str) -> str:
    """
    Clean up an AI response to extract JSON content.

    Removes markdown code block markers and strips whitespace.

    Args:
        response: Raw AI response string

    Returns:
        Cleaned JSON string
    """
    json_str = response.strip()

    # Remove markdown code block markers if present
    if json_str.startswith('```json'):
        json_str = json_str[7:]
    elif json_str.startswith('```'):
        json_str = json_str[3:]

    if json_str.endswith('```'):
        json_str = json_str[:-3]

    return json_str.strip()


def parse_lesson_response(response: str) -> AILessonContent | None:
    """
    Parse AI response into structured lesson content.

    Args:
        response: Raw AI response string containing JSON

    Returns:
        Validated AILessonContent or None if parsing fails
    """
    try:
        json_str = clean_json_response(response)
        data = json.loads(json_str)

        # Validate required fields
        required_fields = ['summary', 'key_concepts', 'explanation']
        for field in required_fields:
            if field not in data:
                logger.warning(f'Missing required field in AI response: {field}')
                return None

        # Validate mermaid diagram if present
        raw_mermaid = data.get('mermaid_diagram')
        validated_mermaid = validate_mermaid_syntax(raw_mermaid) if raw_mermaid else None

        if raw_mermaid and not validated_mermaid:
            logger.info('Mermaid diagram removed due to validation failure')

        # Parse exercise if present
        exercise_data = data.get('exercise')
        validated_exercise = validate_exercise(exercise_data) if exercise_data else None

        # Parse quiz if present
        quiz_data = data.get('quiz')
        validated_quiz = validate_quiz(quiz_data) if quiz_data else None

        # Build the lesson content
        content = AILessonContent(
            summary=data.get('summary', ''),
            key_concepts=data.get('key_concepts', []),
            explanation=data.get('explanation', ''),
            examples=data.get('examples', []),
            practice_prompt=data.get('practice_prompt', ''),
            mermaid_diagram=validated_mermaid,
            exercise=validated_exercise,
            quiz=validated_quiz,
        )

        # Include title if present (used in regeneration)
        if data.get('title'):
            content['title'] = data['title']

        return content

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse AI lesson response as JSON: {e}')
        logger.debug(f'Raw response: {response[:500]}...')
        return None
    except Exception as e:
        logger.error(f'Error parsing AI lesson response: {e}', exc_info=True)
        return None


def parse_exercise_response(response: str) -> LessonExercise | None:
    """
    Parse AI response into exercise structure.

    Args:
        response: Raw AI response string containing JSON

    Returns:
        Validated LessonExercise or None if parsing fails
    """
    try:
        json_str = clean_json_response(response)
        data = json.loads(json_str)

        # Validate and return using existing validator
        return validate_exercise(data)

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse exercise response as JSON: {e}')
        logger.debug(f'Raw response: {response[:500]}...')
        return None
    except Exception as e:
        logger.error(f'Error parsing exercise response: {e}', exc_info=True)
        return None


def parse_topic_analysis(response: str, original_query: str) -> TopicAnalysis | None:
    """
    Parse AI response into TopicAnalysis structure.

    Args:
        response: Raw AI response string containing JSON
        original_query: The original search query for fallback slug generation

    Returns:
        Validated TopicAnalysis or None if parsing fails
    """
    try:
        json_str = clean_json_response(response)
        data = json.loads(json_str)

        # Validate required fields
        required_fields = ['title', 'slug', 'subjects', 'relationship', 'concepts']
        for field in required_fields:
            if field not in data:
                logger.warning(f'Missing required field in topic analysis: {field}')
                return None

        # Validate concepts is a non-empty list
        if not isinstance(data['concepts'], list) or len(data['concepts']) < 2:
            logger.warning('Topic analysis has insufficient concepts')
            return None

        # Ensure slug is properly formatted
        clean_slug = slugify(data['slug'])

        return TopicAnalysis(
            title=data['title'],
            slug=clean_slug,
            subjects=data['subjects'],
            relationship=data['relationship'],
            description=data.get('description', ''),
            concepts=data['concepts'],
        )

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse topic analysis as JSON: {e}')
        logger.debug(f'Raw response: {response[:500]}...')
        return None
    except Exception as e:
        logger.error(f'Error parsing topic analysis: {e}', exc_info=True)
        return None


def get_fallback_topic_analysis(query: str) -> TopicAnalysis:
    """
    Generate a fallback TopicAnalysis when AI analysis fails.

    Uses simple heuristics to create a basic structure.

    Args:
        query: The original search query

    Returns:
        A basic TopicAnalysis with default values
    """
    query_clean = query.replace('-', ' ').replace('_', ' ')
    title = f'{query_clean.title()} Learning Path'

    # Generate basic concepts from query
    concepts = [
        f'Introduction to {query_clean}',
        f'Core Concepts of {query_clean}',
        f'Practical Applications of {query_clean}',
        f'Advanced {query_clean} Techniques',
    ]

    return TopicAnalysis(
        title=title,
        slug=slugify(query),
        subjects=[query_clean.title()],
        relationship='single',
        description=f'Learn about {query_clean} through structured lessons.',
        concepts=concepts,
    )
