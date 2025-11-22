import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExplorePage } from './ExplorePage';
import * as exploreService from '@/services/explore';
import type { PaginatedResponse, Project } from '@/types/models';
import type { User } from '@/services/explore';

// Mock the explore service
vi.mock('@/services/explore', () => ({
  exploreProjects: vi.fn(),
  semanticSearch: vi.fn(),
  exploreProfiles: vi.fn(),
  getFilterOptions: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock('@/components/explore/SemanticSearchBar', () => ({
  SemanticSearchBar: ({ onSearch, initialValue }: any) => (
    <input
      data-testid="search-bar"
      defaultValue={initialValue}
      onChange={(e) => onSearch(e.target.value)}
      placeholder="Search"
    />
  ),
}));

vi.mock('@/components/explore/TabNavigation', () => ({
  TabNavigation: ({ activeTab, onChange }: any) => (
    <div data-testid="tab-navigation">
      <button onClick={() => onChange('for-you')}>For You</button>
      <button onClick={() => onChange('trending')}>Trending</button>
      <button onClick={() => onChange('topics')}>By Topics</button>
      <button onClick={() => onChange('tools')}>By Tools</button>
      <button onClick={() => onChange('profiles')}>Top Profiles</button>
      <span data-testid="active-tab">{activeTab}</span>
    </div>
  ),
}));

vi.mock('@/components/explore/FilterPanel', () => ({
  FilterPanel: ({ selectedTopics, selectedTools, onTopicsChange, onToolsChange, onClear }: any) => (
    <div data-testid="filter-panel">
      <button onClick={() => onTopicsChange(['ai', 'ml'])}>Select Topics</button>
      <button onClick={() => onToolsChange([1, 2])}>Select Tools</button>
      <button onClick={() => onClear()}>Clear Filters</button>
      <span data-testid="selected-topics">{selectedTopics.join(',')}</span>
      <span data-testid="selected-tools">{selectedTools.join(',')}</span>
    </div>
  ),
}));

vi.mock('@/components/explore/ProjectsGrid', () => ({
  ProjectsGrid: ({ projects, isLoading, emptyMessage }: any) => (
    <div data-testid="projects-grid">
      {isLoading && <div data-testid="loading">Loading...</div>}
      {!isLoading && projects.length === 0 && <div data-testid="empty">{emptyMessage}</div>}
      {!isLoading && projects.map((p: Project) => (
        <div key={p.id} data-testid={`project-${p.id}`}>{p.title}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/explore/UserProfileCard', () => ({
  UserProfileCard: ({ user }: any) => (
    <div data-testid={`user-${user.id}`}>{user.username}</div>
  ),
}));

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
  thumbnailUrl: null,
  featuredImageUrl: null,
  externalUrl: null,
  tools: [],
  toolsDetails: [],
  heartCount: 5,
  isLikedByUser: false,
  content: { tags: [], blocks: [] },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockProjectsResponse: PaginatedResponse<Project> = {
  count: 50,
  next: 'http://example.com/api/v1/projects/explore/?page=2',
  previous: null,
  results: [mockProject],
};

const mockUser: User = {
  id: 1,
  username: 'testuser',
  fullName: 'Test User',
  avatarUrl: null,
  bio: 'Test bio',
  tagline: 'Test tagline',
  projectCount: 5,
  followers: 10,
  level: 2,
};

const mockProfilesResponse: PaginatedResponse<User> = {
  count: 40,
  next: 'http://example.com/api/v1/users/explore/?page=2',
  previous: null,
  results: [mockUser],
};

describe('ExplorePage - URL Initialization and State Sync', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default mock implementations
    vi.mocked(exploreService.exploreProjects).mockResolvedValue(mockProjectsResponse);
    vi.mocked(exploreService.semanticSearch).mockResolvedValue([mockProject]);
    vi.mocked(exploreService.exploreProfiles).mockResolvedValue(mockProfilesResponse);
    vi.mocked(exploreService.getFilterOptions).mockResolvedValue({
      topics: ['ai', 'ml', 'web'],
      tools: [{ id: 1, name: 'Tool 1' }, { id: 2, name: 'Tool 2' }],
    });
  });

  const renderExplorePage = (initialUrl = '/explore') => {
    window.history.pushState({}, '', initialUrl);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ExplorePage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should initialize state from URL parameters', async () => {
    renderExplorePage('/explore?tab=trending&q=test&topics=ai,ml&tools=1,2&page=2');

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('trending');
      expect(screen.getByTestId('search-bar')).toHaveValue('test');
    });

    // Verify the service was called with correct parameters
    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: 'trending',
          search: 'test',
          topics: ['ai', 'ml'],
          tools: [1, 2],
          page: 2,
        })
      );
    });
  });

  it('should default to "for-you" tab when no tab parameter is present', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('for-you');
    });
  });

  it('should update URL when state changes', async () => {
    renderExplorePage('/explore');

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    // Change tab
    fireEvent.click(screen.getByText('Trending'));

    await waitFor(() => {
      expect(window.location.search).toContain('tab=trending');
    });
  });

  it('should update URL with multiple parameters', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    // Change tab
    fireEvent.click(screen.getByText('By Topics'));

    // Add filters
    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Topics'));

    await waitFor(() => {
      const url = new URL(window.location.href);
      expect(url.searchParams.get('tab')).toBe('topics');
      expect(url.searchParams.get('topics')).toBe('ai,ml');
    });
  });

  it('should not include default values in URL', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('for-you');
    });

    // Should not include tab=for-you in URL
    expect(window.location.search).not.toContain('tab=for-you');
    // Should not include page=1 in URL
    expect(window.location.search).not.toContain('page=1');
  });

  it('should handle empty filter arrays in URL correctly', async () => {
    renderExplorePage('/explore?topics=&tools=');

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: undefined,
          tools: undefined,
        })
      );
    });
  });
});

describe('ExplorePage - Tab Changes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(exploreService.exploreProjects).mockResolvedValue(mockProjectsResponse);
    vi.mocked(exploreService.semanticSearch).mockResolvedValue([mockProject]);
    vi.mocked(exploreService.exploreProfiles).mockResolvedValue(mockProfilesResponse);
    vi.mocked(exploreService.getFilterOptions).mockResolvedValue({
      topics: ['ai', 'ml', 'web'],
      tools: [{ id: 1, name: 'Tool 1' }, { id: 2, name: 'Tool 2' }],
    });
  });

  const renderExplorePage = (initialUrl = '/explore') => {
    window.history.pushState({}, '', initialUrl);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ExplorePage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should update activeTab state when tab changes', async () => {
    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('for-you');
    });

    fireEvent.click(screen.getByText('Trending'));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('trending');
    });
  });

  it('should reset page to 1 when tab changes', async () => {
    renderExplorePage('/explore?page=3');

    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    // Clear previous calls
    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Trending'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  it('should fetch projects for non-profile tabs', async () => {
    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Trending'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: 'trending',
        })
      );
    });
  });

  it('should fetch profiles when switching to profiles tab', async () => {
    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Top Profiles'));

    await waitFor(() => {
      expect(exploreService.exploreProfiles).toHaveBeenCalled();
      expect(screen.getByTestId('user-1')).toBeInTheDocument();
    });
  });

  it('should not fetch projects when on profiles tab', async () => {
    renderExplorePage('/explore?tab=profiles');

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('profiles');
    });

    // exploreProjects should not be called for profiles tab
    await waitFor(() => {
      expect(exploreService.exploreProfiles).toHaveBeenCalled();
    });

    // Projects endpoint should not be called
    expect(exploreService.exploreProjects).not.toHaveBeenCalled();
  });
});

describe('ExplorePage - Search Functionality', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(exploreService.exploreProjects).mockResolvedValue(mockProjectsResponse);
    vi.mocked(exploreService.semanticSearch).mockResolvedValue([mockProject]);
    vi.mocked(exploreService.exploreProfiles).mockResolvedValue(mockProfilesResponse);
    vi.mocked(exploreService.getFilterOptions).mockResolvedValue({
      topics: [],
      tools: [],
    });
  });

  const renderExplorePage = (initialUrl = '/explore') => {
    window.history.pushState({}, '', initialUrl);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ExplorePage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should update searchQuery state when searching', async () => {
    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'test search' } });

    await waitFor(() => {
      expect(window.location.search).toContain('q=test+search');
    });
  });

  it('should reset page to 1 when searching', async () => {
    renderExplorePage('/explore?page=3');

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    vi.mocked(exploreService.semanticSearch).mockClear();

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'test' } });

    await waitFor(() => {
      expect(window.location.search).not.toContain('page=3');
    });
  });

  it('should trigger semantic search when query is entered', async () => {
    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'machine learning' } });

    await waitFor(() => {
      expect(exploreService.semanticSearch).toHaveBeenCalledWith('machine learning');
    });
  });

  it('should display semantic search results when query is present', async () => {
    const semanticResults = [
      { ...mockProject, id: 99, title: 'Semantic Result' },
    ];
    vi.mocked(exploreService.semanticSearch).mockResolvedValue(semanticResults);

    renderExplorePage();

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByTestId('project-99')).toBeInTheDocument();
      expect(screen.getByText('Semantic Result')).toBeInTheDocument();
    });
  });

  it('should not trigger semantic search on profiles tab', async () => {
    renderExplorePage('/explore?tab=profiles');

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'test' } });

    // Wait a bit to ensure it doesn't get called
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(exploreService.semanticSearch).not.toHaveBeenCalled();
  });
});

describe('ExplorePage - Filter Changes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(exploreService.exploreProjects).mockResolvedValue(mockProjectsResponse);
    vi.mocked(exploreService.semanticSearch).mockResolvedValue([mockProject]);
    vi.mocked(exploreService.exploreProfiles).mockResolvedValue(mockProfilesResponse);
    vi.mocked(exploreService.getFilterOptions).mockResolvedValue({
      topics: ['ai', 'ml', 'web'],
      tools: [{ id: 1, name: 'Tool 1' }, { id: 2, name: 'Tool 2' }],
    });
  });

  const renderExplorePage = (initialUrl = '/explore') => {
    window.history.pushState({}, '', initialUrl);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ExplorePage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should update selectedTopics state when topics filter changes', async () => {
    renderExplorePage('/explore?tab=topics');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Topics'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-topics')).toHaveTextContent('ai,ml');
    });
  });

  it('should update selectedTools state when tools filter changes', async () => {
    renderExplorePage('/explore?tab=tools');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select Tools'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-tools')).toHaveTextContent('1,2');
    });
  });

  it('should reset page to 1 when topics filter changes', async () => {
    renderExplorePage('/explore?tab=topics&page=3');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Select Topics'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  it('should reset page to 1 when tools filter changes', async () => {
    renderExplorePage('/explore?tab=tools&page=3');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Select Tools'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  it('should include topics in API call when topics are selected', async () => {
    renderExplorePage('/explore?tab=topics');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Select Topics'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: ['ai', 'ml'],
        })
      );
    });
  });

  it('should include tools in API call when tools are selected', async () => {
    renderExplorePage('/explore?tab=tools');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Select Tools'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [1, 2],
        })
      );
    });
  });

  it('should clear filters when clear button is clicked', async () => {
    renderExplorePage('/explore?tab=topics&topics=ai,ml&tools=1,2');

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear Filters'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-topics')).toHaveTextContent('');
      expect(screen.getByTestId('selected-tools')).toHaveTextContent('');
    });
  });

  it('should only show filters on topics and tools tabs', async () => {
    // Test for-you tab
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();

    // Switch to topics tab
    fireEvent.click(screen.getByText('By Topics'));

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });
  });
});

describe('ExplorePage - Pagination', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(exploreService.exploreProjects).mockResolvedValue(mockProjectsResponse);
    vi.mocked(exploreService.semanticSearch).mockResolvedValue([mockProject]);
    vi.mocked(exploreService.exploreProfiles).mockResolvedValue(mockProfilesResponse);
    vi.mocked(exploreService.getFilterOptions).mockResolvedValue({
      topics: [],
      tools: [],
    });
  });

  const renderExplorePage = (initialUrl = '/explore') => {
    window.history.pushState({}, '', initialUrl);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ExplorePage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should update page state when next button is clicked', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('should update page state when previous button is clicked', async () => {
    renderExplorePage('/explore?page=2');

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    vi.mocked(exploreService.exploreProjects).mockClear();

    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => {
      expect(exploreService.exploreProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  it('should trigger data re-fetching when page changes', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    const initialCallCount = vi.mocked(exploreService.exploreProjects).mock.calls.length;

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(vi.mocked(exploreService.exploreProjects).mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });

  it('should disable previous button on page 1', async () => {
    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('should disable next button when no next page exists', async () => {
    vi.mocked(exploreService.exploreProjects).mockResolvedValue({
      ...mockProjectsResponse,
      next: null,
    });

    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should display current page number', async () => {
    renderExplorePage('/explore?page=2');

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });
  });

  it('should show pagination for profiles tab', async () => {
    renderExplorePage('/explore?tab=profiles');

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });

  it('should hide pagination when total count is <= 30', async () => {
    vi.mocked(exploreService.exploreProjects).mockResolvedValue({
      count: 10,
      next: null,
      previous: null,
      results: [mockProject],
    });

    renderExplorePage('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('projects-grid')).toBeInTheDocument();
    });

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  it('should not show pagination when search query is active', async () => {
    renderExplorePage('/explore?q=test');

    await waitFor(() => {
      expect(screen.getByTestId('projects-grid')).toBeInTheDocument();
    });

    // Pagination should be hidden during search
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });
});
