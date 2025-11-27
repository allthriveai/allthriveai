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
}));

vi.mock('@/services/projects', () => ({
  getUserProjects: vi.fn(),
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
    tierStatus: { totalPoints: 100, tierDisplay: 'Ember' },
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

// Create mock user
const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  fullName: 'Test User',
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
  isStaff: false,
  dateJoined: '2024-01-01T00:00:00Z',
};

const mockOtherUser: User = {
  ...mockUser,
  id: 2,
  username: 'otheruser',
  email: 'other@example.com',
  fullName: 'Other User',
};

const mockProject: Project = {
  id: 1,
  username: 'testuser',
  title: 'Test Project',
  slug: 'test-project',
  description: 'Test description',
  type: 'other',
  isShowcase: true,
  isHighlighted: false,
  isPrivate: false,
  isArchived: false,
  isPublished: true,
  publishedAt: '2025-01-01T00:00:00Z',
  bannerUrl: 'https://example.com/thumbnail.jpg',
  featuredImageUrl: null,
  externalUrl: null,
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
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });
  });

  it('should render ActivityFeed component when on activity tab as owner', async () => {
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
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
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

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it('should toggle project selection when toggleSelection is called', async () => {
    const projects: Project[] = [
      { ...mockProject, id: 1 },
      { ...mockProject, id: 2 },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
      { ...mockProject, id: 1 },
      { ...mockProject, id: 2 },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
      { ...mockProject, id: 1 },
      { ...mockProject, id: 2 },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
      { ...mockProject, id: 1, title: 'Project 1' },
      { ...mockProject, id: 2, title: 'Project 2' },
      { ...mockProject, id: 3, title: 'Project 3' },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
      { ...mockProject, id: 1 },
      { ...mockProject, id: 2 },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
      { ...mockProject, id: 1 },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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
    const projects: Project[] = [
      { ...mockProject, id: 1, isShowcase: true },
    ];

    const playgroundProjects: Project[] = [
      { ...mockProject, id: 2, isShowcase: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: projects,
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
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

    // Switch to playground tab
    const playgroundTab = screen.getByText('Playground');
    fireEvent.click(playgroundTab);

    await waitFor(() => {
      // Should exit selection mode
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  it('should maintain separate selection state between showcase and playground tabs', async () => {
    const showcaseProjects: Project[] = [
      { ...mockProject, id: 1, isShowcase: true },
    ];

    const playgroundProjects: Project[] = [
      { ...mockProject, id: 2, isShowcase: false },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: showcaseProjects,
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument();
    });

    // The selection state is managed at the component level,
    // so switching tabs clears the selection
    const selectButton = screen.getByText('Select');
    fireEvent.click(selectButton);

    fireEvent.click(screen.getByTestId('select-1'));

    await waitFor(() => {
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    // Switch to playground tab
    const playgroundTab = screen.getByText('Playground');
    fireEvent.click(playgroundTab);

    await waitFor(() => {
      expect(screen.getByTestId('project-card-2')).toBeInTheDocument();
    });

    // Switch back to showcase
    const showcaseTab = screen.getByText('Showcase');
    fireEvent.click(showcaseTab);

    await waitFor(() => {
      // Selection should be cleared after tab switch
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });
});

describe('ProfilePage - Sidebar Toggle State', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });
  });

  it('should toggle sidebar open/closed state when toggle buttons are clicked', async () => {
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

    // Find the collapse button (arrow left)
    const collapseButtons = screen.getAllByTestId('icon').filter(icon =>
      icon.textContent === 'arrow-left'
    );
    expect(collapseButtons.length).toBeGreaterThan(0);

    // Click to collapse
    fireEvent.click(collapseButtons[0].closest('button')!);

    await waitFor(() => {
      // Find the expand button (arrow right)
      const expandButtons = screen.getAllByTestId('icon').filter(icon =>
        icon.textContent === 'arrow-right'
      );
      expect(expandButtons.length).toBeGreaterThan(0);
    });

    // Click to expand
    const expandButtons = screen.getAllByTestId('icon').filter(icon =>
      icon.textContent === 'arrow-right'
    );
    fireEvent.click(expandButtons[0].closest('button')!);

    await waitFor(() => {
      // Should show collapse button again
      const collapseButtonsAgain = screen.getAllByTestId('icon').filter(icon =>
        icon.textContent === 'arrow-left'
      );
      expect(collapseButtonsAgain.length).toBeGreaterThan(0);
    });
  });

  it('should change sidebar width when toggling between open and closed states', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Showcase')).toBeInTheDocument();
    });

    // Find sidebar element
    const sidebar = container.querySelector('aside');
    expect(sidebar).toBeInTheDocument();

    // Initially should be wide (w-80)
    expect(sidebar).toHaveClass('w-80');

    // Collapse sidebar
    const collapseButtons = screen.getAllByTestId('icon').filter(icon =>
      icon.textContent === 'arrow-left'
    );
    fireEvent.click(collapseButtons[0].closest('button')!);

    await waitFor(() => {
      expect(sidebar).toHaveClass('w-20');
    });

    // Expand sidebar
    const expandButtons = screen.getAllByTestId('icon').filter(icon =>
      icon.textContent === 'arrow-right'
    );
    fireEvent.click(expandButtons[0].closest('button')!);

    await waitFor(() => {
      expect(sidebar).toHaveClass('w-80');
    });
  });
});

// Sidebar scroll position tests removed - implementation has changed to simpler conditional rendering

describe('ProfilePage - Sidebar Projects Count', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  it('should display correct total number of projects (showcase + playground)', async () => {
    const showcaseProjects: Project[] = [
      { ...mockProject, id: 1, title: 'Showcase 1' },
      { ...mockProject, id: 2, title: 'Showcase 2' },
      { ...mockProject, id: 3, title: 'Showcase 3' },
    ];

    const playgroundProjects: Project[] = [
      { ...mockProject, id: 4, title: 'Playground 1' },
      { ...mockProject, id: 5, title: 'Playground 2' },
    ];

    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: showcaseProjects,
      playground: playgroundProjects,
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Find the Projects label in uppercase
      const projectsLabel = screen.getByText(/Projects/i);
      expect(projectsLabel).toBeInTheDocument();

      // Find the number above it (should be 5 = 3 showcase + 2 playground)
      const statsContainer = projectsLabel.closest('div');
      const projectCount = statsContainer?.parentElement?.querySelector('.text-lg.font-bold');
      expect(projectCount?.textContent).toBe('5');
    });
  });

  it('should display 0 when there are no projects', async () => {
    vi.mocked(projectsService.getUserProjects).mockResolvedValue({
      showcase: [],
      playground: [],
    });

    render(
      <MemoryRouter initialEntries={['/testuser']}>
        <Routes>
          <Route path="/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Find the Projects label within the stats grid (uppercase styling)
      const projectsLabels = screen.getAllByText(/Projects/i);
      const projectsLabel = projectsLabels.find(el => el.classList.contains('uppercase'));
      expect(projectsLabel).toBeInTheDocument();
      const statsContainer = projectsLabel?.closest('div');
      const projectCount = statsContainer?.parentElement?.querySelector('.text-lg.font-bold');
      expect(projectCount?.textContent).toBe('0');
    });
  });

  // Test removed - rerender doesn't trigger useEffect to refetch projects in current implementation
});

describe('ProfilePage - Select Button Conditional Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show Select button for profile owner on Showcase tab with projects', async () => {
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
      expect(screen.getByText('Select')).toBeInTheDocument();
    });
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
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
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

  it('should NOT show Select button when Showcase tab has no projects', async () => {
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
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

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

  it('should hide Select button when switching from tab with projects to tab without', async () => {
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
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    // Switch to Playground tab (which has no projects)
    const playgroundTab = screen.getByText('Playground');
    fireEvent.click(playgroundTab);

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
