"""
API views for file uploads.
"""
import logging
from io import BytesIO
from PIL import Image
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django_ratelimit.decorators import ratelimit
from services.storage_service import get_storage_service

logger = logging.getLogger(__name__)


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
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    uploaded_file = request.FILES['file']
    folder = request.data.get('folder', 'images')
    is_public = request.data.get('is_public', 'true').lower() == 'true'
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if uploaded_file.size > max_size:
        return Response(
            {'error': 'File too large. Maximum size: 10MB'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Read file data
        file_data = uploaded_file.read()
        
        # Validate actual file content (not just header)
        try:
            img = Image.open(BytesIO(file_data))
            
            # Validate image dimensions
            width, height = img.size
            if width > 5000 or height > 5000:
                return Response(
                    {'error': 'Image too large. Maximum dimensions: 5000x5000 pixels'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check megapixels
            if width * height > 25_000_000:  # 25 megapixels
                return Response(
                    {'error': 'Image resolution too high. Maximum: 25 megapixels'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Optimize image (resize if too large, compress)
            optimized_data = _optimize_image(img, uploaded_file.name)
            
        except Exception as e:
            logger.warning(f"Invalid image file: {e}")
            return Response(
                {'error': 'Invalid or corrupted image file'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Upload to MinIO
        storage = get_storage_service()
        url, error = storage.upload_file(
            file_data=optimized_data,
            filename=uploaded_file.name,
            content_type='image/jpeg',  # Always save as JPEG after optimization
            user_id=request.user.id,
            folder=folder,
            is_public=is_public
        )
        
        if error:
            return Response(
                {'error': error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # For private files, url is just the object name - generate presigned URL
        if not is_public:
            url = storage.get_presigned_url(url, expires_seconds=3600)
        
        return Response({
            'url': url,
            'filename': uploaded_file.name,
            'original_size': uploaded_file.size,
            'optimized_size': len(optimized_data),
            'is_public': is_public
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}", exc_info=True)
        return Response(
            {'error': 'Failed to upload file'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
        logger.info(f"Resized image from {img.size} to {new_size}")
    
    # Save optimized
    output = BytesIO()
    img.save(output, format='JPEG', quality=85, optimize=True)
    optimized_data = output.getvalue()
    
    logger.info(f"Optimized image: {filename}")
    return optimized_data
