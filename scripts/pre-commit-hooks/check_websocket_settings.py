#!/usr/bin/env python3
"""
Pre-commit hook to validate WebSocket-related Django settings.

Ensures SECURE_PROXY_SSL_HEADER uses the correct header that ALB/CloudFront
actually sends (X-Forwarded-Proto), preventing WebSocket connection failures.
"""

import re
import sys
from pathlib import Path


def check_secure_proxy_ssl_header(file_path: Path) -> list[str]:
    """
    Check if SECURE_PROXY_SSL_HEADER is correctly configured.

    Args:
        file_path: Path to the settings file

    Returns:
        List of error messages (empty if valid)
    """
    errors = []
    content = file_path.read_text()

    # Check for SECURE_PROXY_SSL_HEADER setting
    pattern = r"SECURE_PROXY_SSL_HEADER\s*=\s*\(['\"]([^'\"]+)['\"],\s*['\"]https['\"]\)"
    matches = re.findall(pattern, content)

    if not matches:
        # Setting not found - this is okay for local development
        return errors

    for match in matches:
        header_name = match
        # Django converts HTTP headers to HTTP_* format with dashes -> underscores
        # X-Forwarded-Proto becomes HTTP_X_FORWARDED_PROTO
        if header_name not in ['HTTP_X_FORWARDED_PROTO', 'HTTP_X_FORWARDED_SSL']:
            errors.append(
                f"\n❌ SECURE_PROXY_SSL_HEADER uses incorrect header: '{header_name}'\n"
                f'\n'
                f'WebSocket connections will fail with 301 redirects!\n'
                f'\n'
                f"AWS ALB/CloudFront sets 'X-Forwarded-Proto' header (becomes HTTP_X_FORWARDED_PROTO in Django).\n"
                f"Other headers like 'CloudFront-Forwarded-Proto' are NOT set by AWS infrastructure.\n"
                f'\n'
                f'✅ Correct usage:\n'
                f"   SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')\n"
                f'\n'
                f'📝 Location: {file_path}\n'
            )

    return errors


def main() -> int:
    """Main function to check all modified settings files."""
    if len(sys.argv) < 2:
        return 0

    exit_code = 0
    settings_files = [Path(f) for f in sys.argv[1:] if 'settings' in f and f.endswith('.py')]

    for file_path in settings_files:
        if not file_path.exists():
            continue

        errors = check_secure_proxy_ssl_header(file_path)
        if errors:
            for error in errors:
                print(error, file=sys.stderr)
            exit_code = 1

    return exit_code


if __name__ == '__main__':
    sys.exit(main())
