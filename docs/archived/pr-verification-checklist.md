# PR Verification Checklist - new-onboarding-and-feelings-not-features

## Pre-Merge Manual Verification Checklist

---

## NEW FEATURES IN THIS PR

| Feature | Location | Description |
|---------|----------|-------------|
| **Feeling Pills** | `/home` page | 11 emotion-based quick action buttons |
| **GamePicker** | `/home` when "Play a game" clicked | Visual game selection UI |
| **Inline Games** | Chat messages | Snake, Trivia, Ethics Defender, Prompt Battle |
| **Learning Content Cards** | Chat messages | Horizontal scroll carousel of content |

---

## 0. AUTOMATED TESTS (Run First!)

### Commands to Run

```bash
# Frontend E2E - UI Only (Fast)
cd frontend && npx playwright test e2e/ember-chat/home-flows.spec.ts -g "UI Behavior"

# Frontend E2E - With AI (Slower)
cd frontend && RUN_AI_TESTS=true npx playwright test e2e/ember-chat/home-flows.spec.ts

# Backend Tests
make test-backend
```

| ✓ | Test Suite | Command | Status |
|---|------------|---------|--------|
| [ ] | E2E UI Tests | `npx playwright test -g "UI Behavior"` | |
| [ ] | E2E AI Tests | `RUN_AI_TESTS=true npx playwright test` | |
| [ ] | Backend Tests | `make test-backend` | |
| [ ] | Learning Paths | `docker compose exec web python manage.py test core.learning_paths` | |
| [ ] | Weaviate | `docker compose exec web python manage.py test services.weaviate` | |

---

## 1. EMBER CHAT - /home Page Flows

### 1.1 Greeting & Typewriter Animation

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Time-of-day greeting appears ("Good morning/afternoon/evening") | [ ] | [ ] | |
| [ ] | User's first name in greeting (or "there" for guests) | [ ] | [ ] | |
| [ ] | Typewriter animation plays character-by-character | [ ] | [ ] | |
| [ ] | Cursor disappears after animation completes | [ ] | [ ] | |
| [ ] | Animation skips if page has existing messages | [ ] | [ ] | |

### 1.2 Feeling Pills

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Pills appear ~300ms after greeting completes | [ ] | [ ] | |
| [ ] | Maximum 4 pills visible at once | [ ] | [ ] | |
| [ ] | Pills filtered by user's `excitedFeatures` | [ ] | [ ] | |
| [ ] | Pills shuffle/rotate on each visit | [ ] | [ ] | |
| [ ] | "Make my avatar" ONLY shows when user has NO avatar | [ ] | [ ] | |
| [ ] | "Personalize my experience" hidden after onboarding | [ ] | [ ] | |
| [ ] | Pills disappear after first message sent | [ ] | [ ] | |
| [ ] | Pills reappear after `/clear` command | [ ] | [ ] | |

### 1.3 Feeling Pill Actions

| ✓ | Pill Label | Expected Action | Dark | Light | Notes |
|---|------------|-----------------|------|-------|-------|
| [ ] | "Share something I've been working on" | Sends portfolio message | [ ] | [ ] | |
| [ ] | "Play a game" | Shows GamePicker (NOT message) | [ ] | [ ] | |
| [ ] | "See this week's challenge" | Sends challenge message | [ ] | [ ] | |
| [ ] | "Learn something new" | Sends learning message | [ ] | [ ] | |
| [ ] | "Sell a product or service" | Sends marketplace message | [ ] | [ ] | |
| [ ] | "Explore what others are making" | Sends explore message | [ ] | [ ] | |
| [ ] | "Connect with others" | Sends community message | [ ] | [ ] | |
| [ ] | "Personalize my experience" | Sends personalization message | [ ] | [ ] | |
| [ ] | "What's trending today?" | Sends trending message | [ ] | [ ] | |
| [ ] | "Give me a quick win" | Sends quick win message | [ ] | [ ] | |
| [ ] | "Make my avatar" | Triggers avatar creation | [ ] | [ ] | |

### 1.4 GamePicker

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | GamePicker appears when "Play a game" clicked | [ ] | [ ] | |
| [ ] | Shows all 4 games with promo images | [ ] | [ ] | |
| [ ] | Glassmorphism footer shows name + tagline | [ ] | [ ] | |
| [ ] | Close (X) button hides GamePicker | [ ] | [ ] | |
| [ ] | Clicking game card sends launch message | [ ] | [ ] | |
| [ ] | Framer Motion staggered animations work | [ ] | [ ] | |

### 1.5 Inline Games

| ✓ | Game | Loads | Controls | Score | Play Again | Try Another | Dark | Light |
|---|------|-------|----------|-------|------------|-------------|------|-------|
| [ ] | Context Snake | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | AI Trivia (QuickQuiz) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | Ethics Defender | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| [ ] | Prompt Battle | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Confetti celebration for high scores | |
| [ ] | Error boundary catches game crashes | |

### 1.6 Chat Input & Messaging

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Chat input shows "Message Ember..." placeholder | [ ] | [ ] | |
| [ ] | Enter key sends message | [ ] | [ ] | |
| [ ] | Message appears immediately (optimistic) | [ ] | [ ] | |
| [ ] | 10,000 character limit enforced | [ ] | [ ] | |
| [ ] | `/clear` clears conversation and resets state | [ ] | [ ] | |
| [ ] | Plus (+) menu opens with integrations | [ ] | [ ] | |

### 1.7 Plus Menu Integrations

| ✓ | Integration | Visible | Clickable | Dark | Light |
|---|-------------|---------|-----------|------|-------|
| [ ] | GitHub | [ ] | [ ] | [ ] | [ ] |
| [ ] | GitLab | [ ] | [ ] | [ ] | [ ] |
| [ ] | Figma | [ ] | [ ] | [ ] | [ ] |
| [ ] | YouTube import | [ ] | [ ] | [ ] | [ ] |
| [ ] | URL import | [ ] | [ ] | [ ] | [ ] |
| [ ] | Create a visual | [ ] | [ ] | [ ] | [ ] |

### 1.8 File Upload

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Dragging file shows orange overlay | |
| [ ] | Dropping file uploads successfully | |
| [ ] | Multiple files supported | |
| [ ] | Upload progress indicator shows | |
| [ ] | Images display inline | |
| [ ] | Documents linked with filename | |

### 1.9 Message Rendering

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | User messages right-aligned with avatar | [ ] | [ ] | |
| [ ] | Ember messages left-aligned with dragon | [ ] | [ ] | |
| [ ] | Streaming text renders progressively | [ ] | [ ] | |
| [ ] | Markdown formatting works | [ ] | [ ] | |
| [ ] | Images display correctly | [ ] | [ ] | |
| [ ] | Loading message shows during processing | [ ] | [ ] | |

---

## 2. EMBER CHAT - Right Sidebar

### 2.1 Sidebar Open/Close

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Sidebar slides in from right | [ ] | [ ] | |
| [ ] | Backdrop blur appears | [ ] | [ ] | |
| [ ] | Close (X) button works | [ ] | [ ] | |
| [ ] | Clicking backdrop closes sidebar | [ ] | [ ] | |
| [ ] | "Ember" header with online indicator | [ ] | [ ] | |

### 2.2 Context-Aware Quick Actions

| ✓ | Context | Action | Appears | Dark | Light |
|---|---------|--------|---------|------|-------|
| [ ] | Learn | "Learn AI Basics" | [ ] | [ ] | [ ] |
| [ ] | Learn | "Quiz Me" | [ ] | [ ] | [ ] |
| [ ] | Learn | "My Progress" | [ ] | [ ] | [ ] |
| [ ] | Learn | "What Next?" | [ ] | [ ] | [ ] |
| [ ] | Explore | "Trending Projects" | [ ] | [ ] | [ ] |
| [ ] | Explore | "Find Projects" | [ ] | [ ] | [ ] |
| [ ] | Explore | "Recommend For Me" | [ ] | [ ] | [ ] |
| [ ] | Explore | "Similar Projects" | [ ] | [ ] | [ ] |
| [ ] | Project | "Paste a URL" | [ ] | [ ] | [ ] |
| [ ] | Project | "Make Infographic" | [ ] | [ ] | [ ] |
| [ ] | Project | "From GitHub" | [ ] | [ ] | [ ] |
| [ ] | Project | "Upload Media" | [ ] | [ ] | [ ] |
| [ ] | Default | "I need help" | [ ] | [ ] | [ ] |
| [ ] | Default | "I don't know what to do next" | [ ] | [ ] | [ ] |
| [ ] | Default | "I want to do something fun" | [ ] | [ ] | [ ] |

### 2.3 Quick Action Behavior

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Clicking action sends message + hides buttons | |
| [ ] | Actions hidden when messages present | |
| [ ] | Actions hidden during onboarding | |
| [ ] | Actions hidden when integration flow active | |

---

## 3. WEAVIATE & SEMANTIC SEARCH

### 3.1 Search Functionality

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | `/api/v1/projects/search/?q=<query>` returns results | |
| [ ] | Hybrid search works (semantic + keyword) | |
| [ ] | Private/archived projects NOT returned | |
| [ ] | Results ranked by semantic similarity | |

### 3.2 Explore Feed Tabs

| ✓ | Tab | Returns Correct Data | Pagination Works | Notes |
|---|-----|---------------------|------------------|-------|
| [ ] | For You | [ ] | [ ] | |
| [ ] | Trending | [ ] | [ ] | |
| [ ] | New | [ ] | [ ] | |
| [ ] | News | [ ] | [ ] | |
| [ ] | All | [ ] | [ ] | |

### 3.3 Weaviate Sync

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Creating project triggers sync | |
| [ ] | Updating project triggers re-sync | |
| [ ] | Deleting/archiving removes from Weaviate | |
| [ ] | Private project removes from search | |

### 3.4 Weaviate Collections

| ✓ | Collection | Exists | Has Documents | Notes |
|---|------------|--------|---------------|-------|
| [ ] | Project | [ ] | [ ] | |
| [ ] | UserProfile | [ ] | [ ] | |
| [ ] | Tool | [ ] | [ ] | |
| [ ] | Quiz | [ ] | [ ] | |
| [ ] | MicroLesson | [ ] | [ ] | |
| [ ] | Game | [ ] | [ ] | |

---

## 4. PERSONALIZATION & TAGS

### 4.1 Personalization Settings API

| ✓ | Endpoint/Field | Works | Notes |
|---|----------------|-------|-------|
| [ ] | GET `/api/v1/me/personalization/settings/` | [ ] | |
| [ ] | PATCH `use_topic_selections` | [ ] | |
| [ ] | PATCH `learn_from_views` | [ ] | |
| [ ] | PATCH `learn_from_likes` | [ ] | |
| [ ] | PATCH `discovery_balance` (0-100) | [ ] | |
| [ ] | PATCH `excited_features` (array) | [ ] | |

### 4.2 Tag Management

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | User tags display in profile/settings | |
| [ ] | Auto-tags generated from project views/likes | |
| [ ] | Auto-tags generated from chat conversations | |
| [ ] | Manual tags can be added/removed | |

### 4.3 Recommendations

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | "For You" reflects user interests | |
| [ ] | Connection suggestions show shared interests | |
| [ ] | Tool recommendation quiz works | |
| [ ] | Cold-start users see fallback content | |

### 4.4 Cold-Start Detection

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | `/api/v1/projects/personalization-status/` returns status | |
| [ ] | New users flagged as cold-start | |
| [ ] | Cold-start CTA shown appropriately | |
| [ ] | Flag clears after sufficient activity | |

---

## 5. STRUCTURED LEARNING PATHS

### 5.1 Learning Path APIs

| ✓ | Endpoint | Returns Data | Notes |
|---|----------|--------------|-------|
| [ ] | GET `/api/v1/me/learning-paths/` | [ ] | |
| [ ] | GET `/api/v1/me/learner-profile/` | [ ] | |
| [ ] | POST `/api/v1/me/learning-paths/{topic}/start/` | [ ] | |
| [ ] | GET `/api/v1/me/concept-mastery/` | [ ] | |
| [ ] | GET `/api/v1/me/learning-stats/` | [ ] | |

### 5.2 Learning Content in Chat

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Learning content message displays | [ ] | [ ] | |
| [ ] | Horizontal scroll carousel works | [ ] | [ ] | |
| [ ] | Featured images display | [ ] | [ ] | |
| [ ] | Author avatars with glow effect | [ ] | [ ] | |
| [ ] | Duration badges (videos) | [ ] | [ ] | |
| [ ] | Difficulty badges (quizzes) | [ ] | [ ] | |
| [ ] | Description text readable | [ ] | [ ] | |
| [ ] | Clicking card navigates to content | [ ] | [ ] | |

### 5.3 Content Sources

| ✓ | Source Type | Shows Correct Content | Notes |
|---|-------------|----------------------|-------|
| [ ] | Trending | [ ] | |
| [ ] | Personalized | [ ] | |
| [ ] | Video (play icon) | [ ] | |
| [ ] | Quiz (gamepad icon) | [ ] | |
| [ ] | Project (code icon) | [ ] | |

### 5.4 Micro-Lessons

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Micro-lessons render markdown | |
| [ ] | Follow-up prompts work | |
| [ ] | Quality ratings can be submitted | |

### 5.5 Cold-Start Learning Setup

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Learning goal selector appears for new users | |
| [ ] | Goal selection saved to preferences | |
| [ ] | Skip option available | |
| [ ] | Setup completion tracked | |

---

## 6. ONBOARDING FLOWS

### 6.1 Avatar Creation

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Avatar intro message displays | [ ] | [ ] | |
| [ ] | Template selector shows options | [ ] | [ ] | |
| [ ] | Selecting template triggers generation | [ ] | [ ] | |
| [ ] | Avatar preview displays | [ ] | [ ] | |
| [ ] | Can regenerate preview | [ ] | [ ] | |
| [ ] | Can select different template | [ ] | [ ] | |
| [ ] | Completion saves to profile | [ ] | [ ] | |
| [ ] | "Make my avatar" pill hidden after | [ ] | [ ] | |

### 6.2 Path Selection

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Path selection options display | |
| [ ] | Selection saves to preferences | |
| [ ] | Can skip selection | |
| [ ] | Completion tracked | |

---

## 7. WEBSOCKET & CONNECTION

### 7.1 Connection Stability

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | WebSocket connects on page load | |
| [ ] | Heartbeat keeps connection alive (30s) | |
| [ ] | Reconnects on disconnect (up to 5 attempts) | |
| [ ] | Reconnects on tab visibility change | |
| [ ] | "Reconnecting..." indicator shows | |

### 7.2 Message Handling

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Messages deduplicated (rapid clicks) | |
| [ ] | Messages persist to localStorage (max 100) | |
| [ ] | Messages restore on page reload | |
| [ ] | `/clear` removes from localStorage | |

---

## 8. ERROR HANDLING & EDGE CASES

### 8.1 Quota Management

| ✓ | Test Case | Dark | Light | Notes |
|---|-----------|------|-------|-------|
| [ ] | Quota exceeded banner appears | [ ] | [ ] | |
| [ ] | Shows subscription tier + usage | [ ] | [ ] | |
| [ ] | Upgrade button navigates to billing | [ ] | [ ] | |
| [ ] | Token purchase option works | [ ] | [ ] | |

### 8.2 Graceful Degradation

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Chat works when Weaviate unavailable | |
| [ ] | Chat works during network interruptions | |
| [ ] | Error messages auto-dismiss (10s) | |
| [ ] | Game crashes don't break chat | |

### 8.3 Mobile Responsiveness

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Pills stack/wrap correctly | |
| [ ] | Games fit in viewport | |
| [ ] | GamePicker cards scrollable | |
| [ ] | Touch/swipe controls work | |

### 8.4 Theme Testing

| ✓ | Component | Dark Theme | Light Theme | Notes |
|---|-----------|------------|-------------|-------|
| [ ] | Greeting text contrast | [ ] | [ ] | |
| [ ] | Feeling pills visible | [ ] | [ ] | |
| [ ] | GamePicker glassmorphism | [ ] | [ ] | |
| [ ] | Chat input border | [ ] | [ ] | |
| [ ] | Ember avatar visible | [ ] | [ ] | |
| [ ] | Loading spinners visible | [ ] | [ ] | |
| [ ] | Neon glow effects | [ ] | [ ] | |
| [ ] | Glass-subtle backgrounds | [ ] | [ ] | |
| [ ] | Snake grid visible | [ ] | [ ] | |
| [ ] | Quiz answer buttons | [ ] | [ ] | |
| [ ] | Sidebar background | [ ] | [ ] | |
| [ ] | Learning card text | [ ] | [ ] | |
| [ ] | Hover states | [ ] | [ ] | |
| [ ] | Focus rings | [ ] | [ ] | |

---

## 9. INTEGRATION FLOWS

| ✓ | Integration | Flow Launches | Search Works | OAuth Works | Import Success |
|---|-------------|---------------|--------------|-------------|----------------|
| [ ] | GitHub | [ ] | [ ] | [ ] | [ ] |
| [ ] | GitLab | [ ] | [ ] | [ ] | [ ] |
| [ ] | Figma | [ ] | [ ] | [ ] | [ ] |

---

## 10. DATA INTEGRITY

### 10.1 Privacy/Security

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Private projects never in search/explore | |
| [ ] | Archived projects never in search/explore | |
| [ ] | `allow_similarity_matching=False` excludes from similar users | |
| [ ] | GDPR deletion removes from Weaviate | |

### 10.2 Sync Consistency

| ✓ | Test Case | Notes |
|---|-----------|-------|
| [ ] | Project changes sync to Weaviate | |
| [ ] | User tag changes update recommendations | |
| [ ] | Learning progress persists across sessions | |

---

## 11. API HEALTH CHECKS

### Authentication Setup
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpass"}' | jq -r '.key')
AUTH="Authorization: Token $TOKEN"
```

| ✓ | Endpoint | Status | Response OK | Notes |
|---|----------|--------|-------------|-------|
| [ ] | GET `/api/v1/auth/me/` | | [ ] | |
| [ ] | GET `/api/v1/me/personalization/settings/` | | [ ] | |
| [ ] | GET `/api/v1/me/learner-profile/` | | [ ] | |
| [ ] | GET `/api/v1/me/learning-paths/` | | [ ] | |
| [ ] | GET `/api/v1/me/learning-stats/` | | [ ] | |
| [ ] | GET `/api/v1/me/concept-mastery/` | | [ ] | |
| [ ] | GET `/api/v1/projects/personalization-status/` | | [ ] | |
| [ ] | GET `/api/v1/projects/search/?q=test` | | [ ] | |
| [ ] | GET `/api/v1/projects/explore/?tab=for-you` | | [ ] | |
| [ ] | GET `/api/v1/projects/explore/?tab=trending` | | [ ] | |
| [ ] | GET `/api/v1/projects/explore/?tab=new` | | [ ] | |
| [ ] | GET `/api/v1/tools/recommendation-quiz-questions` | | [ ] | |
| [ ] | GET `/api/v1/users/suggestions/` | | [ ] | |
| [ ] | GET `/api/v1/taxonomy/?type=topic` | | [ ] | |

---

## 12. EMBER TEST PROMPTS

### Game Triggers

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "Let's play a game" | Game picker or inline game | [ ] | |
| [ ] | "Play snake" | Context Snake game | [ ] | |
| [ ] | "Quiz me on AI" | AI Trivia quiz | [ ] | |
| [ ] | "Let's do a prompt battle" | Prompt Battle vs Pip | [ ] | |
| [ ] | "Play ethics defender" | Ethics Defender game | [ ] | |

### Learning Content Triggers

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "I want to learn about prompt engineering" | Learning content cards | [ ] | |
| [ ] | "Teach me about AI agents" | Educational content | [ ] | |
| [ ] | "What's the difference between GPT and Claude?" | Explanation + resources | [ ] | |
| [ ] | "Show me tutorials on RAG" | Learning content | [ ] | |

### Personalization & Discovery

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "Show me what's trending" | Trending projects | [ ] | |
| [ ] | "Recommend projects for me" | Personalized recommendations | [ ] | |
| [ ] | "Find people to follow" | Connection suggestions | [ ] | |
| [ ] | "Help me personalize my experience" | Personalization guide | [ ] | |

### Project Creation

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "I want to share a project" | Project creation flow | [ ] | |
| [ ] | "Import from GitHub" | GitHub integration flow | [ ] | |
| [ ] | "Create a new project" | Project creation guide | [ ] | |

### Avatar & Onboarding

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "Help me create my avatar" | Avatar creation flow | [ ] | |
| [ ] | "Make my profile picture" | Avatar options | [ ] | |

### Challenges & Quick Wins

| ✓ | Prompt | Expected Response | Works | Notes |
|---|--------|-------------------|-------|-------|
| [ ] | "Show me this week's challenge" | Current challenge | [ ] | |
| [ ] | "Give me a quick win" | Quick achievable task | [ ] | |

### Error Cases

| ✓ | Test Case | Handles Gracefully | Notes |
|---|-----------|-------------------|-------|
| [ ] | Empty message | [ ] | |
| [ ] | Very long message (1000+ chars) | [ ] | |
| [ ] | XSS attempt: `<script>alert('xss')</script>` | [ ] | |
| [ ] | Repeated rapid messages | [ ] | |

---

## 13. QUICK SMOKE TEST (5 minutes)

| ✓ | Step | Test | Notes |
|---|------|------|-------|
| [ ] | 1 | Load /home → Greeting animates → 4 pills appear | |
| [ ] | 2 | Click "Play a game" → GamePicker shows → Click Snake → Works | |
| [ ] | 3 | Send message → Response streams → Persists after reload | |
| [ ] | 4 | Search projects → Results → Click → Navigates | |
| [ ] | 5 | Open sidebar → Actions show → Click → Sends message | |
| [ ] | 6 | Clear conversation → Pills reappear | |

---

## 14. TEST ACCOUNTS NEEDED

| ✓ | Account Type | Created | Notes |
|---|--------------|---------|-------|
| [ ] | New user (cold-start, no avatar) | [ ] | |
| [ ] | Active user (avatar, personalization set) | [ ] | |
| [ ] | Quota-exceeded user | [ ] | |
| [ ] | Mobile device / browser dev tools | [ ] | |

---

## 15. FINAL SIGN-OFF

| ✓ | Category | All Tests Pass | Tester | Date |
|---|----------|----------------|--------|------|
| [ ] | Automated E2E Tests | | | |
| [ ] | Backend Tests | | | |
| [ ] | /home Page Flows | | | |
| [ ] | Right Sidebar Flows | | | |
| [ ] | Weaviate & Search | | | |
| [ ] | Personalization | | | |
| [ ] | Learning Paths | | | |
| [ ] | Games (all 4) | | | |
| [ ] | Dark Theme | | | |
| [ ] | Light Theme | | | |
| [ ] | Mobile Responsiveness | | | |
| [ ] | API Health Checks | | | |

**Ready to Merge:** [ ] Yes / [ ] No

**Blockers/Notes:**
```


```
