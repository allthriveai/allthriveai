# PRD: Sprint 1 - Hide Legacy + Minimal Shell

## Overview
Strip down navigation, create placeholder pages, redirect to new home. This is the foundation for the AI Collective pivot.

## Features

### 1. Hide Legacy Navigation Sections
Remove legacy nav sections from the UI while keeping routes working.

**Requirements:**
- Modify menuData.ts to hide: Discover (Learn, Play, Tools)
- Keep Lounge visible (community chat stays)
- Keep all routes working for direct URLs
- New nav structure: Logo | [Search] [Ava] [User Menu]
- User menu keeps: Profile, Settings, Sign Out

**Test Steps:**
1. Navigate to http://localhost:3000/home
2. Verify top nav only shows: Logo, Search, Ava, User Menu
3. Verify "Discover" dropdown is NOT visible
4. Verify "Learn", "Play", "Tools" are NOT in navigation
5. Verify direct URL http://localhost:3000/learn still works (not 404)
6. Verify direct URL http://localhost:3000/tools still works
7. Verify Lounge/community is still accessible

### 2. Collective Home Page Placeholder
Create new home page at /home with Ava chat sidebar.

**Requirements:**
- Create CollectiveHomePage.tsx at /home route
- Welcome message with tagline: "Share what you offer. Ask for what you need."
- "Coming soon" messaging for features not yet built
- Ava chat sidebar (reuse existing EmbeddedChatLayout pattern)
- Link to complete onboarding if not done
- Show profile completion percentage
- Use Neon Glass design system

**Test Steps:**
1. Log in as test user
2. Navigate to http://localhost:3000/home
3. Verify welcome message displays with tagline
4. Verify Ava chat sidebar is visible and functional
5. Verify "Complete Your Profile" link appears if onboarding incomplete
6. Verify page uses Neon Glass styling (glass-panel classes)
7. Verify no console errors

### 3. Route Configuration Updates
Update routing to support new home and preserve legacy routes.

**Requirements:**
- /home routes to CollectiveHomePage
- Logged-in users landing on / redirect to /home
- All legacy routes (/learn/*, /play/*, /tools/*) still resolve
- /collective route still works (landing page)

**Test Steps:**
1. Log out, navigate to http://localhost:3000/ - should show public landing
2. Log in, navigate to http://localhost:3000/ - should redirect to /home
3. Navigate to http://localhost:3000/home - CollectiveHomePage renders
4. Navigate to http://localhost:3000/learn - page loads (not 404)
5. Navigate to http://localhost:3000/tools - page loads (not 404)
6. Navigate to http://localhost:3000/collective - landing page renders

### 4. Update User Menu Dropdown
Simplify user menu to essentials only.

**Requirements:**
- Show: My Profile, Settings, Sign Out
- Remove: any legacy menu items not needed
- Profile links to /@username
- Settings links to /settings

**Test Steps:**
1. Log in as test user
2. Click user avatar in nav
3. Verify dropdown shows: My Profile, Settings, Sign Out
4. Click My Profile - navigates to /@{username}
5. Click Settings - navigates to /settings
6. Click Sign Out - logs out user
