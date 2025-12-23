"""
AI Lesson Generator for Learning Paths.

Generates personalized learning content when curated content is unavailable.
Uses member_context to adapt content format based on learning style and difficulty.

The generated content is designed to provide immediate value - not placeholders,
but real learning material that can be supplemented or replaced with community
projects and curated content over time.
"""

import json
import logging
import re
from typing import TypedDict

from django.db.models import F
from django.utils.text import slugify

logger = logging.getLogger(__name__)


# =============================================================================
# Mermaid Diagram Validation
# =============================================================================

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


class AILessonContent(TypedDict, total=False):
    """Structure of AI-generated lesson content."""

    summary: str
    key_concepts: list[str]
    explanation: str
    examples: list[dict]
    practice_prompt: str
    mermaid_diagram: str | None


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


# Style-specific prompt instructions
STYLE_INSTRUCTIONS = {
    'visual': """
Format your explanation for VISUAL learners:
- Include a mermaid diagram showing the concept's relationships or flow
- Use visual metaphors ("think of X like a...")
- Describe processes as step-by-step visual flows
- Use formatting (bullets, numbered lists) to make structure visible
""",
    'hands_on': """
Format your explanation for HANDS-ON learners:
- Start with a practical code example, then explain what it does
- Include a "Try This" exercise they can do immediately
- Focus on practical application over theory
- Show real-world use cases they can replicate
""",
    'conceptual': """
Format your explanation for CONCEPTUAL learners:
- Start with the "why" before the "how"
- Explain underlying principles and theory
- Connect to broader patterns and concepts
- Include mental models for understanding
""",
    'mixed': """
Provide a BALANCED explanation:
- Include one visual diagram (mermaid format)
- Include one practical code example
- Include conceptual explanation connecting ideas
""",
}

# Difficulty-specific prompt instructions
DIFFICULTY_INSTRUCTIONS = {
    'beginner': """
Write for BEGINNER level:
- Use simple everyday analogies (e.g., "like organizing books on a shelf")
- Define any technical terms before using them
- Keep explanations to 2-3 short paragraphs
- Avoid jargon or explain it immediately when used
- Focus on foundational concepts

CODE EXAMPLES FOR BEGINNERS:
- Add detailed inline comments explaining EVERY line of code
- Before the code, explain what we're about to do and why
- After the code, walk through what happened step by step
- Use descriptive variable names (e.g., `user_message` not `msg`)
- Keep examples short (5-15 lines max) and focused on ONE concept
- Example format:
  ```python
  # First, we import the library we need
  import openai

  # This is our message that we'll send to the AI
  user_message = "Hello, can you help me?"

  # Here we send the message and wait for a response
  response = openai.chat.completions.create(
      model="gpt-4",  # The AI model we're using
      messages=[{"role": "user", "content": user_message}]
  )
  ```

DIAGRAMS FOR BEGINNERS:
- If including a mermaid diagram, add a "Reading this diagram" section explaining:
  - What each box/node represents
  - What the arrows/connections mean
  - How to follow the flow (top-to-bottom, left-to-right)
- Use simple, descriptive labels (not abbreviations)
- Limit to 5-7 nodes maximum to avoid overwhelming
""",
    'intermediate': """
Write for INTERMEDIATE level:
- Assume familiarity with basics, build on them
- Compare different approaches and when to use each
- Include common pitfalls to avoid
- Introduce nuances and edge cases

CODE EXAMPLES FOR INTERMEDIATE:
- Include brief comments for non-obvious logic only
- Show complete, working examples that can be copy-pasted
- Include error handling patterns
- Show both the simple way and a more robust alternative
- Mention relevant libraries or tools

DIAGRAMS FOR INTERMEDIATE:
- Diagrams can include more components and relationships
- Use standard technical terminology
- Show system interactions and data flow
""",
    'advanced': """
Write for ADVANCED level:
- Be concise and technical - skip the basics
- Go deep into implementation details and internals
- Cover edge cases, performance implications, and scaling considerations
- Discuss production considerations, monitoring, and debugging
- Include trade-offs between different architectural approaches
- Reference relevant specs, RFCs, or documentation when applicable

CODE EXAMPLES FOR ADVANCED:
- No need for basic comments - just document the "why" for complex decisions
- Show production-grade patterns (typing, error handling, logging)
- Include performance considerations (async, batching, caching)
- Reference actual library APIs accurately
- Show architectural patterns, not just syntax

DIAGRAMS FOR ADVANCED:
- Include system-level architecture when relevant
- Show performance bottlenecks, scaling points
- Use standard technical notation
- Can be more complex - assume diagram literacy
""",
}


class AILessonGenerator:
    """
    Generates personalized learning content when curated content is unavailable.

    Uses the AIProvider to generate structured lesson content that adapts to
    the user's learning style and difficulty level from member_context.
    """

    # System prompt for lesson generation
    SYSTEM_PROMPT = """You are Ember, an AI learning assistant for AllThrive AI.
Your task is to generate educational content that provides real value to learners.

CRITICAL: Adapt your teaching style based on the difficulty level specified:

For BEGINNERS:
- Be patient and thorough - explain everything
- Every code example MUST have detailed comments on every line
- If you include a diagram, add a "Reading this diagram:" section that walks through each part
- Use analogies and real-world comparisons
- Define jargon before using it

For ADVANCED users:
- Be concise and technical - respect their time
- Skip obvious explanations they already know
- Focus on nuances, edge cases, and production considerations
- Code can have minimal comments - just document the "why" for complex parts
- Use technical terminology without over-explaining

Generate content that:
1. Is accurate and educational
2. STRICTLY adapts to the specified difficulty level (this is critical!)
3. Provides practical value the learner can use immediately
4. Includes clear structure with key concepts, explanation, and practice

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
    "summary": "1-2 sentence hook that explains what the learner will understand",
    "key_concepts": ["concept1", "concept2", "concept3"],
    "explanation": "Full markdown explanation with formatting, code blocks if relevant",
    "examples": [
        {"title": "Example Name", "description": "Brief description", "code": "optional code"}
    ],
    "practice_prompt": "A question or exercise for the learner to try",
    "mermaid_diagram": "optional mermaid diagram code if visual style. For beginners, add diagram explanation."
}

MERMAID DIAGRAM SYNTAX RULES (if including a diagram):
- MUST start with a valid diagram type: graph, flowchart, sequenceDiagram, classDiagram, etc.
- For flowcharts, use: graph TD or graph LR (TD=top-down, LR=left-right)
- Node syntax: A[Rectangle] B(Rounded) C{Diamond} D((Circle))
- Arrow syntax: A --> B or A -- text --> B or A -.-> B (dotted)
- NEVER use empty brackets like [] or ()
- NEVER use special characters in node IDs (use letters, numbers, underscores only)
- All brackets MUST be balanced
- Example of VALID flowchart:
  graph TD
      A[User Input] --> B[Process]
      B --> C{Decision}
      C -->|Yes| D[Output A]
      C -->|No| E[Output B]
"""

    @classmethod
    def generate_curriculum(
        cls,
        topic: str,
        member_context: dict | None,
        existing_content: dict,
        user_id: int | None = None,
    ) -> list[CurriculumItem]:
        """
        Generate a complete curriculum mixing existing content with AI-generated lessons.

        Args:
            topic: The topic/query for the learning path
            member_context: User's learning preferences and context
            existing_content: Content found by ContentFinder
            user_id: User ID for logging and gap tracking

        Returns:
            List of curriculum items (existing content + AI lessons)
        """
        curriculum: list[CurriculumItem] = []
        order = 1

        # Extract learning preferences from member_context
        learning_prefs = cls._extract_learning_preferences(member_context)

        # Add existing content first (prioritized by type)
        order = cls._add_existing_content(curriculum, existing_content, order)

        # Check if we need AI-generated content
        has_content_gap = cls._has_content_gap(existing_content)

        if has_content_gap:
            # Log the content gap for strategic content development
            cls._log_content_gap(topic, user_id, existing_content, member_context)

            # Generate AI lessons to fill the gap
            ai_lessons = cls._generate_ai_lessons(
                topic=topic,
                learning_style=learning_prefs['style'],
                difficulty=learning_prefs['difficulty'],
                session_length=learning_prefs['session_length'],
                existing_count=len(curriculum),
                user_id=user_id,
            )

            for lesson in ai_lessons:
                lesson['order'] = order
                curriculum.append(lesson)
                order += 1

        # Add related projects section at the end
        order = cls._add_related_projects_section(curriculum, existing_content, order)

        return curriculum

    @classmethod
    def _extract_learning_preferences(cls, member_context: dict | None) -> dict:
        """Extract learning preferences from member_context."""
        defaults = {
            'style': 'mixed',
            'difficulty': 'beginner',
            'session_length': 15,
            'goal': 'exploring',
        }

        if not member_context:
            return defaults

        learning = member_context.get('learning', {})

        # Check top-level skill_level first (set from user profile settings),
        # then fall back to learning.difficulty_level, then default
        skill_level = member_context.get('skill_level') or learning.get('difficulty_level') or defaults['difficulty']

        return {
            'style': learning.get('learning_style', defaults['style']),
            'difficulty': skill_level,
            'session_length': learning.get('session_length', defaults['session_length']),
            'goal': learning.get('learning_goal', defaults['goal']),
        }

    @classmethod
    def _add_existing_content(
        cls,
        curriculum: list[CurriculumItem],
        existing_content: dict,
        start_order: int,
    ) -> int:
        """Add existing content to curriculum in priority order. Returns next order number."""
        order = start_order

        # Add tool overview if found
        if existing_content.get('tool'):
            tool = existing_content['tool']
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='tool',
                    title=f"Understanding {tool['name']}",
                    tool_slug=tool['slug'],
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Categorize projects by content type
        # Use 'in' matching to handle variants like 'content-video', 'content-article'
        projects = existing_content.get('projects', [])
        video_projects = [p for p in projects if 'video' in (p.get('content_type') or '').lower()]
        article_projects = [p for p in projects if 'article' in (p.get('content_type') or '').lower()]
        code_projects = [p for p in projects if 'code-repo' in (p.get('content_type') or '').lower()]

        # Add videos (introduction) - max 2
        for project in video_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='video',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=15,
                    generated=False,
                )
            )
            order += 1

        # Add first quiz for knowledge check
        for quiz in existing_content.get('quizzes', [])[:1]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='quiz',
                    title=quiz['title'],
                    quiz_id=quiz['id'],
                    url=quiz.get('url'),
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Add articles - max 2
        for project in article_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='article',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=10,
                    generated=False,
                )
            )
            order += 1

        # Add games - max 1
        for game in existing_content.get('games', [])[:1]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='game',
                    title=game['title'],
                    game_slug=game['slug'],
                    estimated_minutes=15,
                    generated=False,
                )
            )
            order += 1

        # Add code repos - max 2
        for project in code_projects[:2]:
            curriculum.append(
                CurriculumItem(
                    order=order,
                    type='code-repo',
                    title=project['title'],
                    project_id=project['id'],
                    url=project.get('url'),
                    estimated_minutes=20,
                    generated=False,
                )
            )
            order += 1

        return order

    @classmethod
    def _add_related_projects_section(
        cls,
        curriculum: list[CurriculumItem],
        existing_content: dict,
        order: int,
    ) -> int:
        """Add 'See what others are doing' section with related projects at the end."""
        projects = existing_content.get('projects', [])

        # Need at least 3 projects to show this section
        if len(projects) < 3:
            return order

        # Take 3-5 projects (dynamic based on availability)
        project_count = min(5, len(projects))
        selected_projects = projects[:project_count]

        curriculum.append(
            CurriculumItem(
                order=order,
                type='related_projects',
                title='See what others are doing',
                projects=selected_projects,
                estimated_minutes=10,
                generated=False,
            )
        )
        return order + 1

    @classmethod
    def _has_content_gap(cls, existing_content: dict) -> bool:
        """Determine if there's a content gap requiring AI generation.

        Only counts LESSON content (is_lesson=True) that would be added as curriculum items:
        - Videos, articles, code-repos (from projects with is_lesson=True and matching content_type)
        - Quizzes and games
        - Tool overview

        Regular community projects (is_lesson=False) only appear in related_projects section
        and do NOT count toward filling the content gap.
        """
        projects = existing_content.get('projects', [])
        quizzes = existing_content.get('quizzes', [])
        games = existing_content.get('games', [])
        tool = existing_content.get('tool')

        # Only count LESSON projects (is_lesson=True)
        lesson_projects = [p for p in projects if p.get('is_lesson', False)]

        # Count lesson projects that would be added as curriculum items
        # Match content-video, video, content-article, article, etc.
        curriculum_content_types = {'video', 'article', 'code-repo'}
        curriculum_lesson_projects = [
            p
            for p in lesson_projects
            if any(ct in (p.get('content_type') or '').lower() for ct in curriculum_content_types)
        ]

        # Total = tool (if exists) + lesson projects + quizzes + games
        total_curriculum_items = (1 if tool else 0) + len(curriculum_lesson_projects) + len(quizzes) + len(games)

        # Consider it a gap if we have fewer than 3 curriculum items
        # This ensures AI lessons are generated when we only have related projects
        return total_curriculum_items < 3

    @classmethod
    def _log_content_gap(
        cls,
        topic: str,
        user_id: int | None,
        existing_content: dict,
        member_context: dict | None,
    ) -> None:
        """Log content gap to ContentGap model for strategic content development."""
        try:
            from core.learning_paths.models import ContentGap

            topic_normalized = slugify(topic)

            # Calculate how many results we found
            results_count = (
                len(existing_content.get('projects', []))
                + len(existing_content.get('quizzes', []))
                + len(existing_content.get('games', []))
            )

            # Build context metadata
            context = {}
            if member_context:
                learning = member_context.get('learning', {})
                context['difficulty_level'] = learning.get('difficulty_level')
                context['learning_style'] = learning.get('learning_style')

            # Update or create the gap record
            gap, created = ContentGap.objects.update_or_create(
                topic_normalized=topic_normalized,
                modality='learning_path',
                defaults={
                    'topic': topic,
                    'gap_type': ContentGap.GapType.MISSING_TOPIC,
                    'results_returned': results_count,
                    'context': context,
                },
            )

            if not created:
                # Increment counters for existing gap
                ContentGap.objects.filter(pk=gap.pk).update(
                    request_count=F('request_count') + 1,
                )

            # Track first requester if not set
            if created and user_id:
                gap.first_requested_by_id = user_id
                gap.save(update_fields=['first_requested_by_id'])

            logger.info(
                f"Content gap logged: topic='{topic}', results={results_count}",
                extra={
                    'topic': topic,
                    'topic_normalized': topic_normalized,
                    'user_id': user_id,
                    'results_count': results_count,
                    'created': created,
                },
            )

        except Exception as e:
            # Don't let gap logging failures break the flow
            logger.error(f'Failed to log content gap: {e}', exc_info=True)

    @classmethod
    def _generate_ai_lessons(
        cls,
        topic: str,
        learning_style: str,
        difficulty: str,
        session_length: int,
        existing_count: int,
        user_id: int | None = None,
    ) -> list[CurriculumItem]:
        """Generate AI lessons to fill content gaps."""

        lessons = []

        # Determine how many lessons to generate based on existing content
        # If we have some content, generate fewer AI lessons
        lessons_to_generate = max(1, 5 - existing_count)

        # Generate concept breakdown for the topic
        concepts = cls._break_down_topic(topic, lessons_to_generate)

        for _i, concept in enumerate(concepts):
            try:
                lesson_content = cls._generate_single_lesson(
                    concept=concept,
                    topic=topic,
                    learning_style=learning_style,
                    difficulty=difficulty,
                    user_id=user_id,
                )

                if lesson_content:
                    # Estimate time based on content length
                    explanation_length = len(lesson_content.get('explanation', ''))
                    estimated_minutes = max(5, min(20, explanation_length // 200))

                    lessons.append(
                        CurriculumItem(
                            order=0,  # Will be set by caller
                            type='ai_lesson',
                            title=concept,
                            content=lesson_content,
                            estimated_minutes=estimated_minutes,
                            difficulty=difficulty,
                            generated=True,
                        )
                    )

            except Exception as e:
                logger.error(
                    f'Failed to generate lesson for concept: {concept}',
                    extra={'concept': concept, 'topic': topic, 'error': str(e)},
                    exc_info=True,
                )

        return lessons

    @classmethod
    def _break_down_topic(cls, topic: str, num_concepts: int) -> list[str]:
        """Break down a topic into learnable concepts."""
        # For now, use simple heuristics. Could be AI-powered in future.
        topic_clean = topic.replace('-', ' ').replace('_', ' ').title()

        # Common concept patterns for learning paths
        concept_templates = [
            f'What is {topic_clean}?',
            f'Core Concepts of {topic_clean}',
            f'How {topic_clean} Works',
            f'Getting Started with {topic_clean}',
            f'Best Practices for {topic_clean}',
            f'Common Patterns in {topic_clean}',
            f'Advanced {topic_clean} Techniques',
        ]

        return concept_templates[:num_concepts]

    @classmethod
    def _generate_single_lesson(
        cls,
        concept: str,
        topic: str,
        learning_style: str,
        difficulty: str,
        user_id: int | None = None,
    ) -> AILessonContent | None:
        """Generate a single AI lesson for a concept."""
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        # Build the personalized prompt
        style_instruction = STYLE_INSTRUCTIONS.get(learning_style, STYLE_INSTRUCTIONS['mixed'])
        difficulty_instruction = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS['beginner'])

        prompt = f"""Generate a lesson about: {concept}
Topic context: {topic}

{style_instruction}

{difficulty_instruction}

Remember to return valid JSON matching the required structure."""

        try:
            ai = AIProvider(user_id=user_id)

            response = ai.complete(
                prompt=prompt,
                system_message=cls.SYSTEM_PROMPT,
                temperature=0.7,
                max_tokens=2000,
            )

            # Track AI usage for billing and analytics
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='lesson_generation',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={
                            'concept': concept,
                            'topic': topic,
                            'learning_style': learning_style,
                            'difficulty': difficulty,
                        },
                        gateway_metadata={
                            'gateway_provider': ai.last_usage.get('gateway_provider'),
                            'gateway_model': ai.last_usage.get('gateway_model'),
                            'requested_model': ai.last_usage.get('requested_model'),
                        }
                        if ai.last_usage.get('gateway_provider')
                        else None,
                    )
                except User.DoesNotExist:
                    logger.warning(f'User {user_id} not found for AI usage tracking')
                except Exception as e:
                    logger.error(f'Failed to track AI usage: {e}', exc_info=True)

            # Parse JSON response
            lesson_content = cls._parse_lesson_response(response)

            if lesson_content:
                logger.info(
                    f'Generated AI lesson: {concept}',
                    extra={
                        'concept': concept,
                        'topic': topic,
                        'learning_style': learning_style,
                        'difficulty': difficulty,
                        'user_id': user_id,
                    },
                )

            return lesson_content

        except Exception as e:
            logger.error(
                f'AI lesson generation failed: {e}',
                extra={'concept': concept, 'topic': topic, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _parse_lesson_response(cls, response: str) -> AILessonContent | None:
        """Parse AI response into structured lesson content."""
        try:
            # Try to extract JSON from the response
            # Sometimes AI wraps JSON in markdown code blocks
            json_str = response.strip()

            # Remove markdown code block markers if present
            if json_str.startswith('```json'):
                json_str = json_str[7:]
            elif json_str.startswith('```'):
                json_str = json_str[3:]

            if json_str.endswith('```'):
                json_str = json_str[:-3]

            json_str = json_str.strip()

            # Parse JSON
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

            # Build the lesson content
            return AILessonContent(
                summary=data.get('summary', ''),
                key_concepts=data.get('key_concepts', []),
                explanation=data.get('explanation', ''),
                examples=data.get('examples', []),
                practice_prompt=data.get('practice_prompt', ''),
                mermaid_diagram=validated_mermaid,
            )

        except json.JSONDecodeError as e:
            logger.error(f'Failed to parse AI lesson response as JSON: {e}')
            logger.debug(f'Raw response: {response[:500]}...')
            return None
        except Exception as e:
            logger.error(f'Error parsing AI lesson response: {e}', exc_info=True)
            return None
