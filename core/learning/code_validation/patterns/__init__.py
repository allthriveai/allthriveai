"""
Language-specific validation patterns for code exercises.
"""

from .html_css import CSS_PATTERNS, HTML_PATTERNS
from .javascript import JAVASCRIPT_PATTERNS
from .python import PYTHON_PATTERNS

LANGUAGE_PATTERNS = {
    'python': PYTHON_PATTERNS,
    'javascript': JAVASCRIPT_PATTERNS,
    'typescript': JAVASCRIPT_PATTERNS,  # TypeScript uses same patterns as JS
    'html': HTML_PATTERNS,
    'css': CSS_PATTERNS,
}

__all__ = [
    'PYTHON_PATTERNS',
    'JAVASCRIPT_PATTERNS',
    'HTML_PATTERNS',
    'CSS_PATTERNS',
    'LANGUAGE_PATTERNS',
]
