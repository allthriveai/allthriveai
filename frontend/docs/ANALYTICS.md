# Analytics Setup Guide

## Overview

All Thrive uses **PostHog** for product analytics and session replay to understand how users interact with the platform.

## Features

- ✅ **Event Tracking** - Track user interactions across the platform
- ✅ **User Identification** - Link events to specific users
- ✅ **Session Replay** - Watch recordings of user sessions (optional)
- ✅ **Feature Flags** - A/B testing and gradual rollouts (future)
- ✅ **Privacy-First** - Respects Do Not Track, GDPR compliant

## Setup Instructions

### 1. Create PostHog Account

1. Go to [PostHog Cloud](https://app.posthog.com/signup)
2. Sign up for a free account (1M events/month free)
3. Create a new project for "All Thrive"

### 2. Get Your API Key

1. In PostHog dashboard, go to **Project Settings**
2. Copy your **Project API Key** (starts with `phc_`)
3. Copy your **API Host** (usually `https://app.posthog.com`)

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# PostHog Analytics
VITE_POSTHOG_KEY=phc_your_project_api_key_here
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 4. Test the Integration

1. Start the development server: `npm run dev`
2. Open the browser console
3. You should see: `PostHog analytics initialized`
4. Navigate around the app - events should appear in PostHog dashboard

## Events Being Tracked

### Authentication
- `login_completed` - User logs in
- `sign_up_started` - User starts signup
- `sign_up_completed` - User completes signup

### Page Views
- `page_view` - Any page navigation
- `about_page_viewed` - About page visit
- `about_panel_opened` - About panel opened
- `pricing_page_viewed` - Pricing page visit

### Pricing & Subscriptions
- `pricing_plan_selected` - User selects a plan
- `checkout_started` - User starts checkout
- `checkout_completed` - User completes payment

### Quests (to be implemented)
- `quest_started` - User starts a quest
- `quest_completed` - User completes a quest
- `quest_tray_opened` - Quest tray opened

### Projects (to be implemented)
- `project_viewed` - User views a project
- `project_created` - User creates a project
- `project_liked` - User likes a project

### Explore Page (to be implemented)
- `explore_filter_changed` - User changes filter
- `explore_sort_changed` - User changes sort
- `explore_search_used` - User searches

## How to Add New Events

### 1. Define the Event in utils/analytics.ts

```typescript
export const analytics = {
  // ... existing events ...

  myNewEvent: (param1: string, param2?: number) => {
    track('my_new_event', {
      param_1: param1,
      param_2: param2,
    });
  },
};
```

### 2. Use the Event in Your Component

```typescript
import { analytics } from '@/utils/analytics';

function MyComponent() {
  const handleClick = () => {
    analytics.myNewEvent('value', 42);
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

## Performance Impact

- **Bundle size**: ~40KB (PostHog JS SDK)
- **Network**: Events are batched and sent asynchronously
- **Loading**: SDK loads **after** page is interactive (no blocking)
- **Impact**: ⭐⭐⭐⭐⭐ Negligible performance impact

## Privacy & GDPR

PostHog is configured with privacy in mind:

- ✅ Respects "Do Not Track" browser setting
- ✅ No analytics if user has DNT enabled
- ✅ Can be disabled entirely by not setting `VITE_POSTHOG_KEY`
- ✅ Only tracks events, not personal data (emails/passwords never sent)
- ✅ User IDs are hashed/anonymized

## Viewing Analytics

1. Go to [PostHog Dashboard](https://app.posthog.com)
2. Navigate to **Insights** to see event data
3. Create custom dashboards for:
   - Daily active users
   - Most popular features
   - Conversion funnels (signup → paid)
   - User journeys

## Session Replay

Session replay is **enabled** by default but can be controlled from PostHog dashboard:

1. Go to **Project Settings → Recordings**
2. Configure which sessions to record:
   - All sessions
   - Only sessions with errors
   - Specific user cohorts
   - None (disable)

## Common Issues

### Analytics not working?

1. Check console for errors
2. Verify `VITE_POSTHOG_KEY` is set correctly
3. Check PostHog dashboard for "Live Events"
4. Disable ad blockers (they may block PostHog)

### Events not showing up?

- Events may take 1-2 minutes to appear in dashboard
- Check "Live Events" tab for real-time view
- Verify event name matches dashboard

### Performance concerns?

- PostHog SDK lazy-loads after page interactive
- Events are batched (not sent individually)
- SDK is <50KB gzipped
- Zero impact on initial page load

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog React Integration](https://posthog.com/docs/libraries/react)
- [Event Naming Best Practices](https://posthog.com/docs/integrate/client/js#event-naming)
