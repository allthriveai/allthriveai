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

// Suppress console errors in tests (optional - remove if you want to see them)
// global.console.error = () => {};
