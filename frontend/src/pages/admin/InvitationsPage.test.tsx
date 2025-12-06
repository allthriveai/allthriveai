import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from '@/context/ThemeContext';

/**
 * Note: The InvitationsPage component has complex dependencies that make
 * full integration testing challenging (pagination state, API calls, etc).
 *
 * These tests focus on:
 * 1. Role-based access control - ensuring only admins can access the page
 * 2. Basic rendering verification
 *
 * For comprehensive E2E testing of invitation workflows, consider using
 * Playwright or Cypress with a full backend mock.
 */

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API - return stats synchronously
vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          data: { pending: 0, approved: 0, rejected: 0, total: 0 },
        });
      }
      return Promise.resolve({
        data: { results: [], count: 0, next: null, previous: null },
      });
    }),
    post: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
  },
}));

// Mock DashboardLayout to avoid QueryClient requirement
vi.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

// Mock AdminLayout
vi.mock('@/components/layouts/AdminLayout', () => ({
  AdminLayout: ({ children, pendingInvitationsCount }: any) => (
    <div data-testid="admin-layout" data-pending={pendingInvitationsCount}>
      {children}
    </div>
  ),
}));

// Import after mocks are set up
import AdminInvitationsPage from './InvitationsPage';

describe('AdminInvitationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider>
          <AdminInvitationsPage />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  describe('Access Control', () => {
    it('should redirect non-admin users to home', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'user', role: 'explorer' },
      });

      renderPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should not render content for non-admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'user', role: 'explorer' },
      });

      renderPage();

      // Should not show the main content
      expect(screen.queryByText('Invitation Requests')).not.toBeInTheDocument();
    });

    it('should render AdminLayout wrapper for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });

      renderPage();

      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    });

    it('should render DashboardLayout wrapper for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });

      renderPage();

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should not render for vendor users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      renderPage();

      expect(screen.queryByText('Invitation Requests')).not.toBeInTheDocument();
    });

    it('should not render for null user', () => {
      mockUseAuth.mockReturnValue({
        user: null,
      });

      renderPage();

      expect(screen.queryByText('Invitation Requests')).not.toBeInTheDocument();
    });

    it('should show loading state for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });

      renderPage();

      expect(screen.getByText('Loading invitations...')).toBeInTheDocument();
    });
  });
});
