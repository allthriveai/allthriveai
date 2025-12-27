/**
 * Client-side code validation (Tier 1)
 * Fast syntax checks before sending to server
 */

import type { CodeLanguage, CodeFeedback, CodeFeedbackIssue } from '../types';

interface ClientValidationResult {
  hasErrors: boolean;
  feedback: CodeFeedback | null;
}

/**
 * Basic bracket/parenthesis matching
 */
function checkBracketBalance(code: string): CodeFeedbackIssue | null {
  const stack: Array<{ char: string; line: number }> = [];
  const pairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
  };
  const closers = new Set([')', ']', '}']);

  const lines = code.split('\n');
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    // Skip strings and comments for simple validation
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      // Track string state
      if ((char === '"' || char === "'" || char === '`') && (i === 0 || line[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (inString) continue;

      // Check for comment start
      if (char === '/' && line[i + 1] === '/') break;
      if (char === '#') break; // Python comment

      if (pairs[char]) {
        stack.push({ char, line: lineNum + 1 });
      } else if (closers.has(char)) {
        const last = stack.pop();
        if (!last) {
          return {
            type: 'error',
            line: lineNum + 1,
            message: `Unexpected closing '${char}'`,
            explanation: `Found a closing '${char}' without a matching opening bracket.`,
            hint: 'Check if you have an extra closing bracket or if you\'re missing an opening one.',
          };
        }
        if (pairs[last.char] !== char) {
          return {
            type: 'error',
            line: lineNum + 1,
            message: `Mismatched brackets: expected '${pairs[last.char]}' but found '${char}'`,
            explanation: `You opened with '${last.char}' on line ${last.line} but closed with '${char}'.`,
            hint: 'Make sure your brackets are properly paired.',
          };
        }
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return {
      type: 'error',
      line: unclosed.line,
      message: `Unclosed '${unclosed.char}'`,
      explanation: `You opened '${unclosed.char}' but never closed it with '${pairs[unclosed.char]}'.`,
      hint: `Add a closing '${pairs[unclosed.char]}' to match your opening '${unclosed.char}'.`,
    };
  }

  return null;
}

/**
 * Check for common Python-specific syntax issues
 */
function checkPythonSyntax(code: string): CodeFeedbackIssue[] {
  const issues: CodeFeedbackIssue[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Check for missing colon after def/if/else/for/while/class
    const needsColon = /^(def|if|elif|else|for|while|class|try|except|finally|with)\s/.test(trimmed);
    if (needsColon && !trimmed.endsWith(':') && !trimmed.includes('#')) {
      // Check if it's a multi-line statement (ends with line continuation or bracket)
      if (!trimmed.endsWith('\\') && !trimmed.endsWith('(') && !trimmed.endsWith('[') && !trimmed.endsWith('{')) {
        issues.push({
          type: 'error',
          line: lineNum,
          message: 'Missing colon',
          explanation: `In Python, statements like '${trimmed.split(' ')[0]}' must end with a colon (:).`,
          hint: `Add a colon at the end of line ${lineNum}.`,
        });
      }
    }

    // Check for = vs == in conditions
    if (/^(if|elif|while)\s/.test(trimmed)) {
      // Look for single = that's not part of == or <=, >=, !=
      const condition = trimmed.replace(/[<>!=]=/, '').replace(/==/g, '');
      if (/[^=!<>]=[^=]/.test(condition)) {
        issues.push({
          type: 'warning',
          line: lineNum,
          message: 'Possible assignment in condition',
          explanation: 'Using = instead of == in a condition assigns a value instead of comparing.',
          hint: 'Did you mean to use == for comparison?',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for common JavaScript-specific syntax issues
 */
function checkJavaScriptSyntax(code: string): CodeFeedbackIssue[] {
  const issues: CodeFeedbackIssue[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Check for var usage (suggest let/const)
    if (/\bvar\s+/.test(trimmed)) {
      issues.push({
        type: 'suggestion',
        line: lineNum,
        message: 'Consider using let or const instead of var',
        explanation: 'Modern JavaScript prefers let (for variables that change) or const (for constants).',
        hint: 'Replace var with let if the value changes, or const if it stays the same.',
      });
    }

    // Check for == instead of === (common beginner mistake)
    if (/[^=!]==[^=]/.test(trimmed) && !/===/.test(trimmed)) {
      issues.push({
        type: 'warning',
        line: lineNum,
        message: 'Consider using === instead of ==',
        explanation: '== does type coercion which can lead to unexpected results. === is stricter.',
        hint: 'Use === for strict equality comparison.',
      });
    }
  }

  return issues;
}

/**
 * Check for common HTML issues
 */
function checkHTMLSyntax(code: string): CodeFeedbackIssue[] {
  const issues: CodeFeedbackIssue[] = [];
  const lines = code.split('\n');

  // Check for DOCTYPE
  if (!code.toLowerCase().includes('<!doctype html>')) {
    issues.push({
      type: 'warning',
      line: 1,
      message: 'Missing DOCTYPE declaration',
      explanation: 'HTML documents should start with <!DOCTYPE html> to ensure proper rendering.',
      hint: 'Add <!DOCTYPE html> at the very beginning of your HTML file.',
    });
  }

  // Track open tags
  const tagStack: Array<{ tag: string; line: number }> = [];
  const selfClosing = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);

  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*\/?>/gi;
  let match;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    while ((match = tagRegex.exec(line)) !== null) {
      const fullMatch = match[0];
      const tagName = match[1].toLowerCase();

      if (fullMatch.startsWith('</')) {
        // Closing tag
        const last = tagStack.pop();
        if (!last) {
          issues.push({
            type: 'error',
            line: lineNum,
            message: `Unexpected closing tag </${tagName}>`,
            explanation: `Found a closing tag without a matching opening tag.`,
          });
        } else if (last.tag !== tagName) {
          issues.push({
            type: 'error',
            line: lineNum,
            message: `Mismatched tags: expected </${last.tag}> but found </${tagName}>`,
            explanation: `You opened <${last.tag}> on line ${last.line} but are closing with </${tagName}>.`,
          });
        }
      } else if (!selfClosing.has(tagName) && !fullMatch.endsWith('/>')) {
        // Opening tag (not self-closing)
        tagStack.push({ tag: tagName, line: lineNum });
      }
    }
  }

  // Check for unclosed tags
  for (const unclosed of tagStack) {
    issues.push({
      type: 'error',
      line: unclosed.line,
      message: `Unclosed <${unclosed.tag}> tag`,
      explanation: `The <${unclosed.tag}> tag opened on line ${unclosed.line} is never closed.`,
      hint: `Add </${unclosed.tag}> to close this tag.`,
    });
  }

  return issues;
}

/**
 * Main client-side validation function
 */
export function validateClientSide(code: string, language: CodeLanguage): ClientValidationResult {
  // Empty code check
  if (!code.trim()) {
    return {
      hasErrors: true,
      feedback: {
        isCorrect: false,
        status: 'needs_work',
        issues: [{
          type: 'error',
          message: 'No code entered',
          explanation: 'Write some code to check!',
        }],
        aiUsed: false,
      },
    };
  }

  const issues: CodeFeedbackIssue[] = [];

  // Universal bracket check (except HTML/CSS)
  if (language !== 'html' && language !== 'css') {
    const bracketIssue = checkBracketBalance(code);
    if (bracketIssue) {
      issues.push(bracketIssue);
    }
  }

  // Language-specific checks
  switch (language) {
    case 'python':
      issues.push(...checkPythonSyntax(code));
      break;
    case 'javascript':
    case 'typescript':
      issues.push(...checkJavaScriptSyntax(code));
      break;
    case 'html':
      issues.push(...checkHTMLSyntax(code));
      break;
    // CSS validation is complex, defer to server
  }

  // Only block on errors, not warnings/suggestions
  const hasBlockingErrors = issues.some(i => i.type === 'error');

  if (hasBlockingErrors) {
    return {
      hasErrors: true,
      feedback: {
        isCorrect: false,
        status: 'needs_work',
        issues,
        aiUsed: false,
      },
    };
  }

  // If only warnings/suggestions, don't block but include them
  if (issues.length > 0) {
    return {
      hasErrors: false,
      feedback: {
        isCorrect: false,
        status: 'almost_there',
        issues,
        aiUsed: false,
      },
    };
  }

  return { hasErrors: false, feedback: null };
}
