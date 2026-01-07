/**
 * AuthPage Component Tests - Real User Scenarios (TDD)
 *
 * Tests for actual user-facing behavior:
 * - OAuth button rendering and clicks
 * - Referral code display
 * - Redirect when already authenticated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

import AuthPage from './AuthPage';

// Mock framer-motion to avoid animation issues in tests
// Need to strip framer-motion specific props to prevent React warnings
vi.mock('framer-motion', () => {
  const filterMotionProps = (props: any) => {
    const {
      initial: _initial, animate: _animate, exit: _exit, variants: _variants, transition: _transition,
      whileHover: _whileHover, whileTap: _whileTap, whileFocus: _whileFocus, whileInView: _whileInView,
      onAnimationStart: _onAnimationStart, onAnimationComplete: _onAnimationComplete,
      ...rest
    } = props;
    return rest;
  };

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
      header: ({ children, ...props }: any) => <header {...filterMotionProps(props)}>{children}</header>,
      img: (props: any) => <img {...filterMotionProps(props)} />,
      h1: ({ children, ...props }: any) => <h1 {...filterMotionProps(props)}>{children}</h1>,
      p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
      button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...filterMotionProps(props)}>{children}</button>
      ),
      span: ({ children, ...props }: any) => <span {...filterMotionProps(props)}>{children}</span>,
      input: (props: any) => <input {...filterMotionProps(props)} />,
      a: ({ children, ...props }: any) => <a {...filterMotionProps(props)}>{children}</a>,
      nav: ({ children, ...props }: any) => <nav {...filterMotionProps(props)}>{children}</nav>,
      main: ({ children, ...props }: any) => <main {...filterMotionProps(props)}>{children}</main>,
      footer: ({ children, ...props }: any) => <footer {...filterMotionProps(props)}>{children}</footer>,
    },
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => 0,
    useReducedMotion: () => true, // Disable animations in tests
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock FontAwesome icons
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid={`icon-${icon.iconName || 'unknown'}`} />,
}));

// Mock referral service
vi.mock('@/services/referral', () => ({
  validateReferralCode: vi.fn().mockResolvedValue({ valid: false }),
  storeReferralCode: vi.fn(),
  getStoredReferralCode: vi.fn().mockReturnValue(null),
  getStoredReferrerUsername: vi.fn().mockReturnValue(null),
}));

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  analytics: {
    referralCodeCaptured: vi.fn(),
  },
}));

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useNavigate - only mock what we need, keep the rest real
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    // Don't mock useSearchParams - let BrowserRouter provide it
  };
});

describe('AuthPage - Real User Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
    // Default: user not authenticated
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
  });

  describe('OAuth Login Buttons', () => {
    it('renders all OAuth provider buttons', () => {
      render(<AuthPage />);

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with linkedin/i })).toBeInTheDocument();
    });

    it('redirects to Google OAuth on button click', async () => {
      const user = userEvent.setup();

      // Mock window.location.href
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      });

      render(<AuthPage />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(googleButton);

      expect(window.location.href).toContain('/accounts/google/login/');

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('redirects to GitHub OAuth on button click', async () => {
      const user = userEvent.setup();

      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      });

      render(<AuthPage />);

      const githubButton = screen.getByRole('button', { name: /sign in with github/i });
      await user.click(githubButton);

      expect(window.location.href).toContain('/accounts/github/login/');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
  });

  describe('Authentication Redirect', () => {
    it('redirects to home when user is already authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { username: 'testuser' },
      });

      render(<AuthPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/home');
      });
    });

    it('does not redirect when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });

      render(<AuthPage />);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Referral Code Display', () => {
    it('shows referral banner when valid referral code is stored', async () => {
      const { getStoredReferralCode, getStoredReferrerUsername } = await import('@/services/referral');
      vi.mocked(getStoredReferralCode).mockReturnValue('ABC123');
      vi.mocked(getStoredReferrerUsername).mockReturnValue('frienduser');

      render(<AuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/referred by/i)).toBeInTheDocument();
        expect(screen.getByText('@frienduser')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has skip to main content link', () => {
      render(<AuthPage />);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('has accessible labels on OAuth buttons', () => {
      render(<AuthPage />);

      expect(screen.getByRole('button', { name: /sign in with google/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /sign in with github/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /sign in with linkedin/i })).toHaveAttribute('aria-label');
    });
  });

  describe('Page Content', () => {
    it('shows welcome message', () => {
      render(<AuthPage />);

      expect(screen.getByText(/welcome to/i)).toBeInTheDocument();
      // "All Thrive" appears in multiple places (header and welcome section)
      const allThriveElements = screen.getAllByText('All Thrive');
      expect(allThriveElements.length).toBeGreaterThan(0);
    });

    it('has link to explore page for browsing', () => {
      render(<AuthPage />);

      const browseLink = screen.getByText(/just browsing\?/i);
      expect(browseLink).toHaveAttribute('href', '/explore');
    });

    it('has links to terms and privacy policy', () => {
      render(<AuthPage />);

      expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    });
  });
});
