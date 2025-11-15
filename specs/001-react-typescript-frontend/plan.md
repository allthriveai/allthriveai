# Implementation Plan: React TypeScript Frontend Skeleton

**Branch**: `001-react-typescript-frontend` | **Date**: 2025-11-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-react-typescript-frontend/spec.md`

## Summary

Create a React TypeScript frontend skeleton that integrates with the Django backend, enforcing authentication requirements per the AllThrive AI Constitution. The frontend will provide public access to homepage and about pages, while requiring authentication for all other features. User data isolation will be enforced from the frontend through backend API calls.

## Technical Context

**Language/Version**: TypeScript 5.x+, JavaScript ES2022+
**Primary Dependencies**: React 18.x+, React Router 6.x+, Axios/Fetch API, TanStack Query (React Query)
**Storage**: Browser localStorage/sessionStorage for auth tokens (or httpOnly cookies), no direct database access
**Testing**: Vitest, React Testing Library, Playwright (E2E)
**Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
**Project Type**: Web application (frontend only, communicates with existing Django backend)
**Performance Goals**: <2s initial page load, <1s route transitions, <300ms UI feedback
**Constraints**: Must work on mobile (320px+), tablet (768px+), desktop (1024px+); Must integrate with Django CORS; Authentication-first architecture
**Scale/Scope**: Single-page application with 5 initial routes (home, about, login, dashboard, 404)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with AllThrive AI Constitution principles:

- [x] **AI-First Development**: N/A for frontend skeleton (no AI features in this phase)
- [x] **API-First Design**: Consumes Django REST APIs, frontend follows API contracts
- [ ] **Test-Driven Development**: Tests written before implementation (NON-NEGOTIABLE) - Will be addressed in implementation
- [x] **Data Privacy & Security**: Auth tokens secured, no credentials in code, user data isolation enforced via API
- [ ] **Asynchronous Task Processing**: N/A for frontend (handled by Django backend)
- [x] **Observability & Monitoring**: Error boundary for React errors, API error logging, loading states
- [x] **Authentication-First Access Control**: Login required for all features except homepage/about (NON-NEGOTIABLE) - Core feature

**Complexity Justifications**: None - all constitution principles align with this feature

## Project Structure

### Documentation (this feature)

```text
specs/001-react-typescript-frontend/
├── plan.md              # This file
├── research.md          # Phase 0 output - build tool, state management, routing decisions
├── data-model.md        # Phase 1 output - frontend state models
├── quickstart.md        # Phase 1 output - developer setup guide
└── contracts/           # Phase 1 output - API interface contracts
    └── auth-api.yaml    # Authentication endpoints contract
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── common/      # Shared components (Button, Input, etc.)
│   │   ├── layout/      # Layout components (Header, Footer, Nav)
│   │   └── auth/        # Auth-specific components (LoginForm, etc.)
│   ├── pages/           # Page components
│   │   ├── HomePage.tsx
│   │   ├── AboutPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/        # API client services
│   │   ├── api.ts       # Axios/fetch wrapper with auth
│   │   └── auth.ts      # Authentication service
│   ├── hooks/           # Custom React hooks
│   │   ├── useAuth.ts   # Authentication hook
│   │   └── useApi.ts    # API call hook
│   ├── context/         # React context providers
│   │   └── AuthContext.tsx  # Auth state management
│   ├── types/           # TypeScript type definitions
│   │   ├── api.ts       # API response types
│   │   └── models.ts    # Data model types
│   ├── utils/           # Utility functions
│   │   ├── storage.ts   # LocalStorage helpers
│   │   └── validators.ts # Input validation
│   ├── routes/          # Route configuration
│   │   ├── index.tsx    # Route definitions
│   │   └── ProtectedRoute.tsx # Auth guard component
│   ├── App.tsx          # Root component
│   ├── main.tsx         # Entry point
│   └── vite-env.d.ts    # Vite type definitions
├── tests/
│   ├── unit/            # Unit tests for components, hooks, utils
│   ├── integration/     # Integration tests for page flows
│   └── e2e/             # End-to-end tests with Playwright
├── public/              # Static assets
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies
└── README.md            # Frontend documentation
```

**Structure Decision**: Web application structure with frontend/ directory at repository root. This separates frontend code from Django backend while maintaining a monorepo structure. Uses Vite for fast development and optimal production builds.

## Complexity Tracking

No complexity violations - this feature aligns with all constitution principles.

## Phase 0: Research & Technical Decisions

*See [research.md](./research.md) for detailed analysis*

### Key Technical Decisions

1. **Build Tool**: NEEDS CLARIFICATION - Vite vs Create React App vs Next.js
2. **State Management**: NEEDS CLARIFICATION - Context API vs Zustand vs Redux Toolkit
3. **API Client**: NEEDS CLARIFICATION - Axios vs native Fetch with TanStack Query
4. **Styling**: NEEDS CLARIFICATION - Tailwind CSS vs CSS Modules vs styled-components
5. **Authentication Strategy**: NEEDS CLARIFICATION - JWT in localStorage vs httpOnly cookies vs session storage

### Research Tasks

- Research modern React build tools (Vite, CRA, Next.js) and their integration with Django backends
- Investigate state management patterns for authentication and user data
- Evaluate API client libraries and their error handling capabilities
- Research CSS frameworks compatible with TypeScript React
- Determine best practices for token storage and CSRF protection with Django

## Phase 1: Design & Contracts

*Outputs: data-model.md, contracts/auth-api.yaml, quickstart.md*

### Data Models

*See [data-model.md](./data-model.md) for complete definitions*

**User State Model**:
- User info (id, email, name)
- Authentication status
- Auth token

**Navigation State Model**:
- Current route
- Authentication requirement
- Redirect paths

**API Response Models**:
- Standard response envelope
- Error response format
- Loading/success/error states

### API Contracts

*See [contracts/](./contracts/) for OpenAPI specifications*

**Authentication Endpoints** (from Django backend):
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- GET /api/auth/me - Get current user
- POST /api/auth/refresh - Refresh token

### Developer Quickstart

*See [quickstart.md](./quickstart.md) for setup instructions*

**Prerequisites**:
- Node.js 18+ and npm/yarn/pnpm
- Django backend running on localhost:8000
- Backend CORS configured for frontend origin

**Setup Steps**:
1. Install dependencies
2. Configure environment variables (.env)
3. Start development server
4. Run tests

## Implementation Notes

### Authentication Flow

1. User visits site → checks auth status
2. If unauthenticated and accessing protected route → redirect to /login
3. User submits credentials → POST to Django /api/auth/login
4. Backend returns auth token → store securely
5. Subsequent API calls include auth token
6. Token expired → redirect to login with return URL

### Route Protection

- Public routes: `/`, `/about`
- Auth routes: `/login` (redirect if already authenticated)
- Protected routes: `/dashboard`, all others
- 404 route: `/404` or catch-all `*`

### User Isolation

- All API calls include user auth token
- Backend filters data by authenticated user
- Frontend never sees other users' data
- No client-side data caching that could leak between users

## Next Steps

After completing Phase 1 design artifacts:
1. Run `/speckit.tasks` to generate implementation tasks
2. Review tasks for TDD compliance (tests first)
3. Begin implementation following task order
