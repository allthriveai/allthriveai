"""
Django settings for allthrive-ai-django project.
"""

import os
import socket
import sys
from datetime import timedelta
from pathlib import Path

from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
# No default - must be set explicitly in environment
SECRET_KEY = config('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

# Beta Mode: When enabled, bypasses all subscription/feature gates
# Set BETA_MODE=True in environment to enable unlimited access for all users
BETA_MODE = config('BETA_MODE', default=False, cast=bool)

# Credit Pack Enforcement: Controls whether credit packs block users when credits run out
# When False: Track usage but don't block (useful during beta to see what users would use)
# When True AND BETA_MODE=False: Actually enforce credit limits and block when depleted
# Usage is ALWAYS tracked regardless of this setting for analytics purposes
CREDIT_PACK_ENFORCEMENT_ENABLED = config('CREDIT_PACK_ENFORCEMENT_ENABLED', default=False, cast=bool)

# Unified Ava Agent: Routes AvaHomePage conversations to single agent with all tools
# When True: Conversations starting with 'ava-' use unified Ava agent (no supervisor routing)
# When False: Uses multi-agent orchestrator with supervisor routing (default)
USE_UNIFIED_AVA = config('USE_UNIFIED_AVA', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

# AWS ECS/ALB health checks use container private IPs (10.x.x.x) in the Host header.
# We handle this with HealthCheckMiddleware which bypasses ALLOWED_HOSTS for health paths.
# For ECS environments, we add specific allowed patterns instead of wildcard for security.
if config('ECS_ALLOW_ALL_HOSTS', default=False, cast=bool):
    # In ECS behind ALB, add ALB health check IPs and known domains
    # SECURITY: Never use ['*'] - it allows host header injection attacks
    # Instead, explicitly list allowed hosts including internal IPs for health checks
    ECS_ADDITIONAL_HOSTS = config(
        'ECS_ADDITIONAL_HOSTS',
        default='',
        cast=lambda v: [s.strip() for s in v.split(',') if s.strip()],
    )
    # Add ECS-specific hosts (10.x.x.x handled by HealthCheckMiddleware)
    ALLOWED_HOSTS = ALLOWED_HOSTS + ECS_ADDITIONAL_HOSTS

# Health check paths that bypass ALLOWED_HOSTS validation
HEALTH_CHECK_PATHS = ['/api/v1/health/', '/health/', '/healthz/', '/ready/']

# Compute URL defaults without hardcoding full URLs on a single line
FRONTEND_HOST = config('FRONTEND_HOST', default='localhost')
BACKEND_HOST = config('BACKEND_HOST', default='localhost')
FRONTEND_PORT = config('FRONTEND_PORT', default=3000, cast=int)
BACKEND_PORT = config('BACKEND_PORT', default=8000, cast=int)
FRONTEND_URL_DEFAULT = f'http://{FRONTEND_HOST}:{FRONTEND_PORT}'
BACKEND_URL_DEFAULT = f'http://{BACKEND_HOST}:{BACKEND_PORT}'


# Application definition

INSTALLED_APPS = [
    'django_prometheus',  # Must be first for accurate metrics
    'daphne',  # ASGI server - must be before django.contrib.staticfiles
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.sitemaps',
    'channels',  # WebSocket support
    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',  # OpenAPI schema generation
    'corsheaders',
    'csp',
    'core',  # Must come before allauth to ensure User model is available
    'core.users',  # User model lives here
    'core.achievements',
    'core.thrive_circle',
    'core.integrations',  # Content source integrations (YouTube, RSS, etc.)
    'core.learning_paths',  # Auto-generated learning paths per topic
    'core.billing',  # Stripe subscriptions and token packages
    'core.ai_usage',  # AI usage tracking and cost analytics
    'core.stats',  # Platform statistics
    'core.notifications',  # Email notification system (AWS SES)
    'core.sms',  # SMS notifications (Twilio)
    'core.challenges',  # Weekly challenges with leaderboards
    'core.marketplace',  # Creator marketplace for digital products
    'core.vendors',  # Vendor analytics for tool companies
    'core.tools',  # AI tools and technology directory
    'core.battles',  # Prompt battles feature
    'core.events',  # Events and calendar
    'core.social',  # Social connections
    'core.engagement',  # Engagement tracking for personalization
    'core.tasks',  # Admin task tracker for team coordination
    'core.uat_scenarios',  # UAT scenario tracking for QA
    'core.avatars',  # AI-generated user avatars
    'core.games',  # Educational mini-games
    'core.community',  # Community messaging (forums, DMs, circle chat)
    'core.feedback',  # Member feedback system (feature requests, bug reports)
    'core.admin_logs',  # Admin log streaming dashboard
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.github',
    'allauth.socialaccount.providers.openid_connect',  # For LinkedIn OIDC
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',  # Must be first
    'core.middleware.HealthCheckMiddleware',  # Bypass ALLOWED_HOSTS for health checks (before CommonMiddleware)
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files in production
    'corsheaders.middleware.CorsMiddleware',
    'csp.middleware.CSPMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'core.users.middleware.UsernameRedirectMiddleware',  # Redirect old usernames to new ones (301)
    'core.middleware.CookieJWTAuthenticationMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.auth.oauth_middleware.OAuthJWTMiddleware',  # Set JWT cookies after OAuth login
    'core.billing.middleware.BillingContextMiddleware',  # Add billing context to requests
    'core.billing.middleware.AIRequestThrottleMiddleware',  # Add AI quota checking
    'core.users.middleware.UserActivityMiddleware',  # Track user activity for battles
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',  # Must be last
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
DATABASE_URL = config('DATABASE_URL', default='')
DB_HOST = config('DB_HOST', default='')

if DATABASE_URL:
    # Use DATABASE_URL if provided (e.g., postgresql://user:pass@host:5432/dbname)
    import dj_database_url

    db_config = dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,  # Enable connection health checks
    )

    # Fallback to localhost if 'db' hostname is not resolvable (local development)
    if db_config.get('HOST') == 'db':
        try:
            socket.gethostbyname('db')
        except socket.gaierror:
            db_config['HOST'] = 'localhost'

    DATABASES = {'default': db_config}

    # Use django-db-connection-pool for production connection pooling
    # This provides SQLAlchemy-style connection pooling for better performance
    #
    # Pool sizing: Each ECS task gets POOL_SIZE + MAX_OVERFLOW connections
    # Current setup: 2 web tasks + 6 celery tasks = 8 tasks
    # RDS db.t4g.medium supports ~225 connections
    #
    # Sizing: Web (2 × 25) + Celery (6 × 15) = 140 connections max (fits in 225)
    # Note: We release connections before long AI calls (see core/agents/tasks.py)
    # so actual usage should be much lower than theoretical max.
    if not DEBUG:
        DATABASES['default']['ENGINE'] = 'dj_db_conn_pool.backends.postgresql'
        DATABASES['default']['POOL_OPTIONS'] = {
            'POOL_SIZE': 15,  # Base pool size per worker (increased from 5)
            'MAX_OVERFLOW': 10,  # Extra connections allowed beyond POOL_SIZE (increased from 5)
            'RECYCLE': 300,  # Recycle connections after 5 minutes
            'PRE_PING': True,  # Verify connections before use
            'POOL_TIMEOUT': 30,  # Wait max 30 seconds for a connection
        }

    # Add connection timeouts for PostgreSQL only (not SQLite)
    if 'postgresql' in DATABASES['default'].get('ENGINE', ''):
        DATABASES['default']['OPTIONS'] = {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000',  # 30 second query timeout
        }
elif DB_HOST:
    # Use individual DB_* environment variables (for ECS/AWS Secrets Manager)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'HOST': DB_HOST,
            'PORT': config('DB_PORT', default='5432'),
            'NAME': config('DB_NAME', default='allthrive_ai'),
            'USER': config('DB_USER', default='allthrive'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'connect_timeout': 10,
                'options': '-c statement_timeout=30000',  # 30 second query timeout
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise for serving static files in production
# Compresses and caches static files for better performance
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# Production security settings
#
# SECURE_SSL_REDIRECT defaults to True in production (non-DEBUG) to enforce HTTPS.
# In development (DEBUG=True), defaults to False to avoid redirect issues.
# Can always be overridden via environment variable.
_ssl_redirect_default = not DEBUG  # True in production, False in development
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=_ssl_redirect_default, cast=bool)

# Trust the X-Forwarded-Proto header from CloudFront/ALB to determine if request is HTTPS
# This is required when running behind CloudFront/ALB which terminates SSL
# ALB sets X-Forwarded-Proto for both HTTP and WebSocket connections
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# CORS settings
_DEFAULT_CORS_ALLOWED = ','.join(
    [
        FRONTEND_URL_DEFAULT,
        f'http://127.0.0.1:{FRONTEND_PORT}',
    ]
)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default=_DEFAULT_CORS_ALLOWED,
    cast=lambda v: [s.strip() for s in v.split(',')],
)
CORS_ALLOW_CREDENTIALS = True
CORS_PREFLIGHT_MAX_AGE = 86400  # Cache preflight requests for 24 hours
# Allow custom headers for smoke tests
from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-smoke-test-key',
]

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Global fallbacks required by DRF's AnonRateThrottle and UserRateThrottle
        'anon': '100/minute',
        'user': '1000/minute',
        # Endpoint-specific scopes used throughout the project
        'public_profile': '60/hour',
        'public_projects': '100/hour',
        'authenticated_profile': '300/hour',
        'authenticated_projects': '500/hour',
        'quiz_start': '10/hour',
        'quiz_answer': '100/minute',
        # Feedback endpoints
        'feedback': '30/hour',
        'feedback_read': '120/hour',
    },
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.CustomPageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# OpenAPI Schema Settings (drf-spectacular)
SPECTACULAR_SETTINGS = {
    'TITLE': 'AllThrive AI API',
    'DESCRIPTION': 'API for AllThrive AI platform - AI-powered learning and project portfolio',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SECURITY': [{'bearerAuth': []}],
    'COMPONENT_SPLIT_REQUEST': True,
    # Better serializer introspection
    'SCHEMA_PATH_PREFIX': r'/api/v1/',
    'SCHEMA_PATH_PREFIX_TRIM': True,
    # Enable request/response body detection
    'POSTPROCESSING_HOOKS': [],
    # Generate pagination parameters
    'PAGINATION_COMPONENT': True,
    # Generate filter parameters from django-filter
    'PREPROCESSING_HOOKS': ['drf_spectacular.hooks.preprocess_exclude_path_format'],
    # Component settings
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'bearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
    # Enable deep inspection of serializers
    'COMPONENT_NO_READ_ONLY_REQUIRED': True,
}

# AI API Keys
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
OPENAI_BASE_URL = config('OPENAI_BASE_URL', default='')  # For AI gateway (OpenRouter, etc.)
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')
GOOGLE_API_KEY = config('GOOGLE_API_KEY', default='')

# Production Smoke Test API Key (for E2E tests via GitHub Actions)
SMOKE_TEST_API_KEY = config('SMOKE_TEST_API_KEY', default='')

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY = config('AZURE_OPENAI_API_KEY', default='')
AZURE_OPENAI_ENDPOINT = config(
    'AZURE_OPENAI_ENDPOINT', default='https://go1-presales-resource.cognitiveservices.azure.com/'
)
AZURE_OPENAI_API_VERSION = config('AZURE_OPENAI_API_VERSION', default='2025-01-01-preview')
AZURE_OPENAI_DEPLOYMENT_NAME = config('AZURE_OPENAI_DEPLOYMENT_NAME', default='gpt-4.1')

# Stripe Payment Configuration
STRIPE_PUBLIC_KEY = config('STRIPE_PUBLIC_KEY', default='')
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')

# reCAPTCHA v3 Configuration (for bot protection)
# Get your keys from: https://www.google.com/recaptcha/admin
RECAPTCHA_SECRET_KEY = config('RECAPTCHA_SECRET_KEY', default='')
GEMINI_MODEL_NAME = config('GEMINI_MODEL_NAME', default='gemini-2.0-flash')
# Image generation model - gemini-3-pro-image-preview is best quality but slow
# For avatars, use gemini-2.5-flash-image (faster, still good quality)
GEMINI_IMAGE_MODEL = config('GEMINI_IMAGE_MODEL', default='gemini-3-pro-image-preview')
GEMINI_AVATAR_MODEL = config('GEMINI_AVATAR_MODEL', default='gemini-2.5-flash-image')

# OpenAI image generation model for avatars
# gpt-image-1: Fast, good quality, supports reference images via images.edit() API for "Make Me" mode
# gpt-image-1.5: Best quality but slow (~45s), use for premium tier only
OPENAI_AVATAR_MODEL = config('OPENAI_AVATAR_MODEL', default='gpt-image-1')

# Weaviate Vector Database Configuration
WEAVIATE_HOST = config('WEAVIATE_HOST', default='localhost')
WEAVIATE_PORT = config('WEAVIATE_PORT', default=8080, cast=int)
WEAVIATE_URL = config('WEAVIATE_URL', default=f'http://{WEAVIATE_HOST}:{WEAVIATE_PORT}')
WEAVIATE_API_KEY = config('WEAVIATE_API_KEY', default='')  # Optional for local dev
WEAVIATE_EMBEDDING_MODEL = config('WEAVIATE_EMBEDDING_MODEL', default='text-embedding-3-small')
WEAVIATE_BATCH_SIZE = config('WEAVIATE_BATCH_SIZE', default=100, cast=int)
WEAVIATE_TIMEOUT = config('WEAVIATE_TIMEOUT', default=30, cast=int)  # seconds

# Redis Agent Memory Server Configuration
# Used for AI chat persistence, semantic search, and agent memory
AGENT_MEMORY_SERVER_URL = config('AGENT_MEMORY_SERVER_URL', default='http://agent-memory:8000')

# GitHub API Token (for project agent)
GITHUB_API_TOKEN = config('GITHUB_API_TOKEN', default='')  # Optional, increases rate limit

# MCP (Model Context Protocol) Server Configuration
# FastMCP client connects to these servers for multi-source project analysis
MCP_SERVERS = {
    'figma': {
        'transport': 'http',
        'url': config('FIGMA_MCP_SERVER_URL', default=f'{BACKEND_URL_DEFAULT}:3845/mcp'),
        'env': {
            'FIGMA_ACCESS_TOKEN': config('FIGMA_ACCESS_TOKEN', default=''),
        },
    },
}

# Social OAuth Provider Credentials
# These are for account linking (separate from authentication OAuth)
GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = config('GOOGLE_CLIENT_SECRET', default='')

GITHUB_CLIENT_ID = config('GITHUB_CLIENT_ID', default='')
GITHUB_CLIENT_SECRET = config('GITHUB_CLIENT_SECRET', default='')

# GitHub App settings (for installation-based repo access)
GITHUB_APP_ID = config('GITHUB_APP_ID', default='')  # Numeric App ID
GITHUB_APP_SLUG = config('GITHUB_APP_SLUG', default='all-thrive-ai')  # App slug for URLs
GITHUB_APP_PRIVATE_KEY = config('GITHUB_APP_PRIVATE_KEY', default='')  # PEM private key (optional)

GITLAB_OAUTH_CLIENT_ID = config('GITLAB_OAUTH_CLIENT_ID', default='')
GITLAB_OAUTH_CLIENT_SECRET = config('GITLAB_OAUTH_CLIENT_SECRET', default='')

LINKEDIN_OAUTH_CLIENT_ID = config('LINKEDIN_OAUTH_CLIENT_ID', default='')
LINKEDIN_OAUTH_CLIENT_SECRET = config('LINKEDIN_OAUTH_CLIENT_SECRET', default='')

FIGMA_OAUTH_CLIENT_ID = config('FIGMA_OAUTH_CLIENT_ID', default='')
FIGMA_OAUTH_CLIENT_SECRET = config('FIGMA_OAUTH_CLIENT_SECRET', default='')

HUGGINGFACE_OAUTH_CLIENT_ID = config('HUGGINGFACE_OAUTH_CLIENT_ID', default='')
HUGGINGFACE_OAUTH_CLIENT_SECRET = config('HUGGINGFACE_OAUTH_CLIENT_SECRET', default='')

MIDJOURNEY_OAUTH_CLIENT_ID = config('MIDJOURNEY_OAUTH_CLIENT_ID', default='')
MIDJOURNEY_OAUTH_CLIENT_SECRET = config('MIDJOURNEY_OAUTH_CLIENT_SECRET', default='')

# Fallback AI Provider (used when DEFAULT_AI_PROVIDER is not set)
FALLBACK_AI_PROVIDER = config('FALLBACK_AI_PROVIDER', default='openai')

# Default AI Provider (options: openai, anthropic, gemini)
# If not explicitly set, falls back to FALLBACK_AI_PROVIDER.
DEFAULT_AI_PROVIDER = config('DEFAULT_AI_PROVIDER', default=FALLBACK_AI_PROVIDER)

# AI Models by Purpose
# - default: General purpose, supports temperature, cost-effective
# - reasoning: Complex multi-step tasks, no temperature support
# - image: Image generation (always uses Gemini)
# - vision: Image understanding/analysis
# - tagging: Bulk content tagging (cheapest model for high volume)
# - tagging_premium: High-quality tagging for important/featured content
AI_MODELS = {
    'openai': {
        'default': config('OPENAI_MODEL_DEFAULT', default='gpt-4o-mini'),
        'reasoning': config('OPENAI_MODEL_REASONING', default='gpt-5-mini-2025-08-07'),
        'tagging': config('OPENAI_MODEL_TAGGING', default='gpt-3.5-turbo'),
        'tagging_premium': config('OPENAI_MODEL_TAGGING_PREMIUM', default='gpt-4o-mini'),
        'avatar': OPENAI_AVATAR_MODEL,  # gpt-image-1 - faster, supports reference images
    },
    'azure': {
        'default': AZURE_OPENAI_DEPLOYMENT_NAME,
        'reasoning': config('AZURE_OPENAI_REASONING_DEPLOYMENT', default=AZURE_OPENAI_DEPLOYMENT_NAME),
        'tagging': config('AZURE_OPENAI_TAGGING_DEPLOYMENT', default=AZURE_OPENAI_DEPLOYMENT_NAME),
        'tagging_premium': config('AZURE_OPENAI_TAGGING_PREMIUM_DEPLOYMENT', default=AZURE_OPENAI_DEPLOYMENT_NAME),
    },
    'anthropic': {
        'default': config('ANTHROPIC_MODEL_DEFAULT', default='claude-3-5-haiku-20241022'),
        'reasoning': config('ANTHROPIC_MODEL_REASONING', default='claude-sonnet-4-20250514'),
        'tagging': config('ANTHROPIC_MODEL_TAGGING', default='claude-3-5-haiku-20241022'),
        'tagging_premium': config('ANTHROPIC_MODEL_TAGGING_PREMIUM', default='claude-3-5-haiku-20241022'),
    },
    'gemini': {
        'default': config('GEMINI_MODEL_DEFAULT', default='gemini-2.0-flash'),
        'image': config('GEMINI_IMAGE_MODEL', default='gemini-3-pro-image-preview'),
        'avatar': GEMINI_AVATAR_MODEL,  # Fast image model for avatar generation
        'vision': config('GEMINI_MODEL_VISION', default='gemini-2.0-flash'),
        'tagging': config('GEMINI_MODEL_TAGGING', default='gemini-2.0-flash'),
        'tagging_premium': config('GEMINI_MODEL_TAGGING_PREMIUM', default='gemini-2.0-flash'),
    },
}

# Legacy setting - kept for backwards compatibility, maps to AI_MODELS['openai']['default']
DEFAULT_OPENAI_MODEL = AI_MODELS['openai']['default']

# Image Analysis Provider Configuration
# Primary provider for analyzing uploaded images (gemini, openai, anthropic)
IMAGE_ANALYSIS_PROVIDER = config('IMAGE_ANALYSIS_PROVIDER', default='gemini')
# Fallback provider if primary fails (set to same as primary to disable fallback)
IMAGE_ANALYSIS_FALLBACK_PROVIDER = config('IMAGE_ANALYSIS_FALLBACK_PROVIDER', default='openai')

# Phoenix Configuration (LLM Observability & Evaluation)
# Local: Traces appear at http://localhost:6006
# Production: Traces go to Arize Cloud (requires PHOENIX_API_KEY)
PHOENIX_ENABLED = config('PHOENIX_ENABLED', default=True, cast=bool)
PHOENIX_API_KEY = config('PHOENIX_API_KEY', default='')  # Arize Cloud API key for production
PHOENIX_COLLECTOR_ENDPOINT = config('PHOENIX_COLLECTOR_ENDPOINT', default='')  # Custom endpoint
PHOENIX_PROJECT_NAME = config('PHOENIX_PROJECT_NAME', default='allthrive-ai')

# AI Gateway Cost Tracking
AI_COST_TRACKING_ENABLED = config('AI_COST_TRACKING_ENABLED', default=True, cast=bool)
AI_MONTHLY_SPEND_LIMIT_USD = config('AI_MONTHLY_SPEND_LIMIT_USD', default=1000.0, cast=float)
AI_USER_DAILY_SPEND_LIMIT_USD = config('AI_USER_DAILY_SPEND_LIMIT_USD', default=5.0, cast=float)

# AI Token Limits (per request safeguards)
# These prevent runaway costs from extremely large requests
# Soft limit: warns but allows
# Hard limit: blocks request entirely
AI_TOKEN_SOFT_LIMIT = config('AI_TOKEN_SOFT_LIMIT', default=8000, cast=int)  # Warn above this
AI_TOKEN_HARD_LIMIT = config('AI_TOKEN_HARD_LIMIT', default=32000, cast=int)  # Block above this
AI_OUTPUT_TOKEN_LIMIT = config('AI_OUTPUT_TOKEN_LIMIT', default=4096, cast=int)  # Max output tokens

# Daily AI Request Limits (abuse protection)
# Maximum AI requests per user per day (0 = unlimited)
# Soft limit: warns in logs when exceeded (for monitoring)
# Hard limit: blocks requests when exceeded (abuse protection)
AI_DAILY_REQUEST_SOFT_LIMIT = config('AI_DAILY_REQUEST_SOFT_LIMIT', default=200, cast=int)  # Warn above this
AI_DAILY_REQUEST_HARD_LIMIT = config('AI_DAILY_REQUEST_HARD_LIMIT', default=500, cast=int)  # Block above this

# RSS Agent Image Generation
# Set to False in local development to save Gemini API token costs
RSS_GENERATE_HERO_IMAGES = config('RSS_GENERATE_HERO_IMAGES', default=True, cast=bool)

# Redis Configuration
# For AWS ElastiCache with TLS + auth, construct URLs from components
# For local dev, use simple URLs
REDIS_HOST = config('REDIS_HOST', default='')
REDIS_PORT = config('REDIS_PORT', default='6379')
REDIS_AUTH_TOKEN = config('REDIS_AUTH_TOKEN', default='')
REDIS_USE_TLS = config('REDIS_USE_TLS', default=False, cast=bool)


def _build_redis_url(db: int = 0, include_ssl_params: bool = True) -> str:
    """Build Redis URL from components or use environment variable.

    Args:
        db: Redis database number
        include_ssl_params: If True, adds ssl_cert_reqs parameter for Celery.
                          If False, omits it for Django cache (uses OPTIONS instead).
    """
    if REDIS_HOST:
        # AWS ElastiCache mode: build URL from components
        scheme = 'rediss' if REDIS_USE_TLS else 'redis'
        auth = f':{REDIS_AUTH_TOKEN}@' if REDIS_AUTH_TOKEN else ''
        base_url = f'{scheme}://{auth}{REDIS_HOST}:{REDIS_PORT}/{db}'
        # Celery requires ssl_cert_reqs parameter in URL
        # Django cache uses OPTIONS dict instead
        if REDIS_USE_TLS and include_ssl_params:
            base_url += '?ssl_cert_reqs=required'
        return base_url
    # Local development: use simple localhost URLs
    return f'redis://localhost:6379/{db}'


def _ensure_redis_ssl_params(url: str) -> str:
    """Ensure rediss:// URLs have the required ssl_cert_reqs parameter."""
    if url and url.startswith('rediss://') and 'ssl_cert_reqs=' not in url:
        separator = '&' if '?' in url else '?'
        return f'{url}{separator}ssl_cert_reqs=required'
    return url


# Celery Configuration
CELERY_BROKER_URL = _ensure_redis_ssl_params(config('CELERY_BROKER_URL', default=_build_redis_url(0)))
CELERY_RESULT_BACKEND = _ensure_redis_ssl_params(config('CELERY_RESULT_BACKEND', default=_build_redis_url(1)))
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Celery SSL configuration for Redis with TLS (AWS ElastiCache)
if REDIS_USE_TLS:
    import ssl

    CELERY_BROKER_USE_SSL = {
        'ssl_cert_reqs': ssl.CERT_REQUIRED,
    }
    CELERY_REDIS_BACKEND_USE_SSL = {
        'ssl_cert_reqs': ssl.CERT_REQUIRED,
    }

# Redis Configuration for LangChain State
REDIS_URL = _ensure_redis_ssl_params(config('REDIS_URL', default=_build_redis_url(2)))
CHAT_SESSION_TTL = config('CHAT_SESSION_TTL', default=1800, cast=int)  # 30 minutes

# Django Channels Configuration
ASGI_APPLICATION = 'config.asgi.application'

# Channels Redis Configuration (DB 3)
# For AWS ElastiCache with TLS, use rediss:// URL with ssl_cert_reqs as a kwarg
# The kwarg must be lowercase 'none' (not 'CERT_NONE' or ssl.CERT_NONE)
# because channels_redis passes it to aioredis.ConnectionPool.from_url()
#
# NOTE on ssl_cert_reqs:
# - AWS ElastiCache uses Amazon's internal CA which isn't in the default certificate store
# - Using 'none' skips certificate verification (works but less secure)
# - For production, consider installing Amazon Root CA and using 'required'
# - See: https://github.com/andymccurdy/redis-py/issues/1080
if REDIS_USE_TLS and REDIS_HOST:
    # Build rediss:// URL for TLS connection
    _channels_redis_url = f'rediss://:{REDIS_AUTH_TOKEN}@{REDIS_HOST}:{REDIS_PORT}/3'

    # Allow override via environment variable for stricter security
    _redis_ssl_cert_reqs = config('REDIS_SSL_CERT_REQS', default='none')

    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [
                    {
                        'address': _channels_redis_url,
                        'ssl_cert_reqs': _redis_ssl_cert_reqs,  # 'none' for ElastiCache compatibility
                    }
                ],
                'capacity': 3000,  # Max messages to store per channel (increased for production load)
                'expiry': 15,  # Message expiry in seconds (slight increase for reliability)
            },
        },
    }
else:
    # Local development: use simple URL
    _channels_redis_url = config('REDIS_URL', default='redis://localhost:6379/3')
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [_channels_redis_url],
                'capacity': 3000,  # Max messages to store per channel
                'expiry': 15,  # Message expiry in seconds
            },
        },
    }

# Cache Configuration
# Use Redis for caching (DB 2 for cache)
# Use LocMemCache during tests (supports atomic operations like add())
if 'test' in sys.argv or 'pytest' in sys.modules:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'test-cache',
        }
    }
else:
    cache_config = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            # Build URL without ssl_cert_reqs parameter (handled via OPTIONS instead)
            'LOCATION': config('CACHE_URL', default=_build_redis_url(4, include_ssl_params=False)),
            'KEY_PREFIX': 'allthrive',
            'TIMEOUT': 300,  # 5 minutes default
        }
    }
    # Add SSL options for Redis TLS connections
    if REDIS_USE_TLS:
        import ssl

        cache_config['default']['OPTIONS'] = {
            'ssl_cert_reqs': ssl.CERT_NONE,  # Use CERT_NONE for AWS ElastiCache
        }
    CACHES = cache_config

# Cache timeouts for different data types
CACHE_TTL = {
    'PUBLIC_PROFILE': 300,  # 5 minutes
    'PUBLIC_PROJECTS': 180,  # 3 minutes
    'USER_PROJECTS': 60,  # 1 minute for own projects
}

# Points System Configuration
POINTS_CONFIG = {
    # Quiz-related points
    'QUIZ_COMPLETED': 20,
    'QUIZ_PERFECT_SCORE': 30,
    'QUIZ_STREAK': 10,
    # Project-related points
    'PROJECT_CREATED': 10,
    'PROJECT_PUBLISHED': 15,
    'PROJECT_MILESTONE': 50,
    # Engagement points
    'DAILY_LOGIN': 5,
    'WEEK_STREAK': 25,
    'MONTH_STREAK': 100,
    # Battle-related points
    'BATTLE_PARTICIPATED': 25,
    'BATTLE_WON': 20,
    'BATTLE_COMPLETED': 10,
    # Community points
    'PROFILE_COMPLETED': 25,
    'REFERRAL': 50,
    # Validation limits
    'MAX_POINTS_PER_AWARD': 10000,
    'MIN_POINTS_PER_AWARD': -1000,
}

# GitHub API Rate Limiting Configuration
GITHUB_RATE_LIMIT = {
    # Authenticated requests: 5000 per hour (GitHub limit)
    # Conservative limits to avoid hitting GitHub's limits
    'MAX_REQUESTS_PER_HOUR': config('GITHUB_MAX_REQUESTS_PER_HOUR', default=4500, cast=int),
    'MAX_REQUESTS_PER_MINUTE': config('GITHUB_MAX_REQUESTS_PER_MINUTE', default=60, cast=int),
    # User-specific limits (per user per hour)
    # Increased for development: 50 fetches/hour, 20 imports/hour
    'USER_MAX_REPO_FETCHES_PER_HOUR': config('GITHUB_USER_REPO_FETCHES_PER_HOUR', default=50, cast=int),
    'USER_MAX_IMPORTS_PER_HOUR': config('GITHUB_USER_IMPORTS_PER_HOUR', default=20, cast=int),
    # Cache durations (in seconds)
    'REPO_LIST_CACHE_DURATION': 300,  # 5 minutes
    'REPO_PREVIEW_CACHE_DURATION': 600,  # 10 minutes
    # Retry configuration
    'MAX_RETRIES': 3,
    'RETRY_BACKOFF': 2,  # Exponential backoff multiplier
}

# Logging Configuration
# In containerized environments (ECS, etc.), log to console only
# File logging can be enabled for local development via FILE_LOGGING=true
FILE_LOGGING_ENABLED = config('FILE_LOGGING', default=DEBUG, cast=bool)

if FILE_LOGGING_ENABLED:
    os.makedirs(BASE_DIR / 'logs', exist_ok=True)

# Build handlers based on environment
_log_handlers = {
    'console': {
        'level': 'INFO',
        'class': 'logging.StreamHandler',
        'formatter': 'simple',
        'filters': ['sanitize_sensitive_data'],
    },
    'mail_admins': {
        'level': 'ERROR',
        'class': 'django.utils.log.AdminEmailHandler',
        'filters': ['require_debug_false'],
    },
}

# Only add file handlers if file logging is enabled
if FILE_LOGGING_ENABLED:
    _log_handlers['file'] = {
        'level': 'INFO',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': BASE_DIR / 'logs' / 'django.log',
        'maxBytes': 1024 * 1024 * 15,  # 15MB
        'backupCount': 10,
        'formatter': 'verbose',
        'filters': ['sanitize_sensitive_data'],
    }
    _log_handlers['security'] = {
        'level': 'WARNING',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': BASE_DIR / 'logs' / 'security.log',
        'maxBytes': 1024 * 1024 * 15,
        'backupCount': 10,
        'formatter': 'verbose',
    }

# Configure logger handlers based on file logging availability
_default_handlers = ['console', 'file'] if FILE_LOGGING_ENABLED else ['console']
_security_handlers = ['security', 'mail_admins'] if FILE_LOGGING_ENABLED else ['console', 'mail_admins']
_request_handlers = ['file', 'mail_admins'] if FILE_LOGGING_ENABLED else ['console', 'mail_admins']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
        'sanitize_sensitive_data': {
            '()': 'core.billing.logging_utils.SensitiveDataFilter',
        },
    },
    'handlers': _log_handlers,
    'loggers': {
        'django': {
            'handlers': _default_handlers,
            'level': 'INFO',
        },
        'django.security': {
            'handlers': _security_handlers,
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': _request_handlers,
            'level': 'ERROR',
            'propagate': False,
        },
        'core': {
            'handlers': _default_handlers,
            'level': 'INFO',
            'propagate': False,
        },
        'core.billing': {
            'handlers': _default_handlers,
            'level': 'DEBUG',  # More verbose for billing
            'propagate': False,
        },
        'services': {
            'handlers': _default_handlers,
            'level': 'DEBUG',
        },
    },
    'root': {
        'level': 'INFO',
        'handlers': ['console'],
    },
}

# MinIO / S3 Configuration
# MINIO_ENDPOINT: Internal Docker network endpoint (backend -> MinIO)
MINIO_ENDPOINT = config('MINIO_ENDPOINT', default='localhost:9000')
# MINIO_ENDPOINT_PUBLIC: Public endpoint for browser access (browser -> MinIO)
MINIO_ENDPOINT_PUBLIC = config('MINIO_ENDPOINT_PUBLIC', default='localhost:9000')
MINIO_ACCESS_KEY = config('MINIO_ACCESS_KEY', default='minioadmin')
MINIO_SECRET_KEY = config('MINIO_SECRET_KEY', default='minioadmin')
MINIO_USE_SSL = config('MINIO_USE_SSL', default=False, cast=bool)
MINIO_BUCKET_NAME = config('MINIO_BUCKET_NAME', default='allthrive-media')

# Media files configuration (uploaded by users)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'  # Fallback for local development without MinIO

# File upload security limits
# These protect against denial-of-service attacks via large uploads
DATA_UPLOAD_MAX_MEMORY_SIZE = config(
    'DATA_UPLOAD_MAX_MEMORY_SIZE', default=10 * 1024 * 1024, cast=int
)  # 10MB max for in-memory upload
FILE_UPLOAD_MAX_MEMORY_SIZE = config(
    'FILE_UPLOAD_MAX_MEMORY_SIZE', default=10 * 1024 * 1024, cast=int
)  # 10MB before temp file is used
DATA_UPLOAD_MAX_NUMBER_FILES = config('DATA_UPLOAD_MAX_NUMBER_FILES', default=20, cast=int)  # Max files per request
DATA_UPLOAD_MAX_NUMBER_FIELDS = config('DATA_UPLOAD_MAX_NUMBER_FIELDS', default=1000, cast=int)  # Max form fields

# Maximum allowed file size for user uploads (enforced in views)
MAX_UPLOAD_SIZE_MB = config('MAX_UPLOAD_SIZE_MB', default=25, cast=int)  # 25MB max file size
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # In bytes

# Custom User Model (points to users subdomain where User is defined)
AUTH_USER_MODEL = 'users.User'

# Django Sites Framework
SITE_ID = 1

# Site URL for SEO and sitemap generation
# Used in meta tags, canonical URLs, and sitemap protocol
SITE_URL = config('SITE_URL', default=BACKEND_URL_DEFAULT)

# Email Configuration (AWS SES)
if DEBUG:
    # Development: log emails to console
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'noreply@allthrive.ai'
else:
    # Production: use AWS SES
    EMAIL_BACKEND = 'django_ses.SESBackend'
    AWS_SES_REGION_NAME = config('AWS_SES_REGION', default='us-east-1')
    AWS_SES_REGION_ENDPOINT = f'email.{AWS_SES_REGION_NAME}.amazonaws.com'
    # SES credentials (uses IAM role if not set)
    AWS_SES_ACCESS_KEY_ID = config('AWS_SES_ACCESS_KEY_ID', default='')
    AWS_SES_SECRET_ACCESS_KEY = config('AWS_SES_SECRET_ACCESS_KEY', default='')
    # Rate limiting (SES sandbox: 1/sec, production: 14/sec default)
    AWS_SES_AUTO_THROTTLE = 0.5  # seconds between emails
    DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@allthrive.ai')
    SERVER_EMAIL = config('SERVER_EMAIL', default=DEFAULT_FROM_EMAIL)  # Used for error emails
    ADMINS = [('Admin', config('ADMIN_EMAIL', default='admin@allthrive.ai'))]

# Twilio SMS Configuration
# Uses ConsoleSMSProvider for development if not configured
TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN', default='')
TWILIO_PHONE_NUMBER = config('TWILIO_PHONE_NUMBER', default='')

# Django Allauth Configuration
AUTHENTICATION_BACKENDS = [
    'core.auth.backends.EmailOrUsernameModelBackend',  # Custom backend for email or username login
    'allauth.account.auth_backends.AuthenticationBackend',
]

# Custom allauth adapters for JWT token handling
ACCOUNT_ADAPTER = 'core.auth.adapter.CustomAccountAdapter'
SOCIALACCOUNT_ADAPTER = 'core.auth.adapter.CustomSocialAccountAdapter'

# New django-allauth settings format (v0.50+)
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'optional'  # Optional for OAuth (they verify with provider)
ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'http' if DEBUG else 'https'  # HTTP for local dev, HTTPS for production
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_LOGIN_ON_GET = True  # Skip intermediate page and go directly to provider
SOCIALACCOUNT_STORE_TOKENS = True  # Store OAuth tokens for API access (GitHub import, etc.)

# Redirect after OAuth login - handled by CustomAccountAdapter
LOGIN_REDIRECT_URL = None  # Adapter will handle redirect
ACCOUNT_LOGOUT_REDIRECT_URL = '/'

# OAuth Provider Settings
# Note: Client ID and Secret are stored in database via SocialApp model
# See: python manage.py setup_github_oauth or Django Admin
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': [
            'profile',
            'email',
        ],
        'AUTH_PARAMS': {
            'access_type': 'online',  # No refresh token needed for basic sign-in
        },
    },
    'github': {
        # Note: GitHub Apps get repo access through App installation, not OAuth scopes.
        # Only user-related scopes are valid for GitHub App user authorization.
        'SCOPE': [
            'user',
            'user:email',
            'read:user',  # Read user profile data
        ],
    },
    'figma': {
        'SCOPE': [
            'file_content:read',  # Read file contents (nodes, editor type)
            'file_metadata:read',  # Read file metadata (name, last modified, etc.)
        ],
    },
    # LinkedIn uses OpenID Connect (the old linkedin_oauth2 provider is deprecated)
    # The SocialApp should be created with provider_id='linkedin'
    # See: https://docs.allauth.org/en/dev/socialaccount/providers/linkedin.html
    'openid_connect': {
        'APPS': [
            {
                'provider_id': 'linkedin',
                'name': 'LinkedIn',
                'client_id': config('LINKEDIN_OAUTH_CLIENT_ID', default=''),
                'secret': config('LINKEDIN_OAUTH_CLIENT_SECRET', default=''),
                'settings': {
                    'server_url': 'https://www.linkedin.com/oauth',
                },
            },
        ],
    },
}

# JWT Settings
# Cookie domain for cross-subdomain support
# For localhost development: use 'localhost' to share cookies between ports (3000 and 8000)
# For production (e.g., api.example.com and app.example.com), use '.example.com'
# If you experience cookie issues locally, try setting COOKIE_DOMAIN= (empty) to use host-only cookies
_cookie_domain_raw = config('COOKIE_DOMAIN', default='localhost')
COOKIE_DOMAIN = _cookie_domain_raw if _cookie_domain_raw else None

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',  # Lax for cross-origin OAuth flows
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_DOMAIN': COOKIE_DOMAIN,
}

# Frontend URL for OAuth redirects
FRONTEND_URL = config('FRONTEND_URL', default=FRONTEND_URL_DEFAULT)
BACKEND_URL = config('BACKEND_URL', default=BACKEND_URL_DEFAULT)

# Session settings for first-party cookies
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'  # Lax required for OAuth flows
SESSION_COOKIE_DOMAIN = COOKIE_DOMAIN

# CSRF settings
CSRF_COOKIE_HTTPONLY = False  # Must be False so JavaScript can read it
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'Lax'  # Lax required for OAuth callbacks
CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN
CSRF_USE_SESSIONS = False  # Use cookie-based CSRF
CSRF_COOKIE_NAME = 'csrftoken'
_DEFAULT_CSRF_TRUSTED = ','.join(
    [
        FRONTEND_URL_DEFAULT,
        f'http://127.0.0.1:{FRONTEND_PORT}',
    ]
)
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default=_DEFAULT_CSRF_TRUSTED,
    cast=lambda v: [s.strip() for s in v.split(',')],
)

# Content Security Policy (django-csp 4.0 format)
# SECURITY NOTE: 'unsafe-inline' for styles is required for many CSS-in-JS libraries.
# To remove it, migrate to nonce-based CSP or external stylesheets.
# See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#inline_styles
# CDN sources for API documentation (Swagger UI, ReDoc)
_API_DOCS_CDN = ('https://cdn.jsdelivr.net',)

if DEBUG:
    _CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'") + _API_DOCS_CDN
    _CSP_STYLE_SRC = ("'self'", "'unsafe-inline'") + _API_DOCS_CDN
else:
    _CSP_SCRIPT_SRC = ("'self'",) + _API_DOCS_CDN
    # TODO: Remove 'unsafe-inline' for styles once CSS-in-JS is refactored to use nonces
    _CSP_STYLE_SRC = ("'self'", "'unsafe-inline'") + _API_DOCS_CDN

CONTENT_SECURITY_POLICY = {
    'DIRECTIVES': {
        'default-src': ("'self'",),
        'script-src': _CSP_SCRIPT_SRC,
        'style-src': _CSP_STYLE_SRC,
        'img-src': ("'self'", 'data:', 'https:'),
        'connect-src': ("'self'", 'wss:', 'ws:')
        + tuple(
            config(
                'CORS_ALLOWED_ORIGINS',
                default=FRONTEND_URL_DEFAULT,
                cast=lambda v: [s.strip() for s in v.split(',')],
            )
        ),
        'font-src': ("'self'", 'data:'),
        'frame-src': (
            "'self'",
            'https://www.youtube.com',
            'https://www.youtube-nocookie.com',
            'https://player.vimeo.com',
            'https://www.redditmedia.com',
            'https://embed.reddit.com',
            'https://js.stripe.com',
            'https://www.google.com',  # reCAPTCHA
        ),
        'media-src': (
            "'self'",
            'https://v.redd.it',
            'https://*.redd.it',
            'blob:',
        ),
        'frame-ancestors': ("'none'",),
        'report-uri': '/api/v1/csp-report/',  # CSP violation reporting
    }
}

# Production configuration validation
# These checks prevent common misconfigurations that would break production deployments
if not DEBUG:
    import sys

    # Check 1: Cookie domain must be set in production
    if COOKIE_DOMAIN == 'localhost':
        print(
            '\n'
            '❌ CRITICAL: COOKIE_DOMAIN is set to "localhost" in production mode.\n'
            '   This will prevent authentication cookies from working on your production domain.\n'
            '   Set COOKIE_DOMAIN to your production domain (e.g., ".example.com") in your .env file.\n'
            '   Example: COOKIE_DOMAIN=.allthrive.ai\n',
            file=sys.stderr,
        )
        sys.exit(1)

    # Check 2: CSP should not allow unsafe-inline in production
    if "'unsafe-inline'" in _CSP_STYLE_SRC:
        print(
            '\n'
            '⚠️  WARNING: Content-Security-Policy allows unsafe-inline styles in production.\n'
            '   This is a security risk. Migrate to nonce-based CSP or external stylesheets.\n'
            '   See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#inline_styles\n',
            file=sys.stderr,
        )
        # Note: This is a warning, not a hard failure, to allow gradual migration
        # To make this a hard failure, change to sys.exit(1)
