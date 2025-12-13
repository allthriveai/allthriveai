"""
OG Image Generation Service for Battle Social Sharing.

Generates 1200x630px images optimized for Twitter/Facebook social cards,
showing side-by-side comparison of battle submissions with scores and branding.
"""

import io
import logging
from typing import TYPE_CHECKING

import requests
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont

from services.integrations.storage import get_storage_service

if TYPE_CHECKING:
    from core.battles.models import PromptBattle

logger = logging.getLogger(__name__)


def _get_internal_url(url: str) -> str:
    """Convert public URL to internal URL for server-side access.

    In Docker, public URLs use localhost:9000 but containers need minio:9000.
    """
    if not url:
        return url

    public_endpoint = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', None)
    internal_endpoint = getattr(settings, 'MINIO_ENDPOINT', None)

    if public_endpoint and internal_endpoint and public_endpoint != internal_endpoint:
        # Replace public endpoint with internal endpoint
        return url.replace(public_endpoint, internal_endpoint)

    return url


# Image dimensions (Twitter/Facebook optimal)
OG_WIDTH = 1200
OG_HEIGHT = 630

# Colors (matching AllThrive neon glass aesthetic)
BACKGROUND_COLOR = (15, 23, 42)  # Slate-900 #0f172a
HEADER_BG_COLOR = (30, 41, 59)  # Slate-800
TEXT_COLOR = (248, 250, 252)  # Slate-50
SCORE_COLOR = (6, 182, 212)  # Cyan-500
WINNER_COLOR = (250, 204, 21)  # Yellow-400 (gold)
SECONDARY_TEXT = (148, 163, 184)  # Slate-400


def _download_image(url: str, max_size: tuple[int, int] = (400, 350)) -> Image.Image | None:
    """Download and resize an image from URL.

    Args:
        url: Image URL to download
        max_size: Maximum dimensions for the image

    Returns:
        PIL Image or None if download fails
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))

        # Convert to RGB if necessary (handles PNG transparency)
        if img.mode in ('RGBA', 'P'):
            # Create a background and paste the image
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


def _create_placeholder_image(size: tuple[int, int] = (400, 350)) -> Image.Image:
    """Create a placeholder image when player image is unavailable."""
    img = Image.new('RGB', size, (30, 41, 59))  # Slate-800
    draw = ImageDraw.Draw(img)

    # Draw "No Image" text in center
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
    except OSError:
        font = ImageFont.load_default()

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


def _truncate_text(text: str, max_length: int = 60) -> str:
    """Truncate text with ellipsis if too long."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + '...'


def generate_battle_og_image(battle: 'PromptBattle') -> str | None:
    """Generate OG image for a completed battle.

    Creates a 1200x630px image showing:
    - Challenge text at top
    - Both player images side-by-side
    - Player usernames and scores
    - Winner highlight
    - AllThrive branding

    Args:
        battle: Completed PromptBattle instance

    Returns:
        URL to the generated image, or None if generation fails
    """
    try:
        # Create base image
        img = Image.new('RGB', (OG_WIDTH, OG_HEIGHT), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)

        # Get submissions
        submissions = list(battle.submissions.select_related('user').all())
        if len(submissions) < 2:
            logger.warning(f'Battle {battle.id} has fewer than 2 submissions')
            return None

        # Order submissions: challenger first, opponent second
        challenger_sub = next((s for s in submissions if s.user_id == battle.challenger_id), None)
        opponent_sub = next((s for s in submissions if s.user_id == battle.opponent_id), None)

        if not challenger_sub or not opponent_sub:
            logger.warning(f'Battle {battle.id} missing challenger or opponent submission')
            return None

        # Load fonts
        font_challenge = _get_font(22)
        font_username = _get_font(20, bold=True)
        font_score = _get_font(24, bold=True)
        font_label = _get_font(16)
        font_branding = _get_font(18, bold=True)

        # --- Header Section (challenge text) ---
        header_height = 80
        draw.rectangle([(0, 0), (OG_WIDTH, header_height)], fill=HEADER_BG_COLOR)

        # Challenge text
        challenge_preview = _truncate_text(battle.challenge_text, 80)
        draw.text((40, 15), 'Challenge:', fill=SECONDARY_TEXT, font=font_label)
        draw.text((40, 38), f'"{challenge_preview}"', fill=TEXT_COLOR, font=font_challenge)

        # --- Player Images Section ---
        img_section_y = header_height + 20
        img_height = 350
        img_width = 400
        gap = 80  # Gap between images

        # Calculate positions for centered side-by-side images
        total_width = img_width * 2 + gap
        start_x = (OG_WIDTH - total_width) // 2

        # Download player images (convert to internal URLs for Docker access)
        img1 = None
        img2 = None
        if challenger_sub.generated_output_url:
            internal_url = _get_internal_url(challenger_sub.generated_output_url)
            img1 = _download_image(internal_url, (img_width, img_height))
        if opponent_sub.generated_output_url:
            internal_url = _get_internal_url(opponent_sub.generated_output_url)
            img2 = _download_image(internal_url, (img_width, img_height))

        # Use placeholders if images unavailable
        if img1 is None:
            img1 = _create_placeholder_image((img_width, img_height))
        if img2 is None:
            img2 = _create_placeholder_image((img_width, img_height))

        # Calculate centered positions for each image (in case they're smaller than max)
        img1_x = start_x + (img_width - img1.width) // 2
        img1_y = img_section_y + (img_height - img1.height) // 2
        img2_x = start_x + img_width + gap + (img_width - img2.width) // 2
        img2_y = img_section_y + (img_height - img2.height) // 2

        # Winner highlight - draw gold border around winner's image
        border_width = 6
        if battle.winner_id == battle.challenger_id:
            draw.rectangle(
                [
                    (img1_x - border_width, img1_y - border_width),
                    (img1_x + img1.width + border_width, img1_y + img1.height + border_width),
                ],
                outline=WINNER_COLOR,
                width=border_width,
            )
        elif battle.winner_id == battle.opponent_id:
            draw.rectangle(
                [
                    (img2_x - border_width, img2_y - border_width),
                    (img2_x + img2.width + border_width, img2_y + img2.height + border_width),
                ],
                outline=WINNER_COLOR,
                width=border_width,
            )

        # Paste images
        img.paste(img1, (img1_x, img1_y))
        img.paste(img2, (img2_x, img2_y))

        # Draw "VS" in the gap
        vs_x = start_x + img_width + gap // 2
        vs_y = img_section_y + img_height // 2 - 20
        vs_font = _get_font(36, bold=True)
        bbox = draw.textbbox((0, 0), 'VS', font=vs_font)
        vs_text_width = bbox[2] - bbox[0]
        draw.text((vs_x - vs_text_width // 2, vs_y), 'VS', fill=SECONDARY_TEXT, font=vs_font)

        # --- Player Info Section ---
        info_y = img_section_y + img_height + 15

        # Challenger info (left)
        challenger_name = f'@{challenger_sub.user.username}'
        challenger_name = _truncate_text(challenger_name, 20)
        challenger_score = f'{float(challenger_sub.score):.1f}' if challenger_sub.score else '--'

        # Center username under image
        name_bbox = draw.textbbox((0, 0), challenger_name, font=font_username)
        name_width = name_bbox[2] - name_bbox[0]
        name_x = start_x + (img_width - name_width) // 2
        draw.text((name_x, info_y), challenger_name, fill=TEXT_COLOR, font=font_username)

        # Score
        score_text = f'Score: {challenger_score}'
        score_bbox = draw.textbbox((0, 0), score_text, font=font_score)
        score_width = score_bbox[2] - score_bbox[0]
        score_x = start_x + (img_width - score_width) // 2
        draw.text((score_x, info_y + 28), score_text, fill=SCORE_COLOR, font=font_score)

        # Winner badge
        if battle.winner_id == battle.challenger_id:
            winner_text = 'WINNER'
            winner_bbox = draw.textbbox((0, 0), winner_text, font=font_label)
            winner_width = winner_bbox[2] - winner_bbox[0]
            winner_x = start_x + (img_width - winner_width) // 2
            draw.text((winner_x, info_y + 58), winner_text, fill=WINNER_COLOR, font=font_label)

        # Opponent info (right)
        opponent_name = f'@{opponent_sub.user.username}'
        opponent_name = _truncate_text(opponent_name, 20)
        opponent_score = f'{float(opponent_sub.score):.1f}' if opponent_sub.score else '--'

        # Center username under image
        name_bbox = draw.textbbox((0, 0), opponent_name, font=font_username)
        name_width = name_bbox[2] - name_bbox[0]
        name_x = start_x + img_width + gap + (img_width - name_width) // 2
        draw.text((name_x, info_y), opponent_name, fill=TEXT_COLOR, font=font_username)

        # Score
        score_text = f'Score: {opponent_score}'
        score_bbox = draw.textbbox((0, 0), score_text, font=font_score)
        score_width = score_bbox[2] - score_bbox[0]
        score_x = start_x + img_width + gap + (img_width - score_width) // 2
        draw.text((score_x, info_y + 28), score_text, fill=SCORE_COLOR, font=font_score)

        # Winner badge
        if battle.winner_id == battle.opponent_id:
            winner_text = 'WINNER'
            winner_bbox = draw.textbbox((0, 0), winner_text, font=font_label)
            winner_width = winner_bbox[2] - winner_bbox[0]
            winner_x = start_x + img_width + gap + (img_width - winner_width) // 2
            draw.text((winner_x, info_y + 58), winner_text, fill=WINNER_COLOR, font=font_label)

        # Tie indicator
        if battle.winner_id is None:
            tie_text = "IT'S A TIE!"
            tie_font = _get_font(28, bold=True)
            tie_bbox = draw.textbbox((0, 0), tie_text, font=tie_font)
            tie_width = tie_bbox[2] - tie_bbox[0]
            tie_x = (OG_WIDTH - tie_width) // 2
            draw.text((tie_x, info_y + 55), tie_text, fill=SCORE_COLOR, font=tie_font)

        # --- Footer / Branding ---
        footer_y = OG_HEIGHT - 40
        branding_text = 'AllThrive AI - Prompt Battle'
        draw.text((40, footer_y), branding_text, fill=SECONDARY_TEXT, font=font_branding)

        # Battle URL hint
        url_text = 'allthrive.ai/battles'
        url_bbox = draw.textbbox((0, 0), url_text, font=font_label)
        url_width = url_bbox[2] - url_bbox[0]
        draw.text((OG_WIDTH - url_width - 40, footer_y + 4), url_text, fill=SECONDARY_TEXT, font=font_label)

        # --- Save and upload ---
        output = io.BytesIO()
        img.save(output, format='PNG', optimize=True)
        output.seek(0)
        image_bytes = output.getvalue()

        # Upload to storage
        storage = get_storage_service()
        url, error = storage.upload_file(
            file_data=image_bytes,
            filename=f'battle_{battle.id}_og.png',
            content_type='image/png',
            folder='battle-og-images',
            is_public=True,
        )

        if error:
            logger.error(f'Failed to upload OG image for battle {battle.id}: {error}')
            return None

        logger.info(f'Generated OG image for battle {battle.id}: {url}')
        return url

    except Exception as e:
        logger.error(f'Error generating OG image for battle {battle.id}: {e}', exc_info=True)
        return None
