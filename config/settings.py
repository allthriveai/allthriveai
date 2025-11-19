"""
Django settings for allthrive-ai-django project.
"""
import os
from datetime import timedelta
from pathlib import Path

from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
# No default - must be set explicitly in environment
SECRET_KEY = config("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=lambda v: [s.strip() for s in v.split(",")])


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "csp",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.github",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "csp.middleware.CSPMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
DATABASE_URL = config("DATABASE_URL", default="")
if DATABASE_URL:
    # Use DATABASE_URL if provided (e.g., postgresql://user:pass@host:5432/dbname)
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,  # Enable connection health checks
        )
    }
    # Add connection pooling and timeouts for PostgreSQL
    DATABASES["default"]["OPTIONS"] = {
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000",  # 30 second query timeout
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Production security settings
#
# By default we avoid forcing HTTPS redirects in development and test
# environments to prevent unexpected 301 responses in automated tests.
# Deployments that need HTTPS enforcement can enable it via environment
# variables without changing code.
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)

if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# CORS settings
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
CORS_ALLOW_CREDENTIALS = True
CORS_PREFLIGHT_MAX_AGE = 86400  # Cache preflight requests for 24 hours

# REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "public_profile": "60/hour",
        "public_projects": "100/hour",
        "authenticated_profile": "300/hour",
        "authenticated_projects": "500/hour",
        "quiz_start": "10/hour",
        "quiz_answer": "100/minute",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

# AI API Keys
OPENAI_API_KEY = config("OPENAI_API_KEY", default="")
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default="")

# GitHub API Token (for project agent)
GITHUB_API_TOKEN = config("GITHUB_API_TOKEN", default="")  # Optional, increases rate limit

# Social OAuth Provider Credentials
# These are for account linking (separate from authentication OAuth)
GITHUB_OAUTH_CLIENT_ID = config("GITHUB_OAUTH_CLIENT_ID", default="")
GITHUB_OAUTH_CLIENT_SECRET = config("GITHUB_OAUTH_CLIENT_SECRET", default="")

GITLAB_OAUTH_CLIENT_ID = config("GITLAB_OAUTH_CLIENT_ID", default="")
GITLAB_OAUTH_CLIENT_SECRET = config("GITLAB_OAUTH_CLIENT_SECRET", default="")

LINKEDIN_OAUTH_CLIENT_ID = config("LINKEDIN_OAUTH_CLIENT_ID", default="")
LINKEDIN_OAUTH_CLIENT_SECRET = config("LINKEDIN_OAUTH_CLIENT_SECRET", default="")

FIGMA_OAUTH_CLIENT_ID = config("FIGMA_OAUTH_CLIENT_ID", default="")
FIGMA_OAUTH_CLIENT_SECRET = config("FIGMA_OAUTH_CLIENT_SECRET", default="")

HUGGINGFACE_OAUTH_CLIENT_ID = config("HUGGINGFACE_OAUTH_CLIENT_ID", default="")
HUGGINGFACE_OAUTH_CLIENT_SECRET = config("HUGGINGFACE_OAUTH_CLIENT_SECRET", default="")

MIDJOURNEY_OAUTH_CLIENT_ID = config("MIDJOURNEY_OAUTH_CLIENT_ID", default="")
MIDJOURNEY_OAUTH_CLIENT_SECRET = config("MIDJOURNEY_OAUTH_CLIENT_SECRET", default="")

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY = config("AZURE_OPENAI_API_KEY", default="")
AZURE_OPENAI_ENDPOINT = config("AZURE_OPENAI_ENDPOINT", default="")
AZURE_OPENAI_API_VERSION = config("AZURE_OPENAI_API_VERSION", default="2024-02-15-preview")
AZURE_OPENAI_DEPLOYMENT_NAME = config("AZURE_OPENAI_DEPLOYMENT_NAME", default="gpt-4")

# Default AI Provider (options: azure, openai, anthropic)
DEFAULT_AI_PROVIDER = config("DEFAULT_AI_PROVIDER", default="azure")

# Celery Configuration
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Redis Configuration for LangChain State
REDIS_URL = config("REDIS_URL", default="redis://redis:6379/1")  # Use DB 1 for LangChain
CHAT_SESSION_TTL = config("CHAT_SESSION_TTL", default=1800, cast=int)  # 30 minutes

# Cache Configuration
# Use Redis for caching (DB 2 for cache)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("CACHE_URL", default="redis://redis:6379/2"),
        "KEY_PREFIX": "allthrive",
        "TIMEOUT": 300,  # 5 minutes default
    }
}

# Cache timeouts for different data types
CACHE_TTL = {
    "PUBLIC_PROFILE": 300,  # 5 minutes
    "PUBLIC_PROJECTS": 180,  # 3 minutes
    "USER_PROJECTS": 60,  # 1 minute for own projects
}

# Logging Configuration
os.makedirs(BASE_DIR / "logs", exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
        "require_debug_true": {
            "()": "django.utils.log.RequireDebugTrue",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": BASE_DIR / "logs" / "django.log",
            "maxBytes": 1024 * 1024 * 15,  # 15MB
            "backupCount": 10,
            "formatter": "verbose",
        },
        "security": {
            "level": "WARNING",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": BASE_DIR / "logs" / "security.log",
            "maxBytes": 1024 * 1024 * 15,
            "backupCount": 10,
            "formatter": "verbose",
        },
        "mail_admins": {
            "level": "ERROR",
            "class": "django.utils.log.AdminEmailHandler",
            "filters": ["require_debug_false"],
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
        "django.security": {
            "handlers": ["security", "mail_admins"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["file", "mail_admins"],
            "level": "ERROR",
            "propagate": False,
        },
        "core": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
        "services": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
}

# MinIO / S3 Configuration
# MINIO_ENDPOINT: Internal Docker network endpoint (backend -> MinIO)
MINIO_ENDPOINT = config("MINIO_ENDPOINT", default="localhost:9000")
# MINIO_ENDPOINT_PUBLIC: Public endpoint for browser access (browser -> MinIO)
MINIO_ENDPOINT_PUBLIC = config("MINIO_ENDPOINT_PUBLIC", default="localhost:9000")
MINIO_ACCESS_KEY = config("MINIO_ACCESS_KEY", default="minioadmin")
MINIO_SECRET_KEY = config("MINIO_SECRET_KEY", default="minioadmin")
MINIO_USE_SSL = config("MINIO_USE_SSL", default=False, cast=bool)
MINIO_BUCKET_NAME = config("MINIO_BUCKET_NAME", default="allthrive-media")

# Media files configuration (uploaded by users)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # Fallback for local development without MinIO

# Custom User Model
AUTH_USER_MODEL = "core.User"

# Django Sites Framework
SITE_ID = 1

# Email Configuration
if not DEBUG:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = config("EMAIL_HOST", default="smtp.sendgrid.net")
    EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
    DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@allthrive.ai")
    ADMINS = [("Admin", config("ADMIN_EMAIL", default="admin@allthrive.ai"))]
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    DEFAULT_FROM_EMAIL = "noreply@allthrive.ai"

# Django Allauth Configuration
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory"  # Changed from 'optional' to 'mandatory'
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_LOGIN_ON_GET = True  # Skip intermediate page and go directly to provider
SOCIALACCOUNT_STORE_TOKENS = False  # Don't store OAuth tokens in DB

# Redirect after OAuth login
LOGIN_REDIRECT_URL = "/api/v1/auth/callback/"
ACCOUNT_LOGOUT_REDIRECT_URL = "/"

# OAuth Provider Settings
# Note: Client ID and Secret are stored in database via SocialApp model
# See: python manage.py setup_github_oauth or Django Admin
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": [
            "profile",
            "email",
        ],
        "AUTH_PARAMS": {
            "access_type": "online",
        },
    },
    "github": {
        "SCOPE": [
            "user",
            "user:email",
        ],
    },
}

# JWT Settings
# Cookie domain for cross-subdomain support
# For localhost:3000 and localhost:8000 to share cookies, use 'localhost'
# For production (e.g., api.example.com and app.example.com), use '.example.com'
COOKIE_DOMAIN = config("COOKIE_DOMAIN", default="localhost")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_SECURE": not DEBUG,
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SAMESITE": "Lax",  # Lax for cross-origin OAuth flows
    "AUTH_COOKIE_PATH": "/",
    "AUTH_COOKIE_DOMAIN": COOKIE_DOMAIN,
}

# Frontend URL for OAuth redirects
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")

# Session settings for first-party cookies
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = "Lax"  # Lax required for OAuth flows
SESSION_COOKIE_DOMAIN = COOKIE_DOMAIN

# CSRF settings
CSRF_COOKIE_HTTPONLY = False  # Must be False so JavaScript can read it
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"  # Lax required for OAuth callbacks
CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN
CSRF_USE_SESSIONS = False  # Use cookie-based CSRF
CSRF_COOKIE_NAME = "csrftoken"
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# Content Security Policy (django-csp 4.0 format)
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": ("'self'",),
        "script-src": ("'self'", "'unsafe-inline'"),  # Minimize unsafe-inline in production
        "style-src": ("'self'", "'unsafe-inline'"),
        "img-src": ("'self'", "data:", "https:"),
        "connect-src": ("'self'",)
        + tuple(
            config(
                "CORS_ALLOWED_ORIGINS",
                default="http://localhost:3000",
                cast=lambda v: [s.strip() for s in v.split(",")],
            )
        ),
        "font-src": ("'self'", "data:"),
        "frame-ancestors": ("'none'",),
        "report-uri": "/api/v1/csp-report/",  # CSP violation reporting
    }
}
