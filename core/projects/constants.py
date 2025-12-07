"""Constants for projects domain."""

# Project content validation
MAX_PROJECT_TAGS = 20
MAX_CONTENT_SIZE = 100_000  # 100KB in bytes
MAX_TAG_LENGTH = 50

# Performance thresholds
MIN_RESPONSE_TIME_SECONDS = 0.05  # Minimum response time for timing attacks prevention

# Cache TTL (time to live in seconds)
USER_PROJECTS_CACHE_TTL = 60  # 1 minute for user's own projects
PUBLIC_PROJECTS_CACHE_TTL = 180  # 3 minutes for public projects

# Default banner images for projects (when user doesn't provide one)
DEFAULT_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=400&fit=crop',  # Gradient abstract
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&h=400&fit=crop',  # Gradient purple
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=400&fit=crop',  # Gradient blue
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&h=400&fit=crop',  # Gradient warm
    'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=400&fit=crop',  # Gradient teal
]

# Default banner image to use (first one in the list)
DEFAULT_BANNER_IMAGE = DEFAULT_BANNER_IMAGES[0]

# Promotion settings
PROMOTION_DURATION_DAYS = 7  # Promotions expire after 7 days
