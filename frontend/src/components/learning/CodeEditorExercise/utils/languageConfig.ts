/**
 * Monaco Editor language configuration utilities
 */

import type { CodeLanguage } from '../types';

/**
 * Map our language types to Monaco's language identifiers
 */
export function getMonacoLanguage(language: CodeLanguage): string {
  switch (language) {
    case 'python':
      return 'python';
    case 'javascript':
      return 'javascript';
    case 'typescript':
      return 'typescript';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    default:
      return 'plaintext';
  }
}

/**
 * Get file extension for language (for display)
 */
export function getFileExtension(language: CodeLanguage): string {
  switch (language) {
    case 'python':
      return '.py';
    case 'javascript':
      return '.js';
    case 'typescript':
      return '.ts';
    case 'html':
      return '.html';
    case 'css':
      return '.css';
    default:
      return '.txt';
  }
}

/**
 * Get display name for language
 */
export function getLanguageDisplayName(language: CodeLanguage): string {
  switch (language) {
    case 'python':
      return 'Python';
    case 'javascript':
      return 'JavaScript';
    case 'typescript':
      return 'TypeScript';
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    default:
      return 'Code';
  }
}

/**
 * Get default starter code for language if none provided
 */
export function getDefaultStarterCode(language: CodeLanguage): string {
  switch (language) {
    case 'python':
      return '# Write your Python code here\n\n';
    case 'javascript':
      return '// Write your JavaScript code here\n\n';
    case 'typescript':
      return '// Write your TypeScript code here\n\n';
    case 'html':
      return '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  \n</body>\n</html>';
    case 'css':
      return '/* Write your CSS here */\n\n';
    default:
      return '';
  }
}

/**
 * Get Monaco editor options specific to language
 */
export function getLanguageEditorOptions(language: CodeLanguage): Record<string, unknown> {
  const baseOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: language === 'python' ? 4 : 2,
    insertSpaces: true,
    wordWrap: 'on' as const,
    folding: true,
    renderLineHighlight: 'line' as const,
    selectOnLineNumbers: true,
    roundedSelection: true,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    smoothScrolling: true,
    padding: { top: 16, bottom: 16 },
  };

  // Language-specific overrides
  switch (language) {
    case 'html':
      return {
        ...baseOptions,
        formatOnType: true,
        autoClosingBrackets: 'languageDefined' as const,
        autoClosingQuotes: 'languageDefined' as const,
      };
    case 'python':
      return {
        ...baseOptions,
        autoIndent: 'full' as const,
      };
    default:
      return baseOptions;
  }
}
