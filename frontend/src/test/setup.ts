import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Add custom matchers from @testing-library/jest-dom
// This allows us to use matchers like .toBeInTheDocument(), .toHaveTextContent(), etc.

// Mock the AuthContext and useAuth hook to prevent "useAuth must be used within an AuthProvider" errors
vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  AuthContext: {}, // minimal mock
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock useActiveQuest to prevent QueryClient errors
vi.mock('@/hooks/useActiveQuest', () => ({
  useActiveQuest: () => ({
    activeQuest: null,
    questTrayOpen: false,
    setQuestTrayOpen: vi.fn(),
    selectedQuest: null,
    setSelectedQuest: vi.fn(),
    startQuest: vi.fn(),
    completeQuest: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock QuestCompletionContext to prevent "useQuestCompletion must be used within a QuestCompletionProvider" errors
vi.mock('@/contexts/QuestCompletionContext', () => ({
  QuestCompletionProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuestCompletion: () => ({
    showCelebration: vi.fn(),
  }),
}));

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver for components that use it
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock scrollIntoView - not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock window.scrollTo - not available in jsdom
window.scrollTo = vi.fn();

// =============================================================================
// CONSOLE ERROR TRACKING
// =============================================================================
// Catches unexpected React warnings and errors during tests.
// Tests will FAIL if console.error is called unexpectedly.
// To mark an error as expected (e.g., testing error boundaries), include '[EXPECTED]' in the message.

const originalConsoleError = console.error;
const consoleErrors: string[] = [];

// Known warnings to ignore (jsdom/testing-library issues, not real bugs)
const IGNORED_WARNINGS = [
  'Warning: ReactDOM.render is no longer supported', // jsdom compatibility
  'Warning: An update to', // React 18 concurrent mode warnings in tests
  'An update to', // Same warning without "Warning:" prefix
  'Warning: Cannot update a component', // Sometimes triggers in test cleanup
  'Warning: `ReactDOMTestUtils.act` is deprecated', // Testing library deprecation
  'Download the React DevTools', // Dev tools prompt
  'Warning: React does not recognize the `fetchPriority`', // Image optimization warning
  'React does not recognize the', // framer-motion props (whileHover, whileTap)
  'inside a test was not wrapped in act', // act() warnings from async state updates
  '[WebSocket]', // Intentional debug logging from WebSocket hooks
];

beforeEach(() => {
  consoleErrors.length = 0; // Clear before each test
  console.error = (...args: unknown[]) => {
    const message = String(args[0]);
    consoleErrors.push(message);
    // Still log to console for visibility during test runs
    originalConsoleError.apply(console, args);
  };
});

afterEach(() => {
  // Restore original console.error
  console.error = originalConsoleError;

  // Filter out expected and known-ignorable errors
  const unexpected = consoleErrors.filter((msg) => {
    // Allow explicitly expected errors
    if (msg.includes('[EXPECTED]')) return false;
    // Allow known jsdom/testing-library warnings
    if (IGNORED_WARNINGS.some((warning) => msg.includes(warning))) return false;
    return true;
  });

  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected console.error during test:\n\n${unexpected.map((e) => `  • ${e.substring(0, 200)}${e.length > 200 ? '...' : ''}`).join('\n')}\n\nTo mark an error as expected, include '[EXPECTED]' in the error message.`
    );
  }
});
