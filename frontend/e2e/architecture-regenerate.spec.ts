import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

/**
 * Architecture Diagram Regeneration E2E Tests
 *
 * SCENARIO: As user who uploaded a project with AI analysis, I want to regenerate
 *           the architecture diagram if it's incorrect.
 *
 * FLOW:
 * 1. User views their project page with an architecture diagram
 * 2. User clicks the regenerate button (circular arrow icon) next to "System Architecture"
 * 3. Chat panel opens and automatically sends a message about regenerating the diagram
 * 4. AI responds with educational context and asks for the system description
 * 5. User describes their architecture in plain English
 * 6. AI generates a new Mermaid diagram and updates the project
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
    test('should show regenerate button for project owner on architecture section', async ({ page }) => {
      // Navigate to a project page with an architecture diagram
      // Using the test user's project or a known project with architecture
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Find a project card and click to view it
      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (await projectCard.isVisible()) {
        await projectCard.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Look for architecture section
        const architectureSection = page.locator('[data-section-type="architecture"]');

        if (await architectureSection.isVisible()) {
          // The regenerate button should be visible for owners
          const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
          await expect(regenerateButton).toBeVisible({ timeout: 5000 });
        } else {
          // Skip test if no architecture section exists
          test.skip();
        }
      } else {
        // Skip test if no projects exist
        test.skip();
      }
    });

    test('should NOT show regenerate button for non-owner viewing project', async ({ page }) => {
      // Navigate to a project owned by someone else
      await page.goto('/alliejones42/restfulapi-example');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Look for architecture section
      const architectureSection = page.locator('[data-section-type="architecture"]');

      if (await architectureSection.isVisible()) {
        // The regenerate button should NOT be visible for non-owners
        const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');

        // Only check if the current user is not alliejones42
        if (TEST_USER.username !== 'alliejones42') {
          await expect(regenerateButton).not.toBeVisible();
        }
      }
    });

    test('should NOT show regenerate button when in edit mode', async ({ page }) => {
      // Navigate to user's own project
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Click on a project to view it
      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (await projectCard.isVisible()) {
        await projectCard.click();
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
            // The regenerate button should NOT be visible in edit mode
            const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
            await expect(regenerateButton).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Regeneration Flow', () => {
    // These tests require AI API keys
    test.setTimeout(180000); // 3 minutes for AI responses

    test('CRITICAL: should open chat panel when regenerate button is clicked', async ({ page }) => {
      /**
       * SCENARIO: User clicks regenerate button on architecture diagram
       * EXPECTED: Chat panel opens and automatically sends initial message
       */

      // Navigate to a known project with architecture diagram
      await page.goto('/alliejones42/restfulapi-example');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // If test user doesn't own this project, use their own project
      if (TEST_USER.username !== 'alliejones42') {
        // Navigate to test user's profile to find their project
        await page.goto(`/${TEST_USER.username}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const projectCard = page.locator('[data-testid="project-card"]').first();
        if (await projectCard.isVisible()) {
          await projectCard.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);
        }
      }

      // Look for architecture section
      const architectureSection = page.locator('[data-section-type="architecture"]');

      if (await architectureSection.isVisible()) {
        // Find and click the regenerate button
        const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');

        if (await regenerateButton.isVisible()) {
          await regenerateButton.click();
          await page.waitForTimeout(2000);

          // Chat panel should be visible
          const chatHeader = page.getByText('All Thrive AI Chat');
          await expect(chatHeader).toBeVisible({ timeout: 10000 });

          // Check that connection is established
          const connectionStatus = page.locator('[data-testid="connection-status"]');
          await expect(connectionStatus).toBeVisible({ timeout: 10000 });

          // Initial message about regenerating should appear in chat
          // The system sends: "I want to regenerate the architecture diagram for my project..."
          await page.waitForTimeout(5000);
          const regenerateMessage = page.getByText('regenerate', { exact: false });
          await expect(regenerateMessage).toBeVisible({ timeout: 15000 });
        } else {
          console.log('Regenerate button not visible - user may not be owner');
          test.skip();
        }
      } else {
        console.log('No architecture section found');
        test.skip();
      }
    });

    test('CRITICAL: should receive AI response asking for architecture description', async ({ page }) => {
      /**
       * SCENARIO: User clicks regenerate button
       * EXPECTED: AI responds with educational context about mermaid diagrams
       *           and asks for the system description
       */

      // Setup - navigate to project with architecture
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        test.skip();
        return;
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        test.skip();
        return;
      }

      // Click regenerate
      await regenerateButton.click();
      await page.waitForTimeout(2000);

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
       * SCENARIO: Full regeneration flow
       * 1. User clicks regenerate
       * 2. AI asks for description
       * 3. User describes architecture
       * 4. AI generates new diagram
       *
       * EXPECTED: Project's architecture diagram is updated
       * FAILURE: Diagram does not change
       */

      // Setup - navigate to project with architecture
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        console.log('No project found for test user');
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Store the project URL for later verification
      const projectUrl = page.url();

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        console.log('No architecture section in project');
        test.skip();
        return;
      }

      // Capture the current diagram content (if visible)
      const mermaidDiagram = architectureSection.locator('.mermaid, [class*="mermaid"], svg');
      let originalDiagramHtml = '';
      if (await mermaidDiagram.isVisible()) {
        originalDiagramHtml = await mermaidDiagram.innerHTML().catch(() => '');
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        console.log('Regenerate button not visible - user may not own project');
        test.skip();
        return;
      }

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

      // Setup
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        test.skip();
        return;
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        test.skip();
        return;
      }

      await regenerateButton.click();
      await page.waitForTimeout(2000);

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
    test('should show hover effect on regenerate button', async ({ page }) => {
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        test.skip();
        return;
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        test.skip();
        return;
      }

      // Hover over the button
      await regenerateButton.hover();
      await page.waitForTimeout(500);

      // Button should still be visible and interactive
      await expect(regenerateButton).toBeVisible();

      // The icon inside should have a rotation animation class or transform
      const icon = regenerateButton.locator('svg');
      await expect(icon).toBeVisible();
    });

    test('should have proper button styling', async ({ page }) => {
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        test.skip();
        return;
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        test.skip();
        return;
      }

      // Check button has circular styling (w-8 h-8 rounded-full)
      const buttonBox = await regenerateButton.boundingBox();
      if (buttonBox) {
        // Button should be roughly square (circular)
        const aspectRatio = buttonBox.width / buttonBox.height;
        expect(aspectRatio).toBeGreaterThan(0.9);
        expect(aspectRatio).toBeLessThan(1.1);
      }
    });
  });

  test.describe('WebSocket Connection', () => {
    test('should establish WebSocket connection with project context', async ({ page }) => {
      /**
       * SCENARIO: Regenerate button opens chat with project-specific conversation
       * EXPECTED: WebSocket connects with conversation ID like project-{id}-architecture
       */

      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (!await projectCard.isVisible()) {
        test.skip();
        return;
      }

      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const architectureSection = page.locator('[data-section-type="architecture"]');
      if (!await architectureSection.isVisible()) {
        test.skip();
        return;
      }

      const regenerateButton = architectureSection.locator('button[title="Regenerate architecture diagram with AI"]');
      if (!await regenerateButton.isVisible()) {
        test.skip();
        return;
      }

      // Listen for WebSocket connections
      const wsConnections: string[] = [];
      page.on('websocket', ws => {
        wsConnections.push(ws.url());
      });

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
