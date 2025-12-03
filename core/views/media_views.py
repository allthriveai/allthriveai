"""Views for serving media files with range request support."""

import os
import re

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.cache import cache_control


@cache_control(max_age=3600, public=True)
def serve_media_with_range(request, path):
    """Serve media files with HTTP range request support for video streaming.

    This allows browsers to:
    - Load videos progressively
    - Seek to any point in the video
    - Resume downloads
    """
    # Construct full file path
    file_path = os.path.join(settings.MEDIA_ROOT, path)

    # Security check: ensure path is within MEDIA_ROOT
    if not os.path.abspath(file_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
        raise Http404('Invalid file path')

    # Check if file exists
    if not os.path.exists(file_path):
        raise Http404('File not found')

    # Get file size
    file_size = os.path.getsize(file_path)

    # Check for Range header
    range_header = request.headers.get('range', '')

    if range_header:
        # Parse range header (e.g., "bytes=0-1023")
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1

            # Validate range
            if start >= file_size or end >= file_size or start > end:
                response = HttpResponse(status=416)  # Range Not Satisfiable
                response['Content-Range'] = f'bytes */{file_size}'
                return response

            # Calculate content length
            length = end - start + 1

            # Open file and seek to start position
            with open(file_path, 'rb') as f:
                f.seek(start)
                data = f.read(length)

            # Create partial content response
            response = HttpResponse(data, status=206)  # Partial Content
            response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            response['Content-Length'] = str(length)
            response['Accept-Ranges'] = 'bytes'

            # Set content type based on file extension
            content_type = _get_content_type(file_path)
            if content_type:
                response['Content-Type'] = content_type

            return response

    # No range header - return full file
    response = FileResponse(open(file_path, 'rb'))
    response['Accept-Ranges'] = 'bytes'
    response['Content-Length'] = str(file_size)

    # Set content type
    content_type = _get_content_type(file_path)
    if content_type:
        response['Content-Type'] = content_type

    return response


def _get_content_type(file_path):
    """Get content type based on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    content_types = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    }
    return content_types.get(ext)
