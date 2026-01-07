"""
Instagram Carousel Image Generation for Battle Social Sharing.

Generates 1080x1920px (9:16 vertical) images optimized for Instagram feed/Reels,
showing battle results in a 3-slide carousel format with AllThrive branding.
"""

import io
import logging
from typing import TYPE_CHECKING

import requests
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont

from services.integrations.storage import get_storage_service

if TYPE_CHECKING:
    from core.battles.models import BattleSubmission, PromptBattle
    from core.users.models import User

logger = logging.getLogger(__name__)


# Instagram carousel dimensions (9:16 vertical)
IG_WIDTH = 1080
IG_HEIGHT = 1920

# Colors (matching AllThrive neon glass aesthetic)
BACKGROUND_COLOR = (15, 23, 42)  # Slate-900 #0f172a
HEADER_BG_COLOR = (30, 41, 59)  # Slate-800
TEXT_COLOR = (248, 250, 252)  # Slate-50
CYAN_COLOR = (6, 182, 212)  # Cyan-500
WINNER_COLOR = (250, 204, 21)  # Yellow-400 (gold)
SECONDARY_TEXT = (148, 163, 184)  # Slate-400
GRADIENT_TOP = (15, 23, 42)  # Slate-900
GRADIENT_BOTTOM = (30, 41, 59)  # Slate-800


def _get_internal_url(url: str) -> str:
    """Convert public URL to internal URL for server-side access.

    In Docker, public URLs use localhost:9000 but containers need minio:9000.
    """
    if not url:
        return url

    public_endpoint = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', None)
    internal_endpoint = getattr(settings, 'MINIO_ENDPOINT', None)

    if public_endpoint and internal_endpoint and public_endpoint != internal_endpoint:
        return url.replace(public_endpoint, internal_endpoint)

    return url


def _download_image(url: str, max_size: tuple[int, int] = (1000, 1000)) -> Image.Image | None:
    """Download and resize an image from URL."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))

        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            background = Image.new('RGB', img.size, BACKGROUND_COLOR)
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Resize maintaining aspect ratio
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        return img
    except Exception as e:
        logger.warning(f'Failed to download image from {url}: {e}')
        return None


def _create_placeholder_image(size: tuple[int, int] = (800, 800)) -> Image.Image:
    """Create a placeholder image when player image is unavailable."""
    img = Image.new('RGB', size, HEADER_BG_COLOR)
    draw = ImageDraw.Draw(img)

    font = _get_font(36)
    text = 'No Image'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    draw.text((x, y), text, fill=SECONDARY_TEXT, font=font)

    return img


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get font with fallback to default if system fonts unavailable."""
    try:
        if bold:
            return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', size)
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)
    except OSError:
        return ImageFont.load_default()


def _truncate_text(text: str, max_length: int = 100) -> str:
    """Truncate text with ellipsis if too long."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + '...'


def _draw_gradient_background(img: Image.Image) -> None:
    """Draw a subtle gradient background."""
    draw = ImageDraw.Draw(img)
    for y in range(IG_HEIGHT):
        # Interpolate between top and bottom colors
        ratio = y / IG_HEIGHT
        r = int(GRADIENT_TOP[0] + (GRADIENT_BOTTOM[0] - GRADIENT_TOP[0]) * ratio)
        g = int(GRADIENT_TOP[1] + (GRADIENT_BOTTOM[1] - GRADIENT_TOP[1]) * ratio)
        b = int(GRADIENT_TOP[2] + (GRADIENT_BOTTOM[2] - GRADIENT_TOP[2]) * ratio)
        draw.line([(0, y), (IG_WIDTH, y)], fill=(r, g, b))


def _draw_text_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    max_width: int = IG_WIDTH - 80,
) -> int:
    """Draw text centered horizontally. Returns the y position after text."""
    # Word wrap if needed
    words = text.split()
    lines = []
    current_line = []

    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]

    if current_line:
        lines.append(' '.join(current_line))

    current_y = y
    line_height = font.size + 10

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        x = (IG_WIDTH - text_width) // 2
        draw.text((x, current_y), line, fill=fill, font=font)
        current_y += line_height

    return current_y


def _generate_slide1_winner_announcement(
    battle: 'PromptBattle',
    winner: 'User',
    loser: 'User',
) -> Image.Image:
    """Generate slide 1: Winner announcement with challenge text."""
    img = Image.new('RGB', (IG_WIDTH, IG_HEIGHT), BACKGROUND_COLOR)
    _draw_gradient_background(img)
    draw = ImageDraw.Draw(img)

    # Fonts
    font_emoji = _get_font(120)
    font_title = _get_font(72, bold=True)
    font_subtitle = _get_font(48, bold=True)
    font_challenge = _get_font(36)
    font_username = _get_font(56, bold=True)
    font_vs = _get_font(32)
    font_branding = _get_font(28)

    y_offset = 200

    # Trophy emoji
    _draw_text_centered(draw, '🏆', y_offset, font_emoji, TEXT_COLOR)
    y_offset += 180

    # "PROMPT BATTLE"
    _draw_text_centered(draw, 'PROMPT BATTLE', y_offset, font_title, TEXT_COLOR)
    y_offset += 100

    # "WINNER"
    _draw_text_centered(draw, 'WINNER', y_offset, font_subtitle, WINNER_COLOR)
    y_offset += 150

    # Decorative line
    line_width = 600
    line_x = (IG_WIDTH - line_width) // 2
    draw.line([(line_x, y_offset), (line_x + line_width, y_offset)], fill=CYAN_COLOR, width=3)
    y_offset += 60

    # Challenge text
    challenge = _truncate_text(battle.challenge_text, 150)
    y_offset = _draw_text_centered(draw, f'"{challenge}"', y_offset, font_challenge, CYAN_COLOR)
    y_offset += 100

    # Decorative line
    draw.line([(line_x, y_offset), (line_x + line_width, y_offset)], fill=CYAN_COLOR, width=3)
    y_offset += 80

    # Crown + Winner username
    _draw_text_centered(draw, '👑', y_offset, _get_font(80), TEXT_COLOR)
    y_offset += 100
    _draw_text_centered(draw, f'@{winner.username}', y_offset, font_username, WINNER_COLOR)
    y_offset += 80

    # "vs"
    _draw_text_centered(draw, 'vs', y_offset, font_vs, SECONDARY_TEXT)
    y_offset += 50

    # Loser username
    _draw_text_centered(draw, f'@{loser.username}', y_offset, _get_font(40), SECONDARY_TEXT)

    # AllThrive branding at bottom
    branding_y = IG_HEIGHT - 100
    _draw_text_centered(draw, 'AllThrive.ai', branding_y, font_branding, SECONDARY_TEXT)

    return img


def _generate_slide_image(
    image_url: str | None,
    username: str,
    label: str,
    prompt_text: str = '',
    is_winner: bool = False,
) -> Image.Image:
    """Generate an image slide showing submission with overlay."""
    img = Image.new('RGB', (IG_WIDTH, IG_HEIGHT), BACKGROUND_COLOR)

    # Download and fit image
    if image_url:
        internal_url = _get_internal_url(image_url)
        source_img = _download_image(internal_url, (IG_WIDTH, IG_WIDTH))
    else:
        source_img = None

    if source_img is None:
        source_img = _create_placeholder_image((IG_WIDTH, IG_WIDTH))

    # Calculate position to center image vertically
    img_y = (IG_HEIGHT - source_img.height) // 2 - 50  # Slightly above center

    # Paste image centered horizontally
    img_x = (IG_WIDTH - source_img.width) // 2
    img.paste(source_img, (img_x, img_y))

    # Draw overlay gradient at top and bottom for text readability
    draw = ImageDraw.Draw(img)

    # Top gradient overlay
    for y in range(200):
        alpha = int(255 * (1 - y / 200))
        draw.line([(0, y), (IG_WIDTH, y)], fill=(15, 23, 42))

    # Bottom gradient overlay
    for y in range(IG_HEIGHT - 400, IG_HEIGHT):
        alpha = int(255 * ((y - (IG_HEIGHT - 400)) / 400))
        r = int(15 * alpha / 255)
        g = int(23 * alpha / 255)
        b = int(42 * alpha / 255)
        draw.line([(0, y), (IG_WIDTH, y)], fill=(15 + r, 23 + g, 42 + b))

    # Fonts
    font_label = _get_font(36, bold=True)
    font_username = _get_font(48, bold=True)
    font_prompt = _get_font(28)

    # Top label (WINNER or Runner-up)
    label_color = WINNER_COLOR if is_winner else SECONDARY_TEXT
    _draw_text_centered(draw, label, 60, font_label, label_color)

    # Username below label
    _draw_text_centered(draw, username, 110, font_username, TEXT_COLOR)

    # Bottom section: Prompt text (if provided)
    if prompt_text:
        prompt_y = IG_HEIGHT - 280
        prompt_label_font = _get_font(24)
        _draw_text_centered(draw, 'Prompt:', prompt_y, prompt_label_font, SECONDARY_TEXT)
        truncated_prompt = _truncate_text(prompt_text, 200)
        _draw_text_centered(draw, truncated_prompt, prompt_y + 40, font_prompt, TEXT_COLOR, max_width=IG_WIDTH - 100)

    # AllThrive branding at very bottom
    branding_y = IG_HEIGHT - 80
    _draw_text_centered(draw, 'AllThrive.ai/battles', branding_y, _get_font(24), SECONDARY_TEXT)

    return img


def generate_battle_carousel(
    battle: 'PromptBattle',
    winner: 'User',
    loser: 'User',
    winner_submission: 'BattleSubmission | None',
    loser_submission: 'BattleSubmission | None',
) -> list[str]:
    """Generate 3-slide Instagram carousel for battle results.

    Slide 1: Winner announcement with challenge text
    Slide 2: Winner's image with their prompt
    Slide 3: Runner-up's image

    Args:
        battle: The completed battle
        winner: User who won
        loser: User who lost
        winner_submission: Winner's BattleSubmission
        loser_submission: Loser's BattleSubmission

    Returns:
        List of 3 public URLs to the carousel images
    """
    try:
        # Generate all 3 slides
        slide1 = _generate_slide1_winner_announcement(battle, winner, loser)

        winner_prompt = winner_submission.prompt_text if winner_submission else ''
        slide2 = _generate_slide_image(
            image_url=winner_submission.generated_output_url if winner_submission else None,
            username=f'@{winner.username}',
            label='🏆 WINNER',
            prompt_text=winner_prompt,
            is_winner=True,
        )

        slide3 = _generate_slide_image(
            image_url=loser_submission.generated_output_url if loser_submission else None,
            username=f'@{loser.username}',
            label='Runner-up',
            prompt_text='Great battle! 🔥',
            is_winner=False,
        )

        # Upload all to S3 (public URLs for Instagram to fetch)
        storage = get_storage_service()
        urls = []

        for i, slide in enumerate([slide1, slide2, slide3], 1):
            buffer = io.BytesIO()
            slide.save(buffer, format='JPEG', quality=95)
            image_bytes = buffer.getvalue()

            url, error = storage.upload_file(
                file_data=image_bytes,
                filename=f'battle_{battle.id}_instagram_{i}.jpg',
                content_type='image/jpeg',
                folder='battle-instagram',
                is_public=True,
            )

            if error:
                logger.error(f'Failed to upload Instagram slide {i} for battle {battle.id}: {error}')
                continue

            if url:
                urls.append(url)
                logger.info(f'Uploaded Instagram slide {i} for battle {battle.id}: {url}')

        if len(urls) < 3:
            logger.error(f'Only {len(urls)}/3 Instagram slides uploaded for battle {battle.id}')

        return urls

    except Exception as e:
        logger.error(f'Error generating Instagram carousel for battle {battle.id}: {e}', exc_info=True)
        return []


def build_battle_caption(
    battle: 'PromptBattle',
    winner: 'User',
    loser: 'User',
    winner_submission: 'BattleSubmission | None' = None,
) -> str:
    """Build Instagram caption for battle post.

    Args:
        battle: The completed battle
        winner: User who won
        loser: User who lost
        winner_submission: Winner's submission (optional, for tool info)

    Returns:
        Formatted caption string
    """
    challenge = _truncate_text(battle.challenge_text, 100)

    caption = f"""🎨 PROMPT BATTLE RESULTS 🎨

Challenge: "{challenge}"

🏆 Winner: @{winner.username}
vs @{loser.username}

Swipe to see both creations ➡️

Think you can do better? Battle @pip at allthrive.ai/battles

#PromptBattle #AIArt #Midjourney #DALLE #StableDiffusion #AIGenerated #DigitalArt #CreativeAI #AllThrive"""

    return caption
