/**
 * Home Page E2E Test Helpers
 *
 * Utilities for testing the /home page greeting and feeling pills.
 * Works with both EmbeddedChatLayout (/home) and SidebarChatLayout.
 */

import { Page } from '@playwright/test';
import { getChatContent } from './chat-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All 11 feeling pills with their labels, messages, and required features
 */
export const FEELING_PILLS: Record<string, {
  label: string;
  message: string;
  features: string[];
  requiresNoAvatar?: boolean;
  showsGamePicker?: boolean;
}> = {
  share: {
    label: "Share something I've been working on",
    message: "I want to share something I've been working on",
    features: ['portfolio'],
  },
  play: {
    label: 'Play a game',
    message: 'I want to play a game',
    features: ['battles'],
    showsGamePicker: true, // This pill shows a game picker UI instead of sending a message
  },
  challenge: {
    label: "See this week's challenge",
    message: "Show me this week's challenge",
    features: ['challenges'],
  },
  learn: {
    label: 'Learn something new',
    message: 'I want to learn something new about AI',
    features: ['microlearning', 'learning'],
  },
  marketplace: {
    label: 'Sell a product or service',
    message: 'I want to sell a product or service',
    features: ['marketplace'],
  },
  explore: {
    label: 'Explore what others are making',
    message: 'Show me what others are making',
    features: ['community'],
  },
  connect: {
    label: 'Connect with others',
    message: 'Help me find people to connect with',
    features: ['community'],
  },
  personalize: {
    label: 'Personalize my experience',
    message: 'Help me personalize my AllThrive experience',
    features: ['personalize'],
  },
  trending: {
    label: "What's trending today?",
    message: "Show me what's trending today",
    features: ['community', 'portfolio'],
  },
  'quick-win': {
    label: 'Give me a quick win',
    message: 'I want a quick win to start my day',
    features: ['microlearning', 'battles'],
  },
  avatar: {
    label: 'Make my avatar',
    message: 'Help me create my avatar',
    features: ['personalize', 'portfolio', 'community'],
    requiresNoAvatar: true,
  },
};

/**
 * Expected keywords in AI responses for each pill type
 */
export const PILL_RESPONSE_KEYWORDS: Record<string, string[]> = {
  share: ['share', 'project', 'upload', 'working on', 'show', 'create'],
  play: ['game', 'play', 'fun', 'snake', 'quiz', 'battle', 'prompt'],
  challenge: ['challenge', 'week', 'participate', 'submit', 'prompt'],
  learn: ['learn', 'ai', 'topic', 'concept', 'understand', 'teach', 'lesson'],
  marketplace: ['sell', 'product', 'service', 'marketplace', 'create', 'offer'],
  explore: ['trending', 'projects', 'popular', 'discover', 'explore', 'check out'],
  connect: ['connect', 'people', 'community', 'circle', 'members', 'network'],
  personalize: ['personalize', 'experience', 'preferences', 'interests', 'customize'],
  trending: ['trending', 'popular', 'today', 'hot', 'buzz', 'latest'],
  'quick-win': ['quick', 'win', 'easy', 'start', 'simple', 'accomplish'],
  avatar: ['avatar', 'create', 'image', 'profile', 'picture', 'generate'],
};

/**
 * All features that can be set in user personalization
 */
export const ALL_FEATURES = [
  'portfolio',
  'battles',
  'challenges',
  'microlearning',
  'learning',
  'marketplace',
  'community',
  'personalize',
];

// ============================================================================
// PERSONALIZATION HELPERS
// ============================================================================

/**
 * Set user's excited features via API
 * Controls which feeling pills are shown
 */
export async function setExcitedFeatures(page: Page, features: string[]): Promise<void> {
  await page.evaluate(async (featureList) => {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    const response = await fetch('/api/v1/me/personalization/settings/', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      body: JSON.stringify({ excited_features: featureList }),
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to set excited features:', await response.text());
    }
  }, features);
}

/**
 * Clear user's avatar via API (for testing avatar pill)
 */
export async function clearUserAvatar(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    const response = await fetch('/api/v1/auth/me/', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      body: JSON.stringify({ avatar_url: null }),
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to clear avatar:', await response.text());
    }
  });
}

// ============================================================================
// GREETING HELPERS
// ============================================================================

/**
 * Wait for the greeting typewriter animation to complete
 * Detects when the cursor stops and text is stable
 */
export async function waitForGreetingComplete(page: Page, timeout = 15000): Promise<void> {
  // Wait for the page to load
  await page.waitForLoadState('domcontentloaded');

  // Wait for greeting to appear - it's in a glass-subtle container with text-lg
  // The greeting contains "Good morning/afternoon/evening"
  await page.waitForFunction(
    () => {
      const pageText = document.body.textContent || '';
      return (
        pageText.includes('Good morning') ||
        pageText.includes('Good afternoon') ||
        pageText.includes('Good evening')
      );
    },
    { timeout: 10000 }
  );

  // Wait for typewriter to complete (text ends with punctuation and cursor is gone)
  await page.waitForFunction(
    () => {
      const pageText = document.body.textContent || '';
      // Look for complete greeting pattern - ends with ! or ?
      const greetingMatch = pageText.match(/Good (morning|afternoon|evening),\s+\w+[^?!]*([?!])/);
      if (!greetingMatch) return false;

      // Also verify the blinking cursor is gone (animation finished)
      const cursor = document.querySelector('.animate-pulse');
      return !cursor;
    },
    { timeout }
  );

  // Additional buffer for pill animations
  await page.waitForTimeout(500);
}

/**
 * Get the greeting text content
 */
export async function getGreetingText(page: Page): Promise<string> {
  // The greeting is in a glass-subtle container with text-lg class
  // Look for text that matches the greeting pattern
  const pageText = await page.locator('body').textContent() || '';

  // Extract the greeting using regex
  const greetingMatch = pageText.match(/Good (morning|afternoon|evening),\s+[\w\s]+[?!]/);
  if (greetingMatch) {
    return greetingMatch[0];
  }

  // Fallback to looking for any text starting with "Good"
  const altMatch = pageText.match(/Good (morning|afternoon|evening)[^]*?[?!]/);
  return altMatch ? altMatch[0] : '';
}

/**
 * Get expected time-of-day greeting based on current hour
 */
export function getExpectedTimeOfDayGreeting(): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ============================================================================
// FEELING PILLS HELPERS
// ============================================================================

/**
 * Get all visible feeling pill labels
 */
export async function getVisiblePillLabels(page: Page): Promise<string[]> {
  // Wait for pills to potentially appear
  await page.waitForTimeout(1000);

  // Pills are buttons in a flex container with specific styling
  const pills = page.locator('button').filter({
    has: page.locator('text=/Share something|Play a game|See this week|Learn something|Sell a product|Explore what|Connect with|Personalize my|What\'s trending|Give me a quick|Make my avatar/i'),
  });

  const count = await pills.count();
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await pills.nth(i).textContent();
    if (text) labels.push(text.trim());
  }

  return labels;
}

/**
 * Click a feeling pill by its label text
 */
export async function clickFeelingPill(page: Page, pillLabel: string): Promise<void> {
  const pill = page.locator(`button:has-text("${pillLabel}")`);
  await pill.waitFor({ state: 'visible', timeout: 10000 });
  await pill.click();
}

/**
 * Check if a specific pill is visible
 */
export async function isPillVisible(page: Page, pillLabel: string): Promise<boolean> {
  const pill = page.locator(`button:has-text("${pillLabel}")`);
  return await pill.isVisible().catch(() => false);
}

/**
 * Wait for pills to appear after greeting animation
 */
export async function waitForPillsToAppear(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const buttons = document.querySelectorAll('button');
      const pillLabels = [
        'Share something', 'Play a game', 'See this week', 'Learn something',
        'Sell a product', 'Explore what', 'Connect with', 'Personalize my',
        "What's trending", 'Give me a quick', 'Make my avatar'
      ];

      for (const button of buttons) {
        const text = button.textContent || '';
        if (pillLabels.some(label => text.includes(label))) {
          return true;
        }
      }
      return false;
    },
    { timeout }
  );
}

// ============================================================================
// AI RESPONSE VERIFICATION
// ============================================================================

/**
 * Verify Ember's response contains expected keywords for a pill type
 */
export async function verifyPillResponse(page: Page, pillId: string): Promise<boolean> {
  const content = await getChatContent(page);
  const keywords = PILL_RESPONSE_KEYWORDS[pillId] || [];
  return keywords.some(keyword => content.includes(keyword.toLowerCase()));
}

/**
 * Get all expected keywords for a pill
 */
export function getPillKeywords(pillId: string): string[] {
  return PILL_RESPONSE_KEYWORDS[pillId] || [];
}

// ============================================================================
// SIDEBAR HELPERS
// ============================================================================

/**
 * Sidebar quick actions by context
 */
export const SIDEBAR_QUICK_ACTIONS: Record<string, { label: string; message: string }[]> = {
  explore: [
    { label: 'Trending Projects', message: 'Show me trending projects' },
    { label: 'Find Projects', message: 'Help me find projects' },
  ],
  learn: [
    { label: 'Learn AI Basics', message: 'Teach me AI basics' },
    { label: 'Quiz Me', message: 'Quiz me on what I learned' },
  ],
  project: [
    { label: 'Add Media', message: 'I want to add media to my project' },
    { label: 'Edit Details', message: 'Help me edit my project details' },
  ],
  default: [
    { label: 'I need help', message: 'I need help' },
    { label: 'I want to do something fun', message: 'I want to do something fun' },
  ],
};

/**
 * Get visible quick action buttons in sidebar
 */
export async function getSidebarQuickActions(page: Page): Promise<string[]> {
  const actions = page.locator('button.rounded-full');
  const count = await actions.count();
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await actions.nth(i).textContent();
    if (text) labels.push(text.trim());
  }

  return labels;
}

/**
 * Click a sidebar quick action by label
 */
export async function clickSidebarQuickAction(page: Page, actionLabel: string): Promise<void> {
  const action = page.locator(`button.rounded-full:has-text("${actionLabel}")`);
  await action.waitFor({ state: 'visible', timeout: 5000 });
  await action.click();
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Log current pill state for debugging
 */
export async function debugLogPills(page: Page, label: string = 'Pills'): Promise<void> {
  const pills = await getVisiblePillLabels(page);
  console.log(`\n=== ${label} ===`);
  console.log(`Visible pills (${pills.length}):`, pills);
  console.log('='.repeat(50) + '\n');
}
