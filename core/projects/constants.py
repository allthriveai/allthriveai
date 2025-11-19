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
