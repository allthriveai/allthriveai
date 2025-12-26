# Ava Chat E2E Testing Patterns

**Source of Truth** | **Last Updated**: 2025-12-25

This document describes patterns for writing reliable E2E tests for Ava (the AI chat assistant) flows. These tests are challenging because they involve AI operations that can take 60-120 seconds and produce non-deterministic output.

---

## Overview

### Why Ava Tests Are Different

Ava tests differ from typical E2E tests because:

1. **Long operation times** - AI calls can take 60-90 seconds, especially with provider fallback (Gemini → OpenAI)
2. **Non-deterministic responses** - AI may phrase things differently each time
3. **Tool execution delays** - LangGraph tool calls add latency
4. **Rendered content** - Markdown `[link](/url)` becomes HTML `<a href="/url">link</a>`
5. **WebSocket state** - Input is disabled while Ava is "thinking"

### Key Patterns

| Pattern | Why It Matters |
|---------|---------------|
| Extended timeouts (90-120s) | AI operations need time, especially with provider fallback |
| `waitForAvaReady()` | Wait for input to be enabled = Ava finished responding |
| Poll for results | Check every 10s instead of one long wait |
| Detect HTML links | Markdown is rendered, so look for `<a>` elements |
| Flexible assertions | Check for outcomes, not exact wording |

---

## Test Location & Structure

**Location**: `frontend/e2e/deep/*.spec.ts`

**Helpers**: `frontend/e2e/deep/deep-helpers.ts`

### File Structure
```
frontend/e2e/
├── deep/
│   ├── deep-helpers.ts           # Ava-specific helpers
│   ├── ai-quality-assertions.ts  # Response quality checks
│   ├── chat-media-upload.spec.ts # Image/video upload → project
│   ├── chat-url-import.spec.ts   # URL paste → project creation
│   └── chat-learning-path.spec.ts # Topic question → learning path offer → creation
```

---

## Critical Helper Functions

### `waitForAvaReady(page, timeout)`

Waits for Ava to finish responding by checking when the chat input becomes enabled again.

```typescript
export async function waitForAvaReady(
  page: Page,
  timeout = DEEP_AI_TIMEOUT
): Promise<void> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isEnabled = await chatInput.isEnabled().catch(() => false);
    if (isEnabled) {
      await page.waitForTimeout(500); // Double-check stability
      const stillEnabled = await chatInput.isEnabled().catch(() => false);
      if (stillEnabled) return;
    }

    // Log thinking states for debugging
    const pageContent = await getPageContent(page);
    const isThinking =
      pageContent.includes('Thinking') ||
      pageContent.includes('Consulting my') ||
      pageContent.includes('Fanning the embers');

    if (isThinking) {
      console.log(`Waiting for Ava... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Ava did not become ready within ${timeout}ms`);
}
```

### `sendHomeChat(page, message)`

Sends a message in the home chat, waiting for WebSocket connection first.

```typescript
export async function sendHomeChat(page: Page, message: string): Promise<void> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  await chatInput.fill(message);
  const sendButton = page.locator('button[aria-label*="Send"]').first();
  await sendButton.click();

  await page.waitForTimeout(2000); // Initial processing delay
}
```

### Detecting Rendered Links

When Ava returns markdown like `[Project Title](/username/slug)`, the browser renders it as HTML. Use both detection methods:

```typescript
// Method 1: Check for markdown in text content (if not rendered)
const markdownMatch = afterTool.match(/\[([^\]]+)\]\(\/[a-z0-9_-]+\/[a-z0-9_-]+\)/i);

// Method 2: Check for rendered <a> elements
if (!markdownMatch) {
  const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
  if (await projectLink.isVisible()) {
    projectUrl = await projectLink.getAttribute('href');
  }
}
```

---

## Timeout Configuration

### Backend Tool Timeouts

In `services/agents/ember/agent.py`:

```python
EXTENDED_TIMEOUT_TOOLS = {
    'create_learning_path': 120,  # AI lesson generation
    'create_media_project': 120,  # Image analysis + fallback
    'create_project': 120,        # AI metadata generation
    'import_from_url': 90,        # URL scraping + AI analysis
}
```

### Frontend Test Timeouts

```typescript
// In deep-helpers.ts
export const DEEP_AI_TIMEOUT = 120000;     // 2 minutes for AI responses
export const MULTI_TURN_TIMEOUT = 300000;  // 5 minutes for multi-turn
export const WS_CONNECT_TIMEOUT = 15000;   // 15 seconds for WebSocket

// In test files
test.setTimeout(180000); // 3 minutes per test
```

---

## Test Templates

### Template: Ava Tool Execution Flow

Use this template for tests where Ava calls a tool and returns results:

```typescript
test('user action → Ava calls tool → creates entity → verify it exists', async ({ page }) => {
  // Setup
  await loginViaAPI(page);
  await page.goto('/home');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Step 1: User action (e.g., upload, send message)
  await sendHomeChat(page, "User's message here");

  // Step 2: Wait for Ava to respond (may take 60-90s)
  console.log('Waiting for Ava...');
  await waitForAvaReady(page, 90000);

  // Step 3: Get content and verify no errors
  const content = await getPageContent(page);
  assertNoTechnicalErrors(content, 'after Ava response');

  // Step 4: Poll for created entity link
  let entityUrl: string | null = null;
  const startTime = Date.now();
  const maxWait = 120000;

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(10000);

    // Method 1: Check for markdown link in text (may not be rendered yet)
    const pageText = await getPageContent(page);
    const markdownMatch = pageText.match(/\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i);
    if (markdownMatch) {
      entityUrl = markdownMatch[2];
      break;
    }

    // Method 2: Check for rendered <a> element (markdown becomes HTML)
    const link = page.locator('a[href^="/e2e-test-user/"]').first();
    if (await link.isVisible().catch(() => false)) {
      entityUrl = await link.getAttribute('href');
      if (entityUrl) break;
    }

    console.log(`Waiting for entity creation... (${Math.round((Date.now() - startTime) / 1000)}s)`);
  }

  // Step 5: Verify we got a link
  expect(entityUrl).toBeTruthy();
  console.log('Created entity URL:', entityUrl);

  // Step 6: Navigate to created entity and verify it exists
  await page.goto(entityUrl!);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Step 7: Verify entity-specific content
  // For projects: check title, image, etc.
  const pageTitle = await page.title();
  expect(pageTitle).not.toBe('');  // Page should have a title
  expect(pageTitle).not.toContain('404');  // Should not be a 404 page

  // Example: For media projects, verify image is real (not placeholder)
  const featuredImage = page.locator('img[alt*="featured"], img[class*="hero"]').first();
  if (await featuredImage.isVisible()) {
    const imageSrc = await featuredImage.getAttribute('src');
    console.log('Featured image src:', imageSrc);

    // Verify it's a real URL, not a placeholder
    expect(imageSrc).not.toContain('...url...');
    expect(imageSrc).toMatch(/localhost:9000|amazonaws\.com|minio/i);
  }
});
```

### Verification Checklist

When Ava creates something, verify it actually exists:

| Created Entity | How to Verify |
|----------------|---------------|
| **Project** | Navigate to URL, check title exists, verify featured image is real |
| **Learning Path** | Navigate to URL, check path has lessons listed |
| **Avatar** | Check avatar URL updated, image loads without 404 |
| **Clipped Project** | Navigate to URL, verify `is_owned=false` badge or attribution shown |

### Template: Multi-Turn Conversation

```typescript
test('multi-turn conversation with Ava', async ({ page }) => {
  await loginViaAPI(page);
  await page.goto('/home');
  await page.waitForTimeout(2000);

  // Turn 1: User initiates
  await sendHomeChat(page, "First message");
  await waitForAvaReady(page, 60000);

  const turn1 = await getPageContent(page);
  assertNoTechnicalErrors(turn1, 'turn 1');
  expect(turn1).toMatch(/expected pattern/i);

  // Turn 2: User follows up
  await sendHomeChat(page, "Follow up message");
  await waitForAvaReady(page, 60000);

  const turn2 = await getPageContent(page);
  assertNoTechnicalErrors(turn2, 'turn 2');
  expect(turn2).toMatch(/another pattern/i);

  // Turn 3: Final action
  await sendHomeChat(page, "Final message that triggers tool");
  await waitForAvaReady(page, 120000); // Longer for tool execution

  const turn3 = await getPageContent(page);
  expect(turn3).toMatch(/success indicator/i);
});
```

---

## Testable Ava Flows

### Currently Tested

| Flow | File | Status |
|------|------|--------|
| Image upload → ownership → tool → project | `chat-media-upload.spec.ts` | ✅ |
| URL import → ownership → project creation | `chat-url-import.spec.ts` | ✅ |
| Topic question → learning path offer → creation | `chat-learning-path.spec.ts` | ✅ |
| Tool discovery → projects using tools → preview tray | `chat-tool-discovery.spec.ts` | ✅ |

### To Be Tested

| Flow | Priority | Notes |
|------|----------|-------|
| Avatar generation | Medium | "Make my avatar" → wizard opens → avatar generated |
| Inline game launch | Medium | "Play a game" → game widget appears in chat |
| Profile building questions | Low | Ava asks pill question → user clicks → saved |

---

## Prompt Engineering for Reliable Tool Responses

When tests fail because Ava doesn't format responses correctly (e.g., missing links), update the Ava prompt to be more explicit.

### Example: Forcing Markdown Links

In `services/agents/ember/prompts.py`:

```python
### Project Creation Response Format (MANDATORY!)
When a project creation tool returns successfully:
1. Use the `title` and `url` from the tool response to create a markdown link
2. Format: `[{title}]({url})` - e.g., `[Bold Blue Expression](/username/bold-blue-expression)`
3. NEVER say "view it here" or "click here" without the actual link
4. NEVER omit the URL - users need to click through to their project

Example correct response:
- Tool returns: `{'success': True, 'title': 'Bold Blue Expression', 'url': '/allierays/bold-blue-expression'}`
- Your response: "Done! I've saved your project: [Bold Blue Expression](/allierays/bold-blue-expression)"

Example WRONG responses:
- "Your project has been saved! You can view it here." ❌ Missing link!
```

### Tool Response Message Format

In tool implementations, include markdown links directly:

```python
project_url = f'/{user.username}/{project.slug}'
markdown_link = f'[{project.title}]({project_url})'
return {
    'success': True,
    'url': project_url,
    'markdown_link': markdown_link,
    'message': f"SUCCESS! Project created: {markdown_link}",
}
```

---

## Debugging Failed Tests

### 1. Check Celery Logs

```bash
docker compose logs celery --tail=100 | grep -E "(ERROR|Exception|create_media|process_chat)"
```

### 2. Look for Thinking States

If test times out waiting for Ava, check what thinking state it's stuck on:
- "Thinking..." - Initial processing
- "Consulting my treasure trove..." - Tool lookup
- "Fanning the embers..." - Generating response

### 3. Verify Tool Execution

```bash
docker compose logs celery | grep -E "Tool call:|tool_calls=|Executing tool:"
```

### 4. Check AI Provider Status

Gemini often times out at 60s. Look for:
```
504 Deadline Exceeded
```

If seen, the fallback to OpenAI should kick in (but needs time).

### 5. View Test Artifacts

```bash
# Screenshots
ls test-results/*/test-failed-*.png

# Video recordings
ls test-results/*/*.webm

# Playwright trace
npx playwright show-trace test-results/*/trace.zip
```

---

## How to Request New Ava Tests

When asking for a new Ava flow test, provide:

```
Write an Ava e2e test for [FLOW NAME]:

User journey:
1. User does X
2. Ava responds with Y (may call Z tool)
3. User does W
4. Expected outcome: [SPECIFIC RESULT]

Key verifications:
- [ ] What should appear in UI
- [ ] What should be created in DB
- [ ] Links that should work

Known timing:
- [ ] AI calls expected (add to extended timeout tools if needed)
- [ ] Provider fallback possible
```

### Example Request

```
Write an Ava e2e test for Learning Path Creation:

User journey:
1. User says "I want to learn about RAG"
2. Ava asks clarifying questions (1-2 questions)
3. User answers "I want to build a chatbot, intermediate level"
4. Ava calls create_learning_path tool
5. Expected: Link to learning path appears, user can navigate to it

Key verifications:
- [ ] Learning path link appears in chat
- [ ] Link navigates to valid page
- [ ] Path has lessons visible

Known timing:
- [ ] create_learning_path takes 60-90s (already in extended timeout)
- [ ] May need Gemini fallback to OpenAI
```

---

## Maintenance

### When to Update This Doc

- New Ava tools added that need testing
- New thinking states added (update waitForAvaReady)
- Timeout issues discovered
- New helper functions created

### Review Cadence

Review after:
- Adding new Ava capabilities
- Encountering flaky tests
- Provider changes (new AI models)

---

**Version**: 1.0
**Status**: Active
**Maintainer**: Engineering Team
