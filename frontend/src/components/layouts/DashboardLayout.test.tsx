import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import { ThemeProvider } from '@/context/ThemeContext';

// Mock child components
vi.mock('@/components/navigation/LeftSidebar', () => ({
  LeftSidebar: ({ onAddProject }: any) => (
    <div data-testid="left-sidebar">
      <button onClick={onAddProject} data-testid="add-project-button">
        Add Project
      </button>
    </div>
  ),
}));

vi.mock('@/components/chat/RightChatPanel', () => ({
  RightChatPanel: ({ isOpen }: any) =>
    isOpen ? <div data-testid="right-chat-panel">Chat Panel</div> : null,
}));

vi.mock('@/components/about', () => ({
  RightAboutPanel: ({ isOpen }: any) =>
    isOpen ? <div data-testid="right-about-panel">About Panel</div> : null,
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
      <BrowserRouter>
        <ThemeProvider>
          <DashboardLayout {...props}>
            <div data-testid="dashboard-content">Dashboard Content</div>
          </DashboardLayout>
        </ThemeProvider>
      </BrowserRouter>
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
        expect(screen.getByTestId('right-add-project-chat')).toBeInTheDocument();
      });

      // Clear localStorage
      localStorage.removeItem('github_oauth_return');

      // Rerender the component
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <DashboardLayout>
              <div data-testid="dashboard-content">Dashboard Content</div>
            </DashboardLayout>
          </ThemeProvider>
        </BrowserRouter>
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
        <BrowserRouter>
          <ThemeProvider>
            <DashboardLayout>{functionChild}</DashboardLayout>
          </ThemeProvider>
        </BrowserRouter>
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
