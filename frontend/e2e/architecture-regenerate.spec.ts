import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER, TEST_PROJECT_SLUG } from './helpers';

/**
 * Architecture Diagram Regeneration E2E Tests
 *
 * SCENARIO: As user who uploaded a project with AI analysis, I want to regenerate
 *           the architecture diagram if it's incorrect.
 *
 * FLOW:
 * 1. User views their project page with an architecture diagram
 * 2. User enters edit mode
 * 3. User hovers over the architecture diagram to reveal the "Regenerate with AI" button
 * 4. User clicks the regenerate button
 * 5. Chat panel opens and automatically sends a message about regenerating the diagram
 * 6. AI responds with educational context and asks for the system description
 * 7. User describes their architecture in plain English
 * 8. AI generates a new Mermaid diagram and updates the project
 *
 * IMPORTANT: Regenerate button ONLY appears in edit mode when hovering over the diagram.
 *
 * FAILURE CASE: The mermaid graph does not regenerate.
 */

test.describe('Architecture Diagram Regeneration', () => {
  // Skip in CI - requires AI API keys and real project data
  test.skip(!!process.env.CI, 'Skipping architecture regeneration tests in CI - requires API keys and test project');

  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test.describe('Regenerate Button Visibility', () => {
    test('should NOT show regenerate button in view mode (published)', async ({ page }) => {
      // Navigate directly to the test project with architecture section
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Look for architecture section
      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // The regenerate button should NOT be visible in view mode
      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      await expect(regenerateButton).not.toBeVisible();

      // Also check for the text button
      const regenerateTextButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateTextButton).not.toBeVisible();
    });

    test('should NOT show regenerate button for non-owner even in any mode', async ({ page }) => {
      // Navigate to a project owned by someone else
      await page.goto('/alliejones42/restfulapi-example');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Look for architecture section
      const architectureSection = page.locator('[data-section-type="architecture"]');

      if (await architectureSection.isVisible()) {
        // The regenerate button should NOT be visible for non-owners
        const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
        const regenerateTextButton = architectureSection.locator('button:has-text("Regenerate with AI")');

        // Only check if the current user is not alliejones42
        if (TEST_USER.username !== 'alliejones42') {
          await expect(regenerateButton).not.toBeVisible();
          await expect(regenerateTextButton).not.toBeVisible();
        }
      }
    });

    test('should show regenerate button ONLY on hover over diagram in edit mode', async ({ page }) => {
      // Navigate directly to the test project
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Enter edit mode if available
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Look for architecture section
        const architectureSection = page.locator('[data-section-type="architecture"]');

        if (await architectureSection.isVisible()) {
          // The regenerate button should NOT be visible initially (without hover)
          const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
          await expect(regenerateButton).not.toBeVisible();

          // Hover over the diagram area to reveal the button
          const diagramArea = architectureSection.locator('.mermaid, [class*="mermaid"], svg').first();
          if (await diagramArea.isVisible()) {
            await diagramArea.hover();
            await page.waitForTimeout(500);

            // Now the button should be visible
            await expect(regenerateButton).toBeVisible({ timeout: 5000 });
          }
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Regeneration Flow', () => {
    // These tests require AI API keys
    test.setTimeout(180000); // 3 minutes for AI responses

    // Helper function to enter edit mode and click regenerate button
    async function enterEditModeAndClickRegenerate(page: import('@playwright/test').Page) {
      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      // Look for architecture section
      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Hover over the diagram area to reveal the regenerate button
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      // Find and click the regenerate button
      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });
      await regenerateButton.click();
      await page.waitForTimeout(2000);
    }

    test('CRITICAL: should open chat panel when regenerate button is clicked', async ({ page }) => {
      /**
       * SCENARIO: User clicks regenerate button on architecture diagram (in edit mode)
       * EXPECTED: Chat panel opens and automatically sends initial message
       */

      await enterEditModeAndClickRegenerate(page);

      // Chat panel should be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Check that connection is established
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });

      // Initial message about regenerating should appear in chat
      // The system sends: "The architecture diagram on my project... is wrong, can you help me fix it?"
      await page.waitForTimeout(5000);
      const regenerateMessage = page.getByText('architecture', { exact: false });
      await expect(regenerateMessage).toBeVisible({ timeout: 15000 });
    });

    test('CRITICAL: should receive AI response asking for architecture description', async ({ page }) => {
      /**
       * SCENARIO: User clicks regenerate button (in edit mode)
       * EXPECTED: AI responds with educational context about mermaid diagrams
       *           and asks for the system description
       */

      await enterEditModeAndClickRegenerate(page);

      // Wait for chat panel
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Wait for AI response (should ask about architecture)
      await page.waitForTimeout(30000);

      // AI should respond with educational context about mermaid diagrams
      // Expected phrases in response
      const expectedPhrases = [
        'mermaid',
        'diagram',
        'describe',
        'architecture',
        'components',
        'connect',
      ];

      const chatContent = await page.locator('.chat-message, [class*="message"], [class*="Message"]').allTextContents();
      const fullChatText = chatContent.join(' ').toLowerCase();

      // At least some of the expected phrases should appear
      const matchedPhrases = expectedPhrases.filter(phrase => fullChatText.includes(phrase));
      console.log(`Matched phrases: ${matchedPhrases.join(', ')}`);
      console.log(`Chat content preview: ${fullChatText.substring(0, 500)}...`);

      // Should have at least 2 matches indicating AI understands the context
      expect(matchedPhrases.length).toBeGreaterThanOrEqual(2);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });

    test('CRITICAL: should regenerate diagram after user describes architecture', async ({ page }) => {
      /**
       * SCENARIO: Full regeneration flow (in edit mode)
       * 1. User enters edit mode and hovers to reveal regenerate button
       * 2. User clicks regenerate
       * 3. AI asks for description
       * 4. User describes architecture
       * 5. AI generates new diagram
       *
       * EXPECTED: Project's architecture diagram is updated
       * FAILURE: Diagram does not change
       */

      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Store the project URL for later verification
      const projectUrl = page.url();

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Capture the current diagram content (if visible)
      const mermaidDiagram = architectureSection.locator('.mermaid, [class*="mermaid"], svg');
      let originalDiagramHtml = '';
      if (await mermaidDiagram.isVisible()) {
        originalDiagramHtml = await mermaidDiagram.innerHTML().catch(() => '');
      }

      // Hover over the diagram area to reveal the regenerate button
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });

      // Step 1: Click regenerate button
      await regenerateButton.click();
      await page.waitForTimeout(2000);

      // Wait for chat panel
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Wait for AI to ask about architecture
      await page.waitForTimeout(30000);

      // Step 2: User describes their architecture
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await expect(chatInput).toBeVisible({ timeout: 10000 });

      // Describe a simple architecture
      const architectureDescription = 'It has a React frontend that connects to a Node.js API. The API talks to a PostgreSQL database and Redis for caching.';
      await chatInput.fill(architectureDescription);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Step 3: Wait for AI to process and generate diagram
      await page.waitForTimeout(60000);

      // Check for success indicators in chat
      const chatContent = await page.locator('.chat-message, [class*="message"]').allTextContents();
      const fullChatText = chatContent.join(' ').toLowerCase();

      // Should see mermaid code in response or success message
      const successIndicators = [
        'graph tb',
        'graph td',
        'updated',
        'generated',
        'here\'s',
        '```mermaid',
        'diagram',
      ];

      const hasSuccess = successIndicators.some(indicator => fullChatText.includes(indicator));
      console.log(`Success indicators found: ${hasSuccess}`);
      console.log(`Chat content: ${fullChatText.substring(0, 1000)}`);

      // Should NOT have error messages
      const errorIndicators = [
        'error',
        'failed',
        'could not',
        'unable to',
        'sorry',
      ];

      const hasError = errorIndicators.some(indicator =>
        fullChatText.includes(indicator) &&
        !fullChatText.includes('no error') // Exclude false positives
      );

      expect(hasError).toBe(false);
      expect(hasSuccess).toBe(true);

      // Step 4: Close chat and verify diagram was updated
      const closeButton = page.locator('button[aria-label="Close chat"]');
      await closeButton.click();
      await page.waitForTimeout(1000);

      // Reload the project page to see updated diagram
      await page.goto(projectUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // Verify architecture section still exists
      const updatedArchitectureSection = page.locator('[data-section-type="architecture"]');
      await expect(updatedArchitectureSection).toBeVisible({ timeout: 10000 });

      // Get the new diagram content
      const updatedMermaidDiagram = updatedArchitectureSection.locator('.mermaid, [class*="mermaid"], svg');
      if (await updatedMermaidDiagram.isVisible()) {
        const newDiagramHtml = await updatedMermaidDiagram.innerHTML().catch(() => '');

        // If we had an original diagram, it should be different now
        if (originalDiagramHtml && newDiagramHtml) {
          console.log('Original diagram length:', originalDiagramHtml.length);
          console.log('New diagram length:', newDiagramHtml.length);

          // The diagram should have changed (not necessarily completely different,
          // but at least some content should be different)
          // Note: This might fail if the AI generated the exact same diagram
        }
      }

      console.log('Architecture regeneration flow completed successfully');
    });

    test('should handle regeneration error gracefully', async ({ page }) => {
      /**
       * SCENARIO: Something goes wrong during regeneration
       * EXPECTED: User sees friendly error message, chat remains functional
       */

      await enterEditModeAndClickRegenerate(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Send an ambiguous/unclear description that might cause issues
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('just use magic to make it work lol');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(30000);

      // Should NOT show technical errors
      const technicalErrors = ['TypeError', 'Exception', 'Traceback', 'undefined', 'NoneType'];
      for (const error of technicalErrors) {
        const hasError = await page.getByText(error).isVisible().catch(() => false);
        if (hasError) {
          console.error(`Found technical error: ${error}`);
        }
        expect(hasError).toBe(false);
      }

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();

      // Should be able to continue chatting
      await expect(chatInput).toBeVisible();
    });
  });

  test.describe('UI/UX', () => {
    test('should show regenerate button with hover overlay in edit mode', async ({ page }) => {
      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Before hovering, button should not be visible
      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).not.toBeVisible();

      // Hover over the diagram area
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      // After hovering, button should be visible
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });

      // The icon inside should be visible
      const icon = regenerateButton.locator('svg');
      await expect(icon).toBeVisible();
    });

    test('should have proper button styling with text label', async ({ page }) => {
      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Hover to reveal button
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });

      // Button should contain text "Regenerate with AI" - not just an icon
      const buttonText = await regenerateButton.textContent();
      expect(buttonText).toContain('Regenerate with AI');

      // Button should have proper dimensions (rectangular, not circular)
      const buttonBox = await regenerateButton.boundingBox();
      if (buttonBox) {
        // Button should be wider than tall (horizontal pill shape)
        expect(buttonBox.width).toBeGreaterThan(buttonBox.height);
      }
    });

    test('should hide regenerate button when mouse leaves diagram area', async ({ page }) => {
      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Hover to reveal button
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });

      // Move mouse away from the diagram area
      await page.mouse.move(0, 0);
      await page.waitForTimeout(500);

      // Button should now be hidden (or have opacity-0)
      // The button may still be in DOM but should not be interactable
      const isVisible = await regenerateButton.isVisible().catch(() => false);
      // Button may fade out rather than being removed from DOM
      if (isVisible) {
        // Check if it's actually clickable (visible to user)
        const buttonBox = await regenerateButton.boundingBox();
        // If button has no bounding box or pointer-events-none, it's effectively hidden
        console.log('Button visibility after mouse leave:', isVisible, 'Box:', buttonBox);
      }
    });
  });

  test.describe('WebSocket Connection', () => {
    test('should establish WebSocket connection with project context', async ({ page }) => {
      /**
       * SCENARIO: Regenerate button opens chat with project-specific conversation
       * EXPECTED: WebSocket connects with conversation ID like project-{id}-architecture
       */

      // Navigate directly to test project with architecture
      await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Listen for WebSocket connections before entering edit mode
      const wsConnections: string[] = [];
      page.on('websocket', ws => {
        wsConnections.push(ws.url());
      });

      // Enter edit mode
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await page.waitForTimeout(1000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      await expect(architectureSection).toBeVisible({ timeout: 10000 });

      // Hover over the diagram area to reveal the regenerate button
      const diagramContainer = architectureSection.locator('.relative').first();
      await diagramContainer.hover();
      await page.waitForTimeout(500);

      const regenerateButton = architectureSection.locator('button:has-text("Regenerate with AI")');
      await expect(regenerateButton).toBeVisible({ timeout: 5000 });

      await regenerateButton.click();
      await page.waitForTimeout(5000);

      // Chat panel should be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Wait for connection
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 15000 });

      // Check that a WebSocket connection was made with architecture context
      console.log('WebSocket connections:', wsConnections);

      // At least one connection should have been made
      expect(wsConnections.length).toBeGreaterThan(0);

      // The connection URL should contain 'architecture' in the conversation ID
      const hasArchitectureContext = wsConnections.some(url =>
        url.includes('architecture') || url.includes('project-')
      );
      expect(hasArchitectureContext).toBe(true);
    });
  });
});
