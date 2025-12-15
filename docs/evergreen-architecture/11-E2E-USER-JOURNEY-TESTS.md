# E2E User Journey Tests

**Source of Truth** | **Last Updated**: 2025-12-14

This document describes AllThrive's End-to-End (E2E) Test-Driven Development (TDD) approach for user journey tests. These tests validate complete user workflows from start to finish, ensuring the application works correctly from the user's perspective.

---

## Overview

### Philosophy

User journey tests are **not** unit tests for individual UI components. They are complete workflows that:

1. **Simulate real user behavior** - Click buttons, fill forms, navigate pages
2. **Cross multiple systems** - Frontend, API, WebSocket, database
3. **Validate business outcomes** - User can complete their goal
4. **Serve as TDD drivers** - Written first to fail, then fixed with implementation

### TDD Approach

```
1. Write test describing expected user experience
2. Run test → should FAIL (functionality doesn't exist)
3. Implement the feature
4. Run test → should PASS
5. Commit test and implementation together
```

This ensures tests are meaningful and catch real regressions.

---

## Test Location & Execution

**Location**: `frontend/e2e/*.spec.ts`

**Run Commands**:
```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/prompt-battles.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run critical tests (longer timeout)
RUN_CRITICAL_E2E=true npx playwright test
```

---

## Prompt Battles User Journeys

**File**: `frontend/e2e/prompt-battles.spec.ts`

These tests cover the complete Prompt Battles invite-and-battle flow, including async scenarios where users don't join simultaneously.

### 1. Challenger Creates Invite Link

**Test**: `challenger can generate battle invite link`

**User Journey**:
1. Authenticated user navigates to `/battles`
2. Clicks "Battle a Human" button
3. Clicks "Share a Link" option
4. Sees generated invite URL with token
5. Can copy link to share with friend

**What It Validates**:
- Invite generation API works
- UI correctly displays the shareable link
- Token is properly formatted in URL

---

### 2. Guest Accepts Invite and Joins Battle

**Test**: `guest can accept invite and join battle`

**User Journey**:
1. Guest (unauthenticated) receives invite link
2. Navigates to invite URL
3. Sees invite page with challenger info
4. Clicks "Continue as Guest" button
5. Redirected to battle page (`/battles/{id}`)
6. Can see the challenge text

**What It Validates**:
- Guest can access invite without account
- Invite acceptance flow works
- Guest is properly joined to battle
- Battle page loads correctly

---

### 3. Guest Returns to See Battle Results

**Test**: `guest can return to same invite link and see battle results`

**User Journey**:
1. Guest accepts invite and joins battle
2. Battle completes (both users submit, AI judges)
3. Guest returns to the SAME invite URL
4. Should either:
   - Redirect to battle results page
   - Show "already accepted" with link to results
   - Display results directly

**What It Validates**:
- Invite link remains useful after acceptance
- Guest can find their completed battle
- Results are accessible without account

---

### 4. Async Battle: Guest Joins After Challenger Starts

**Test**: `guest can accept battle after challenger starts their turn (async battle)`

**User Journey**:
1. Challenger creates invite, starts their turn
2. Guest clicks invite link LATER (not immediately)
3. Guest should NOT see error
4. Guest clicks "Continue as Guest"
5. Successfully joins the active battle

**What It Validates**:
- Invites work even after battle is "active"
- No race condition errors
- Async battle flow is supported

**Critical Assertions**:
- No "Battle is no longer pending" error
- Guest can still join active battles

---

### 5. Guest Joins While Challenger's Timer Runs

**Test**: `guest can join while challenger is actively playing`

**User Journey**:
1. Challenger starts turn, timer begins
2. Guest clicks invite link during timer
3. Guest joins successfully
4. Guest sees battle is active
5. Can wait for their turn

**What It Validates**:
- Real-time battle state doesn't block new joins
- WebSocket handles concurrent connections
- UI shows appropriate state for waiting

---

### 6. Full Async Battle Flow (Critical Test)

**Test**: `guest can submit after challenger has already submitted (async battle flow)`

**Execution**: Only runs with `RUN_CRITICAL_E2E=true` (takes ~90 seconds for AI judging)

**User Journey**:
1. Challenger creates invite
2. Challenger starts turn, types prompt, submits
3. Guest joins AFTER challenger submitted
4. Guest should see prompt editor (their turn)
5. Guest types and submits their prompt
6. AI generates images and judges
7. Winner is displayed to both users

**What It Validates**:
- Turn state transfers correctly after submission
- Guest isn't stuck in "waiting" limbo
- Full battle flow completes to winner display
- AI judging works end-to-end

**Critical Assertions**:
- Guest sees textarea (not "waiting for turn")
- No "It's not your turn" error on submit
- Winner displayed within 90 seconds

---

### 7. Timer Starts on User Action

**Test**: `challenged user timer starts only when they click join, not before`

**User Journey**:
1. Challenger creates invite, starts turn
2. Guest clicks invite link
3. Guest clicks "Join" / "Continue as Guest"
4. Guest navigates to battle page
5. Guest sees "Start My Turn" button OR textarea
6. Timer should be at/near full time (3:00)

**What It Validates**:
- Timer doesn't start until user action
- No unfair time penalty for late joins
- User has full time allocation

**Critical Assertions**:
- Timer shows 170+ seconds (near 3:00)
- Guest isn't in "limbo" state
- Can actually type in prompt editor

---

### 8. Simultaneous Play

**Test**: `challenger and challenged user can enter battle at the same time`

**User Journey**:
1. Challenger starts turn, sees prompt editor
2. Guest joins, starts their turn
3. BOTH users can see each other
4. BOTH can type prompts simultaneously
5. BOTH have individual timers

**What It Validates**:
- Real-time presence via WebSocket
- Both users can play concurrently
- No "Waiting for opponent" after join
- Independent timer instances

---

### 9. Battle Completion Visibility

**Test**: `challenger can see when battle completes`

**User Journey**:
1. Challenger creates invite
2. Guest accepts and battle completes
3. Challenger navigates to `/battles`
4. Can see completed battle in list
5. Can view battle results

**What It Validates**:
- Battle state updates propagate
- Challenger notified of completion
- Results accessible to both parties

---

### 10. Expired Invite Link

**Test**: `guest sees expired message when invite link has expired`

**User Journey**:
1. Invite link created (valid for 24 hours)
2. Time passes, link expires
3. Guest clicks expired link
4. Sees "Challenge Expired" heading
5. Sees explanation (24 hours validity)
6. Sees "Start a New Battle" button
7. Sees "Explore All Thrive" option
8. Does NOT see "Continue as Guest" button

**What It Validates**:
- Expiration logic works correctly
- User gets specific error (not generic)
- Actionable next steps provided
- Clear UX for edge case

**Technical Note**: Uses `test-expire-invite` API endpoint (DEBUG mode only) to simulate expiration.

---

### 11. Friend Name on Invite

**Test**: `challenger can add friends name to challenge invite`

**User Journey**:
1. Challenger creates battle invite
2. Navigates to battle page (ChallengeReadyScreen)
3. Sees input field for friend's name
4. Types "Alex Thompson"
5. Starts their turn
6. Friend's name shows in opponent circle
7. Guest joins battle
8. Friend's name STILL shows (not replaced by guest_xxx)
9. Friend's name visible in My Battles tab

**What It Validates**:
- Personalization feature works
- Name persists through battle lifecycle
- Display name takes precedence over username
- Name visible in battle history

---

## Intelligent Chat User Journeys

**File**: `frontend/e2e/intelligent-chat.spec.ts`

The "Real User Workflows" section tests actual user interactions with the AI chat system.

> **Note**: These tests skip in CI (`process.env.CI`) because they require AI API keys.

### 1. YouTube Video Import

**Test**: `should handle YouTube video link and offer to create project`

**User Journey**:
1. User opens chat via +Add Project button
2. Pastes YouTube video URL
3. AI recognizes it's a video
4. AI responds with content analysis
5. May offer to create a project

**What It Validates**:
- URL detection and routing
- YouTube content extraction
- AI contextual response
- No technical error crashes

---

### 2. GitHub Repository Import

**Test**: `should handle GitHub repository link`

**User Journey**:
1. User pastes GitHub repo URL
2. AI recognizes repository content
3. Responds with repo information
4. Doesn't crash or show errors

**What It Validates**:
- GitHub URL handling
- Repository content extraction
- Graceful response

---

### 3. AI Tool Recommendations

**Test**: `should handle general question about AI tools`

**User Journey**:
1. User asks "What AI tools are best for creating images?"
2. AI provides substantive response
3. Mentions relevant tools (Midjourney, DALL-E, etc.)

**What It Validates**:
- Natural language understanding
- Domain knowledge (AI tools)
- Helpful responses

---

### 4. Project Creation from Description

**Test**: `should handle request to create a project from description`

**User Journey**:
1. User describes their AI art project
2. AI offers to help create a project
3. May ask for more details
4. Guides through project creation

**What It Validates**:
- Intent recognition (project creation)
- Conversational flow
- Helpful guidance

---

### 5. Social Media URL Handling

**Test**: `should handle tweet/X link for import`

**User Journey**:
1. User pastes Twitter/X URL
2. AI handles gracefully (may not access content)
3. Doesn't crash or show technical errors

**What It Validates**:
- URL handling for restricted sites
- Graceful degradation
- User-friendly messaging

---

### 6. Figma Integration Flow

**Test**: `should handle Figma link via menu integration`

**User Journey**:
1. User clicks + button in chat
2. Opens "More Integrations" submenu
3. Clicks "Add from Figma"
4. UI prompts for Figma link

**What It Validates**:
- Integration menu structure
- Figma option visibility
- Workflow continuity

---

### 7. Image Generation Request

**Test**: `should handle image generation request`

**User Journey**:
1. User clicks + button
2. Selects "Create Image/Infographic"
3. Types prompt: "A futuristic city with flying cars"
4. AI processes request
5. Image generation initiated

**What It Validates**:
- Image generation trigger
- Prompt handling
- Long-running operation (60s timeout)

---

### 8. Profile Help Request

**Test**: `should handle asking for help creating a profile`

**User Journey**:
1. User asks "How do I make my AllThrive profile stand out?"
2. AI provides personalized advice
3. References user's context (AI art)

**What It Validates**:
- Platform-specific knowledge
- Helpful onboarding guidance
- Contextual responses

---

### 9. LinkedIn URL Import

**Test**: `should handle LinkedIn URL for import`

**User Journey**:
1. User pastes LinkedIn profile URL
2. AI handles gracefully (LinkedIn may block)
3. No technical errors shown

**What It Validates**:
- Restricted URL handling
- Error resilience
- User-friendly fallback

---

## Authentication User Journeys

**File**: `frontend/e2e/login.spec.ts`

### 1. API-Based Authentication

**Test**: `should login via test API and verify authentication`

**User Journey**:
1. E2E helper calls test login API
2. Session cookies set
3. Auth check returns user info
4. Username matches test user

---

### 2. User Menu Visibility

**Test**: `should show user menu when authenticated`

**User Journey**:
1. Authenticated user visits `/explore`
2. User menu button visible
3. Clicking shows dropdown
4. "Sign Out" option available

---

### 3. Protected Page Redirect

**Test**: `should redirect unauthenticated users from protected pages`

**User Journey**:
1. Unauthenticated user visits `/account/settings`
2. Redirected to auth page
3. Or sees login prompt

---

## Side Quests User Journeys

**File**: `frontend/e2e/side-quests.spec.ts`

### 1. Quest Paths Display

**Test**: `should display the side quests page with Quest Paths section`

**User Journey**:
1. User navigates to `/play/side-quests`
2. Sees "Side Quests" heading
3. Sees "Quest Paths" section

---

### 2. Quest Category Expansion

**Test**: `should expand category to show individual quests`

**User Journey**:
1. User clicks on "Community Builder" category
2. Category expands
3. Individual quests with point rewards visible

---

### 3. Daily Quests

**Test**: `should show daily quests like Daily Explorer, Daily Check-In`

**User Journey**:
1. User views Side Quests page
2. Daily quests visible (if available)
3. Point rewards shown

---

## Test Infrastructure

### Helper Functions

**Location**: `frontend/e2e/helpers.ts`

| Function | Purpose |
|----------|---------|
| `loginViaAPI(page)` | Authenticate test user via API |
| `createBattleInviteViaAPI(page)` | Generate battle invite token |
| `startChallengerTurnViaAPI(battleId, page)` | Simulate turn start |
| `expireInviteViaAPI(battleId, page)` | Force-expire invite for testing |
| `completeBattleViaAPI(battleId)` | Simulate battle completion |

### Test-Only API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/battles/{id}/test-expire-invite/` | POST | Expire invitation (DEBUG only) |
| `/api/v1/auth/test-login/` | POST | Authenticate test user |

### Browser Contexts

Tests use separate browser contexts to simulate multi-user scenarios:
- `challengerPage` - Authenticated user who creates battle
- `guestContext` / `guestPage` - Incognito browser for guest user

---

## Running Tests in CI

### GitHub Actions Integration

```yaml
- name: Run E2E Tests
  run: npx playwright test
  env:
    CI: true

- name: Run Critical E2E Tests
  run: npx playwright test
  env:
    CI: true
    RUN_CRITICAL_E2E: true
```

### Tests That Skip in CI

| Test | Reason |
|------|--------|
| AI Workflow tests | Require OpenAI/Anthropic API keys |
| Full async battle flow | Takes 90+ seconds |

---

## Adding New User Journey Tests

### Checklist

1. **Identify the user journey** - What does the user want to accomplish?
2. **Write test first (TDD)** - Test should fail initially
3. **Use real selectors** - `getByRole`, `getByText`, `getByPlaceholder`
4. **Add timeouts for async operations** - WebSocket, API calls
5. **Take screenshots on failure** - `page.screenshot({ path: 'e2e-error.png' })`
6. **Document critical assertions** - Comment what each assertion validates
7. **Consider async scenarios** - Users don't always act simultaneously

### Template

```typescript
test('user can accomplish goal via specific flow', async () => {
  /**
   * SCENARIO: As a [user type], when I [action], I should [expected result]
   *
   * EXPECTED:
   * 1. First expected behavior
   * 2. Second expected behavior
   *
   * FAILURE:
   * - Specific failure mode to watch for
   */

  // === STEP 1: Setup ===
  // ...

  // === STEP 2: User action ===
  // ...

  // === STEP 3: Verify outcome ===
  // CRITICAL ASSERTION: [What this proves]
  expect(result).toBeTruthy();
});
```

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
