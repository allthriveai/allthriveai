# Evergreen Architecture Documentation

**Purpose**: Long-standing sources of truth for AllThrive AI's core features, architecture, and design decisions.

Unlike time-bound implementation docs (which go in `/docs/archived/`), these documents define **what the application is and should be**. They are:

- ✅ **Stable**: Updated quarterly or when major architectural changes occur
- ✅ **Comprehensive**: Detailed enough for new team members to understand the system
- ✅ **Authoritative**: The single source of truth for product and technical decisions
- ✅ **Version-controlled**: Changes tracked via git history

---

## Document Index

### Core Product Documentation

| Document | Status | Description |
|----------|--------|-------------|
| [01-CORE-FEATURES.md](./01-CORE-FEATURES.md) | ✅ Complete | All major features, user journeys, and success metrics |
| [02-DATA-MODELS.md](./02-DATA-MODELS.md) | ✅ Complete | Core data models, relationships, and schema design |
| [03-API-CONTRACTS.md](./03-API-CONTRACTS.md) | ✅ Complete | REST API endpoints, WebSocket protocols, authentication |

### Technical Architecture

| Document | Status | Description |
|----------|--------|-------------|
| [04-AI-ARCHITECTURE.md](./04-AI-ARCHITECTURE.md) | ✅ Complete | LangGraph agents, LLM integration, prompt engineering |
| [05-SECURITY-AUTH.md](./05-SECURITY-AUTH.md) | ✅ Complete | OAuth flows, JWT, WebSocket auth, CSRF protection |
| [06-INTEGRATION-PATTERNS.md](./06-INTEGRATION-PATTERNS.md) | ✅ Complete | GitHub, YouTube, and third-party integration patterns |

### Infrastructure & Operations

| Document | Status | Description |
|----------|--------|-------------|
| [07-WEBSOCKET-IMPLEMENTATION.md](./07-WEBSOCKET-IMPLEMENTATION.md) | ✅ Complete | WebSocket architecture, auth flow, debugging guide |
| [08-ONBOARDING-ARCHITECTURE.md](./08-ONBOARDING-ARCHITECTURE.md) | ✅ Complete | Auth chat, welcome flow, unified chat onboarding |
| [09-PROMPT-BATTLES.md](./09-PROMPT-BATTLES.md) | ✅ Complete | Prompt Battles system, challenge templates, AI judging |
| 10-INFRASTRUCTURE.md | 📝 Planned | Docker setup, Redis, Celery, PostgreSQL, MinIO |
| 11-FRONTEND-ARCHITECTURE.md | 📝 Planned | React/TypeScript patterns, state management, routing |
| 12-TESTING-STRATEGY.md | 📝 Planned | Test pyramid, coverage requirements, E2E approach |

### Design & UX

| Document | Status | Description |
|----------|--------|-------------|
| 13-DESIGN-SYSTEM.md | 📝 Planned | Color palette, typography, components, patterns |
| 14-UX-PRINCIPLES.md | 📝 Planned | Interaction patterns, accessibility, mobile-first |

---

## When to Update

Update evergreen docs when:

1. **Major Feature Addition**: New core feature launched
2. **Architectural Change**: Significant technical architecture shifts
3. **API Breaking Change**: Public API contract changes
4. **Security Update**: New authentication/authorization patterns
5. **Design System Evolution**: Major UI/UX direction changes

Do NOT update for:
- ❌ Bug fixes
- ❌ Minor feature tweaks
- ❌ Implementation details (those go in `/docs/archived/`)
- ❌ Temporary experiments

---

## Document Structure

Each document should follow this structure:

```markdown
# Document Title

**Source of Truth** | **Last Updated**: YYYY-MM-DD

Brief introduction explaining scope and purpose.

---

## Section 1

Content...

---

## Section 2

Content...

---

**Version**: X.Y
**Status**: [Draft | Stable | Deprecated]
**Review Cadence**: [Quarterly | Annually]
```

---

## Contribution Guidelines

### Proposing Changes

1. Create a branch: `git checkout -b docs/update-evergreen-{topic}`
2. Update the relevant document
3. Include rationale in commit message
4. Open PR with "evergreen" label
5. Require review from 2+ team members

### Version Numbers

- **X.0**: Major architectural changes
- **X.Y**: Minor updates, clarifications
- Increment version number in footer when updating

### Review Process

- Quarterly review cycle
- All team members review annually
- New hires read all docs during onboarding

---

## Related Documentation

- **`/docs/archived/`**: Time-bound implementation docs, code reviews, fix summaries
- **`/docs/plans/`**: Future roadmap and planning documents
- **`README.md`**: Quick start and development setup
- **`WARP.md`**: AI assistant guidelines for this project

---

## Philosophy

> **Evergreen documentation grows with the product, not around it.**

These docs answer:
- **WHAT** the system does (features)
- **WHY** architectural decisions were made (rationale)
- **HOW** components interact (architecture)

They do NOT answer:
- How to fix specific bugs (see git history)
- Implementation minutiae (see code comments)
- Temporary workarounds (see `/docs/archived/`)

---

**Maintained by**: Engineering Team  
**Review Cycle**: Quarterly  
**Last Review**: 2025-12-01
