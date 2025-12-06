"""Constants for Figma integration."""

# API Configuration
FIGMA_API_BASE_URL = 'https://api.figma.com/v1'
FIGMA_API_TIMEOUT = 15  # seconds - Figma can be slower for large files
FIGMA_RETRY_ATTEMPTS = 3

# Import settings
IMPORT_LOCK_TIMEOUT = 300  # 5 minutes

# Image export settings
DEFAULT_IMAGE_SCALE = 2  # 2x for high quality
DEFAULT_IMAGE_FORMAT = 'png'
SUPPORTED_IMAGE_FORMATS = ['png', 'jpg', 'svg', 'pdf']

# File type detection
FIGMA_FILE_URL_PATTERN = r'figma\.com/(file|design)/([a-zA-Z0-9]+)'
FIGMA_PROJECT_URL_PATTERN = r'figma\.com/files/project/(\d+)'
