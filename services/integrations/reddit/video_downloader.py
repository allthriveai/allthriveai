"""Service to download Reddit videos with audio using yt-dlp."""

import logging
import os
import subprocess
import tempfile

from django.conf import settings
from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)


class RedditVideoDownloader:
    """Download Reddit videos with audio merged using yt-dlp and upload to MinIO."""

    def __init__(self):
        """Initialize the downloader with MinIO client."""
        # Initialize MinIO client
        self.minio_client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME

        # Ensure bucket exists
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                logger.info(f'Created MinIO bucket: {self.bucket_name}')
        except S3Error as e:
            logger.error(f'MinIO bucket check failed: {e}')

    def download_video(self, reddit_url: str, reddit_post_id: str) -> str | None:
        """Download a Reddit video with audio merged and upload to MinIO.

        Args:
            reddit_url: Reddit post URL (permalink)
            reddit_post_id: Reddit post ID (e.g., 't3_1pajikw')

        Returns:
            MinIO object path, or None if download/upload failed
        """
        try:
            # Check if video already exists in MinIO
            object_name = f'reddit_videos/{reddit_post_id}.mp4'
            try:
                self.minio_client.stat_object(self.bucket_name, object_name)
                logger.info(f'Video already exists in MinIO: {object_name}')
                return object_name
            except S3Error:
                pass  # Object doesn't exist, continue with download

            # Use temporary directory for download
            with tempfile.TemporaryDirectory() as temp_dir:
                output_template = os.path.join(temp_dir, f'{reddit_post_id}.%(ext)s')

                # yt-dlp command to download and merge video+audio
                # For Reddit: bestvideo+bestaudio/best will merge video and audio streams
                cmd = [
                    'yt-dlp',
                    '--format',
                    'bestvideo+bestaudio/best',
                    '--merge-output-format',
                    'mp4',
                    '--output',
                    output_template,
                    '--no-playlist',
                    reddit_url,
                ]

                logger.info(f'Downloading Reddit video: {reddit_url}')
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)  # noqa: S603

                if result.returncode != 0:
                    logger.error(f'yt-dlp failed: {result.stderr}')
                    return None

                # Find the downloaded file
                downloaded_file = os.path.join(temp_dir, f'{reddit_post_id}.mp4')
                if not os.path.exists(downloaded_file):
                    # Try to find with any extension
                    for file in os.listdir(temp_dir):
                        if file.startswith(reddit_post_id) and file.endswith(('.mp4', '.webm', '.mkv')):
                            downloaded_file = os.path.join(temp_dir, file)
                            break
                    else:
                        logger.error(f'Downloaded file not found in {temp_dir}')
                        return None

                logger.info(f'Successfully downloaded video: {downloaded_file}')

                # Upload to MinIO
                file_size = os.path.getsize(downloaded_file)
                self.minio_client.fput_object(
                    self.bucket_name,
                    object_name,
                    downloaded_file,
                    content_type='video/mp4',
                )
                logger.info(f'Uploaded video to MinIO: {object_name} ({file_size} bytes)')
                return object_name

        except subprocess.TimeoutExpired:
            logger.error(f'Download timeout for {reddit_url}')
            return None
        except Exception as e:
            logger.error(f'Error downloading Reddit video {reddit_url}: {e}', exc_info=True)
            return None

    def get_video_url(self, reddit_post_id: str) -> str | None:
        """Get the public URL for a video in MinIO.

        Args:
            reddit_post_id: Reddit post ID

        Returns:
            Public URL to the video, or None if not found
        """
        object_name = f'reddit_videos/{reddit_post_id}.mp4'
        try:
            # Check if object exists
            self.minio_client.stat_object(self.bucket_name, object_name)

            # Generate public URL
            # Use MINIO_ENDPOINT_PUBLIC for browser access
            protocol = 'https' if settings.MINIO_USE_SSL else 'http'
            public_url = f'{protocol}://{settings.MINIO_ENDPOINT_PUBLIC}/{self.bucket_name}/{object_name}'
            return public_url
        except S3Error:
            return None

    def check_yt_dlp_installed(self) -> bool:
        """Check if yt-dlp is installed."""
        try:
            result = subprocess.run(['yt-dlp', '--version'], capture_output=True, timeout=5)  # noqa: S603, S607
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
