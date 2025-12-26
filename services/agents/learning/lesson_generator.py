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


class ExerciseContentByLevel(TypedDict, total=False):
    """Content for a specific skill level in an exercise."""

    instructions: str
    command_hint: str | None
    hints: list[str]


class LessonExercise(TypedDict, total=False):
    """Interactive exercise for hands-on practice."""

    exercise_type: str  # 'terminal' | 'git' | 'ai_prompt' | 'code_review'
    scenario: str
    expected_inputs: list[str]  # Regex patterns for validation
    success_message: str
    expected_output: str
    content_by_level: dict[str, ExerciseContentByLevel]


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


# System prompt for topic analysis
TOPIC_ANALYSIS_PROMPT = """You are analyzing a learning request to create a structured learning path.

Your task is to understand what the user wants to learn and break it down intelligently.

IMPORTANT: Handle multi-subject queries properly. For example:
- "playwright with claude" → Integration of Playwright (browser testing) WITH Claude (AI assistant)
- "react vs vue" → Comparison of two frameworks
- "python for data science" → Using Python IN the context of data science

Return a JSON object with this exact structure:
{
    "title": "A clear, human-readable title describing what they'll learn",
    "slug": "url-friendly-slug-for-the-path",
    "subjects": ["Subject1", "Subject2"],
    "relationship": "integration|comparison|workflow|single",
    "description": "One sentence describing the learning outcome",
    "concepts": [
        "Lesson 1 title - foundational concept",
        "Lesson 2 title - builds on lesson 1",
        "Lesson 3 title - integration/application",
        "Lesson 4 title - practical project",
        "Lesson 5 title - advanced techniques"
    ]
}

Guidelines for concepts:
- For SINGLE subject: Progress from basics → intermediate → advanced
- For INTEGRATION (X with Y): Cover X basics → Y basics → How to use them together → Practical workflow
- For COMPARISON (X vs Y): Cover X overview → Y overview → Key differences → When to use each
- For WORKFLOW (X for Y): Cover the goal (Y) → How X helps → Step-by-step process

IMPORTANT:
- The title should NEVER just concatenate words
  (not "Playwright Claude" but "Browser Testing with Playwright and Claude AI")
- Each concept should be a complete, meaningful lesson title
- Concepts should build on each other in a logical learning progression
- Generate 4-6 concepts based on topic complexity

Return ONLY valid JSON, no other text."""


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
- For TECHNICAL topics: Start with a practical code example, then explain what it does
- For NON-TECHNICAL topics: Describe a real scenario the learner can relate to, then walk through the steps
- Include a "Try This" exercise they can do immediately (code for technical, thought exercise for non-technical)
- Focus on practical application over theory
- Show real-world use cases they can replicate or imagine themselves doing
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
- For TECHNICAL topics: Include one practical code example
- For NON-TECHNICAL topics: Include a detailed scenario or case study
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

FOR TECHNICAL TOPICS - CODE EXAMPLES FOR BEGINNERS:
- Add detailed inline comments explaining EVERY line of code
- Before the code, explain what we're about to do and why
- After the code, walk through what happened step by step
- Use descriptive variable names (e.g., `user_message` not `msg`)
- Keep examples short (5-15 lines max) and focused on ONE concept

FOR NON-TECHNICAL TOPICS - EXAMPLES FOR BEGINNERS:
- Use real-world scenarios the learner can visualize
- Explain CONCEPTS, not UI clicks (they're not in the tool)
- Use "imagine you're..." framing to make it relatable
- Focus on WHAT to think about, not WHERE to click
- Give them questions to ask themselves when using any tool
- Example: "When building a chatbot, first list your users' top 5 questions" (actionable thinking)
- NOT: "Click the chatbot button and drag it..." (fake UI instructions)

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

FIRST: Determine if this is a TECHNICAL or NON-TECHNICAL topic:

TECHNICAL topics (involve actual code, commands, or syntax):
- Programming languages (Python, JavaScript, etc.)
- CLI tools (Git, Docker, npm, etc.)
- APIs and SDKs
- Database queries
- DevOps and system administration
→ Include code examples AND may include interactive exercises

NON-TECHNICAL topics (conceptual, strategic, or using visual interfaces):
- No-code/low-code platforms (Bubble, Zapier, etc.)
- AI concepts and ethics
- Design thinking and UX principles
- Business strategy and soft skills
- Tool overviews (learning ABOUT a tool, not CLI usage)
→ Keep explanations SHORT - focus on mental models and decision frameworks
→ Do NOT describe fake UI actions ("click the button", "drag the component")
→ Use exercise_type: "ai_prompt" so users can apply concepts to their situation
→ Use quizzes for knowledge checks

CRITICAL - TEACH HOW TO THINK, NOT HOW TO CLICK:
Focus on mental models, decision frameworks, and conceptual understanding.
NOT on describing UI features, button clicks, or tool-specific workflows.

❌ BAD - Describing made-up UI actions:
"With a low-code platform, you can select a 'Chatbot' component, set up questions and
answers using simple forms, and connect it to your website—all by clicking and filling out fields."
This teaches nothing. It's vague, generic, and not actionable.

✅ GOOD - Teach HOW TO THINK about the problem:
"Before building any chatbot, ask yourself three questions:
1. What are the 5 most common things users ask? (These become your main flows)
2. What should happen when the bot doesn't understand? (Your fallback strategy)
3. When should the bot hand off to a human? (Your escalation criteria)

These questions apply whether you use Intercom, Drift, or build custom."

✅ GOOD - Teach mental models and frameworks:
"Think of a chatbot like a phone tree: each user message is a branch point. Good chatbots
have shallow trees (users get answers fast) and clear escape hatches (talk to human).
Bad chatbots have deep trees where users get lost."

✅ GOOD - Teach decision-making criteria:
"When choosing a no-code chatbot platform, evaluate: (1) Can it integrate with your
existing tools? (2) Does it support your channels - web, SMS, WhatsApp? (3) What
analytics does it provide? (4) How much does it cost per conversation?"

The goal: After the lesson, the learner should THINK DIFFERENTLY about the topic,
not just know which buttons to click in some tool.

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
5. ALWAYS includes a short quiz (2-3 questions) to check understanding
6. MAY include an interactive exercise IF the topic involves commands/code (see rules below)

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
    "summary": "1-2 sentence hook that explains what the learner will understand",
    "key_concepts": ["concept1", "concept2", "concept3"],
    "explanation": "Full markdown explanation with formatting, code blocks if relevant",
    "examples": [
        {
            "title": "Example Name",
            "description": "Use markdown formatting: paragraphs, **bold**, bullets, code blocks, etc."
        }
    ],
    "practice_prompt": "An ACTIONABLE exercise the user can do RIGHT NOW. See examples below.",
    "mermaid_diagram": "optional mermaid diagram code if visual style. For beginners, add diagram explanation.",
    "exercise": null,
    "quiz": {
        "questions": [
            {
                "id": "q1",
                "question": "Clear question testing a key concept from the lesson",
                "question_type": "multiple_choice",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A",
                "explanation": "Why this is correct, reinforcing the learning",
                "hint": "Optional hint to guide thinking"
            },
            {
                "id": "q2",
                "question": "True or false question about an important point",
                "question_type": "true_false",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": "Explanation of why this is true/false",
                "hint": null
            }
        ],
        "passing_score": 2,
        "encouragement_message": "Great job! You understood the key concepts.",
        "retry_message": "Almost there! Review the explanation and try again."
    }
}

EXERCISE RULES - CRITICAL:

FOR NON-TECHNICAL TOPICS: ALWAYS use exercise_type: "ai_prompt"
The inline AI chat lets users apply concepts to THEIR specific situation.
This is MORE valuable than a thought exercise because it's personalized and interactive.

Examples of GOOD ai_prompt exercises for non-technical lessons:
- "Tell me about your business and I'll help identify your top 5 user questions"
- "Describe your use case and I'll help you decide when to escalate to human"
- "Let's write your chatbot welcome message together - describe what you want it to say"
- "Tell me your budget and requirements, and I'll help you evaluate platform options"

FOR TECHNICAL TOPICS: Use the appropriate exercise type:
- "terminal": For lessons teaching shell commands (cd, ls, mkdir, curl, etc.)
- "git": For lessons teaching git CLI commands (git add, git commit, git push, etc.)
- "ai_prompt": For lessons teaching prompt engineering
- "code_review": For lessons where user identifies bugs in code snippets

EXERCISE VALIDATION (expected_inputs) - only if exercise is not null:
- Use regex patterns that flexibly match the user's input
- For git commit: "^git commit -m ['\"].+['\"]$" matches any commit message
- For mkdir: "^mkdir\\s+\\w+" matches mkdir with any directory name
- Include variations users might type (with/without spaces, quotes, etc.)

EXERCISE JSON STRUCTURE (only include if topic is technical):
{
    "exercise_type": "terminal|git|ai_prompt|code_review",
    "scenario": "Real-world context for the exercise (1-2 sentences)",
    "expected_inputs": ["regex pattern to match valid input", "alternate pattern"],
    "success_message": "Congratulations message when completed",
    "expected_output": "What the simulated terminal/system shows on success",
    "content_by_level": {
        "beginner": {
            "instructions": "Step-by-step instructions with lots of guidance",
            "command_hint": "The exact command with placeholders",
            "hints": ["First hint", "Second hint", "Third hint"]
        },
        "intermediate": {
            "instructions": "Concise instructions",
            "command_hint": "Partial hint",
            "hints": ["First hint", "Second hint"]
        },
        "advanced": {
            "instructions": "Brief task description",
            "command_hint": null,
            "hints": ["One subtle hint"]
        }
    }
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

QUIZ GENERATION RULES:
- Generate 2-3 questions that test the KEY CONCEPTS from this specific lesson
- Use a mix of multiple_choice and true_false question types
- For multiple_choice: ALWAYS provide exactly 4 options
- Make wrong options plausible but clearly incorrect (avoid trick questions)
- The explanation should teach WHY the answer is correct, not just state it
- Adapt question complexity to the difficulty level:
  - BEGINNER: Straightforward recall questions, simple scenarios
  - INTERMEDIATE: Application questions, comparing approaches
  - ADVANCED: Edge cases, best practices, "when would you use X vs Y"
- Each question MUST have a unique id (q1, q2, q3)
- Set passing_score to the number of questions - 1 (allow one mistake)
"""

    @classmethod
    def analyze_topic(cls, query: str, user_id: int | None = None) -> TopicAnalysis | None:
        """
        Analyze a learning query to extract subjects, relationship, and generate concepts.

        Uses AI to intelligently parse multi-subject queries like:
        - "playwright with claude" → Integration learning path
        - "react vs vue" → Comparison learning path
        - "python for data science" → Workflow learning path

        Args:
            query: The raw learning query from the user
            user_id: User ID for AI usage tracking

        Returns:
            TopicAnalysis with title, slug, subjects, relationship, and concepts,
            or None if analysis fails (falls back to simple parsing)
        """
        from django.contrib.auth import get_user_model

        from core.ai_usage.tracker import AIUsageTracker
        from services.ai.provider import AIProvider

        User = get_user_model()

        try:
            ai = AIProvider(user_id=user_id)

            prompt = f"""Analyze this learning request and create a structured learning path:

"{query}"

Remember:
- Detect if this involves multiple subjects (tools, frameworks, concepts)
- Create a meaningful title that describes the RELATIONSHIP, not just concatenation
- Generate lesson concepts that build logically from basics to application
- For integration queries, ensure lessons cover both subjects AND how they work together"""

            response = ai.complete(
                prompt=prompt,
                system_message=TOPIC_ANALYSIS_PROMPT,
                temperature=0.3,  # Lower temperature for more consistent structure
                max_tokens=800,
            )

            # Track AI usage
            if user_id and ai.last_usage:
                try:
                    user = User.objects.get(id=user_id)
                    AIUsageTracker.track_usage(
                        user=user,
                        feature='topic_analysis',
                        provider=ai._provider.value if ai._provider else 'unknown',
                        model=ai.last_usage.get('gateway_model', 'gpt-4o-mini'),
                        input_tokens=ai.last_usage.get('prompt_tokens', 0),
                        output_tokens=ai.last_usage.get('completion_tokens', 0),
                        request_type='completion',
                        status='success',
                        request_metadata={'query': query},
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

            # Parse the response
            analysis = cls._parse_topic_analysis(response, query)

            if analysis:
                logger.info(
                    'Topic analysis complete',
                    extra={
                        'query': query,
                        'title': analysis['title'],
                        'subjects': analysis['subjects'],
                        'relationship': analysis['relationship'],
                        'concept_count': len(analysis['concepts']),
                    },
                )

            return analysis

        except Exception as e:
            logger.error(
                'Topic analysis failed, will use fallback',
                extra={'query': query, 'error': str(e)},
                exc_info=True,
            )
            return None

    @classmethod
    def _parse_topic_analysis(cls, response: str, original_query: str) -> TopicAnalysis | None:
        """Parse AI response into TopicAnalysis structure."""
        try:
            # Clean up the response
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

    @classmethod
    def get_fallback_analysis(cls, query: str) -> TopicAnalysis:
        """
        Generate a fallback TopicAnalysis when AI analysis fails.

        Uses simple heuristics to create a basic structure.
        """
        query_clean = query.replace('-', ' ').replace('_', ' ')
        title = f'{query_clean.title()} Learning Path'
        slug = slugify(query)

        # Simple concept templates as fallback
        concepts = [
            f'Introduction to {query_clean.title()}',
            f'Core Concepts of {query_clean.title()}',
            'Practical Applications',
            'Best Practices and Tips',
            'Next Steps',
        ]

        return TopicAnalysis(
            title=title,
            slug=slug,
            subjects=[query_clean.title()],
            relationship='single',
            description=f'Learn the fundamentals of {query_clean}',
            concepts=concepts,
        )

    @classmethod
    def generate_curriculum(
        cls,
        topic: str,
        member_context: dict | None,
        existing_content: dict,
        user_id: int | None = None,
        topic_analysis: TopicAnalysis | None = None,
    ) -> list[CurriculumItem]:
        """
        Generate a complete curriculum mixing existing content with AI-generated lessons.

        Args:
            topic: The topic/query for the learning path
            member_context: User's learning preferences and context
            existing_content: Content found by ContentFinder
            user_id: User ID for logging and gap tracking
            topic_analysis: Optional pre-analyzed topic with AI-generated concepts

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

            # Get pre-analyzed concepts if available
            analyzed_concepts = topic_analysis['concepts'] if topic_analysis else None

            # Generate AI lessons to fill the gap
            ai_lessons = cls._generate_ai_lessons(
                topic=topic,
                learning_style=learning_prefs['style'],
                difficulty=learning_prefs['difficulty'],
                session_length=learning_prefs['session_length'],
                existing_count=len(curriculum),
                user_id=user_id,
                analyzed_concepts=analyzed_concepts,
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

        # Categorize projects by content type - ONLY include lesson projects
        # Use 'in' matching to handle variants like 'content-video', 'content-article'
        # Non-lesson projects only appear in the "See what others are doing" section
        projects = existing_content.get('projects', [])
        lesson_projects = [p for p in projects if p.get('is_lesson', False)]
        video_projects = [p for p in lesson_projects if 'video' in (p.get('content_type') or '').lower()]
        article_projects = [p for p in lesson_projects if 'article' in (p.get('content_type') or '').lower()]
        code_projects = [p for p in lesson_projects if 'code-repo' in (p.get('content_type') or '').lower()]

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
        """Add 'See what others are doing' section with related projects at the end.

        Always adds this section to encourage community engagement.
        Shows available projects if any, otherwise shows an empty section
        that the frontend can render with a "be the first" message.
        """
        projects = existing_content.get('projects', [])

        # Take up to 5 projects (dynamic based on availability)
        project_count = min(5, len(projects))
        selected_projects = projects[:project_count] if projects else []

        curriculum.append(
            CurriculumItem(
                order=order,
                type='related_projects',
                title='See what others are doing',
                projects=selected_projects,
                estimated_minutes=5 if selected_projects else 2,
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
        analyzed_concepts: list[str] | None = None,
    ) -> list[CurriculumItem]:
        """Generate AI lessons to fill content gaps.

        Args:
            topic: The topic/query for the learning path
            learning_style: User's preferred learning style
            difficulty: Difficulty level (beginner, intermediate, advanced)
            session_length: Preferred session length in minutes
            existing_count: Number of existing curriculum items
            user_id: User ID for AI usage tracking
            analyzed_concepts: Pre-analyzed lesson concepts from TopicAnalysis
        """

        lessons = []

        # Determine how many lessons to generate based on existing content
        # If we have some content, generate fewer AI lessons
        lessons_to_generate = max(1, 5 - existing_count)

        # Use pre-analyzed concepts if available, otherwise fall back to heuristics
        if analyzed_concepts:
            # Use AI-generated concepts, limited to how many we need
            concepts = analyzed_concepts[:lessons_to_generate]
            logger.info(
                f'Using {len(concepts)} pre-analyzed concepts for lessons',
                extra={'topic': topic, 'concepts': concepts},
            )
        else:
            # Fall back to simple heuristic breakdown
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

            # Parse exercise if present
            exercise_data = data.get('exercise')
            validated_exercise = cls._validate_exercise(exercise_data) if exercise_data else None

            # Parse quiz if present
            quiz_data = data.get('quiz')
            validated_quiz = cls._validate_quiz(quiz_data) if quiz_data else None

            # Build the lesson content
            return AILessonContent(
                summary=data.get('summary', ''),
                key_concepts=data.get('key_concepts', []),
                explanation=data.get('explanation', ''),
                examples=data.get('examples', []),
                practice_prompt=data.get('practice_prompt', ''),
                mermaid_diagram=validated_mermaid,
                exercise=validated_exercise,
                quiz=validated_quiz,
            )

        except json.JSONDecodeError as e:
            logger.error(f'Failed to parse AI lesson response as JSON: {e}')
            logger.debug(f'Raw response: {response[:500]}...')
            return None
        except Exception as e:
            logger.error(f'Error parsing AI lesson response: {e}', exc_info=True)
            return None

    @classmethod
    def _validate_exercise(cls, exercise_data: dict) -> LessonExercise | None:
        """Validate and normalize exercise data from AI response.

        Args:
            exercise_data: Raw exercise dict from AI response

        Returns:
            Validated LessonExercise or None if invalid
        """
        if not exercise_data:
            return None

        # Check required fields
        required_fields = ['exercise_type', 'scenario', 'expected_inputs', 'content_by_level']
        for field in required_fields:
            if field not in exercise_data:
                logger.warning(f'Missing required exercise field: {field}')
                return None

        # Validate exercise type
        valid_types = {'terminal', 'git', 'ai_prompt', 'code_review'}
        exercise_type = exercise_data.get('exercise_type', '').lower()
        if exercise_type not in valid_types:
            logger.warning(f'Invalid exercise type: {exercise_type}')
            return None

        # Validate expected_inputs is a list with at least one pattern
        expected_inputs = exercise_data.get('expected_inputs', [])
        if not isinstance(expected_inputs, list) or len(expected_inputs) == 0:
            logger.warning('Exercise must have at least one expected_input pattern')
            return None

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
        return LessonExercise(
            exercise_type=exercise_type,
            scenario=exercise_data.get('scenario', ''),
            expected_inputs=expected_inputs,
            success_message=exercise_data.get('success_message', 'Great job!'),
            expected_output=exercise_data.get('expected_output', ''),
            content_by_level=normalized_content,
        )

    @classmethod
    def _validate_quiz(cls, quiz_data: dict) -> LessonQuiz | None:
        """Validate and normalize quiz data from AI response.

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
