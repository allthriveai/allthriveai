# Intelligent Chat E2E Test Plan

This document outlines comprehensive end-to-end Playwright tests for the AllThrive AI Intelligent Chat system. These tests use real AI tokens and validate actual AI responses.

## Test Organization

### Directory Structure
AI token tests are organized in a separate subdirectory to prevent them from running on every test execution:

```
frontend/e2e/
├── intelligent-chat.spec.ts       # Existing UI tests (no AI tokens)
├── ai-chat/                       # AI token tests (opt-in only)
│   ├── url-import.spec.ts         # URL import AI workflows
│   ├── file-upload.spec.ts        # File upload AI workflows
│   ├── integrations.spec.ts       # GitHub/Figma/etc AI flows
│   ├── project-creation.spec.ts   # Project creation AI flows
│   ├── image-generation.spec.ts   # Nano Banana AI flows
│   ├── multi-agent.spec.ts        # Agent routing AI tests
│   ├── security.spec.ts           # Prompt injection AI tests
│   └── user-journeys.spec.ts      # Full E2E AI journeys
├── helpers.ts                     # Shared utilities
└── .env                           # Test credentials
```

### Running Tests

```bash
# Regular E2E tests (no AI tokens used)
cd frontend && npx playwright test

# AI token tests only (opt-in)
cd frontend && RUN_AI_TESTS=true npx playwright test ai-chat/

# Specific AI test file
RUN_AI_TESTS=true npx playwright test ai-chat/url-import.spec.ts

# All tests including AI
RUN_AI_TESTS=true npx playwright test
```

### Opt-In Pattern
All AI token tests use this pattern to skip unless explicitly enabled:

```typescript
import { test, expect } from '@playwright/test';

const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

test.describe('AI URL Import Tests', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');

  test('should import GitHub repo with AI', async ({ page }) => {
    // Test implementation
  });
});
```

## Test Configuration Notes

- **AI Token Tests**: Require `RUN_AI_TESTS=true` environment variable to run
- **Timeouts**:
  - Simple UI tests: 30s
  - AI response tests: 90s
  - URL scraping + AI: 120s
  - File upload + AI: 180s
- **Validation**: Check for error indicators (`TypeError`, `Exception`, `Traceback`, `NoneType`) to detect failures

---

## 1. CORE CHAT FUNCTIONALITY

### 1.1 Chat Panel Operations
| Test | Description | Priority |
|------|-------------|----------|
| Open chat from Support menu | Click Support > Chat opens with correct state | High |
| Open chat from +Add Project button | Click +Add Project > Chat opens in project mode | High |
| Close chat with X button | Click close > Panel closes smoothly | High |
| Chat persists state on close/reopen | Close and reopen > Messages preserved | Medium |
| Connection status indicator shows "Live" | WebSocket connects > Green "Live" badge visible | High |
| Connection status shows "Reconnecting" | Disconnect WebSocket > Yellow indicator | Medium |

### 1.2 Message Input & Display
| Test | Description | Priority |
|------|-------------|----------|
| Input field visible and focusable | Chat opens > Input auto-focused | High |
| Send plain text message | Type and send > Message appears in chat | High |
| Receive AI response | Send message > AI responds within timeout | Critical |
| Multiple message exchange | Back-and-forth conversation > All messages display | High |
| Auto-scroll to latest message | New message > Chat scrolls to bottom | Medium |
| Empty message blocked | Try to send empty > Button disabled | Medium |
| Character limit enforced | 10,000+ chars > Validation error | Low |

### 1.3 Loading States
| Test | Description | Priority |
|------|-------------|----------|
| Loading indicator during AI response | Send message > 3-dot animation visible | High |
| Tool name displayed during execution | AI uses tool > Tool name shown (e.g., "Importing from URL") | High |
| Cancel button during long operations | Long operation > Cancel button works | Medium |

---

## 2. URL IMPORT WORKFLOWS

### 2.1 GitHub URL Import
| Test | Description | Priority |
|------|-------------|----------|
| Import user's own GitHub repo | Paste own repo URL > Project created successfully | Critical |
| Auto-clip GitHub repo user doesn't own | Paste non-owned repo > "Clipped to library" message | Critical |
| GitHub URL with invalid format | Paste malformed URL > Friendly error message | High |
| Private repository handling | Paste private repo URL > Appropriate error | Medium |
| GitHub URL extracts correct metadata | Paste repo > Stars, language, description shown | High |
| Fork vs personal repo differentiation | Import fork > Correctly identified as fork | Medium |

### 2.2 YouTube URL Import
| Test | Description | Priority |
|------|-------------|----------|
| YouTube video URL creates project | Paste YouTube URL > Video metadata extracted | Critical |
| YouTube video ownership question | Paste video > AI asks "Is this your video?" | High |
| Own video response creates project | Respond "my own" > Project created as owned | High |
| Clipped video response creates clip | Respond "not mine" > Clipped to library | High |
| Invalid YouTube URL handling | Paste invalid > Friendly error | Medium |
| YouTube short URL format | Paste youtu.be URL > Works correctly | Medium |

### 2.3 Generic URL Import
| Test | Description | Priority |
|------|-------------|----------|
| Reddit URL import | Paste Reddit post > Content extracted | High |
| Twitter/X URL import | Paste tweet URL > Content handled | High |
| LinkedIn URL import | Paste LinkedIn URL > Profile/post extracted | Medium |
| Medium article import | Paste Medium URL > Article extracted | Medium |
| Blog post import | Paste blog URL > Content scraped | Medium |
| Invalid/broken URL | Paste 404 URL > Friendly error | High |
| URL behind authentication | Paste auth-required URL > Appropriate message | Medium |

### 2.4 Import from Plus Menu
| Test | Description | Priority |
|------|-------------|----------|
| "Import from URL" menu option | Click option > Prompt for URL appears | High |
| Menu closes after selection | Select option > Menu closes | Medium |
| URL import via menu vs paste | Both methods work identically | Medium |

---

## 3. FILE UPLOAD WORKFLOWS

### 3.1 Video Upload
| Test | Description | Priority |
|------|-------------|----------|
| Upload MP4 video file | Drag & drop MP4 > Upload succeeds | Critical |
| Video ownership confirmation flow | Upload video > AI asks about ownership | Critical |
| Own video + tool identification | Reply "my own and Midjourney" > Project created | Critical |
| Supervisor routing after ownership response | Reply about ownership > Stays in project flow (not discovery) | Critical |
| Upload WebM video | Drag & drop WebM > Works correctly | Medium |
| Video file too large (>100MB) | Upload large file > Size error shown | High |
| Unsupported video format | Upload .avi > Error or conversion | Medium |

### 3.2 Image Upload
| Test | Description | Priority |
|------|-------------|----------|
| Upload JPEG image | Drag & drop JPEG > Preview shown | High |
| Upload PNG image | Drag & drop PNG > Works correctly | High |
| Upload GIF image | Drag & drop GIF > Works correctly | Medium |
| Upload WebP image | Drag & drop WebP > Works correctly | Medium |
| Image file too large (>10MB) | Upload large image > Size error | High |
| Multiple images at once | Upload 3 images > All shown as attachments | Medium |

### 3.3 Document Upload
| Test | Description | Priority |
|------|-------------|----------|
| Upload PDF document | Drag & drop PDF > Analyzed by AI | High |
| Upload ZIP file with project | Upload ZIP > Contents analyzed | High |
| Upload Word document | Upload .docx > Content extracted | Medium |
| Document too large (>25MB) | Upload large doc > Size error | High |

### 3.4 Drag & Drop UI
| Test | Description | Priority |
|------|-------------|----------|
| Drag overlay appears | Drag file over chat > Overlay visible | High |
| Drop file uploads | Drop file > Upload starts | High |
| Attachment preview before send | Attach file > Preview visible | High |
| Remove attachment before send | Click X on attachment > Removed | Medium |
| Cancel upload mid-progress | Click cancel during upload > Upload aborted | Medium |

---

## 4. INTEGRATION FLOWS

### 4.1 GitHub Integration
| Test | Description | Priority |
|------|-------------|----------|
| GitHub connected status shown | User has GitHub connected > "Connected" badge | High |
| GitHub disconnected prompts OAuth | Not connected > OAuth button shown | High |
| List user's repositories | Connected > Repos listed | High |
| Search/filter repositories | Type in search > Filtered results | Medium |
| Select repo to import | Click repo > Import starts | High |
| Import multiple repos | Select 3 repos > All imported | Medium |

### 4.2 GitLab Integration
| Test | Description | Priority |
|------|-------------|----------|
| GitLab connected status shown | User has GitLab connected > "Connected" badge | Medium |
| GitLab disconnected prompts OAuth | Not connected > OAuth button shown | Medium |
| List user's GitLab projects | Connected > Projects listed | Medium |
| Import GitLab project | Select project > Imported | Medium |

### 4.3 Figma Integration
| Test | Description | Priority |
|------|-------------|----------|
| Figma connected status shown | User has Figma connected > "Connected" badge | Medium |
| Figma disconnected prompts OAuth | Not connected > OAuth button shown | Medium |
| Paste Figma URL imports design | Paste URL > Design preview shown | High |
| Invalid Figma URL handling | Paste invalid > Error message | Medium |

### 4.4 YouTube Integration
| Test | Description | Priority |
|------|-------------|----------|
| Add from YouTube menu option | Click option > YouTube import flow | High |
| YouTube URL paste in integration | Paste URL > Video processed | High |

---

## 5. PROJECT CREATION SCENARIOS

### 5.1 Description-Based Creation
| Test | Description | Priority |
|------|-------------|----------|
| Create project from natural language description | "I built a React todo app" > AI asks questions | High |
| AI asks clarifying questions | Describe project > AI asks about tech stack | High |
| Provide additional details | Answer questions > AI creates project | High |
| Generate project name suggestions | Describe project > AI suggests names | Medium |

### 5.2 Project Creation Validation
| Test | Description | Priority |
|------|-------------|----------|
| Project appears in user's playground | Create project > Visible in playground | Critical |
| Project has correct metadata | Create project > Title, description, image correct | High |
| Project link in success message works | Click project link > Opens project page | High |
| Topics/tags assigned correctly | Create GitHub project > Languages as tags | Medium |

---

## 6. IMAGE GENERATION (NANO BANANA)

### 6.1 Image Generation Workflow
| Test | Description | Priority |
|------|-------------|----------|
| Create image from prompt | Click "Create Image" > Describe > Image generated | High |
| Generated image displays in chat | Generate image > Image visible in chat | High |
| "Use as Featured Image" option | Generate > Click option > Image saved | Medium |
| "Create Project from Image" option | Generate > Click option > Project creation starts | Medium |
| Regenerate with modifications | Request changes > New image generated | Medium |
| Multiple iterations supported | Generate 3 variations > All work | Low |

---

## 7. PLUS MENU (+) FEATURES

### 7.1 Primary Menu Options
| Test | Description | Priority |
|------|-------------|----------|
| Import from URL visible | Open menu > Option present | High |
| Create Image/Infographic visible | Open menu > Option present | High |
| Ask for Help visible | Open menu > Option present | High |
| More Integrations submenu | Click More > Submenu opens | High |

### 7.2 Secondary Menu Options
| Test | Description | Priority |
|------|-------------|----------|
| Add from GitHub in submenu | Open More > GitHub option visible | High |
| Add from GitLab in submenu | Open More > GitLab option visible | Medium |
| Add from Figma in submenu | Open More > Figma option visible | Medium |
| Add from YouTube in submenu | Open More > YouTube option visible | Medium |
| Describe Anything option | Open More > Option visible | Medium |

### 7.3 Menu Interactions
| Test | Description | Priority |
|------|-------------|----------|
| Menu opens on + click | Click + > Menu appears | High |
| Menu closes on outside click | Click outside > Menu closes | Medium |
| Menu closes after selection | Select option > Menu closes | Medium |
| Keyboard navigation works | Arrow keys > Navigate options | Low |

### 7.4 Clear Conversation
| Test | Description | Priority |
|------|-------------|----------|
| Clear conversation option | Click Clear > Confirmation shown | High |
| Confirm clear removes messages | Confirm > All messages removed | High |
| Clear resets conversation state | Clear > New conversation ID | Medium |

---

## 8. MULTI-AGENT ROUTING

### 8.1 Intent Detection
| Test | Description | Priority |
|------|-------------|----------|
| Project creation intent detected | "I want to add my GitHub repo" > Project agent | High |
| Support intent detected | "How do I use this?" > Support agent | High |
| Discovery intent detected | "Show me AI projects" > Discovery agent | High |
| Ambiguous intent handled | Vague message > AI asks for clarification | Medium |

### 8.2 Agent Routing Correctness
| Test | Description | Priority |
|------|-------------|----------|
| GitHub URL routes to project agent | Paste GitHub URL > Project creation flow | Critical |
| Video upload routes correctly | Upload video > Project agent handles | Critical |
| Help request routes to support | "Help me" > Support agent responds | High |
| Routing consistency | Same message twice > Same agent | Medium |

### 8.3 Routing Regression Tests
| Test | Description | Priority |
|------|-------------|----------|
| Video ownership response stays in project flow | Reply "Midjourney" > NOT discovery agent | Critical |
| URL import doesn't switch to discovery | Import URL > Stays in project flow | High |

---

## 9. WEBSOCKET & CONNECTIVITY

### 9.1 Connection Management
| Test | Description | Priority |
|------|-------------|----------|
| WebSocket connects on chat open | Open chat > Connection established | Critical |
| Connection status shows "Live" | Connected > Green badge | High |
| Heartbeat keeps connection alive | Wait 60s > Still connected | Medium |
| Connection timeout handled | Block connection > Timeout error | Medium |

### 9.2 Reconnection
| Test | Description | Priority |
|------|-------------|----------|
| Auto-reconnect after disconnect | Disconnect > Reconnects automatically | High |
| Exponential backoff on reconnect | Multiple failures > Delay increases | Medium |
| Max reconnection attempts | 5 failures > Stops trying, shows error | Medium |
| Manual reconnect option | After max attempts > Retry button works | Low |

### 9.3 Network Conditions
| Test | Description | Priority |
|------|-------------|----------|
| Graceful offline handling | Go offline > Friendly error shown | High |
| Recovery when back online | Offline > Online > Reconnects | High |
| Slow network handling | Throttle network > Still works (slower) | Medium |

---

## 10. ERROR HANDLING

### 10.1 User-Friendly Error Messages
| Test | Description | Priority |
|------|-------------|----------|
| No technical errors shown | Any error > No "TypeError", "Exception" | Critical |
| Rate limit message friendly | Hit rate limit > Clear, helpful message | High |
| Upload error message friendly | Upload fails > Understandable error | High |
| Connection error friendly | WebSocket fails > Helpful message | High |

### 10.2 Specific Error Scenarios
| Test | Description | Priority |
|------|-------------|----------|
| Rate limit (50 msgs/hour) | Send 51 messages > Rate limit error | High |
| Quota exceeded | Exhaust tokens > Upgrade prompt | High |
| Tool execution failure | Tool fails > Graceful error | Medium |
| AI response timeout | Slow AI > Timeout message | Medium |

### 10.3 Recovery from Errors
| Test | Description | Priority |
|------|-------------|----------|
| Retry after rate limit | Wait > Can send again | Medium |
| Continue after upload error | Error > Can upload again | Medium |
| Continue after connection error | Reconnect > Chat continues | High |

---

## 11. AUTHENTICATION & AUTHORIZATION

### 11.1 Authenticated User
| Test | Description | Priority |
|------|-------------|----------|
| Logged in user sees chat | Logged in > Chat available | Critical |
| Username shown in header | Logged in > Username visible | High |
| Can import own repos | Connected GitHub > Import works | High |
| Projects saved to account | Create project > In user's playground | High |

### 11.2 Unauthenticated User
| Test | Description | Priority |
|------|-------------|----------|
| Unauthenticated sees login prompt | Not logged in > Login button/redirect | High |
| Cannot access integrations | Not logged in > Integrations blocked | High |
| Cannot save projects | Not logged in > Save blocked | High |

### 11.3 Authorization
| Test | Description | Priority |
|------|-------------|----------|
| Cannot access other user's conversation | Try to access > Blocked | High |
| Cannot modify other user's project | Try to modify > Blocked | High |

---

## 12. SECURITY TESTS

### 12.1 Prompt Injection Prevention
| Test | Description | Priority |
|------|-------------|----------|
| "Ignore previous instructions" blocked | Send injection > Blocked/handled safely | Critical |
| "You are now..." injection blocked | Send injection > Normal response | Critical |
| System prompt extraction blocked | Try to extract > Refused | High |
| Jailbreak attempts handled | DAN, sudo mode > Refused | High |

### 12.2 Input Validation
| Test | Description | Priority |
|------|-------------|----------|
| XSS in message prevented | Send `<script>` > Not executed | Critical |
| HTML sanitized in display | Send HTML > Sanitized | Critical |
| Special characters escaped | Send special chars > Displayed safely | High |

### 12.3 File Security
| Test | Description | Priority |
|------|-------------|----------|
| Dangerous file extensions blocked | Upload .exe > Rejected | High |
| Zip bomb detected | Upload suspicious ZIP > Rejected | High |
| Path traversal prevented | Upload ../file > Blocked | High |

---

## 13. SPECIAL CHARACTERS & EDGE CASES

### 13.1 Unicode & Emoji
| Test | Description | Priority |
|------|-------------|----------|
| Emoji in messages work | Send emoji > Displayed correctly | High |
| Unicode text (Chinese, Arabic) | Send Unicode > Displayed correctly | High |
| Mixed content | Emoji + text + code > All work | Medium |

### 13.2 Edge Cases
| Test | Description | Priority |
|------|-------------|----------|
| Very long message (5000+ chars) | Send long message > Handled | High |
| Very long conversation (100+ messages) | Long convo > Performance OK | Medium |
| Rapid message sending | Send 10 quickly > All handled | Medium |
| Empty response handling | AI returns empty > Graceful | Low |

---

## 14. CHAT MODES

### 14.1 Mode-Specific Behavior
| Test | Description | Priority |
|------|-------------|----------|
| Default mode focuses on project creation | Open chat > Project creation prompts | High |
| Support mode focuses on help | Open via Support > Help-focused | High |
| Architecture regeneration mode | Open from project > Architecture context | Medium |
| Product creation mode | Select product > Product flow | Low |

---

## 15. CONVERSATION MANAGEMENT

### 15.1 Conversation Persistence
| Test | Description | Priority |
|------|-------------|----------|
| Messages persist on page reload | Reload page > Messages still there | High |
| Messages persist on close/reopen | Close and reopen > Messages visible | High |
| Conversation ID tracked correctly | Check localStorage > Correct ID | Medium |

### 15.2 Clear Conversation
| Test | Description | Priority |
|------|-------------|----------|
| Clear removes all messages | Clear > No messages | High |
| Clear creates new conversation | Clear > New conversation ID | Medium |
| Can continue after clear | Clear > Send new message > Works | High |

---

## 16. REAL USER WORKFLOWS (E2E Journeys)

### 16.1 Quick Add Project Journey
| Test | Description | Priority |
|------|-------------|----------|
| Full flow: +Add > URL > Confirm > Success | Complete journey > Project created | Critical |
| Full flow: +Add > GitHub OAuth > Select > Import | Complete journey > Project created | High |

### 16.2 Help & Discovery Journey
| Test | Description | Priority |
|------|-------------|----------|
| Full flow: Support > Ask help > Get guidance | Complete journey > Helpful response | High |
| Full flow: Ask about features > Try feature | Complete journey > Feature works | Medium |

### 16.3 Content Creator Journey
| Test | Description | Priority |
|------|-------------|----------|
| Full flow: Upload video > Ownership > Project | Complete journey > Project with video | Critical |
| Full flow: Paste YouTube > Confirm > Project | Complete journey > Project created | High |

### 16.4 Portfolio Builder Journey
| Test | Description | Priority |
|------|-------------|----------|
| Full flow: Connect GitHub > Import 5 repos | Complete journey > 5 projects | High |
| Full flow: Describe projects > Create multiple | Complete journey > Multiple projects | Medium |

---

## 17. PERFORMANCE VALIDATION

### 17.1 Response Times
| Test | Description | Priority |
|------|-------------|----------|
| WebSocket connects < 2s | Measure connection time > < 2s | High |
| First AI token < 3s | Measure time to first token > < 3s | High |
| Complete simple response < 10s | Measure full response > < 10s | Medium |

### 17.2 UI Responsiveness
| Test | Description | Priority |
|------|-------------|----------|
| No UI freeze during AI response | UI responsive during wait | High |
| Smooth scrolling with many messages | 100+ messages > Smooth scroll | Medium |

---

## Test Implementation Checklist

### Already Implemented (from intelligent-chat.spec.ts)
- [x] Chat panel open/close
- [x] Message sending and display
- [x] Plus menu interactions
- [x] GitHub auto-clipping workflow
- [x] Video upload with ownership confirmation
- [x] URL import (Reddit, invalid URLs)
- [x] WebSocket reconnection
- [x] Special characters/Unicode handling
- [x] Very long messages
- [x] Network offline handling
- [x] Error message display (non-technical)
- [x] Basic user workflows (YouTube, GitHub, general questions)
- [x] GitHub import without connection - ask to connect or clip
- [x] GitHub import without connection - clip flow when user chooses "just clip it"
- [x] GitHub import without connection - direct to Settings when user wants to connect
- [x] Multi-agent routing - Discovery agent (find/search projects)
- [x] Multi-agent routing - Project agent (GitHub URL import)
- [x] Multi-agent routing - Nano Banana (image generation)
- [x] Multi-agent routing - Support agent (help questions)
- [x] Multi-agent routing - Workflow continuation (response stays with asking agent)

### High Priority - To Implement
- [ ] Prompt injection prevention tests
- [ ] XSS prevention tests
- [ ] Rate limiting behavior tests
- [ ] Full user journey tests
- [ ] Figma/GitLab integration tests
- [ ] Image generation workflow tests
- [ ] Document upload tests
- [ ] Authorization tests

### Medium Priority - To Implement
- [ ] All High priority tests above
- [ ] Edge case tests
- [ ] Performance validation tests
- [ ] Mode-specific behavior tests
- [ ] Conversation management tests
- [ ] Connection management detailed tests

---

## Test Organization Recommendation

```
frontend/e2e/
├── intelligent-chat.spec.ts          # Existing - core chat tests
├── intelligent-chat-ai.spec.ts       # NEW - AI response validation tests
├── intelligent-chat-uploads.spec.ts  # NEW - File upload workflow tests
├── intelligent-chat-integrations.spec.ts  # NEW - Integration tests (GitHub, Figma, etc.)
├── intelligent-chat-security.spec.ts # NEW - Security and prompt injection tests
├── intelligent-chat-journeys.spec.ts # NEW - Full user journey tests
└── helpers.ts                        # Shared utilities
```

---

## Running Tests

```bash
# Run all intelligent chat tests
cd frontend && npx playwright test intelligent-chat

# Run specific test file
npx playwright test intelligent-chat-ai.spec.ts

# Run tests with specific tag
npx playwright test --grep "@critical"

# Run with real AI (not in CI)
SKIP_AI_TESTS=false npx playwright test
```

---

## Notes

1. **AI Token Tests**: Mark tests requiring real AI with `test.skip(!!process.env.CI, 'Requires API keys')`
2. **Flaky Tests**: Use `test.retry(2)` for tests with network dependencies
3. **Parallel Execution**: Tests that share state should use `test.describe.serial()`
4. **Test Data**: Use unique identifiers per test to avoid conflicts
5. **Cleanup**: Tests should clean up any created projects/conversations
