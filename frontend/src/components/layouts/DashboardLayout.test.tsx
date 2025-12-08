import { render, screen, waitFor } from '@/test/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import type { ReactNode } from 'react';

// Mock child components
vi.mock('@/components/about', () => ({
  RightAboutPanel: ({ isOpen }: any) => {
    console.log('[Mock] RightAboutPanel called with isOpen:', isOpen);
    return isOpen ? <div data-testid="right-about-panel">About Panel</div> : null;
  },
}));

vi.mock('@/components/events/RightEventsCalendarPanel', () => ({
  RightEventsCalendarPanel: ({ isOpen }: any) =>
    isOpen ? <div data-testid="right-events-panel">Events Panel</div> : null,
}));

vi.mock('@/components/chat/IntelligentChatPanel', () => ({
  IntelligentChatPanel: ({ isOpen }: any) =>
    isOpen ? <div data-testid="intelligent-chat-panel">Intelligent Chat Panel</div> : null,
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { username: 'testuser' },
  }),
}));

// Mock useActiveQuest hook
vi.mock('@/hooks/useActiveQuest', () => ({
  useActiveQuest: () => ({
    questTrayOpen: false,
    selectedQuest: null,
    openQuestTray: vi.fn(),
    openActiveQuestTray: vi.fn(),
    closeQuestTray: vi.fn(),
    getQuestColors: vi.fn(() => ({ colorFrom: '#3b82f6', colorTo: '#8b5cf6' })),
    getQuestCategory: vi.fn(() => null),
  }),
}));

// Mock onboarding components
vi.mock('@/components/onboarding', () => ({
  EmberAdventureBanner: () => null,
  useEmberOnboardingContextSafe: () => null,
}));

// Mock react-router-dom to prevent location changes from closing panels
// Use MemoryRouter instead of BrowserRouter to have a stable location
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <actual.MemoryRouter initialEntries={['/']}>{children}</actual.MemoryRouter>
    ),
  };
});

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear();
  });

  const renderDashboardLayout = (props = {}) => {
    return render(
      <DashboardLayout {...props}>
        <div data-testid="dashboard-content">Dashboard Content</div>
      </DashboardLayout>
    );
  };

  describe('GitHub OAuth Return Flow', () => {
    it('should open Add Project panel when github_oauth_return is set to add_project_chat', async () => {
      // Set up localStorage to simulate OAuth return
      localStorage.setItem('github_oauth_return', 'add_project_chat');

      // Render component
      renderDashboardLayout();

      // Wait for the WebSocket Chat panel to open
      await waitFor(() => {
        const chatPanel = screen.getByTestId('intelligent-chat-panel');
        expect(chatPanel).toBeInTheDocument();
      });

      // Verify the panel is displayed
      expect(screen.getByText('Intelligent Chat Panel')).toBeInTheDocument();
    });

    it('should not open Add Project panel when github_oauth_return is not set', () => {
      // No localStorage flag set
      renderDashboardLayout();

      // WebSocket Chat panel should not be visible
      const chatPanel = screen.queryByTestId('intelligent-chat-panel');
      expect(chatPanel).not.toBeInTheDocument();
    });

    it('should not open Add Project panel when github_oauth_return has different value', () => {
      // Set up localStorage with a different value
      localStorage.setItem('github_oauth_return', 'some_other_value');

      renderDashboardLayout();

      // WebSocket Chat panel should not be visible
      const chatPanel = screen.queryByTestId('intelligent-chat-panel');
      expect(chatPanel).not.toBeInTheDocument();
    });

    it('should only check OAuth return on mount', async () => {
      // Set up localStorage to simulate OAuth return
      localStorage.setItem('github_oauth_return', 'add_project_chat');

      const { rerender } = renderDashboardLayout();

      // Wait for the Add Project panel to open
      await waitFor(() => {
        expect(screen.getByTestId('intelligent-chat-panel')).toBeInTheDocument();
      });

      // Clear localStorage
      localStorage.removeItem('github_oauth_return');

      // Rerender the component
      rerender(
        <DashboardLayout>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </DashboardLayout>
      );

      // Panel should still be open (useEffect only runs on mount)
      expect(screen.getByTestId('intelligent-chat-panel')).toBeInTheDocument();
    });
  });

  describe('Panel Management', () => {
    it('should close other panels when Add Project panel is opened', async () => {
      // Set up localStorage to simulate OAuth return
      localStorage.setItem('github_oauth_return', 'add_project_chat');

      renderDashboardLayout({ openAboutPanel: true });

      // Wait for WebSocket Chat panel to open
      await waitFor(() => {
        expect(screen.getByTestId('intelligent-chat-panel')).toBeInTheDocument();
      });

      // About panel should be closed
      expect(screen.queryByTestId('right-about-panel')).not.toBeInTheDocument();
    });

    it('should render child content correctly', () => {
      renderDashboardLayout();

      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('should render function children with correct props', () => {
      const functionChild = vi.fn(({ openChat, openAddProject }) => (
        <div>
          <button onClick={() => openChat('Chat')}>Open Chat</button>
          <button onClick={openAddProject}>Open Add Project</button>
        </div>
      ));

      render(
        <DashboardLayout>{functionChild}</DashboardLayout>
      );

      // Verify function was called with correct props
      expect(functionChild).toHaveBeenCalledWith(
        expect.objectContaining({
          openChat: expect.any(Function),
          openAddProject: expect.any(Function),
        })
      );
    });
  });

  describe('openAboutPanel prop', () => {
    it('should open about panel when openAboutPanel prop is true', () => {
      renderDashboardLayout({ openAboutPanel: true });

      expect(screen.getByTestId('right-about-panel')).toBeInTheDocument();
    });

    it('should not open about panel when openAboutPanel prop is false', () => {
      renderDashboardLayout({ openAboutPanel: false });

      expect(screen.queryByTestId('right-about-panel')).not.toBeInTheDocument();
    });
  });
});
