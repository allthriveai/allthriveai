# Tasks: React TypeScript Frontend Skeleton

**Input**: Design documents from `/specs/001-react-typescript-frontend/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.yaml

**Tests**: TDD approach - tests written before implementation per constitution requirements

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/`, `frontend/tests/`
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create frontend directory at repository root
- [ ] T002 Initialize Vite + React + TypeScript project in frontend/ using `npm create vite@latest`
- [ ] T003 [P] Install core dependencies: react-router-dom@6, axios, @tanstack/react-query
- [ ] T004 [P] Install Tailwind CSS dependencies: tailwindcss, postcss, autoprefixer
- [ ] T005 [P] Install development dependencies: vitest, @testing-library/react, @testing-library/jest-dom, @playwright/test
- [ ] T006 Configure Tailwind CSS: run `npx tailwindcss init -p` and update tailwind.config.js with content paths
- [ ] T007 Create frontend/src/index.css with Tailwind directives (@tailwind base, components, utilities)
- [ ] T008 [P] Configure TypeScript (tsconfig.json) with strict mode and path aliases (@/ for src/)
- [ ] T009 [P] Configure Vite (vite.config.ts) with proxy to Django backend and path aliases
- [ ] T010 [P] Configure Vitest (vitest.config.ts) for React Testing Library
- [ ] T011 Create project directory structure (components/, pages/, services/, hooks/, context/, types/, utils/, routes/)
- [ ] T012 [P] Create environment configuration file frontend/.env with VITE_API_BASE_URL
- [ ] T013 [P] Update frontend/package.json with proper scripts (dev, build, test, lint)
- [ ] T014 [P] Configure ESLint and Prettier for code quality

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T015 Create TypeScript type definitions in frontend/src/types/models.ts (User, AuthState, LoginCredentials)
- [ ] T016 [P] Create API response types in frontend/src/types/api.ts (ApiResponse, ApiError)
- [ ] T017 [P] Create route configuration types in frontend/src/types/routes.ts (RouteConfig)
- [ ] T018 Create Axios instance with base configuration in frontend/src/services/api.ts
- [ ] T019 Add request interceptor for auth tokens in frontend/src/services/api.ts
- [ ] T020 Add response interceptor for error handling in frontend/src/services/api.ts
- [ ] T021 Create AuthContext with React Context API in frontend/src/context/AuthContext.tsx
- [ ] T022 Create useAuth custom hook in frontend/src/hooks/useAuth.ts
- [ ] T023 Create authentication service in frontend/src/services/auth.ts (login, logout, getCurrentUser)
- [ ] T024 [P] Create storage utilities in frontend/src/utils/storage.ts
- [ ] T025 [P] Create input validators in frontend/src/utils/validators.ts
- [ ] T026 Create ProtectedRoute component in frontend/src/routes/ProtectedRoute.tsx
- [ ] T027 Create route configuration in frontend/src/routes/index.tsx
- [ ] T028 Create App.tsx with Router and AuthContext provider
- [ ] T029 Update main.tsx to render App with React Query provider and Tailwind CSS import
- [ ] T030 [P] Create ErrorBoundary component in frontend/src/components/common/ErrorBoundary.tsx
- [ ] T031 [P] Create Loading component with Tailwind styling in frontend/src/components/common/Loading.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Public Homepage (Priority: P1) 🎯 MVP

**Goal**: Visitors can access homepage without authentication, see branding and navigation

**Independent Test**: Navigate to / and verify homepage renders with AllThrive AI branding, Sign Up and Login buttons visible

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T032 [P] [US1] Unit test for HomePage component in frontend/tests/unit/pages/HomePage.test.tsx
- [ ] T033 [P] [US1] Unit test for Header component in frontend/tests/unit/components/layout/Header.test.tsx
- [ ] T034 [P] [US1] Integration test for homepage route access in frontend/tests/integration/publicRoutes.test.tsx

### Implementation for User Story 1

- [ ] T035 [P] [US1] Create Header component with navigation in frontend/src/components/layout/Header.tsx (styled with Tailwind)
- [ ] T036 [P] [US1] Create Footer component in frontend/src/components/layout/Footer.tsx (styled with Tailwind)
- [ ] T037 [P] [US1] Create Button component in frontend/src/components/common/Button.tsx (styled with Tailwind)
- [ ] T038 [US1] Create HomePage component in frontend/src/pages/HomePage.tsx (styled with Tailwind)
- [ ] T039 [US1] Add homepage route (/) to frontend/src/routes/index.tsx (requiresAuth: false)
- [ ] T040 [US1] Verify tests pass and homepage renders correctly

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - View Public About Page (Priority: P1)

**Goal**: Visitors can access about page without authentication, learn about AllThrive AI

**Independent Test**: Navigate to /about and verify about page renders with platform information

### Tests for User Story 2

- [ ] T041 [P] [US2] Unit test for AboutPage component in frontend/tests/unit/pages/AboutPage.test.tsx
- [ ] T042 [P] [US2] Integration test verifying about page is publicly accessible in frontend/tests/integration/publicRoutes.test.tsx

### Implementation for User Story 2

- [ ] T043 [US2] Create AboutPage component in frontend/src/pages/AboutPage.tsx (styled with Tailwind)
- [ ] T044 [US2] Add about route (/about) to frontend/src/routes/index.tsx (requiresAuth: false)
- [ ] T045 [US2] Update Header navigation to include link to About page
- [ ] T046 [US2] Verify tests pass and about page renders correctly

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Redirected to Login for Protected Pages (Priority: P1)

**Goal**: Unauthenticated users attempting protected routes are redirected to login

**Independent Test**: Attempt to navigate to /dashboard without authentication, verify redirect to /login with returnUrl

### Tests for User Story 3

- [ ] T047 [P] [US3] Unit test for ProtectedRoute component in frontend/tests/unit/routes/ProtectedRoute.test.tsx
- [ ] T048 [P] [US3] Integration test for authentication redirect flow in frontend/tests/integration/authRedirect.test.tsx
- [ ] T049 [P] [US3] Unit test for LoginPage component in frontend/tests/unit/pages/LoginPage.test.tsx

### Implementation for User Story 3

- [ ] T050 [P] [US3] Create Input component in frontend/src/components/common/Input.tsx (styled with Tailwind)
- [ ] T051 [P] [US3] Create LoginForm component in frontend/src/components/auth/LoginForm.tsx (styled with Tailwind)
- [ ] T052 [US3] Create LoginPage component in frontend/src/pages/LoginPage.tsx (styled with Tailwind)
- [ ] T053 [US3] Add login route (/login) to frontend/src/routes/index.tsx (requiresAuth: false, redirectIfAuthenticated: true)
- [ ] T054 [US3] Implement redirect logic in ProtectedRoute component (store returnUrl, redirect to /login)
- [ ] T055 [US3] Verify tests pass and unauthenticated access redirects correctly

**Checkpoint**: All P1 user stories complete - authentication enforcement working

---

## Phase 6: User Story 4 - View Protected Dashboard After Login (Priority: P2)

**Goal**: Authenticated users can access dashboard with personalized, isolated data

**Independent Test**: Login with valid credentials, verify redirect to /dashboard showing only user's data

### Tests for User Story 4

- [ ] T056 [P] [US4] Unit test for DashboardPage component in frontend/tests/unit/pages/DashboardPage.test.tsx
- [ ] T057 [P] [US4] Integration test for login flow → dashboard access in frontend/tests/integration/authFlow.test.tsx
- [ ] T058 [P] [US4] Contract test for login API endpoint in frontend/tests/integration/api/auth.test.tsx

### Implementation for User Story 4

- [ ] T059 [US4] Create DashboardPage component in frontend/src/pages/DashboardPage.tsx (styled with Tailwind)
- [ ] T060 [US4] Add dashboard route (/dashboard) to frontend/src/routes/index.tsx (requiresAuth: true)
- [ ] T061 [US4] Implement login form submission logic with API call
- [ ] T062 [US4] Implement post-login redirect to returnUrl or /dashboard
- [ ] T063 [US4] Add logout functionality to Header navigation
- [ ] T064 [US4] Verify tests pass and authenticated access works with user isolation

**Checkpoint**: Authentication flow complete, user data isolation enforced

---

## Phase 7: User Story 5 - Responsive Design Across Devices (Priority: P2)

**Goal**: Application works on mobile (320px+), tablet (768px+), desktop (1024px+) viewports

**Independent Test**: Access all pages at different viewport sizes, verify Tailwind responsive classes work

### Tests for User Story 5

- [ ] T065 [P] [US5] Responsive design test for HomePage in frontend/tests/unit/pages/HomePage.responsive.test.tsx
- [ ] T066 [P] [US5] Responsive design test for DashboardPage in frontend/tests/unit/pages/DashboardPage.responsive.test.tsx
- [ ] T067 [P] [US5] E2E test for mobile viewport navigation in frontend/tests/e2e/responsive.spec.ts

### Implementation for User Story 5

- [ ] T068 [P] [US5] Add Tailwind responsive classes to Header component (mobile menu, breakpoints)
- [ ] T069 [P] [US5] Add Tailwind responsive classes to HomePage layout (sm:, md:, lg: breakpoints)
- [ ] T070 [P] [US5] Add Tailwind responsive classes to AboutPage layout
- [ ] T071 [P] [US5] Add Tailwind responsive classes to LoginPage layout
- [ ] T072 [P] [US5] Add Tailwind responsive classes to DashboardPage layout
- [ ] T073 [P] [US5] Update Button component with responsive sizing
- [ ] T074 [P] [US5] Update Input component with responsive sizing
- [ ] T075 [US5] Verify tests pass and all pages are responsive

**Checkpoint**: All user stories complete, responsive design working

---

## Phase 8: 404 Page and Error Handling

**Purpose**: Handle edge cases and error scenarios

- [ ] T076 [P] Create NotFoundPage component in frontend/src/pages/NotFoundPage.tsx (styled with Tailwind)
- [ ] T077 Add 404 catch-all route (*) to frontend/src/routes/index.tsx
- [ ] T078 [P] Add error handling for API failures in services
- [ ] T079 [P] Add loading states to all async operations
- [ ] T080 Test 404 page and error scenarios

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T081 [P] Create frontend/README.md with setup instructions
- [ ] T082 [P] Add Tailwind custom theme configuration (brand colors, fonts) in tailwind.config.js
- [ ] T083 [P] Optimize Tailwind build for production (PurgeCSS configuration)
- [ ] T084 Code cleanup and refactoring for DRY principles
- [ ] T085 [P] Add accessibility attributes (ARIA labels, keyboard navigation)
- [ ] T086 [P] Performance optimization (code splitting, lazy loading)
- [ ] T087 Run full test suite and ensure >80% coverage
- [ ] T088 Run E2E tests with Playwright against Django backend
- [ ] T089 Validate against quickstart.md setup instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1, US2, US3 (P1 priority): Can proceed in parallel after foundation
  - US4 (P2): Depends on US3 (login must exist), can run in parallel with US5
  - US5 (P2): Can start after any page exists, enhances all pages
- **404 Page (Phase 8)**: Can run in parallel with any user story
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories (homepage standalone)
- **User Story 2 (P1)**: No dependencies on other stories (about page standalone)
- **User Story 3 (P1)**: No dependencies on other stories (login page and redirect logic)
- **User Story 4 (P2)**: Depends on US3 (login must exist for authentication flow)
- **User Story 5 (P2)**: Depends on any page existing (enhances existing pages)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Components before pages
- Pages before routes
- Routes before integration testing
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T005, T008-T010, T012-T014)
- All Foundational tasks marked [P] can run in parallel within groups
- US1, US2, US3 can start in parallel after Foundational phase
- All tests for a user story marked [P] can be written in parallel
- Components within a story marked [P] can be built in parallel
- US5 tasks (responsive design) can all run in parallel once pages exist

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T032: Unit test for HomePage component
Task T033: Unit test for Header component
Task T034: Integration test for homepage route

# Launch all components for User Story 1 together:
Task T035: Create Header component
Task T036: Create Footer component
Task T037: Create Button component
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

1. Complete Phase 1: Setup (T001-T014) - **Tailwind CSS configured**
2. Complete Phase 2: Foundational (T015-T031) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T032-T040) - Homepage with Tailwind styling
4. Complete Phase 4: User Story 2 (T041-T046) - About page with Tailwind styling
5. Complete Phase 5: User Story 3 (T047-T055) - Login and auth redirect
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo (fully responsive)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Then:
   - Developer A: User Story 4
   - Developer B: User Story 5
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **Tailwind CSS**: Used throughout for all styling (T006-T007 setup, then applied in all component/page tasks)
- Verify tests fail before implementing (TDD per constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
