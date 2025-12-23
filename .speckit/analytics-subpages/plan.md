# Analytics Subpages Implementation Plan

## Current State

The analytics page (`/admin/analytics`) is a single 1334-line file with 8 tab sections:
- Overview
- Users
- Battles (Guest Battles)
- AI Usage
- Content
- Engagement
- Onboarding
- Revenue

All sections load on the same page with client-side tab switching.

## Proposed Architecture

Break into separate URL-routed pages under `/admin/analytics/*`:

```
/admin/analytics           → Overview (default/redirect)
/admin/analytics/users     → Users Dashboard
/admin/analytics/battles   → Guest Battles Dashboard
/admin/analytics/ai        → AI Usage Dashboard
/admin/analytics/content   → Content Dashboard
/admin/analytics/engagement → Engagement Dashboard
/admin/analytics/onboarding → Onboarding Dashboard
/admin/analytics/revenue   → Revenue Dashboard
```

## File Structure

```
frontend/src/
├── pages/admin/analytics/
│   ├── index.tsx              # Redirect to overview
│   ├── OverviewPage.tsx       # Overview dashboard
│   ├── UsersPage.tsx          # Users dashboard
│   ├── BattlesPage.tsx        # Guest battles dashboard
│   ├── AIUsagePage.tsx        # AI cost dashboard
│   ├── ContentPage.tsx        # Content metrics dashboard
│   ├── EngagementPage.tsx     # Engagement dashboard
│   ├── OnboardingPage.tsx     # Onboarding dashboard
│   └── RevenuePage.tsx        # Revenue dashboard (placeholder)
│
├── components/admin/analytics/
│   ├── AnalyticsLayout.tsx    # Wrapper with sub-navigation
│   ├── AnalyticsNav.tsx       # Horizontal subnav tabs
│   ├── KPICard.tsx            # Shared KPI card component
│   ├── MetricCard.tsx         # Shared metric card component
│   ├── ActivityHeatmap.tsx    # Heatmap component
│   ├── RetentionCohortTable.tsx
│   ├── UserJourneyFunnel.tsx
│   └── charts/
│       └── AnalyticsChart.tsx # Shared chart wrapper
│
├── hooks/
│   └── useAnalytics.ts        # Shared analytics data fetching hooks
│
└── types/
    └── analytics.ts           # Shared analytics types
```

## Implementation Steps

### Phase 1: Extract Shared Components (~1 hour)

1. **Create types file** (`types/analytics.ts`)
   - Move all interfaces (OverviewMetrics, UserGrowthMetrics, etc.)

2. **Create shared components** (`components/admin/analytics/`)
   - KPICard
   - MetricCard
   - ActivityHeatmap
   - RetentionCohortTable
   - UserJourneyFunnel

3. **Create analytics hook** (`hooks/useAnalytics.ts`)
   - Centralize API calls with React Query
   - Handle loading/error states

### Phase 2: Create Layout & Navigation (~30 min)

1. **Create AnalyticsLayout.tsx**
   - Wraps all analytics pages
   - Includes persistent time period selector (7/30/90 days)
   - Shows KPI summary cards at top

2. **Create AnalyticsNav.tsx**
   - Horizontal tab navigation for analytics sections
   - Replaces current in-page tab switcher
   - Highlights active section

### Phase 3: Create Individual Pages (~2 hours)

For each section, create a dedicated page:

| Current Tab | New File | Route |
|-------------|----------|-------|
| Overview | OverviewPage.tsx | /admin/analytics |
| Users | UsersPage.tsx | /admin/analytics/users |
| Battles | BattlesPage.tsx | /admin/analytics/battles |
| AI | AIUsagePage.tsx | /admin/analytics/ai |
| Content | ContentPage.tsx | /admin/analytics/content |
| Engagement | EngagementPage.tsx | /admin/analytics/engagement |
| Onboarding | OnboardingPage.tsx | /admin/analytics/onboarding |
| Revenue | RevenuePage.tsx | /admin/analytics/revenue |

### Phase 4: Update Routing (~15 min)

1. **Update routes/index.tsx**
   - Add lazy imports for all analytics pages
   - Add nested routes under `/admin/analytics/*`

2. **Update AdminLayout.tsx**
   - Keep single "Analytics" entry in sidebar
   - Active state works for all `/admin/analytics/*` routes

### Phase 5: Cleanup (~15 min)

1. Delete old `AdminAnalyticsPage.tsx`
2. Update any direct imports

## Navigation Design: Nested Sidebar

Expand Analytics section in AdminLayout sidebar to show sub-items:

```
┌─────────────────────────────────────────────────────┐
│ Admin Sidebar      │ Platform Analytics             │
│ ─────────────────  │                                │
│ ▼ Analytics        │ ┌────────────────────────────┐ │
│    Overview        │ │ Dashboard content here     │ │
│    Users           │ │                            │ │
│    Battles         │ │                            │ │
│    AI Usage        │ │                            │ │
│    Content         │ │                            │ │
│    Engagement      │ │                            │ │
│    Onboarding      │ │                            │ │
│    Revenue         │ │                            │ │
│   Invitations      │ │                            │ │
│   Impersonate      │ └────────────────────────────┘ │
│   ...              │                                │
└─────────────────────────────────────────────────────┘
```

This matches the existing admin navigation pattern and makes all analytics sections easily discoverable.

## Benefits

1. **Better Performance**: Only load data for the current section
2. **Shareable URLs**: Link directly to `/admin/analytics/users`
3. **Maintainability**: ~170 lines per file instead of 1334
4. **Code Splitting**: Lazy load each analytics section
5. **Browser History**: Back/forward navigation works naturally

## Migration Notes

- Keep the same API endpoints (no backend changes)
- Time period selector state persisted via URL params or context
- Overview page shows summary KPIs (existing behavior)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate code in pages | Extract to shared components first |
| State sync across pages | Use URL params for time period |
| Breaking existing bookmarks | `/admin/analytics` redirects to overview |
