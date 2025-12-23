"""
PDF text extraction utility for resume parsing.
"""

import logging
from io import BytesIO

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_data: bytes, max_pages: int = 10, max_chars: int = 15000) -> str:
    """
    Extract text from PDF bytes.

    Args:
        file_data: Raw PDF file bytes
        max_pages: Maximum number of pages to extract (default: 10)
        max_chars: Maximum characters to return (default: 15000 for AI context limits)

    Returns:
        Extracted text from PDF, or empty string on failure
    """
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(file_data))
        text_parts = []

        for i, page in enumerate(reader.pages[:max_pages]):
            try:
                text = page.extract_text()
                if text:
                    # Clean up common PDF extraction artifacts
                    text = text.strip()
                    text_parts.append(text)
            except Exception as page_error:
                logger.warning(f'Failed to extract text from page {i}: {page_error}')
                continue

        full_text = '\n\n'.join(text_parts)

        # Truncate to max_chars to stay within AI context limits
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars] + '\n\n[Text truncated for length...]'
            logger.info(f'PDF text truncated from {len(full_text)} to {max_chars} characters')

        logger.info(f'Extracted {len(full_text)} characters from {len(reader.pages)} page PDF')
        return full_text

    except ImportError:
        logger.error('pypdf not installed. Run: pip install pypdf')
        return ''
    except Exception as e:
        logger.error(f'PDF text extraction failed: {e}', exc_info=True)
        return ''
