import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminLayout } from './AdminLayout';
import { ThemeProvider } from '@/context/ThemeContext';

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

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAdminLayout = (props = {}, route = '/admin/analytics') => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider>
          <AdminLayout {...props}>
            <div data-testid="admin-content">Admin Content</div>
          </AdminLayout>
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  describe('Access Control', () => {
    it('should render content for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });

      renderAdminLayout();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });

    it('should not render content for non-admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'user', role: 'explorer' },
      });

      renderAdminLayout();

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('should redirect non-admin users to home', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'user', role: 'explorer' },
      });

      renderAdminLayout();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should not render when user is null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
      });

      renderAdminLayout();

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });
    });

    it('should render Analytics nav item', () => {
      renderAdminLayout();

      // Multiple elements due to mobile/desktop nav - use getAllBy
      const analyticsItems = screen.getAllByText('Analytics');
      expect(analyticsItems.length).toBeGreaterThan(0);
    });

    it('should render User Management nav item with Invitations submenu', async () => {
      renderAdminLayout();

      // User Management is now the parent menu containing Invitations
      const userManagementItems = screen.getAllByText('User Management');
      expect(userManagementItems.length).toBeGreaterThan(0);

      // Click to expand User Management menu
      const desktopButton = userManagementItems.find(el => el.closest('button'));
      if (desktopButton) {
        fireEvent.click(desktopButton.closest('button')!);
      }

      // Now Invitations should be visible
      await waitFor(() => {
        const invitationsItems = screen.getAllByText('Invitations');
        expect(invitationsItems.length).toBeGreaterThan(0);
      });
    });

    it('should highlight active nav item based on current path', async () => {
      renderAdminLayout({}, '/admin/users/invitations');

      // The User Management menu should auto-expand when on its child route
      await waitFor(() => {
        const invitationsLinks = screen.getAllByText('Invitations');
        expect(invitationsLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Pending Invitations Badge', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });
    });

    it('should show badge when pendingInvitationsCount > 0', () => {
      renderAdminLayout({ pendingInvitationsCount: 5 });

      // Multiple badges shown (mobile + desktop)
      const badges = screen.getAllByText('5');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should not show badge when pendingInvitationsCount is 0', () => {
      renderAdminLayout({ pendingInvitationsCount: 0 });

      // No badge should exist with a number
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should not show badge when pendingInvitationsCount is undefined', async () => {
      renderAdminLayout();

      // User Management contains Invitations - expand it first
      const userManagementItems = screen.getAllByText('User Management');
      const desktopButton = userManagementItems.find(el => el.closest('button'));
      if (desktopButton) {
        fireEvent.click(desktopButton.closest('button')!);
      }

      // Wait for Invitations to be visible
      await waitFor(() => {
        const invitationsNavs = screen.getAllByText('Invitations');
        invitationsNavs.forEach(nav => {
          const badge = nav.parentElement?.querySelector('.bg-pink-100');
          expect(badge).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('Mobile Dropdown', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });
    });

    it('should render mobile dropdown button', () => {
      renderAdminLayout();

      // Find buttons - mobile dropdown is one of them
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should toggle mobile dropdown when clicked', async () => {
      renderAdminLayout();

      // Find the mobile button (first button in the mobile div)
      const buttons = screen.getAllByRole('button');
      const mobileButton = buttons[0];

      // Click to open dropdown
      fireEvent.click(mobileButton);

      await waitFor(() => {
        // Should show dropdown menu items - more Analytics elements after opening
        const analyticsItems = screen.getAllByText('Analytics');
        expect(analyticsItems.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Admin Info Footer', () => {
    it('should display admin username', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'adminuser', role: 'admin' },
      });

      renderAdminLayout();

      expect(screen.getByText('adminuser')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    it('should display first letter of username as avatar', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'testadmin', role: 'admin' },
      });

      renderAdminLayout();

      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });

  describe('Children Rendering', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });
    });

    it('should render children content', () => {
      renderAdminLayout();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('should render custom children', () => {
      render(
        <BrowserRouter>
          <ThemeProvider>
            <AdminLayout>
              <div data-testid="custom-content">Custom Admin Page</div>
            </AdminLayout>
          </ThemeProvider>
        </BrowserRouter>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });
});
