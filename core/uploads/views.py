"""
API views for file uploads.
"""

import logging
import mimetypes
import os
import re
import unicodedata
from io import BytesIO

from django_ratelimit.decorators import ratelimit
from PIL import Image
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.integrations.storage.storage_service import get_storage_service

logger = logging.getLogger(__name__)

# Allowed image formats (validated via PIL)
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP'}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and injection attacks.

    - Removes directory components (path traversal prevention)
    - Normalizes Unicode characters
    - Removes dangerous characters
    - Limits length
    - Preserves file extension

    Args:
        filename: Original filename from upload

    Returns:
        Sanitized filename safe for storage
    """
    if not filename:
        return 'unnamed_file'

    # Get just the filename, removing any path components
    filename = os.path.basename(filename)

    # Normalize Unicode characters (NFC form)
    filename = unicodedata.normalize('NFC', filename)

    # Split name and extension
    name, ext = os.path.splitext(filename)

    # Remove or replace dangerous characters from name
    # Allow only alphanumeric, dash, underscore, space, and period
    name = re.sub(r'[^\w\s\-.]', '', name)

    # Replace multiple spaces/underscores with single underscore
    name = re.sub(r'[\s_]+', '_', name)

    # Remove leading/trailing dots and underscores
    name = name.strip('._')

    # If name is empty after sanitization, use a default
    if not name:
        name = 'file'

    # Limit name length (leaving room for extension)
    max_name_length = 200
    if len(name) > max_name_length:
        name = name[:max_name_length]

    # Sanitize extension (lowercase, alphanumeric only)
    ext = ext.lower()
    ext = re.sub(r'[^a-z0-9.]', '', ext)

    # Ensure extension starts with a dot if present
    if ext and not ext.startswith('.'):
        ext = '.' + ext

    # Combine and return
    sanitized = name + ext

    # Final length check
    if len(sanitized) > 255:
        sanitized = sanitized[:255]

    logger.debug(f'Sanitized filename: {filename!r} -> {sanitized!r}')
    return sanitized


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='10/m', method='POST')  # 10 uploads per minute
def upload_image(request):
    """
    Upload an image file to MinIO storage.

    Expected multipart/form-data with 'file' field.
    Optional 'folder' field to organize uploads (default: 'images').

    Returns:
        {
            "url": "http://minio:9000/bucket/path/to/file.jpg",
            "filename": "original_filename.jpg"
        }
    """
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    uploaded_file = request.FILES['file']
    folder = request.data.get('folder', 'images')
    is_public = request.data.get('is_public', 'true').lower() == 'true'

    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if uploaded_file.size > max_size:
        return Response({'error': 'File too large. Maximum size: 10MB'}, status=status.HTTP_400_BAD_REQUEST)

    # Sanitize the filename to prevent path traversal and injection
    safe_filename = sanitize_filename(uploaded_file.name)

    try:
        # Read file data
        file_data = uploaded_file.read()

        # Validate actual file content (not just header)
        try:
            img = Image.open(BytesIO(file_data))

            # Validate image format against whitelist (prevents processing malicious files)
            if img.format not in ALLOWED_IMAGE_FORMATS:
                logger.warning(f'Disallowed image format: {img.format}')
                return Response(
                    {'error': f'Image format not allowed: {img.format}. Allowed: {", ".join(ALLOWED_IMAGE_FORMATS)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate image dimensions
            width, height = img.size
            if width > 5000 or height > 5000:
                return Response(
                    {'error': 'Image too large. Maximum dimensions: 5000x5000 pixels'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check megapixels
            if width * height > 25_000_000:  # 25 megapixels
                return Response(
                    {'error': 'Image resolution too high. Maximum: 25 megapixels'}, status=status.HTTP_400_BAD_REQUEST
                )

            # Optimize image (resize if too large, compress)
            optimized_data = _optimize_image(img, safe_filename)

        except Exception as e:
            logger.warning(f'Invalid image file: {e}')
            return Response({'error': 'Invalid or corrupted image file'}, status=status.HTTP_400_BAD_REQUEST)

        # Upload to MinIO with sanitized filename
        storage = get_storage_service()
        url, error = storage.upload_file(
            file_data=optimized_data,
            filename=safe_filename,
            content_type='image/jpeg',  # Always save as JPEG after optimization
            user_id=request.user.id,
            folder=folder,
            is_public=is_public,
        )

        if error:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # For private files, url is just the object name - generate presigned URL
        if not is_public:
            url = storage.get_presigned_url(url, expires_seconds=3600)

        return Response(
            {
                'url': url,
                'filename': safe_filename,
                'original_filename': uploaded_file.name,
                'original_size': uploaded_file.size,
                'optimized_size': len(optimized_data),
                'is_public': is_public,
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        logger.error(f'Error uploading file: {e}', exc_info=True)
        return Response({'error': 'Failed to upload file'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _optimize_image(img: Image.Image, filename: str, max_width: int = 1920) -> bytes:
    """
    Optimize image by resizing and compressing.

    Args:
        img: PIL Image object
        filename: Original filename
        max_width: Maximum width in pixels

    Returns:
        Optimized image data as bytes
    """
    # Convert RGBA/LA to RGB for JPEG
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if too large
    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        logger.info(f'Resized image from {img.size} to {new_size}')

    # Save optimized
    output = BytesIO()
    img.save(output, format='JPEG', quality=85, optimize=True)
    optimized_data = output.getvalue()

    logger.info(f'Optimized image: {filename}')
    return optimized_data


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='20/m', method='POST')  # 20 uploads per minute
def upload_file(request):
    """
    Upload any file (video, document, etc.) to MinIO storage.

    Expected multipart/form-data with 'file' field.
    Optional 'folder' field to organize uploads (default: 'files').

    Supported types:
    - Videos: mp4, webm, mov, avi
    - Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt
    - Archives: zip

    Returns:
        {
            "url": "http://minio:9000/bucket/path/to/file.pdf",
            "filename": "document.pdf",
            "file_type": "application/pdf",
            "file_size": 1024000
        }
    """
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    uploaded_file = request.FILES['file']
    folder = request.data.get('folder', 'files')
    is_public = request.data.get('is_public', 'true').lower() == 'true'

    # Determine content type
    content_type, _ = mimetypes.guess_type(uploaded_file.name)
    if not content_type:
        content_type = 'application/octet-stream'

    # Allowed file types
    ALLOWED_TYPES = {
        # Videos
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
        # Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        # Archives
        'application/zip',
        'application/x-zip-compressed',
    }

    if content_type not in ALLOWED_TYPES:
        return Response({'error': f'File type not allowed: {content_type}'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate file size (max 100MB for videos, 25MB for docs)
    if content_type.startswith('video/'):
        max_size = 100 * 1024 * 1024  # 100MB
    else:
        max_size = 25 * 1024 * 1024  # 25MB

    if uploaded_file.size > max_size:
        max_size_mb = max_size // (1024 * 1024)
        return Response({'error': f'File too large. Maximum size: {max_size_mb}MB'}, status=status.HTTP_400_BAD_REQUEST)

    # Sanitize the filename to prevent path traversal and injection
    safe_filename = sanitize_filename(uploaded_file.name)

    try:
        # Read file data
        file_data = uploaded_file.read()

        # Upload to MinIO with sanitized filename
        storage = get_storage_service()
        url, error = storage.upload_file(
            file_data=file_data,
            filename=safe_filename,
            content_type=content_type,
            user_id=request.user.id,
            folder=folder,
            is_public=is_public,
        )

        if error:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # For private files, url is just the object name - generate presigned URL
        if not is_public:
            url = storage.get_presigned_url(url, expires_seconds=7200)  # 2 hours

        return Response(
            {
                'url': url,
                'filename': safe_filename,
                'original_filename': uploaded_file.name,
                'file_type': content_type,
                'file_size': uploaded_file.size,
                'is_public': is_public,
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        logger.error(f'Error uploading file: {e}', exc_info=True)
        return Response({'error': 'Failed to upload file'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
