"""AI-powered topic definition generator.

Generates dictionary-style definitions for topics using AI,
then caches them in the database for future lookups.
"""

import json
import logging

from services.ai.provider import AIProvider

logger = logging.getLogger(__name__)

TOPIC_DEFINITION_PROMPT = """You are helping create a topic dictionary \
for an AI tools and creative technology platform.

Define the topic "{topic}" in the context of AI tools, creative technology, \
and digital creation.

Requirements:
1. Provide a canonical display name (properly capitalized, e.g., "AI Agents" not "ai agents")
2. Write a concise 2-3 sentence dictionary-style definition
3. List 2-4 common aliases or related terms (lowercase, hyphenated slugs)

The definition should be:
- Clear and accessible to beginners
- Focused on how the topic relates to AI tools and creative work
- Professional but not overly technical

Respond ONLY with valid JSON in this exact format:
{{
  "displayName": "Topic Name",
  "description": "A concise 2-3 sentence definition explaining what this topic is \
and how it relates to AI tools and creative technology.",
  "aliases": ["alias-one", "alias-two"]
}}

Do not include any text before or after the JSON."""


def generate_topic_definition(raw_topic: str, slug: str):
    """Generate a topic definition using AI and save it to the database.

    Args:
        raw_topic: Original topic string from user
        slug: Normalized slug for the topic

    Returns:
        TopicDefinition instance

    Raises:
        Exception: If AI generation fails
    """
    from core.taxonomy.models import TopicDefinition

    # Check if definition already exists (race condition protection)
    existing = TopicDefinition.objects.filter(slug=slug).first()
    if existing:
        return existing

    logger.info(f'Generating AI definition for topic: {raw_topic} ({slug})')

    # Generate definition using AI
    ai = AIProvider()
    prompt = TOPIC_DEFINITION_PROMPT.format(topic=raw_topic)

    try:
        response = ai.complete(
            prompt=prompt,
            temperature=0.3,  # Lower temperature for consistent, factual output
            max_tokens=500,
        )

        # Parse the JSON response
        data = _parse_ai_response(response)

        # Create and save the definition
        definition = TopicDefinition.objects.create(
            slug=slug,
            display_name=data.get('displayName', raw_topic.title()),
            description=data.get('description', f'{raw_topic} is a topic in AI and creative technology.'),
            aliases=data.get('aliases', []),
        )

        logger.info(f'Created AI-generated topic definition: {definition.display_name} ({slug})')
        return definition

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse AI response for topic "{raw_topic}": {e}')
        raise
    except Exception as e:
        logger.error(f'AI generation failed for topic "{raw_topic}": {e}')
        raise


def _parse_ai_response(response: str) -> dict:
    """Parse the AI response and extract the JSON data.

    Handles common formatting issues like markdown code blocks.

    Args:
        response: Raw response from AI

    Returns:
        Parsed dictionary with displayName, description, aliases

    Raises:
        json.JSONDecodeError: If response is not valid JSON
    """
    text = response.strip()

    # Remove markdown code blocks if present
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]

    if text.endswith('```'):
        text = text[:-3]

    text = text.strip()

    # Parse JSON
    data = json.loads(text)

    # Validate required fields
    if 'displayName' not in data:
        raise ValueError('Missing displayName in AI response')
    if 'description' not in data:
        raise ValueError('Missing description in AI response')

    # Ensure aliases is a list
    if 'aliases' not in data or not isinstance(data['aliases'], list):
        data['aliases'] = []

    # Clean up aliases (ensure they're slugs)
    from django.utils.text import slugify

    data['aliases'] = [slugify(alias) for alias in data['aliases'] if alias]

    return data


def regenerate_topic_definition(slug: str):
    """Regenerate an existing topic definition using AI.

    Useful for updating definitions when the AI improves or
    if the original definition was unsatisfactory.

    Args:
        slug: Topic slug to regenerate

    Returns:
        Updated TopicDefinition instance
    """
    from core.taxonomy.models import TopicDefinition

    definition = TopicDefinition.objects.get(slug=slug)

    logger.info(f'Regenerating topic definition for: {slug}')

    ai = AIProvider()
    prompt = TOPIC_DEFINITION_PROMPT.format(topic=definition.display_name)

    response = ai.complete(
        prompt=prompt,
        temperature=0.3,
        max_tokens=500,
    )

    data = _parse_ai_response(response)

    # Update the definition
    definition.display_name = data.get('displayName', definition.display_name)
    definition.description = data.get('description', definition.description)
    definition.aliases = data.get('aliases', definition.aliases)
    definition.save()

    logger.info(f'Regenerated topic definition: {definition.display_name}')
    return definition
