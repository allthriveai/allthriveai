import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import * as authService from '@/services/auth';
import * as projectsService from '@/services/projects';
import type { User, Project } from '@/types/models';
import React from 'react';

// Mock services
vi.mock('@/services/auth', () => ({
  getUserByUsername: vi.fn(),
  getUserActivity: vi.fn(),
  getActivityInsights: vi.fn().mockResolvedValue({
    insights: [],
    totalActivities: 0,
    streakDays: 0,
  }),
}));

vi.mock('@/services/projects', () => ({
  getUserProjects: vi.fn(),
  bulkDeleteProjects: vi.fn(),
}));

vi.mock('@/services/followService', () => ({
  followService: {
    getFollowStatus: vi.fn().mockResolvedValue({ is_following: false, followers_count: 0, following_count: 0 }),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

vi.mock('@/services/achievements', () => ({
  getUserAchievements: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/battles', () => ({
  getUserBattles: vi.fn().mockResolvedValue({ results: [], count: 0 }),
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { sections: [] } }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock useAuth hook with default values
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock DashboardLayout
vi.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

// Mock ActivityFeed
vi.mock('@/components/profile/ActivityFeed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed">Activity Feed</div>,
}));

// Mock ProjectCard
vi.mock('@/components/projects/ProjectCard', () => ({
  ProjectCard: ({ project, selectionMode, isSelected, onSelect }: any) => (
    <div data-testid={`project-card-${project.id}`}>
      <span>{project.title}</span>
      {selectionMode && (
        <button
          data-testid={`select-${project.id}`}
          onClick={() => onSelect?.(project.id)}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      )}
    </div>
  ),
}));

// Mock useThriveCircle hook
vi.mock('@/hooks/useThriveCircle', () => ({
  useThriveCircle: vi.fn(() => ({
    tierStatus: { totalPoints: 100, tierDisplay: 'Seedling' },
    isLoading: false,
  })),
}));

// Mock useAchievements hook
vi.mock('@/hooks/useAchievements', () => ({
  useAchievements: vi.fn(() => ({
    achievementsByCategory: {},
    isLoading: false,
  })),
}));

// Mock FontAwesome icons
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid="icon">{icon?.iconName || 'icon'}</span>,
}));

// Mock profile components that make API calls
vi.mock('@/components/profile/StatsSummarySection', () => ({
  StatsSummarySection: () => <div data-testid="stats-summary">Stats Summary</div>,
}));

vi.mock('@/components/profile/ActivityInsightsTab', () => ({
  ActivityInsightsTab: () => <div data-testid="activity-insights">Activity Insights</div>,
}));

vi.mock('@/components/profile/MarketplaceTab', () => ({
  MarketplaceTab: () => <div data-testid="marketplace-tab">Marketplace Tab</div>,
}));

vi.mock('@/components/profile/BattlesTab', () => ({
  BattlesTab: () => <div data-testid="battles-tab">Battles Tab</div>,
}));

// Create mock user
const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  fullName: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  tagline: 'Test tagline',
  location: 'Test City',
  websiteUrl: 'https://example.com',
  githubUrl: 'https://github.com/testuser',
  linkedinUrl: 'https://linkedin.com/in/testuser',
  twitterUrl: 'https://twitter.com/testuser',
  playgroundIsPublic: true,
  totalPoints: 100,
  is_staff: false,
  role: 'explorer',
  roleDisplay: 'Explorer',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockOtherUser: User = {
  ...mockUser,
  id: 2,
  username: 'otheruser',
  email: 'other@example.com',
  fullName: 'Other User',
};

const mockCreatorUser: User = {
  ...mockUser,
  id: 3,
  username: 'creatoruser',
  email: 'creator@example.com',
  fullName: 'Creator User',
  role: 'creator',
  roleDisplay: 'Creator',
};

const mockProject: Project = {
  id: 1,
  username: 'testuser',
  title: 'Test Project',
  slug: 'test-project',
  description: 'Test description',
  type: 'other',
  isShowcased: true,
  isHighlighted: false,
  isPrivate: false,
  isArchived: false,
  bannerUrl: 'https://example.com/thumbnail.jpg',
  featuredImageUrl: undefined,
  externalUrl: undefined,
  tools: [],
  toolsDetails: [],
  heartCount: 0,
  isLikedByUser: false,
  content: { tags: [], blocks: [] },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ProfilePage - Activity Tab Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername - returns mockUser for testuser
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });
  });

  it('should show activity tab for profile owner', async () => {
    // Mock useAuth to return the authenticated user
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  it('should not show activity tab for non-owners', async () => {
    // Mock useAuth to return a different user
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser);

    render(
      <MemoryRouter initialEntries={['/otheruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Activity')).not.toBeInTheDocument();
    });
  });

  it('should redirect to showcase tab when non-owner tries to access activity tab via URL', async () => {
    // Mock useAuth to return testuser
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser);

    render(
      <MemoryRouter initialEntries={['/otheruser?tab=activity']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Activity tab should not be rendered
      expect(screen.queryByTestId('activity-feed')).not.toBeInTheDocument();
      // Should show showcase content instead
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });
  });

  it('should allow owner to access activity tab via URL', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=activity']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Activity tab shows the ActivityInsightsTab component (mocked)
      expect(screen.getByTestId('activity-insights')).toBeInTheDocument();
    });
  });

  it('should render ActivityInsightsTab component when on activity tab as owner', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=activity']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-insights')).toBeInTheDocument();
    });
  });

  it('should default to showcase tab when activity tab is requested but user is not owner', async () => {
    mockUseAuth.mockReturnValue({
      user: { ...mockUser, username: 'anotheruser' },
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser);

    render(
      <MemoryRouter initialEntries={['/otheruser?tab=activity']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Should not render activity feed
      expect(screen.queryByTestId('activity-feed')).not.toBeInTheDocument();
      // Should show showcase tab
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });
  });
});

describe('ProfilePage - Project Selection State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it('should toggle project selection when toggleSelection is called', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
      { ...mockProject, id: 2, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    // Select first project
    const selectProject1 = screen.getByTestId('select-1');
    fireEvent.click(selectProject1);

    await waitFor(() => {
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    // Toggle off (deselect)
    fireEvent.click(selectProject1);

    await waitFor(() => {
      const selectButtons = screen.getAllByText('Select');
      expect(selectButtons.length).toBeGreaterThan(0);
    });
  });

  it('should add project to selected set when toggleSelection is called with unselected project', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
      { ...mockProject, id: 2, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    // Select project 1
    const selectProject1 = screen.getByTestId('select-1');
    fireEvent.click(selectProject1);

    await waitFor(() => {
      const selectedButtons = screen.getAllByText('Selected');
      expect(selectedButtons.length).toBe(1);
    });
  });

  it('should remove project from selected set when toggleSelection is called with selected project', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
      { ...mockProject, id: 2, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    // Select project
    const selectProject1 = screen.getByTestId('select-1');
    fireEvent.click(selectProject1);

    await waitFor(() => {
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    // Deselect project
    fireEvent.click(selectProject1);

    await waitFor(() => {
      const selectButtons = screen.getAllByText('Select');
      expect(selectButtons.length).toBeGreaterThan(0);
    });
  });

  it('should handle multiple project selections', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, title: 'Project 1', isShowcased: false },
      { ...mockProject, id: 2, title: 'Project 2', isShowcased: false },
      { ...mockProject, id: 3, title: 'Project 3', isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    // Select multiple projects
    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-2'));
    fireEvent.click(screen.getByTestId('select-3'));

    await waitFor(() => {
      const selectedButtons = screen.getAllByText('Selected');
      expect(selectedButtons.length).toBe(3);
    });
  });

  it('should clear all selected projects when exitSelectionMode is called', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
      { ...mockProject, id: 2, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    // Select projects
    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-2'));

    await waitFor(() => {
      const selectedButtons = screen.getAllByText('Selected');
      expect(selectedButtons.length).toBe(2);
    });

    // Exit selection mode
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    // Re-enter selection mode
    fireEvent.click(screen.getByText('Select'));

    await waitFor(() => {
      // All projects should be unselected
      const selectButtons = screen.getAllByText('Select');
      expect(selectButtons.length).toBeGreaterThan(0);
      expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    });
  });

  it('should disable selection mode when exitSelectionMode is called', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: projects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    // Exit selection mode
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });

  it('should exit selection mode when switching tabs', async () => {
    const playgroundProjects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    // Switch to showcase tab
    const showcaseTab = screen.getByText('Showcase');
    fireEvent.click(showcaseTab);

    await waitFor(() => {
      // Should exit selection mode (Cancel button should disappear)
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  it('should maintain selection state when staying on playground tab', async () => {
    const playgroundProjects: Project[] = [
      { ...mockProject, id: 1, isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // Enable selection mode and select a project
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    fireEvent.click(screen.getByTestId('select-1'));

    await waitFor(() => {
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    // Cancel selection
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      // Selection mode should be exited
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });
});

describe('ProfilePage - Sidebar Toggle State', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });
  });

  it('should render sidebar on non-showcase tabs', async () => {
    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [{ ...mockProject, id: 1, isShowcased: false }],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Playground')).toBeInTheDocument();
    });
  });

  it('should render profile header with user info', async () => {
    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });
  });
});

// Sidebar scroll position tests removed - implementation has changed to simpler conditional rendering

describe('ProfilePage - Sidebar Projects Count', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it('should display projects when viewing profile on playground tab', async () => {
    const playgroundProjects: Project[] = [
      { ...mockProject, id: 1, title: 'Playground 1', isShowcased: false },
      { ...mockProject, id: 2, title: 'Playground 2', isShowcased: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Playground')).toBeInTheDocument();
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('project-card-2')).toBeInTheDocument();
    });
  });

  it('should show empty state when there are no projects on playground tab', async () => {
    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Playground')).toBeInTheDocument();
      expect(screen.getByText('No playground projects yet.')).toBeInTheDocument();
    });
  });

  // Test removed - rerender doesn't trigger useEffect to refetch projects in current implementation
});

describe('ProfilePage - Select Button Conditional Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });
  });

  it('should NOT show Select button on Showcase tab (Select only available on Playground)', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [{ ...mockProject, id: 1 }],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=showcase']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    // Select button should NOT be visible on Showcase tab
    expect(screen.queryByText('Select')).not.toBeInTheDocument();
  });

  it('should show Select button for profile owner on Playground tab with projects', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [{ ...mockProject, id: 1 }],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });

  it('should NOT show Select button on Activity tab', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [{ ...mockProject, id: 1 }],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=activity']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-insights')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select')).not.toBeInTheDocument();
  });

  it('should NOT show Select button when viewing someone else\'s profile', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser);

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [{ ...mockProject, id: 1, username: 'otheruser' }],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/otheruser?tab=showcase']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select')).not.toBeInTheDocument();
  });

  it('should NOT show Select button on Showcase tab (Select only on Playground)', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [{ ...mockProject, id: 1, isShowcased: false }],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=showcase']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Showcase tab renders (Select button never shows on Showcase tab)
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    // Select button should NOT be on Showcase tab
    expect(screen.queryByText('Select')).not.toBeInTheDocument();
  });

  it('should NOT show Select button when Playground tab has no projects', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [{ ...mockProject, id: 1 }],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No playground projects yet.')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select')).not.toBeInTheDocument();
  });

  it('should hide Select button when switching from playground tab with projects to empty playground', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    // Start with projects in playground
    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [{ ...mockProject, id: 1, isShowcased: false }],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=playground']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    // Switch to Showcase tab (Select button not available on Showcase)
    const showcaseTab = screen.getByText('Showcase');
    fireEvent.click(showcaseTab);

    await waitFor(() => {
      expect(screen.queryByText('Select')).not.toBeInTheDocument();
    });
  });

  it('should show Select button when switching to tab with projects', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [{ ...mockProject, id: 1 }],
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=showcase']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Select')).not.toBeInTheDocument();
    });

    // Switch to Playground tab (which has projects)
    const playgroundTab = screen.getByText('Playground');
    fireEvent.click(playgroundTab);

    await waitFor(() => {
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });
});

describe('ProfilePage - Creator Role Shop Tab Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getUserByUsername
    vi.mocked(authService.getUserByUsername).mockImplementation((username: string) => {
      if (username === 'testuser') return Promise.resolve(mockUser);
      if (username === 'otheruser') return Promise.resolve(mockOtherUser);
      if (username === 'creatoruser') return Promise.resolve(mockCreatorUser);
      return Promise.reject(new Error('User not found'));
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });
  });

  it('should show Shop tab for users with creator role viewing their own profile', async () => {
    mockUseAuth.mockReturnValue({
      user: mockCreatorUser,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/creatoruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });
  });

  it('should NOT show Shop tab for users without creator role viewing their own profile', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser, // explorer role
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    expect(screen.queryByText('Shop')).not.toBeInTheDocument();
  });

  it('should show Shop tab when viewing a creator user profile as a visitor', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser, // logged in as explorer
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockCreatorUser);

    render(
      <MemoryRouter initialEntries={['/creatoruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });
  });

  it('should NOT show Shop tab when viewing a non-creator user profile as a visitor', async () => {
    mockUseAuth.mockReturnValue({
      user: mockCreatorUser, // logged in as creator
      isAuthenticated: true,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser); // viewing explorer profile

    render(
      <MemoryRouter initialEntries={['/otheruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    expect(screen.queryByText('Shop')).not.toBeInTheDocument();
  });

  it('should redirect to showcase tab when non-creator tries to access marketplace tab via URL', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser, // explorer role
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/testuser?tab=marketplace']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Shop tab should not be visible
      expect(screen.queryByText('Shop')).not.toBeInTheDocument();
      // Should show showcase tab instead
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });
  });

  it('should allow creator to access marketplace tab via URL on their own profile', async () => {
    mockUseAuth.mockReturnValue({
      user: mockCreatorUser,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/creatoruser?tab=marketplace']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });
  });

  it('should NOT show Shop tab for unauthenticated users viewing non-creator profile', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockOtherUser);

    render(
      <MemoryRouter initialEntries={['/otheruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    expect(screen.queryByText('Shop')).not.toBeInTheDocument();
  });

  it('should show Shop tab for unauthenticated users viewing creator profile', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    vi.mocked(authService.getUserByUsername).mockResolvedValue(mockCreatorUser);

    render(
      <MemoryRouter initialEntries={['/creatoruser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Shop')).toBeInTheDocument();
    });
  });
});
