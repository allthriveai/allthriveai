# Ember Chat E2E Tests

End-to-end tests for the unified Ember chat system.

## Test Structure

```
ember-chat/
├── README.md              # This file
├── chat-helpers.ts        # Shared test utilities
├── chat-smoke.spec.ts     # Basic connectivity & smoke tests
├── media-upload.spec.ts   # Media upload workflows
└── project-workflow.spec.ts # Project creation flows
```

## Running Tests

### Quick Start

```bash
# Run smoke tests only (no AI calls)
npx playwright test e2e/ember-chat/chat-smoke.spec.ts

# Run ALL Ember chat tests with AI
RUN_AI_TESTS=true npx playwright test e2e/ember-chat/

# Run specific test file
RUN_AI_TESTS=true npx playwright test e2e/ember-chat/media-upload.spec.ts

# Run in headed mode (see browser)
RUN_AI_TESTS=true npx playwright test e2e/ember-chat/ --headed

# Run with debug UI
npx playwright test e2e/ember-chat/ --ui
```

### Prerequisites

1. Backend running: `make up` (Docker)
2. Frontend running: `npm run dev -- --port 3000`
3. Test user exists: See `e2e/.env.example`

## Test Categories

### 1. Smoke Tests (`chat-smoke.spec.ts`)

Quick validation that chat is working. Run these first.

| Test | Description |
|------|-------------|
| Chat Accessibility | Can access chat on /home and sidebar |
| Basic Messaging | Can type and send messages |
| WebSocket Connection | Connection status and reconnection |
| Ember Responses* | Basic greeting and help responses |

*Requires `RUN_AI_TESTS=true`

### 2. Media Upload Tests (`media-upload.spec.ts`)

Tests for the media upload workflow.

| Test | Description |
|------|-------------|
| Upload image to /home | Image file uploads successfully |
| Upload video to /home | Video file uploads successfully |
| Upload to sidebar | Media upload works in sidebar |
| Ember asks ownership | Ember asks "is this your project?" |
| Ember asks about tools | Ember asks what tools were used |
| Create project from image | Full workflow: upload → project |
| Project tagged with tool | Tool (e.g., Midjourney) is saved |
| Save to clippings | User can save as clipping instead |

### 3. Project Workflow Tests (`project-workflow.spec.ts`)

Tests for project creation via chat.

| Test | Description |
|------|-------------|
| GitHub URL import | Ember recognizes and processes GitHub URLs |
| YouTube URL import | Ember handles YouTube videos |
| Natural language creation | User can describe a project to create |
| Conversation flow | Multi-turn conversations maintain context |
| Error handling | Graceful handling of invalid URLs |

## Test Design Principles

### One Behavior Per Test

Each test validates a single behavior:

```typescript
// GOOD: Single behavior
test('Ember asks about media ownership after upload', async ({ page }) => {
  await uploadMedia(page);
  await waitForEmberResponse(page);
  await assertAskedAboutOwnership(page);
});

// BAD: Multiple behaviors bundled
test('user uploads media and creates project with tools', async ({ page }) => {
  // Too many things in one test!
});
```

### Given-When-Then Pattern

```typescript
test('user can create project from uploaded image', async ({ page }) => {
  // GIVEN: I uploaded an image to chat
  await openEmbeddedChat(page);
  await uploadFileViaInput(page, TEST_FILES.image);
  await waitForEmberResponse(page);

  // WHEN: I say it's my project
  await sendMessage(page, 'This is my project, I made it with Midjourney');
  await waitForEmberResponse(page);

  // THEN: A project should be created
  const created = await assertProjectCreated(page);
  expect(created).toBe(true);
});
```

## Helpers Reference

### Chat Access

```typescript
// Open embedded chat on /home
await openEmbeddedChat(page);

// Open sidebar from any page
await openChatSidebar(page, '/explore');
```

### Messaging

```typescript
// Send a message
await sendMessage(page, 'Hello Ember!');

// Wait for response
await waitForEmberResponse(page);

// Get chat content
const content = await getChatContent(page);
```

### Media Upload

```typescript
// Upload via file input
await uploadFileViaInput(page, TEST_FILES.image);

// Check for preview
const hasPreview = await hasMediaPreview(page);
```

### Assertions

```typescript
// Check Ember asked about ownership
await assertAskedAboutOwnership(page);

// Check no technical errors
await assertNoTechnicalErrors(page);

// Check project was created
const created = await assertProjectCreated(page);
```

### Debug

```typescript
// Screenshot
await debugScreenshot(page, 'my-test');

// Log chat content
await debugLogChat(page, 'After upload');
```

## Test Fixtures

Located in `e2e/fixtures/`:

| File | Description |
|------|-------------|
| `test-image.png` | Small test image |
| `test-video.mp4` | Small test video |
| `linkedin-screenshot.png` | Screenshot for testing |

## Environment Variables

Create `e2e/.env` from `e2e/.env.example`:

```env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_USER_USERNAME=testuser
RUN_AI_TESTS=true  # Enable AI-powered tests
```

## Timeouts

Configured in `chat-helpers.ts`:

| Operation | Timeout |
|-----------|---------|
| Chat connect | 10s |
| AI response | 90s |
| Image generation | 180s |
| Project creation | 120s |
| File upload | 30s |

## Debugging Failed Tests

1. Run with `--headed` to see the browser
2. Run with `--ui` for interactive debugging
3. Check `test-results/` for screenshots
4. Use `debugScreenshot()` and `debugLogChat()` in tests

```bash
# View test report
npx playwright show-report
```

## Adding New Tests

1. Identify the **single behavior** to test
2. Add to appropriate spec file (or create new)
3. Use helpers from `chat-helpers.ts`
4. Follow Given-When-Then pattern
5. Add assertions using existing helper functions
