import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { vi } from 'vitest';
import type { User } from '@/types/models';

// Create a new QueryClient for each test to ensure test isolation
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render, createTestQueryClient };

// =============================================================================
// MOCK FACTORIES
// =============================================================================
// Use these to create realistic test data that matches TypeScript interfaces.

/**
 * Create a mock User object for testing
 * @example
 * const user = createMockUser({ username: 'alice' });
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    role: 'explorer',
    roleDisplay: 'Explorer',
    avatarUrl: undefined,
    bio: '',
    level: 1,
    totalPoints: 100,
    currentStreak: 5,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create mock battle props for testing BattleArena and related components
 * @example
 * const props = createMockBattleProps({ hasSubmitted: true });
 */
export function createMockBattleProps(overrides: Record<string, unknown> = {}) {
  return {
    challengeText: 'Create an image of a futuristic city',
    challengeType: { key: 'creative', name: 'Creative' },
    currentUser: createMockUser(),
    opponent: createMockUser({ id: 2, username: 'opponent' }),
    currentUserStatus: 'connected' as const,
    opponentStatus: 'connected' as const,
    timeRemaining: 180,
    hasSubmitted: false,
    onSubmit: vi.fn(),
    onTyping: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a mock WebSocket with controllable state for testing
 * @example
 * const ws = createMockWebSocket();
 * ws.simulateMessage({ type: 'chunk', content: 'Hello' });
 * ws.simulateClose(1006);
 */
export function createMockWebSocket() {
  let onmessageHandler: ((event: MessageEvent) => void) | null = null;
  let oncloseHandler: ((event: CloseEvent) => void) | null = null;
  let onerrorHandler: ((event: Event) => void) | null = null;
  let onopenHandler: ((event: Event) => void) | null = null;

  const mock = {
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.OPEN as number,

    // Property setters to capture handlers
    set onmessage(handler: ((event: MessageEvent) => void) | null) {
      onmessageHandler = handler;
    },
    get onmessage() {
      return onmessageHandler;
    },
    set onclose(handler: ((event: CloseEvent) => void) | null) {
      oncloseHandler = handler;
    },
    get onclose() {
      return oncloseHandler;
    },
    set onerror(handler: ((event: Event) => void) | null) {
      onerrorHandler = handler;
    },
    get onerror() {
      return onerrorHandler;
    },
    set onopen(handler: ((event: Event) => void) | null) {
      onopenHandler = handler;
    },
    get onopen() {
      return onopenHandler;
    },

    // Test helpers to simulate server events
    simulateOpen: () => {
      mock.readyState = WebSocket.OPEN;
      onopenHandler?.({} as Event);
    },
    simulateMessage: (data: unknown) => {
      onmessageHandler?.({
        data: typeof data === 'string' ? data : JSON.stringify(data),
      } as MessageEvent);
    },
    simulateClose: (code = 1000, reason = '') => {
      mock.readyState = WebSocket.CLOSED;
      oncloseHandler?.({ code, reason } as CloseEvent);
    },
    simulateError: () => {
      onerrorHandler?.({} as Event);
    },
  };

  return mock;
}

/**
 * Create a mock chat message for testing
 */
export function createMockChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: `msg-${Date.now()}`,
    content: 'Test message content',
    sender: 'user' as const,
    timestamp: new Date(),
    ...overrides,
  };
}
