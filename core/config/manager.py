"""
Centralized settings manager for domain-organized configuration access.

This module consolidates the 65+ scattered settings access patterns into
organized, type-safe configuration objects. Benefits:

1. Type safety: IDEs can autocomplete and type-check settings
2. Documentation: Each setting is documented with descriptions
3. Validation: Settings are validated at startup
4. Testability: Easy to mock entire configuration domains
5. Discoverability: All settings for a domain in one place

Example:
    from core.config import settings

    # Instead of:
    from django.conf import settings
    url = getattr(settings, 'WEAVIATE_URL', '')
    timeout = getattr(settings, 'WEAVIATE_TIMEOUT', 30)

    # Use:
    url = settings.weaviate.url
    timeout = settings.weaviate.timeout
"""

import logging
from dataclasses import dataclass
from functools import cached_property, lru_cache

from django.conf import settings as django_settings

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION DATACLASSES
# =============================================================================


@dataclass(frozen=True)
class WeaviateSettings:
    """Weaviate vector database configuration."""

    host: str
    port: int
    url: str
    api_key: str
    embedding_model: str
    batch_size: int
    timeout: int

    # Connection pool settings
    pool_size: int = 5
    pool_timeout: int = 30

    # Circuit breaker settings
    circuit_failure_threshold: int = 5
    circuit_recovery_timeout: int = 60

    @property
    def is_configured(self) -> bool:
        """Check if Weaviate is properly configured."""
        return bool(self.url)

    @classmethod
    def from_django_settings(cls) -> 'WeaviateSettings':
        """Create from Django settings."""
        return cls(
            host=getattr(django_settings, 'WEAVIATE_HOST', 'localhost'),
            port=getattr(django_settings, 'WEAVIATE_PORT', 8080),
            url=getattr(django_settings, 'WEAVIATE_URL', ''),
            api_key=getattr(django_settings, 'WEAVIATE_API_KEY', ''),
            embedding_model=getattr(django_settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small'),
            batch_size=getattr(django_settings, 'WEAVIATE_BATCH_SIZE', 100),
            timeout=getattr(django_settings, 'WEAVIATE_TIMEOUT', 30),
            pool_size=getattr(django_settings, 'WEAVIATE_POOL_SIZE', 5),
            pool_timeout=getattr(django_settings, 'WEAVIATE_POOL_TIMEOUT', 30),
            circuit_failure_threshold=getattr(django_settings, 'WEAVIATE_CIRCUIT_FAILURE_THRESHOLD', 5),
            circuit_recovery_timeout=getattr(django_settings, 'WEAVIATE_CIRCUIT_RECOVERY_TIMEOUT', 60),
        )


@dataclass(frozen=True)
class AIProviderSettings:
    """AI provider configuration (OpenAI, Anthropic, Gemini)."""

    # API Keys
    openai_api_key: str
    anthropic_api_key: str
    google_api_key: str

    # Default provider
    default_provider: str

    # Model names
    gemini_model_name: str

    # Cost tracking
    cost_tracking_enabled: bool
    monthly_spend_limit_usd: float
    user_daily_spend_limit_usd: float

    @property
    def has_openai(self) -> bool:
        """Check if OpenAI is configured."""
        return bool(self.openai_api_key)

    @property
    def has_anthropic(self) -> bool:
        """Check if Anthropic is configured."""
        return bool(self.anthropic_api_key)

    @property
    def has_gemini(self) -> bool:
        """Check if Gemini is configured."""
        return bool(self.google_api_key)

    @classmethod
    def from_django_settings(cls) -> 'AIProviderSettings':
        """Create from Django settings."""
        return cls(
            openai_api_key=getattr(django_settings, 'OPENAI_API_KEY', ''),
            anthropic_api_key=getattr(django_settings, 'ANTHROPIC_API_KEY', ''),
            google_api_key=getattr(django_settings, 'GOOGLE_API_KEY', ''),
            default_provider=getattr(
                django_settings,
                'DEFAULT_AI_PROVIDER',
                django_settings.FALLBACK_AI_PROVIDER,
            ),
            gemini_model_name=getattr(django_settings, 'GEMINI_MODEL_NAME', 'gemini-1.5-flash'),
            cost_tracking_enabled=getattr(django_settings, 'AI_COST_TRACKING_ENABLED', True),
            monthly_spend_limit_usd=getattr(django_settings, 'AI_MONTHLY_SPEND_LIMIT_USD', 1000.0),
            user_daily_spend_limit_usd=getattr(django_settings, 'AI_USER_DAILY_SPEND_LIMIT_USD', 5.0),
        )


@dataclass(frozen=True)
class RedisSettings:
    """Redis configuration for caching, Celery, and Channels."""

    # URLs for different services
    cache_url: str
    celery_broker_url: str
    celery_result_backend: str
    langchain_url: str
    channels_url: str

    # Chat session settings
    chat_session_ttl: int

    @property
    def is_configured(self) -> bool:
        """Check if Redis is properly configured."""
        return bool(self.cache_url)

    @classmethod
    def from_django_settings(cls) -> 'RedisSettings':
        """Create from Django settings."""
        return cls(
            cache_url=getattr(django_settings, 'CACHE_URL', 'redis://localhost:6379/2'),
            celery_broker_url=getattr(django_settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0'),
            celery_result_backend=getattr(django_settings, 'CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'),
            langchain_url=getattr(django_settings, 'REDIS_URL', 'redis://localhost:6379/1'),
            channels_url=getattr(django_settings, 'REDIS_URL', 'redis://localhost:6379/3'),
            chat_session_ttl=getattr(django_settings, 'CHAT_SESSION_TTL', 1800),
        )


@dataclass(frozen=True)
class StorageSettings:
    """MinIO/S3 storage configuration."""

    endpoint: str
    endpoint_public: str
    access_key: str
    secret_key: str
    use_ssl: bool
    bucket_name: str

    @property
    def is_configured(self) -> bool:
        """Check if storage is properly configured."""
        return bool(self.endpoint and self.access_key and self.secret_key)

    @property
    def public_url_base(self) -> str:
        """Get the base URL for public access to files."""
        protocol = 'https' if self.use_ssl else 'http'
        return f'{protocol}://{self.endpoint_public}/{self.bucket_name}'

    @classmethod
    def from_django_settings(cls) -> 'StorageSettings':
        """Create from Django settings."""
        return cls(
            endpoint=getattr(django_settings, 'MINIO_ENDPOINT', 'localhost:9000'),
            endpoint_public=getattr(django_settings, 'MINIO_ENDPOINT_PUBLIC', 'localhost:9000'),
            access_key=getattr(django_settings, 'MINIO_ACCESS_KEY', ''),
            secret_key=getattr(django_settings, 'MINIO_SECRET_KEY', ''),
            use_ssl=getattr(django_settings, 'MINIO_USE_SSL', False),
            bucket_name=getattr(django_settings, 'MINIO_BUCKET_NAME', 'allthrive-media'),
        )


@dataclass(frozen=True)
class OAuthSettings:
    """OAuth provider credentials for account linking."""

    # Google
    google_client_id: str
    google_client_secret: str

    # GitHub
    github_client_id: str
    github_client_secret: str
    github_api_token: str

    # GitLab
    gitlab_client_id: str
    gitlab_client_secret: str

    # LinkedIn
    linkedin_client_id: str
    linkedin_client_secret: str

    # Figma
    figma_client_id: str
    figma_client_secret: str

    # HuggingFace
    huggingface_client_id: str
    huggingface_client_secret: str

    @property
    def has_google(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def has_github(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    @classmethod
    def from_django_settings(cls) -> 'OAuthSettings':
        """Create from Django settings."""
        return cls(
            google_client_id=getattr(django_settings, 'GOOGLE_CLIENT_ID', ''),
            google_client_secret=getattr(django_settings, 'GOOGLE_CLIENT_SECRET', ''),
            github_client_id=getattr(django_settings, 'GITHUB_CLIENT_ID', ''),
            github_client_secret=getattr(django_settings, 'GITHUB_CLIENT_SECRET', ''),
            github_api_token=getattr(django_settings, 'GITHUB_API_TOKEN', ''),
            gitlab_client_id=getattr(django_settings, 'GITLAB_OAUTH_CLIENT_ID', ''),
            gitlab_client_secret=getattr(django_settings, 'GITLAB_OAUTH_CLIENT_SECRET', ''),
            linkedin_client_id=getattr(django_settings, 'LINKEDIN_OAUTH_CLIENT_ID', ''),
            linkedin_client_secret=getattr(django_settings, 'LINKEDIN_OAUTH_CLIENT_SECRET', ''),
            figma_client_id=getattr(django_settings, 'FIGMA_OAUTH_CLIENT_ID', ''),
            figma_client_secret=getattr(django_settings, 'FIGMA_OAUTH_CLIENT_SECRET', ''),
            huggingface_client_id=getattr(django_settings, 'HUGGINGFACE_OAUTH_CLIENT_ID', ''),
            huggingface_client_secret=getattr(django_settings, 'HUGGINGFACE_OAUTH_CLIENT_SECRET', ''),
        )


@dataclass(frozen=True)
class PointsSettings:
    """Gamification points system configuration."""

    # Quiz points
    quiz_completed: int
    quiz_perfect_score: int
    quiz_streak: int

    # Project points
    project_created: int
    project_published: int
    project_milestone: int

    # Engagement points
    daily_login: int
    week_streak: int
    month_streak: int

    # Battle points
    battle_participated: int
    battle_won: int
    battle_completed: int

    # Community points
    profile_completed: int
    referral: int

    # Limits
    max_points_per_award: int
    min_points_per_award: int

    @classmethod
    def from_django_settings(cls) -> 'PointsSettings':
        """Create from Django settings."""
        config = getattr(django_settings, 'POINTS_CONFIG', {})
        return cls(
            quiz_completed=config.get('QUIZ_COMPLETED', 20),
            quiz_perfect_score=config.get('QUIZ_PERFECT_SCORE', 30),
            quiz_streak=config.get('QUIZ_STREAK', 10),
            project_created=config.get('PROJECT_CREATED', 10),
            project_published=config.get('PROJECT_PUBLISHED', 15),
            project_milestone=config.get('PROJECT_MILESTONE', 50),
            daily_login=config.get('DAILY_LOGIN', 5),
            week_streak=config.get('WEEK_STREAK', 25),
            month_streak=config.get('MONTH_STREAK', 100),
            battle_participated=config.get('BATTLE_PARTICIPATED', 25),
            battle_won=config.get('BATTLE_WON', 20),
            battle_completed=config.get('BATTLE_COMPLETED', 10),
            profile_completed=config.get('PROFILE_COMPLETED', 25),
            referral=config.get('REFERRAL', 50),
            max_points_per_award=config.get('MAX_POINTS_PER_AWARD', 10000),
            min_points_per_award=config.get('MIN_POINTS_PER_AWARD', -1000),
        )


@dataclass(frozen=True)
class CacheSettings:
    """Cache TTL configuration."""

    public_profile: int
    public_projects: int
    user_projects: int

    @classmethod
    def from_django_settings(cls) -> 'CacheSettings':
        """Create from Django settings."""
        ttl = getattr(django_settings, 'CACHE_TTL', {})
        return cls(
            public_profile=ttl.get('PUBLIC_PROFILE', 300),
            public_projects=ttl.get('PUBLIC_PROJECTS', 180),
            user_projects=ttl.get('USER_PROJECTS', 60),
        )


@dataclass(frozen=True)
class GitHubRateLimitSettings:
    """GitHub API rate limiting configuration."""

    max_requests_per_hour: int
    max_requests_per_minute: int
    user_max_repo_fetches_per_hour: int
    user_max_imports_per_hour: int
    repo_list_cache_duration: int
    repo_preview_cache_duration: int
    max_retries: int
    retry_backoff: int

    @classmethod
    def from_django_settings(cls) -> 'GitHubRateLimitSettings':
        """Create from Django settings."""
        config = getattr(django_settings, 'GITHUB_RATE_LIMIT', {})
        return cls(
            max_requests_per_hour=config.get('MAX_REQUESTS_PER_HOUR', 4500),
            max_requests_per_minute=config.get('MAX_REQUESTS_PER_MINUTE', 60),
            user_max_repo_fetches_per_hour=config.get('USER_MAX_REPO_FETCHES_PER_HOUR', 50),
            user_max_imports_per_hour=config.get('USER_MAX_IMPORTS_PER_HOUR', 20),
            repo_list_cache_duration=config.get('REPO_LIST_CACHE_DURATION', 300),
            repo_preview_cache_duration=config.get('REPO_PREVIEW_CACHE_DURATION', 600),
            max_retries=config.get('MAX_RETRIES', 3),
            retry_backoff=config.get('RETRY_BACKOFF', 2),
        )


@dataclass(frozen=True)
class PhoenixSettings:
    """Phoenix observability configuration."""

    api_key: str
    project_name: str
    enabled: bool

    @property
    def is_configured(self) -> bool:
        """Check if Phoenix is properly configured."""
        return self.enabled

    @property
    def is_cloud(self) -> bool:
        """Check if using Arize Cloud."""
        return bool(self.api_key)

    @classmethod
    def from_django_settings(cls) -> 'PhoenixSettings':
        """Create from Django settings."""
        return cls(
            api_key=getattr(django_settings, 'PHOENIX_API_KEY', ''),
            project_name=getattr(django_settings, 'PHOENIX_PROJECT_NAME', 'allthrive-ai'),
            enabled=getattr(django_settings, 'PHOENIX_ENABLED', True),
        )


@dataclass(frozen=True)
class FeatureFlags:
    """Feature flags for enabling/disabling functionality."""

    weaviate_enabled: bool
    phoenix_enabled: bool
    cost_tracking_enabled: bool

    @classmethod
    def from_django_settings(cls) -> 'FeatureFlags':
        """Create from Django settings."""
        weaviate_url = getattr(django_settings, 'WEAVIATE_URL', '')
        phoenix_enabled = getattr(django_settings, 'PHOENIX_ENABLED', True)

        return cls(
            weaviate_enabled=bool(weaviate_url),
            phoenix_enabled=phoenix_enabled,
            cost_tracking_enabled=getattr(django_settings, 'AI_COST_TRACKING_ENABLED', True),
        )


# =============================================================================
# MAIN SETTINGS CLASS
# =============================================================================


class AppSettings:
    """
    Centralized application settings manager.

    Provides type-safe, domain-organized access to all application settings.
    Settings are lazily loaded and cached for performance.

    Usage:
        settings = AppSettings()
        url = settings.weaviate.url
        provider = settings.ai.default_provider
    """

    @cached_property
    def weaviate(self) -> WeaviateSettings:
        """Weaviate vector database settings."""
        return WeaviateSettings.from_django_settings()

    @cached_property
    def ai(self) -> AIProviderSettings:
        """AI provider settings (OpenAI, Anthropic, Azure)."""
        return AIProviderSettings.from_django_settings()

    @cached_property
    def redis(self) -> RedisSettings:
        """Redis settings for caching and message queues."""
        return RedisSettings.from_django_settings()

    @cached_property
    def storage(self) -> StorageSettings:
        """MinIO/S3 storage settings."""
        return StorageSettings.from_django_settings()

    @cached_property
    def oauth(self) -> OAuthSettings:
        """OAuth provider credentials."""
        return OAuthSettings.from_django_settings()

    @cached_property
    def points(self) -> PointsSettings:
        """Gamification points system settings."""
        return PointsSettings.from_django_settings()

    @cached_property
    def cache_ttl(self) -> CacheSettings:
        """Cache TTL settings."""
        return CacheSettings.from_django_settings()

    @cached_property
    def github_rate_limit(self) -> GitHubRateLimitSettings:
        """GitHub API rate limiting settings."""
        return GitHubRateLimitSettings.from_django_settings()

    @cached_property
    def phoenix(self) -> PhoenixSettings:
        """Phoenix observability settings."""
        return PhoenixSettings.from_django_settings()

    @cached_property
    def features(self) -> FeatureFlags:
        """Feature flags."""
        return FeatureFlags.from_django_settings()

    # Direct pass-through for commonly accessed Django settings
    @property
    def debug(self) -> bool:
        """Django DEBUG setting."""
        return getattr(django_settings, 'DEBUG', False)

    @property
    def frontend_url(self) -> str:
        """Frontend URL for redirects."""
        return getattr(django_settings, 'FRONTEND_URL', django_settings.FRONTEND_URL_DEFAULT)

    @property
    def backend_url(self) -> str:
        """Backend URL for API calls."""
        return getattr(django_settings, 'BACKEND_URL', django_settings.BACKEND_URL_DEFAULT)

    @property
    def site_url(self) -> str:
        """Site URL for SEO and sitemaps."""
        return getattr(django_settings, 'SITE_URL', self.backend_url)

    def validate(self) -> list[str]:
        """
        Validate all settings and return list of warnings.

        Call this at startup to catch configuration issues early.
        """
        warnings = []

        # Validate Weaviate
        if not self.weaviate.is_configured:
            warnings.append('Weaviate URL not configured - vector search disabled')

        # Validate AI providers
        if not self.ai.has_openai and not self.ai.has_anthropic and not self.ai.has_gemini:
            warnings.append('No AI provider configured - AI features will be disabled')

        # Validate storage
        if not self.storage.is_configured:
            warnings.append('MinIO/S3 not configured - file uploads may fail')

        # Log warnings
        for warning in warnings:
            logger.warning(f'Configuration warning: {warning}')

        return warnings

    def clear_cache(self) -> None:
        """
        Clear all cached settings.

        Useful for testing when settings need to be reloaded.
        In production, settings are cached for the lifetime of the process.
        """
        # Clear cached_property values by deleting them from __dict__
        cached_attrs = [
            'weaviate',
            'ai',
            'redis',
            'storage',
            'oauth',
            'points',
            'cache_ttl',
            'github_rate_limit',
            'phoenix',
            'features',
        ]
        for attr in cached_attrs:
            self.__dict__.pop(attr, None)


# =============================================================================
# SINGLETON ACCESS
# =============================================================================


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """
    Get the singleton AppSettings instance.

    This function is cached to ensure only one instance exists.
    """
    return AppSettings()
