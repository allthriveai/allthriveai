<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  * IV. Data Privacy & Security - Added explicit user data isolation requirements
- Added principles:
  * VII. Authentication-First Access Control (NEW)
- Templates requiring updates:
  ✅ constitution.md (this file)
  ✅ plan-template.md (needs new authentication principle check)
  ⚠ spec-template.md (will be validated against new principles)
  ⚠ tasks-template.md (will be validated against new principles)
- Rationale for MINOR version bump: New principle added (Authentication-First)
- No deferred placeholders
-->

# AllThrive AI Constitution

## Core Principles

### I. AI-First Development

AllThrive AI MUST prioritize AI integration quality and reliability. All AI-related features MUST:
- Implement proper error handling for AI service failures (OpenAI, Anthropic, LangChain)
- Include retry logic with exponential backoff for API calls
- Log all AI interactions for debugging and monitoring
- Maintain conversation context appropriately
- Handle rate limits and quota exhaustion gracefully

**Rationale**: AI services are external dependencies prone to failures, rate limiting, and latency issues. Robust error handling ensures application stability and user experience.

### II. API-First Design

All features MUST expose functionality through well-documented REST APIs before UI implementation. APIs MUST:
- Follow Django REST Framework conventions
- Include comprehensive documentation (OpenAPI/Swagger)
- Implement proper authentication and authorization
- Return consistent error responses
- Support versioning for breaking changes

**Rationale**: API-first design enables multiple clients (web, mobile, integrations), facilitates testing, and enforces clear separation of concerns.

### III. Test-Driven Development (NON-NEGOTIABLE)

TDD is mandatory for all features. Tests MUST be written before implementation:
- Write failing tests first
- Implement minimum code to pass tests
- Refactor while maintaining green tests
- Achieve >80% code coverage for critical paths
- Include unit, integration, and contract tests

**Rationale**: TDD ensures code quality, prevents regressions, and creates living documentation of system behavior.

### IV. Data Privacy & Security

User data and AI interactions MUST be protected:
- All sensitive data encrypted at rest and in transit
- API keys and credentials stored in environment variables, never in code
- User data isolation enforced from the database layer up (row-level security, filtered querysets)
- Each user's conversations, AI interactions, and personal data MUST be completely isolated
- Database queries MUST always filter by authenticated user (no shared or global data access)
- Audit logging for all data access with user attribution
- GDPR/privacy compliance for data retention and deletion

**Rationale**: AI applications handle sensitive user data and expensive API credentials. Security breaches compromise user trust and incur significant costs. User data isolation prevents data leakage between users and must be architectural from the start, not added later.

### V. Asynchronous Task Processing

Long-running operations MUST use Celery task queue:
- AI API calls that may take >2 seconds
- Batch processing operations
- Scheduled tasks (cleanup, analytics)
- Email notifications
- Report generation

**Rationale**: Synchronous execution of long operations degrades user experience and ties up web workers. Celery with Redis enables scalable background processing.

### VI. Observability & Monitoring

Application behavior MUST be observable:
- Structured logging for all operations (JSON format)
- Error tracking with full context and stack traces
- Performance monitoring (response times, queue depths)
- AI usage tracking (token counts, costs)
- Health check endpoints for all services

**Rationale**: Complex AI applications require comprehensive monitoring to diagnose issues, optimize costs, and ensure system health.

### VII. Authentication-First Access Control (NON-NEGOTIABLE)

All features beyond public pages MUST require authentication:
- **Public pages**: Only homepage and about page are accessible without login
- **Protected features**: All other pages, APIs, and features REQUIRE authenticated users
- Authentication MUST be enforced at multiple layers (middleware, view decorators, API permissions)
- No feature development without authentication implementation
- Unauthenticated requests to protected resources MUST return 401/403 with login redirect
- Session management MUST follow Django security best practices

**Rationale**: Requiring authentication from the start ensures user data isolation is never compromised. Retrofitting authentication after features are built leads to security gaps, data leakage, and architectural debt. Public-by-default is a security anti-pattern for applications handling personal data and AI interactions.

## Technical Standards

### Technology Stack

**Required Stack Components**:
- **Backend**: Django 4.x+, Python 3.10+
- **API**: Django REST Framework
- **Database**: PostgreSQL (production), SQLite (development)
- **Task Queue**: Celery + Redis
- **AI Integration**: OpenAI SDK, Anthropic SDK, LangChain
- **Testing**: pytest, pytest-django

**Constraints**:
- Python code MUST follow PEP 8 style guidelines
- All dependencies MUST be pinned in requirements.txt
- Database migrations MUST be version controlled
- Environment variables MUST use django-environ or similar

### Code Organization

Django applications MUST follow standard structure:
```
project_root/
├── core/              # Core business logic
├── config/            # Django settings
├── requirements.txt   # Dependencies
├── manage.py         # Django management
└── .env.example      # Environment template
```

**Module Guidelines**:
- Separate models, views, serializers, tasks into distinct files
- Keep views thin, business logic in services
- Use Django signals sparingly, prefer explicit calls
- Create custom management commands for administrative tasks

## Development Workflow

### Branch Strategy

- **main**: Production-ready code, protected
- **feature/[###-name]**: Feature development branches
- **hotfix/[###-name]**: Emergency production fixes

### Code Review Requirements

All changes MUST:
- Pass all automated tests (unit, integration, contract)
- Meet code coverage thresholds (>80% for new code)
- Include migration files if models changed
- Update API documentation if endpoints changed
- Be reviewed by at least one team member
- Pass linting and formatting checks

### Testing Requirements

Before merging, verify:
- All tests pass (`python manage.py test`)
- Migrations apply cleanly (`python manage.py migrate`)
- Static files collect without errors
- No security vulnerabilities (`safety check`)
- API documentation is current

## Governance

### Amendment Process

Constitution changes require:
1. Documented rationale for change
2. Impact assessment on existing features
3. Team consensus (minimum 2/3 approval)
4. Version bump following semantic versioning
5. Update of all dependent templates and documentation

### Versioning Policy

Constitution versions follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Backward incompatible principle changes (e.g., removing mandatory testing)
- **MINOR**: New principles or sections added (e.g., adding security requirements)
- **PATCH**: Clarifications, wording improvements, examples added

### Compliance Review

All pull requests MUST verify:
- Adherence to core principles (especially TDD, security)
- Alignment with technical standards
- Proper testing and documentation
- No unaddressed TODOs or security concerns

Complexity violations MUST be explicitly justified in implementation plans using the Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2025-11-10 | **Last Amended**: 2025-11-10
