import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VendorDashboardPage from './VendorDashboardPage';
import { ThemeProvider } from '@/context/ThemeContext';
import * as api from '@/services/api';

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

// Mock API
vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Mock DashboardLayout
vi.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

const mockVendorTools = {
  tools: [
    {
      id: 1,
      name: 'AI Tool One',
      slug: 'ai-tool-one',
      logo_url: 'https://example.com/logo1.png',
      access: {
        can_view_basic: true,
        can_view_competitive: true,
        can_view_segments: false,
        can_view_queries: false,
        can_export: false,
      },
    },
    {
      id: 2,
      name: 'AI Tool Two',
      slug: 'ai-tool-two',
      logo_url: 'https://example.com/logo2.png',
      access: {
        can_view_basic: true,
        can_view_competitive: false,
        can_view_segments: false,
        can_view_queries: false,
        can_export: false,
      },
    },
  ],
};

const mockAnalytics = {
  tool: {
    id: 1,
    name: 'AI Tool One',
    slug: 'ai-tool-one',
    logoUrl: 'https://example.com/logo1.png',
    category: 'productivity',
    tagline: 'Boost your productivity with AI',
    isFeatured: true,
    isVerified: true,
  },
  period: {
    days: 30,
    startDate: '2025-01-01',
    endDate: '2025-01-31',
  },
  metrics: {
    totalViews: 1500,
    popularityScore: 85.5,
    totalBookmarks: 120,
    recentBookmarks: 25,
    totalReviews: 45,
    recentReviewsCount: 8,
    avgRating: 4.5,
    projectsUsingTool: 30,
    categoryRank: 3,
    categoryTotal: 50,
  },
  similarTools: [
    { id: 10, name: 'Competitor A', slug: 'competitor-a', logoUrl: '', viewCount: 2000, popularityScore: 90 },
    { id: 11, name: 'Competitor B', slug: 'competitor-b', logoUrl: '', viewCount: 1200, popularityScore: 75 },
  ],
  recentReviews: [
    { rating: 5, title: 'Great tool!', content: 'Love using this.', userUsername: 'user1', createdAt: '2025-01-15' },
    { rating: 4, title: 'Very helpful', content: 'Makes work easier.', userUsername: 'user2', createdAt: '2025-01-14' },
  ],
};

describe('VendorDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider>
          <VendorDashboardPage />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  describe('Access Control', () => {
    it('should render for vendor users', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/vendor/tools/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: mockAnalytics });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Vendor Analytics')).toBeInTheDocument();
      });
    });

    it('should render for admin users', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'admin', role: 'admin' },
      });

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/vendor/tools/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: mockAnalytics });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Vendor Analytics')).toBeInTheDocument();
      });
    });

    it('should redirect non-vendor/admin users to home', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'user', role: 'explorer' },
      });

      vi.mocked(api.api.get).mockResolvedValue({ data: { tools: [] } });

      renderPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderPage();

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show welcome message when vendor has no tools', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockResolvedValue({ data: { tools: [] } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Welcome to Vendor Analytics')).toBeInTheDocument();
      });

      expect(screen.getByText(/don't have access to any tools yet/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when API fails', async () => {
      // Suppress expected console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockRejectedValue(new Error('API Error'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Dashboard')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Tool Selection', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/analytics/')) {
          return Promise.resolve({ data: mockAnalytics });
        }
        if (url.includes('/vendor/tools/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: mockAnalytics });
      });
    });

    it('should display tool selector when vendor has multiple tools', async () => {
      renderPage();

      await waitFor(() => {
        // Tool name appears in selector buttons
        const toolOneElements = screen.getAllByText('AI Tool One');
        expect(toolOneElements.length).toBeGreaterThan(0);
      });

      const toolTwoElements = screen.getAllByText('AI Tool Two');
      expect(toolTwoElements.length).toBeGreaterThan(0);
    });

    it('should switch analytics when selecting different tool', async () => {
      renderPage();

      await waitFor(() => {
        const toolTwoElements = screen.getAllByText('AI Tool Two');
        expect(toolTwoElements.length).toBeGreaterThan(0);
      });

      // Click second tool button (find it in the selector area)
      const toolButtons = screen.getAllByText('AI Tool Two');
      const selectorButton = toolButtons.find(el => el.closest('button'));
      if (selectorButton) {
        fireEvent.click(selectorButton);
      }

      await waitFor(() => {
        expect(api.api.get).toHaveBeenCalledWith(
          expect.stringContaining('/vendor/tools/2/analytics/')
        );
      });
    });
  });

  describe('Analytics Display', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/vendor/tools/') && !url.includes('/analytics/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: mockAnalytics });
      });
    });

    it('should display tool info card', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Boost your productivity with AI')).toBeInTheDocument();
      });

      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('should display metric cards', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Total Views')).toBeInTheDocument();
      });

      expect(screen.getByText('1,500')).toBeInTheDocument(); // Views
      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(screen.getByText('Reviews')).toBeInTheDocument();
      // "Projects" appears in both metric card and similar tools table
      expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    });

    it('should display category performance', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Category Performance')).toBeInTheDocument();
      });

      // Rank shown as "#3" - may have multiple due to category info
      const rankTexts = screen.getAllByText(/#3/);
      expect(rankTexts.length).toBeGreaterThan(0);
      expect(screen.getByText('Category Rank')).toBeInTheDocument();
    });

    it('should display recent reviews', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Recent Reviews')).toBeInTheDocument();
      });

      expect(screen.getByText('Great tool!')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    it('should display similar tools table', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Similar Tools in Category')).toBeInTheDocument();
      });

      expect(screen.getByText('Competitor A')).toBeInTheDocument();
      expect(screen.getByText('Competitor B')).toBeInTheDocument();
    });
  });

  describe('Period Selector', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/vendor/tools/') && !url.includes('/analytics/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: mockAnalytics });
      });
    });

    it('should display period selector', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('should update analytics when period changes', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '7' } });

      await waitFor(() => {
        expect(api.api.get).toHaveBeenCalledWith(
          expect.stringContaining('days=7')
        );
      });
    });

    it('should have all period options', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 days')).toBeInTheDocument();
      expect(screen.getByText('Last year')).toBeInTheDocument();
    });
  });

  describe('No Activity State', () => {
    it('should show no activity message when metrics are all zero', async () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'vendor', role: 'vendor' },
      });

      const emptyMetricsAnalytics = {
        ...mockAnalytics,
        metrics: {
          total_views: 0,
          popularity_score: 0,
          total_bookmarks: 0,
          recent_bookmarks: 0,
          total_reviews: 0,
          recent_reviews: 0,
          avg_rating: null,
          projects_using_tool: 0,
          category_rank: null,
          category_total: 0,
        },
        similar_tools: [],
        recent_reviews: [],
      };

      vi.mocked(api.api.get).mockImplementation((url: string) => {
        if (url.includes('/vendor/tools/') && !url.includes('/analytics/')) {
          return Promise.resolve({ data: mockVendorTools });
        }
        return Promise.resolve({ data: emptyMetricsAnalytics });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No Activity Yet')).toBeInTheDocument();
      });
    });
  });
});
