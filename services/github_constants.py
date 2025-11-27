"""Constants for GitHub repository analysis and import."""

# AI Analysis Limits
MAX_CATEGORIES_PER_PROJECT = 2
MAX_TOPICS_PER_PROJECT = 20
MAX_TOOLS_PER_PROJECT = 5
MIN_CATEGORY_ID = 1
MAX_CATEGORY_ID = 15

# Text Limits
MAX_DESCRIPTION_LENGTH = 500
MAX_TOPIC_LENGTH = 50

# API Limits
GITHUB_API_TIMEOUT = 10  # seconds
GITHUB_RETRY_ATTEMPTS = 3
GITHUB_RETRY_MIN_WAIT = 2  # seconds
GITHUB_RETRY_MAX_WAIT = 10  # seconds

# Import Rate Limits
IMPORT_RATE_LIMIT = '5/h'  # 5 imports per hour per user
