"""
Service for handling file uploads to MinIO/S3 storage.
"""

import logging
import threading
import uuid
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)


class StorageService:
    """Service for uploading and managing files in MinIO."""

    def __init__(self):
        """Initialize MinIO client."""
        # Minio 7.2.0+ uses endpoint, access_key, secret_key as positional args
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._bucket_verified = False
        self._bucket_lock = threading.Lock()

    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist (lazy initialization)."""
        if self._bucket_verified:
            return

        with self._bucket_lock:
            # Double-check after acquiring lock
            if self._bucket_verified:
                return

            try:
                if not self.client.bucket_exists(bucket_name=self.bucket_name):
                    self.client.make_bucket(bucket_name=self.bucket_name)
                    self._set_public_read_policy()
                    logger.info(f'Created bucket: {self.bucket_name}')

                self._bucket_verified = True

            except S3Error as e:
                logger.error(f'Failed to ensure bucket exists: {e}')
                raise RuntimeError(f'MinIO bucket setup failed: {e}')

    def _set_public_read_policy(self):
        """Set policy to allow public read only for 'public/' prefix."""
        policy = f"""{{
            "Version": "2012-10-17",
            "Statement": [
                {{
                    "Effect": "Allow",
                    "Principal": {{"AWS": ["*"]}},
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::{self.bucket_name}/public/*"]
                }}
            ]
        }}"""
        try:
            self.client.set_bucket_policy(bucket_name=self.bucket_name, policy=policy)
            logger.info(f'Set public read policy for {self.bucket_name}/public/*')
        except S3Error as e:
            logger.error(f'Failed to set bucket policy: {e}')
            raise

    def upload_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str = 'application/octet-stream',
        user_id: int | None = None,
        folder: str = 'uploads',
        is_public: bool = False,
    ) -> tuple[str | None, str | None]:
        """
        Upload a file to MinIO.

        Args:
            file_data: File content as bytes
            filename: Original filename
            content_type: MIME type of the file
            user_id: User ID for organizing files (optional)
            folder: Folder/prefix for organizing files
            is_public: If True, file is publicly accessible. If False, use presigned URLs.

        Returns:
            (url, error_message)
        """
        # Ensure bucket exists before upload
        self._ensure_bucket_exists()

        try:
            # Generate unique filename to avoid collisions
            file_ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''
            unique_id = str(uuid.uuid4())

            # Construct object path - public files go in public/ prefix
            visibility = 'public' if is_public else 'private'
            if user_id:
                object_name = f'{visibility}/{folder}/user_{user_id}/{unique_id}.{file_ext}'
            else:
                object_name = f'{visibility}/{folder}/{unique_id}.{file_ext}'

            # Upload file
            file_stream = BytesIO(file_data)
            file_size = len(file_data)

            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_stream,
                length=file_size,
                content_type=content_type,
            )

            # Construct URL - use public endpoint for browser access
            public_endpoint = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', settings.MINIO_ENDPOINT)
            protocol = 'https' if settings.MINIO_USE_SSL else 'http'

            if is_public:
                # Direct URL for public files
                url = f'{protocol}://{public_endpoint}/{self.bucket_name}/{object_name}'
            else:
                # For private files, return object name - caller should use get_presigned_url()
                url = object_name

            logger.info(f'Uploaded file: {object_name} (public={is_public})')
            return url, None

        except S3Error as e:
            logger.error(f'Error uploading file: {e}')
            return None, f'Failed to upload file: {str(e)}'
        except Exception as e:
            logger.error(f'Unexpected error uploading file: {e}', exc_info=True)
            return None, f'Unexpected error: {str(e)}'

    def delete_file(self, url: str) -> tuple[bool, str | None]:
        """
        Delete a file from MinIO using its URL.

        Args:
            url: Full URL of the file

        Returns:
            (success, error_message)
        """
        try:
            # Extract object name from URL
            # URL format: http://endpoint/bucket/object_name
            parts = url.split(f'/{self.bucket_name}/', 1)
            if len(parts) != 2:
                return False, 'Invalid URL format'

            object_name = parts[1]

            self.client.remove_object(bucket_name=self.bucket_name, object_name=object_name)
            logger.info(f'Deleted file: {object_name}')
            return True, None

        except S3Error as e:
            logger.error(f'Error deleting file: {e}')
            return False, f'Failed to delete file: {str(e)}'
        except Exception as e:
            logger.error(f'Unexpected error deleting file: {e}', exc_info=True)
            return False, f'Unexpected error: {str(e)}'

    def get_file_url(self, object_name: str, is_public: bool = True) -> str:
        """
        Get URL for an object.

        Args:
            object_name: Path/name of object in bucket
            is_public: If False, returns presigned URL

        Returns:
            URL (direct for public, presigned for private)
        """
        if is_public:
            public_endpoint = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', settings.MINIO_ENDPOINT)
            protocol = 'https' if settings.MINIO_USE_SSL else 'http'
            return f'{protocol}://{public_endpoint}/{self.bucket_name}/{object_name}'
        else:
            return self.get_presigned_url(object_name)

    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        """
        Generate temporary presigned URL for private files.

        Args:
            object_name: Path/name of object in bucket
            expires_seconds: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned URL
        """
        try:
            url = self.client.presigned_get_object(
                bucket_name=self.bucket_name, object_name=object_name, expires=timedelta(seconds=expires_seconds)
            )
            # Replace internal endpoint with public endpoint
            public_endpoint = getattr(settings, 'MINIO_ENDPOINT_PUBLIC', settings.MINIO_ENDPOINT)
            internal_endpoint = settings.MINIO_ENDPOINT
            url = url.replace(internal_endpoint, public_endpoint)
            return url
        except S3Error as e:
            logger.error(f'Failed to generate presigned URL: {e}')
            raise


# Thread-safe singleton
_storage_service = None
_storage_lock = threading.Lock()


def get_storage_service() -> StorageService:
    """Get thread-safe singleton instance of StorageService."""
    global _storage_service
    if _storage_service is None:
        with _storage_lock:
            # Double-check after acquiring lock
            if _storage_service is None:
                _storage_service = StorageService()
    return _storage_service
