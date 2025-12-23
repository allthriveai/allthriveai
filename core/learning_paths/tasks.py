"""
Celery tasks for learning paths.

Handles:
- Cover image generation with Gemini for SavedLearningPath
"""

import logging
import time
import uuid

from celery import shared_task
from django.contrib.auth import get_user_model

from core.ai_usage.tracker import AIUsageTracker
from services.ai import AIProvider
from services.integrations.storage import StorageService

logger = logging.getLogger(__name__)
User = get_user_model()

# Learning path cover image prompt template
# Style: Neon glass aesthetic with AllThrive brand colors (emerald/cyan/amber)
# Colors rotate between green, cyan, and amber for variety
COVER_IMAGE_PROMPT = """Create an EDUCATIONAL DIAGRAM that teaches the concept of "{title}".

MANDATORY - THE IMAGE MUST SHOW THIS EXACT VISUAL:
{concept_visualization}

This is an INSTRUCTIONAL illustration - someone should LEARN something by looking at it.
The image must be a DIAGRAM or INFOGRAPHIC, not abstract art.

DO NOT CREATE:
- Abstract glowing shapes with no meaning
- Generic "tech" or "AI" aesthetic
- Floating geometric patterns
- Images that could represent any topic
- Decorative visuals with no educational value

THE IMAGE MUST:
- Show the actual mechanism/process/concept being taught
- Help learners build a mental model
- Include clear visual components that explain how things work
- Be specific to THIS topic - not generic

Visual style:
- Dark slate background (#0F172A to #020617)
{color_scheme}
- Clean diagram aesthetic

CRITICAL - NO TEXT IN THE IMAGE:
- Do NOT include any labels, captions, or text
- The image will be displayed as a small thumbnail
- Use visual metaphors, colors, and shapes instead of words
- Icons and symbols are okay, but no readable text

The goal is {theme_hint}.
A learner should understand the concept from the visual alone.
"""

# Color schemes that rotate for visual variety
COLOR_SCHEMES = [
    # Green primary
    (
        '- Emerald/green glows (#10B981, #22C55E) for main elements\n'
        '- Cyan/teal (#22D3EE, #14B8A6) for highlights\n'
        '- Yellow/amber (#EAB308) for emphasis'
    ),
    # Cyan primary
    (
        '- Cyan/teal (#22D3EE, #14B8A6) for main elements\n'
        '- Emerald/green (#10B981, #22C55E) for highlights\n'
        '- Yellow/amber (#EAB308) for emphasis'
    ),
    # Amber primary
    (
        '- Yellow/amber (#EAB308, #F59E0B) for main elements\n'
        '- Emerald/green (#10B981, #22C55E) for highlights\n'
        '- Cyan/teal (#22D3EE, #14B8A6) for emphasis'
    ),
]


def get_theme_hint(title: str) -> tuple[str, str]:
    """
    Generate theme hint and concept visualization based on the learning path title.

    Args:
        title: Learning path title

    Returns:
        Tuple of (theme_hint, concept_visualization) for the image prompt
    """
    title_lower = title.lower()

    # Context window / Tokenization - SPECIFIC diagram
    if any(kw in title_lower for kw in ['context window', 'context length']):
        return (
            'teaching how context windows limit what an LLM can "see"',
            'A horizontal row of small rectangular blocks representing tokens (like a long document). '
            'A bright emerald GLOWING FRAME/WINDOW highlights only 5-7 blocks in the center. '
            'Blocks INSIDE the window are bright and vivid. '
            'Blocks OUTSIDE the window are dark, faded, almost invisible. '
            'Cyan arrows on left and right edges show the window can slide. '
            'NO TEXT OR LABELS - purely visual. '
            'The contrast between bright inside vs dark outside tells the story.',
        )

    # Tokenization specifically
    if 'token' in title_lower and 'context' not in title_lower:
        return (
            'teaching how text gets split into tokens',
            'Show a sentence like "Hello world!" being broken into pieces. '
            'Draw arrows from the text to individual token boxes below: ["Hello", " world", "!"]. '
            'Each token box has a number ID underneath (like 15496, 995, 0). '
            'This teaches: text is split into subword pieces, each with an ID.',
        )

    # Version control / Git themes
    if any(kw in title_lower for kw in ['git', 'version control', 'github', 'gitlab']):
        return (
            'teaching how git branching and merging works',
            'A timeline diagram showing: main branch as a horizontal line with commit dots. '
            'A feature branch splits off diagonally, has its own commits, then merges back. '
            'Label the branches "main" and "feature". Show merge point with converging arrows. '
            'This teaches: code can diverge and later combine.',
        )

    # RAG / Vector themes
    if any(kw in title_lower for kw in ['rag', 'retrieval']):
        return (
            'teaching how RAG retrieves relevant documents to answer questions',
            'Three-stage diagram: (1) Documents on left being converted to vectors (show embedding arrows). '
            '(2) A search query in the middle sending rays to find similar vectors. '
            '(3) Retrieved documents being fed into an LLM box on the right that outputs an answer. '
            'This teaches: RAG finds relevant docs then uses them to answer.',
        )

    # Vector / Embedding themes
    if any(kw in title_lower for kw in ['vector', 'embedding']):
        return (
            'teaching how text becomes numerical vectors for similarity search',
            'Show text phrases on the left (like "happy dog", "joyful puppy", "sad cat"). '
            'Arrows transform them into dots in a 2D/3D coordinate space on the right. '
            'Similar meanings cluster together (happy dog near joyful puppy). '
            'Draw a distance line between similar items. '
            'This teaches: similar meanings = nearby vectors.',
        )

    # LLM themes
    if any(kw in title_lower for kw in ['llm', 'large language model']):
        return (
            'teaching the basic input/output flow of language models',
            'Show a simple flow diagram: User prompt (speech bubble) → LLM box (labeled "GPT/Claude") → Response text. '
            'Inside the LLM box, show layers or a transformer icon. '
            'Add arrows showing the flow from input to output. '
            'This teaches: you give text in, model gives text out.',
        )

    # Prompt engineering themes
    if any(kw in title_lower for kw in ['prompt', 'prompting']):
        return (
            'teaching how prompt structure affects LLM output',
            'Side-by-side comparison: Left shows a vague prompt → mediocre output. '
            'Right shows a structured prompt with [Role] [Context] [Task] sections → excellent output. '
            'Use checkmarks and X marks to show quality difference. '
            'This teaches: how you write prompts matters.',
        )

    # Agent themes
    if any(kw in title_lower for kw in ['agent', 'autonomous', 'agentic']):
        return (
            'teaching how AI agents use tools in a loop',
            'Circular flow diagram: LLM Brain → "Think: I need to search" → Tool: Web Search → '
            'Results return to LLM → "Think: Now I can answer" → Final Response. '
            'Show the loop with arrows. Include tool icons (search, calculator, code). '
            'This teaches: agents think, act, observe, repeat.',
        )

    # Neural network / Deep learning
    if any(kw in title_lower for kw in ['neural', 'deep learning']):
        return (
            'teaching how neural networks process information through layers',
            'Classic neural network diagram: Input nodes on left, 2-3 hidden layers in middle, output on right. '
            'Show connections between nodes. Highlight one path through the network. '
            'Label: Input Layer, Hidden Layers, Output Layer. '
            'This teaches: data flows through layers that transform it.',
        )

    # AI/ML general themes
    if any(kw in title_lower for kw in ['ai', 'machine learning', 'ml ']):
        return (
            'teaching the supervised learning feedback loop',
            'Flow diagram: Training Data → Model → Predictions. '
            'Show comparison with "Correct Answers" and feedback arrow back to model. '
            'Include a graph showing error decreasing over time. '
            'This teaches: models learn by comparing predictions to truth.',
        )

    # Attention mechanism
    if 'attention' in title_lower:
        return (
            'teaching how attention lets models focus on relevant words',
            'Show a sentence where one word needs to understand another distant word. '
            'Draw attention lines of varying thickness connecting related words. '
            'Example: "The cat sat on the mat. It was soft." - thick line from "It" to "mat". '
            'This teaches: attention weights show which words matter for understanding each word.',
        )

    # Programming themes
    if any(kw in title_lower for kw in ['python', 'javascript', 'coding', 'programming', 'typescript']):
        return (
            'teaching the programming workflow',
            'Show a code editor with simple code → arrow to terminal/console output. '
            'Include a bug icon with arrow to debugger, then fixed code. '
            'This teaches: write code, run it, fix errors, repeat.',
        )

    # Data themes
    if any(kw in title_lower for kw in ['data', 'analytics', 'database', 'sql']):
        return (
            'teaching data transformation pipelines',
            'Flow from raw messy data → cleaning step → structured table → chart/insight. '
            'Show each transformation as a step with arrow. '
            'This teaches: raw data needs processing to become useful.',
        )

    # API themes
    if any(kw in title_lower for kw in ['api', 'rest', 'endpoint']):
        return (
            'teaching how APIs enable communication between systems',
            'Client/Server diagram: App icon sends "Request" arrow to Server. '
            'Server processes and sends "Response" arrow back. '
            'Show JSON payload example between them. '
            'This teaches: APIs are request/response communication.',
        )

    # Web themes
    if any(kw in title_lower for kw in ['web', 'frontend', 'backend', 'react', 'next']):
        return (
            'teaching frontend/backend architecture',
            'Split diagram: Browser (Frontend) on left with UI mockup. '
            'Server (Backend) on right with database. '
            'Arrows showing HTTP requests/responses between them. '
            'This teaches: frontend handles UI, backend handles data.',
        )

    # Cloud themes
    if any(kw in title_lower for kw in ['cloud', 'aws', 'azure', 'kubernetes', 'docker']):
        return (
            'teaching cloud deployment concepts',
            'Show local computer → upload arrow → cloud region with multiple server boxes. '
            'Include auto-scaling indicator (1x → 3x servers). '
            'This teaches: deploy once, scale automatically.',
        )

    # Security themes
    if any(kw in title_lower for kw in ['security', 'cyber', 'encryption', 'auth']):
        return (
            'teaching encryption and secure communication',
            'Show: Plain text → Key + Lock icon → Encrypted gibberish → Key + Unlock → Plain text again. '
            'Draw the flow with arrows through each stage. '
            'This teaches: encryption scrambles data, only the key holder can read it.',
        )

    # Pricing / Cost themes
    if any(kw in title_lower for kw in ['pricing', 'cost', 'billing', 'budget', 'usage']):
        return (
            'teaching how API pricing works',
            'Show: API request with token count → meter/gauge → cost in dollars. '
            'Include a simple pricing table: "1K tokens = $0.01". '
            'Show input tokens + output tokens = total cost formula. '
            'This teaches: more tokens = more cost.',
        )

    # Fine-tuning themes
    if any(kw in title_lower for kw in ['fine-tun', 'finetun', 'training']):
        return (
            'teaching how fine-tuning customizes a model',
            'Show: Base Model + Custom Training Data → arrow → Fine-tuned Model. '
            'The fine-tuned model has a special badge/color indicating specialization. '
            'Include example: "General LLM + Medical Data = Medical Expert LLM". '
            'This teaches: fine-tuning specializes general models.',
        )

    # Transformer themes
    if 'transformer' in title_lower:
        return (
            'teaching the transformer architecture',
            'Block diagram showing: Input Embedding → Attention Block → Feed Forward → Output. '
            'Show multiple stacked layers with arrows. '
            'Highlight the Attention block as the key innovation. '
            'This teaches: transformers stack attention and feed-forward layers.',
        )

    # Default - try to extract the main concept
    main_concept = title.replace('Learning Path', '').replace('learning path', '').strip()
    return (
        f'teaching the core concept of {main_concept}',
        f'Create a simple educational diagram that explains {main_concept}. '
        f'Show the key components and how they connect/interact. '
        f'Use arrows to show flow or relationships. '
        f'Include simple labels. Make it look like something from a textbook. '
        f'This teaches: the fundamental idea behind {main_concept}.',
    )


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_learning_path_cover(self, saved_path_id: int, user_id: int):
    """
    Generate a cover image for a SavedLearningPath using Gemini.

    Args:
        saved_path_id: SavedLearningPath ID
        user_id: User ID for attribution

    Returns:
        Dict with generation results
    """
    from .models import SavedLearningPath

    logger.info(f'Starting cover image generation for path {saved_path_id}')

    try:
        # Validate user and path exist
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f'User not found: user_id={user_id}')
            return {'status': 'error', 'reason': 'user_not_found'}

        try:
            saved_path = SavedLearningPath.objects.get(id=saved_path_id, user=user)
        except SavedLearningPath.DoesNotExist:
            logger.error(f'SavedLearningPath not found: id={saved_path_id}')
            return {'status': 'error', 'reason': 'path_not_found'}

        # Build prompt with theme hint and concept visualization
        theme_hint, concept_visualization = get_theme_hint(saved_path.title)
        # Rotate color scheme based on path ID for visual variety
        color_scheme = COLOR_SCHEMES[saved_path_id % len(COLOR_SCHEMES)]
        prompt = COVER_IMAGE_PROMPT.format(
            title=saved_path.title,
            theme_hint=theme_hint,
            concept_visualization=concept_visualization,
            color_scheme=color_scheme,
        )

        # Generate image using Gemini
        start_time = time.time()
        ai = AIProvider(provider='gemini', user_id=user_id)
        image_bytes, mime_type, text_response = ai.generate_image(prompt=prompt)
        latency_ms = int((time.time() - start_time) * 1000)

        if not image_bytes:
            error_message = text_response or 'Failed to generate cover image'
            logger.error(f'Cover image generation failed: {error_message}')
            return {'status': 'error', 'reason': 'generation_failed', 'message': error_message}

        # Upload to S3/MinIO
        filename = f'learning-path-{saved_path_id}-{uuid.uuid4()}.png'
        storage = StorageService()
        image_url, upload_error = storage.upload_file(
            file_data=image_bytes,
            filename=filename,
            folder='learning-path-covers',
            content_type=mime_type or 'image/png',
            is_public=True,
        )

        if upload_error or not image_url:
            logger.error(f'Failed to upload cover image: {upload_error}')
            return {'status': 'error', 'reason': 'upload_failed', 'message': str(upload_error)}

        logger.info(f'Cover image generated and uploaded: {image_url}')

        # Update the SavedLearningPath with the cover image URL
        saved_path.cover_image = image_url
        saved_path.save(update_fields=['cover_image', 'updated_at'])

        # Track AI usage
        try:
            AIUsageTracker.track_usage(
                user=user,
                feature='learning_path_cover',
                provider='gemini',
                model='gemini-2.0-flash',
                input_tokens=len(prompt) // 4,  # Estimate
                output_tokens=len(text_response) // 4 if text_response else 0,
                latency_ms=latency_ms,
                status='success',
                request_metadata={
                    'saved_path_id': saved_path_id,
                    'title': saved_path.title,
                    'image_size_bytes': len(image_bytes),
                },
            )
        except Exception as tracking_error:
            logger.warning(f'Failed to track cover image generation usage: {tracking_error}', exc_info=True)

        return {
            'status': 'success',
            'saved_path_id': saved_path_id,
            'cover_image_url': image_url,
            'latency_ms': latency_ms,
        }

    except Exception as exc:
        logger.error(f'Cover image generation failed: {exc}', exc_info=True)

        # Retry for transient errors
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(f'Cover image generation failed after max retries: {exc}')
            return {'status': 'error', 'reason': 'max_retries_exceeded'}


# Lesson image prompt template for educational illustrations
LESSON_IMAGE_PROMPT = """Create an EDUCATIONAL DIAGRAM that teaches: "{lesson_title}"

The diagram must visualize these specific concepts: {key_concepts}

REQUIREMENTS - This must be an instructional diagram, not abstract art:
1. Show the actual mechanism/process/concept step by step
2. Use arrows to show flow, cause-and-effect, or relationships
3. Include labeled components so viewers understand what each part represents
4. Make it look like a diagram from a textbook or technical documentation

Context: {summary}

DO NOT CREATE:
- Abstract glowing shapes
- Generic "tech" imagery
- Decorative patterns
- Anything that could represent multiple topics

THE DIAGRAM MUST:
- Be specific to "{lesson_title}"
- Teach something concrete
- Help build a mental model
- Use visual metaphors that clarify the concept

Style:
- Dark background (#0F172A to #020617)
- Emerald/green (#10B981, #22C55E) for main elements
- Cyan/teal (#22D3EE, #14B8A6) for highlights
- Yellow (#EAB308) for emphasis points
- Clean diagram/infographic aesthetic
- Labels and arrows where they aid understanding
"""


def generate_lesson_image(lesson: dict, path_title: str, user_id: int | None = None) -> str | None:
    """
    Generate an educational illustration for an AI lesson.

    Args:
        lesson: Curriculum item with 'title' and 'content' (AILessonContent)
        path_title: Title of the learning path for context
        user_id: User ID for AI usage tracking

    Returns:
        URL to the generated image, or None on failure
    """
    content = lesson.get('content', {})

    # Build prompt from lesson content
    key_concepts = content.get('key_concepts', content.get('keyConcepts', []))
    summary = content.get('summary', '')

    if not key_concepts:
        # Fall back to extracting from explanation if no key concepts
        key_concepts = [lesson.get('title', 'this concept')]

    prompt = LESSON_IMAGE_PROMPT.format(
        lesson_title=lesson.get('title', 'AI Lesson'),
        key_concepts=', '.join(key_concepts) if isinstance(key_concepts, list) else str(key_concepts),
        summary=summary or f"A lesson about {lesson.get('title', 'AI concepts')}",
    )

    try:
        start_time = time.time()
        ai = AIProvider(provider='gemini', user_id=user_id)
        image_bytes, mime_type, text_response = ai.generate_image(prompt=prompt)
        latency_ms = int((time.time() - start_time) * 1000)

        if not image_bytes:
            logger.warning(f'Lesson image generation returned no image: {text_response}')
            return None

        # Upload to S3/MinIO
        filename = f'lesson-{uuid.uuid4().hex[:8]}.png'
        storage = StorageService()
        image_url, upload_error = storage.upload_file(
            file_data=image_bytes,
            filename=filename,
            folder='lesson-images',
            content_type=mime_type or 'image/png',
            is_public=True,
        )

        if upload_error or not image_url:
            logger.error(f'Failed to upload lesson image: {upload_error}')
            return None

        logger.info(f'Lesson image generated and uploaded: {image_url}')

        # Track AI usage
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                AIUsageTracker.track_usage(
                    user=user,
                    feature='lesson_image',
                    provider='gemini',
                    model='gemini-2.0-flash',
                    input_tokens=len(prompt) // 4,
                    output_tokens=len(text_response) // 4 if text_response else 0,
                    latency_ms=latency_ms,
                    status='success',
                    request_metadata={
                        'lesson_title': lesson.get('title'),
                        'path_title': path_title,
                        'image_size_bytes': len(image_bytes),
                    },
                )
            except Exception as tracking_error:
                logger.warning(f'Failed to track lesson image generation usage: {tracking_error}')

        return image_url

    except Exception as exc:
        logger.error(f'Lesson image generation failed: {exc}', exc_info=True)
        return None
