"""Uploads domain - File and image upload handling.

This domain handles file uploads, image processing,
and storage management.
"""
from .views import upload_file, upload_image

__all__ = [
    # Views
    "upload_image",
    "upload_file",
]
