/**
 * AI Quality Assertions for Deep E2E Tests
 *
 * Shared assertion utilities for validating AI response quality.
 * These patterns detect rejections, technical errors, and hallucinations.
 */

// ============================================================================
// REJECTION PATTERNS - AI refusing to help (TEST FAILS if matched)
// ============================================================================

export const AI_REJECTION_PATTERNS = [
  /I can't help with that/i,
  /I cannot assist with/i,
  /I don't have access to your/i,
  /I'm not able to help/i,
  /sorry.*can't help/i,
  /unable to process your request/i,
  /error occurred while processing/i,
  /something went wrong.*try again/i,
  /as an ai.*i cannot/i,
  /as a language model.*i cannot/i,
  /i apologize, but i cannot help/i,
  /unfortunately, i'm unable to help/i,
  /i'm not allowed to/i,
  /i cannot fulfill this request/i,
];

// Patterns that are NOT rejections - legitimate system limitations
// These explain why something specific can't be done while still being helpful
export const ACCEPTABLE_LIMITATION_PATTERNS = [
  /unable to clip.*already/i, // Project already clipped
  /unable to import.*connection/i, // Missing integration
  /can't access.*connect/i, // Need to connect account first
];

// ============================================================================
// TECHNICAL ERROR PATTERNS - Should never appear to users
// ============================================================================

export const TECHNICAL_ERROR_PATTERNS = [
  /TypeError/,
  /Exception/,
  /Traceback/,
  /NoneType/,
  /AttributeError/,
  /undefined is not/,
  /null is not/,
  /cannot read property/i,
  /Internal Server Error/,
  /500 error/i,
  /502 Bad Gateway/,
  /rate limit exceeded/i,
  /quota exceeded/i,
  /api key/i,
  /authentication failed/i,
  /unauthorized/i,
  /connection refused/i,
  /socket error/i,
];

// ============================================================================
// HALLUCINATION PATTERNS - AI inventing non-existent features
// ============================================================================

export const HALLUCINATION_PATTERNS = [
  /premium subscription|upgrade to pro/i, // No premium tiers with this terminology
  /allthrive\.com/i, // Wrong domain (should be allthriveai.com or platform references)
  /click the hamburger menu/i, // UI doesn't have this specific element
  /go to settings.*gear icon/i, // Specific UI that might not exist
];

// ============================================================================
// TOPIC RELEVANCE KEYWORDS
// ============================================================================

export const TOPIC_KEYWORDS = {
  contextWindow: [
    'context',
    'token',
    'memory',
    'limit',
    'window',
    'input',
    'maximum',
    'llm',
    'characters',
    'conversation',
    'model',
    'size',
    'capacity',
  ],
  discovery: [
    'project',
    'trending',
    'popular',
    'creator',
    'recommend',
    'explore',
    'check out',
    'found',
    'here are',
  ],
  import: [
    'import',
    'project',
    'github',
    'repository',
    'repo',
    'clip',
    'save',
    'added',
    'created',
  ],
  learning: [
    'learning',
    'path',
    'course',
    'topic',
    'study',
    'start',
    'begin',
    'concept',
    'tutorial',
    'lesson',
  ],
  greeting: ['hello', 'hi', 'hey', 'good', 'great', 'help', 'assist', 'welcome'],
  navigation: ['go to', 'navigate', 'take you', 'find', 'here', 'page', 'section'],
  creation: ['create', 'make', 'build', 'new', 'start', 'generate'],
  games: ['game', 'play', 'fun', 'challenge', 'battle', 'quiz'],
};

// ============================================================================
// ASSERTION FUNCTIONS
// ============================================================================

/**
 * Assert response doesn't contain rejection patterns
 * Excludes acceptable limitation patterns (e.g., "unable to clip because already exists")
 */
export function assertNoRejection(text: string, context: string): void {
  // First check if this is an acceptable limitation (not a rejection)
  for (const acceptablePattern of ACCEPTABLE_LIMITATION_PATTERNS) {
    if (acceptablePattern.test(text)) {
      return; // This is a legitimate limitation, not a rejection
    }
  }

  // Check for actual rejections
  for (const pattern of AI_REJECTION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `AI REJECTION in ${context}: Response contains "${pattern.source}"\n` +
          `Response: ${text.substring(0, 300)}...`
      );
    }
  }
}

/**
 * Assert response doesn't contain technical errors
 */
export function assertNoTechnicalErrors(text: string, context: string): void {
  for (const pattern of TECHNICAL_ERROR_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `TECHNICAL ERROR in ${context}: Response contains "${pattern.source}"\n` +
          `Response: ${text.substring(0, 300)}...`
      );
    }
  }
}

/**
 * Assert response doesn't contain hallucinations
 */
export function assertNoHallucinations(text: string, context: string): void {
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `HALLUCINATION in ${context}: Response contains "${pattern.source}"\n` +
          `Response: ${text.substring(0, 300)}...`
      );
    }
  }
}

/**
 * Assert response contains relevant keywords for a topic
 */
export function assertTopicRelevance(
  text: string,
  topic: keyof typeof TOPIC_KEYWORDS,
  context: string
): void {
  const keywords = TOPIC_KEYWORDS[topic];
  const lowerText = text.toLowerCase();

  const hasRelevantContent = keywords.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );

  if (!hasRelevantContent) {
    throw new Error(
      `TOPIC MISMATCH in ${context}: Response lacks keywords for "${topic}"\n` +
        `Expected one of: ${keywords.join(', ')}\n` +
        `Response: ${text.substring(0, 300)}...`
    );
  }
}

/**
 * Assert response has minimum length (not empty or too short)
 */
export function assertMinLength(
  text: string,
  minChars: number,
  context: string
): void {
  const trimmed = text.trim();
  if (trimmed.length < minChars) {
    throw new Error(
      `EMPTY RESPONSE in ${context}: Response too short (${trimmed.length} chars, expected ${minChars}+)\n` +
        `Response: ${trimmed}`
    );
  }
}

/**
 * Assert response has structural elements
 */
export function assertHasStructure(
  text: string,
  options: {
    hasParagraphs?: boolean;
    hasBulletPoints?: boolean;
    hasFollowUpQuestion?: boolean;
  },
  context: string
): void {
  if (options.hasParagraphs) {
    const hasParagraphs = text.split('\n\n').length > 1 || text.length > 200;
    if (!hasParagraphs) {
      throw new Error(
        `STRUCTURE MISSING in ${context}: Expected paragraphs\n` +
          `Response: ${text.substring(0, 200)}...`
      );
    }
  }

  if (options.hasBulletPoints) {
    const hasBullets = /[-•*]\s+\w/m.test(text) || /\d+\.\s+\w/m.test(text);
    if (!hasBullets) {
      throw new Error(
        `STRUCTURE MISSING in ${context}: Expected bullet points or numbered list\n` +
          `Response: ${text.substring(0, 200)}...`
      );
    }
  }

  if (options.hasFollowUpQuestion) {
    const hasQuestion = /\?/.test(text);
    if (!hasQuestion) {
      throw new Error(
        `STRUCTURE MISSING in ${context}: Expected follow-up question\n` +
          `Response: ${text.substring(0, 200)}...`
      );
    }
  }
}

/**
 * Combined assertion: Helpful response with no issues
 */
export function assertHelpfulResponse(text: string, context: string): void {
  assertNoRejection(text, context);
  assertNoTechnicalErrors(text, context);
  assertNoHallucinations(text, context);
  assertMinLength(text, 20, context);
}

/**
 * Assert response matches expected topic relevance
 */
export function assertQualityResponse(
  text: string,
  topic: keyof typeof TOPIC_KEYWORDS,
  context: string
): void {
  assertHelpfulResponse(text, context);
  assertTopicRelevance(text, topic, context);
}
