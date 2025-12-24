/**
 * Command validation utilities for SimulatedTerminal
 *
 * Validates user input against expected patterns with configurable strictness.
 */
import type { SkillLevel } from '@/services/personalization';
import type { ValidationResult } from '../types';

/**
 * Normalize input for comparison (trim, collapse whitespace)
 */
function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Validate user input against expected patterns
 *
 * @param input - User's input
 * @param expectedInputs - Array of expected patterns (can be regex strings)
 * @param skillLevel - User's skill level (affects strictness)
 * @param exerciseType - Type of exercise (affects validation approach)
 */
export function validateCommand(
  input: string,
  expectedInputs: string[],
  skillLevel: SkillLevel,
  exerciseType?: string
): ValidationResult {
  const normalizedInput = normalizeInput(input);

  if (!normalizedInput) {
    return { isValid: false, feedback: 'Please enter a command' };
  }

  // For ai_prompt exercises, be very lenient - any reasonable question/prompt is valid
  if (exerciseType === 'ai_prompt') {
    // Accept any input that:
    // 1. Is at least 3 words (a meaningful question/prompt)
    // 2. OR contains a question mark
    // 3. OR is a reasonable length (10+ chars)
    const wordCount = normalizedInput.split(/\s+/).length;
    const hasQuestionMark = normalizedInput.includes('?');
    const isReasonableLength = normalizedInput.length >= 10;

    if (wordCount >= 3 || hasQuestionMark || isReasonableLength) {
      return { isValid: true };
    }

    return {
      isValid: false,
      feedback: 'Try writing a more complete question or prompt. What would you like to ask the AI?'
    };
  }

  // Determine strictness based on skill level
  const maxTypoDistance = skillLevel === 'beginner' ? 3 : skillLevel === 'intermediate' ? 2 : 1;

  for (const expected of expectedInputs) {
    // Check if it's a regex pattern (starts with ^ or contains special chars)
    if (expected.startsWith('^') || expected.includes('\\') || expected.endsWith('$')) {
      try {
        const regex = new RegExp(expected, 'i');
        if (regex.test(normalizedInput)) {
          return { isValid: true };
        }
      } catch {
        // If invalid regex, fall through to exact match
      }
    }

    // Exact match (case insensitive for beginners/intermediate)
    const compareInput = skillLevel === 'advanced' ? normalizedInput : normalizedInput.toLowerCase();
    const compareExpected = skillLevel === 'advanced' ? expected : expected.toLowerCase();

    if (compareInput === compareExpected) {
      return { isValid: true };
    }

    // Typo tolerance for beginners/intermediate
    if (skillLevel !== 'advanced') {
      const distance = levenshteinDistance(compareInput, compareExpected);
      if (distance <= maxTypoDistance && distance > 0) {
        return {
          isValid: false,
          feedback: `Almost! Did you mean: ${expected}`,
        };
      }
    }
  }

  return { isValid: false };
}

/**
 * Get the prompt symbol based on exercise type
 */
export function getPromptSymbol(exerciseType: string): string {
  switch (exerciseType) {
    case 'git':
      return '$ ';
    case 'terminal':
      return '$ ';
    case 'ai_prompt':
      return '> ';
    case 'code_review':
      return '>>> ';
    default:
      return '$ ';
  }
}
