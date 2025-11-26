import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RightAddProjectChat } from './RightAddProjectChat';
import * as githubService from '@/services/github';
import * as projectsService from '@/services/projects';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { username: 'testuser' },
  }),
}));

// Mock GitHub service
vi.mock('@/services/github', () => ({
  checkGitHubConnection: vi.fn(),
  fetchGitHubRepos: vi.fn(),
  getImportPreview: vi.fn(),
  confirmImport: vi.fn(),
  getGitHubConnectUrl: vi.fn(),
}));

// Mock projects service
vi.mock('@/services/projects', () => ({
  createProject: vi.fn(),
}));

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid="fa-icon">{icon.iconName}</span>,
}));

// Mock window.location
const originalLocation = window.location;
delete (window as any).location;
window.location = {
  ...originalLocation,
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: ''
} as any;

describe('RightAddProjectChat', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.href = 'http://localhost:3000/';
    window.location.pathname = '/';
    window.location.search = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <RightAddProjectChat
          isOpen={true}
          onClose={mockOnClose}
          {...props}
        />
      </BrowserRouter>
    );
  };

  describe('GitHub OAuth Initialization', () => {
    it('should set localStorage flags and redirect when connecting to GitHub', async () => {
      // Mock environment variables
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');

      renderComponent();

      // Click "Import Existing Project" button
      const importButton = screen.getByText('Import Existing Project');
      fireEvent.click(importButton);

      // Wait for GitHub connection check
      await waitFor(() => {
        expect(githubService.checkGitHubConnection).toHaveBeenCalled();
      });

      // Mock not connected response
      vi.mocked(githubService.checkGitHubConnection).mockResolvedValue(false);

      // Re-render to trigger state update
      fireEvent.click(importButton);

      // Wait for "Connect GitHub" button to appear
      await waitFor(() => {
        expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
      });

      // Click "Connect GitHub"
      const connectButton = screen.getByText('Connect GitHub');
      fireEvent.click(connectButton);

      // Verify localStorage flags were set
      expect(localStorage.getItem('github_oauth_return')).toBe('add_project_chat');
      expect(localStorage.getItem('github_oauth_step')).toBe('importing');

      // Verify redirect URL
      expect(window.location.href).toContain('/accounts/github/login/');
      expect(window.location.href).toContain('process=connect');
    });

    it('should construct correct allauth OAuth URL with return path', async () => {
      vi.stubEnv('VITE_API_URL', 'http://localhost:8000');
      // Set up window.location for this test
      window.location.pathname = '/projects';
      window.location.search = '';

      // Mock checkGitHubConnection to return false (not connected)
      vi.mocked(githubService.checkGitHubConnection).mockResolvedValue(false);

      renderComponent();

      // Start import flow
      fireEvent.click(screen.getByText('Import Existing Project'));

      // Wait for "Connect GitHub" button to appear
      await waitFor(() => {
        expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Connect GitHub'));

      // Verify URL includes correct next parameter (pathname is /projects)
      expect(window.location.href).toContain('next=');
      expect(window.location.href).toContain(encodeURIComponent('http://localhost:3000/projects'));
    });
  });

  describe('GitHub OAuth Resume Workflow', () => {
    it('should automatically resume GitHub import when oauth flags are present and panel opens', async () => {
      // Set up OAuth return state
      localStorage.setItem('github_oauth_return', 'add_project_chat');
      localStorage.setItem('github_oauth_step', 'importing');

      // Mock GitHub connection as successful
      vi.mocked(githubService.checkGitHubConnection).mockResolvedValue(true);

      const mockRepos = [
        { fullName: 'user/repo1', name: 'repo1', description: 'Test repo', language: 'TypeScript', stars: 10, forks: 2 },
      ];
      vi.mocked(githubService.fetchGitHubRepos).mockResolvedValue(mockRepos);

      renderComponent({ isOpen: true });

      // Should automatically start import flow
      await waitFor(() => {
        expect(githubService.checkGitHubConnection).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Should load repos
      await waitFor(() => {
        expect(githubService.fetchGitHubRepos).toHaveBeenCalled();
      });

      // Verify localStorage flags were cleared
      expect(localStorage.getItem('github_oauth_return')).toBeNull();
      expect(localStorage.getItem('github_oauth_step')).toBeNull();
    });

    it('should not resume workflow if panel is not open', async () => {
      localStorage.setItem('github_oauth_return', 'add_project_chat');
      localStorage.setItem('github_oauth_step', 'importing');

      renderComponent({ isOpen: false });

      // Should not trigger GitHub connection check
      await new Promise(resolve => setTimeout(resolve, 600));
      expect(githubService.checkGitHubConnection).not.toHaveBeenCalled();
    });

    it('should not resume workflow if oauth_return has wrong value', async () => {
      localStorage.setItem('github_oauth_return', 'different_value');
      localStorage.setItem('github_oauth_step', 'importing');

      renderComponent({ isOpen: true });

      await new Promise(resolve => setTimeout(resolve, 600));
      expect(githubService.checkGitHubConnection).not.toHaveBeenCalled();
    });

    it('should not resume workflow if oauth_step is missing', async () => {
      localStorage.setItem('github_oauth_return', 'add_project_chat');

      renderComponent({ isOpen: true });

      await new Promise(resolve => setTimeout(resolve, 600));
      expect(githubService.checkGitHubConnection).not.toHaveBeenCalled();
    });
  });

  describe('Multi-step GitHub Import Workflow', () => {
    const mockRepos = [
      {
        fullName: 'testuser/test-repo',
        name: 'test-repo',
        description: 'A test repository',
        language: 'TypeScript',
        stars: 42,
        forks: 7,
      },
      {
        fullName: 'testuser/another-repo',
        name: 'another-repo',
        description: 'Another test repository',
        language: 'JavaScript',
        stars: 15,
        forks: 3,
      },
    ];

    const mockPreview = {
      title: 'Test Repo',
      language: 'TypeScript',
      stars: 42,
      tldr: 'A comprehensive test repository for unit testing',
    };

    beforeEach(() => {
      vi.mocked(githubService.checkGitHubConnection).mockResolvedValue(true);
      vi.mocked(githubService.fetchGitHubRepos).mockResolvedValue(mockRepos);
      vi.mocked(githubService.getImportPreview).mockResolvedValue(mockPreview);
    });

    it('should successfully complete the full import flow from start to finish', async () => {
      const mockImportResult = {
        projectSlug: 'test-repo',
        redirectUrl: '/testuser/test-repo',
      };
      vi.mocked(githubService.confirmImport).mockResolvedValue(mockImportResult);

      renderComponent();

      // Step 1: Click "Import Existing Project"
      const importButton = screen.getByText('Import Existing Project');
      fireEvent.click(importButton);

      // Step 2: Wait for repos to load
      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
        expect(screen.getByText('another-repo')).toBeInTheDocument();
      });

      // Step 3: Select a repository
      const repoButton = screen.getByText('test-repo');
      fireEvent.click(repoButton);

      // Step 4: Wait for preview to load
      await waitFor(() => {
        expect(screen.getByText(/Here's what I found:/)).toBeInTheDocument();
        expect(screen.getByText(/Test Repo/)).toBeInTheDocument();
      });

      // Step 5: Confirm import
      const confirmButton = screen.getByText('Import Project');
      fireEvent.click(confirmButton);

      // Step 6: Wait for import to complete and navigate
      await waitFor(() => {
        expect(githubService.confirmImport).toHaveBeenCalledWith({
          repoFullName: 'testuser/test-repo',
          previewData: mockPreview,
          autoPublish: false,
          addToShowcase: false,
        });
      });

      // Step 7: Verify navigation
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/testuser/test-repo');
      }, { timeout: 2000 });
    });

    it('should display repository details correctly', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Import Existing Project'));

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      // Verify repository details are displayed
      expect(screen.getByText('A test repository')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument(); // stars
      expect(screen.getByText('7')).toBeInTheDocument(); // forks
    });

    it('should allow searching/filtering repositories', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Import Existing Project'));

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
        expect(screen.getByText('another-repo')).toBeInTheDocument();
      });

      // Find search input
      const searchInput = screen.getByPlaceholderText('Search repositories...');
      expect(searchInput).toBeInTheDocument();

      // Type in search
      fireEvent.change(searchInput, { target: { value: 'another' } });

      // Only matching repo should be visible
      await waitFor(() => {
        expect(screen.getByText('another-repo')).toBeInTheDocument();
        expect(screen.queryByText('test-repo')).not.toBeInTheDocument();
      });
    });

    it('should display preview data with all fields', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Import Existing Project'));

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('test-repo'));

      await waitFor(() => {
        expect(screen.getByText(/Here's what I found:/)).toBeInTheDocument();
      });

      // Verify all preview fields are displayed
      expect(screen.getByText(/Test Repo/)).toBeInTheDocument();
      expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
      expect(screen.getByText(/42/)).toBeInTheDocument();
      expect(screen.getByText(/A comprehensive test repository for unit testing/)).toBeInTheDocument();
    });

    it('should allow going back to repository list from preview', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Import Existing Project'));

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('test-repo'));

      await waitFor(() => {
        expect(screen.getByText('Import Project')).toBeInTheDocument();
      });

      // Click "Choose Different Repo" button
      const backButton = screen.getByText('Choose Different Repo');
      fireEvent.click(backButton);

      // Should be back at repo list
      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
        expect(screen.getByText('another-repo')).toBeInTheDocument();
      });
    });

    it('should handle import errors gracefully', async () => {
      vi.mocked(githubService.confirmImport).mockRejectedValue(new Error('Import failed'));

      renderComponent();

      fireEvent.click(screen.getByText('Import Existing Project'));

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('test-repo'));

      await waitFor(() => {
        expect(screen.getByText('Import Project')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import Project'));

      // Should display error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to import project/)).toBeInTheDocument();
      });

      // Should not navigate or close
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Panel state management', () => {
    it('should reset state when panel closes', async () => {
      const { rerender } = renderComponent({ isOpen: true });

      // Start some workflow
      fireEvent.click(screen.getByText('Import Existing Project'));

      // Close panel
      rerender(
        <BrowserRouter>
          <RightAddProjectChat isOpen={false} onClose={mockOnClose} />
        </BrowserRouter>
      );

      // Reopen panel
      rerender(
        <BrowserRouter>
          <RightAddProjectChat isOpen={true} onClose={mockOnClose} />
        </BrowserRouter>
      );

      // Should be back at welcome screen
      expect(screen.getByText("Hi! Let's add a project to your portfolio.")).toBeInTheDocument();
    });
  });

  describe('Other project creation methods', () => {
    it('should create manual project when "Create Project Page" is clicked', async () => {
      const mockProject = {
        id: 1,
        slug: 'untitled-project',
        title: 'Untitled Project',
      };
      vi.mocked(projectsService.createProject).mockResolvedValue(mockProject as any);

      renderComponent();

      const manualButton = screen.getByText('Create Project Page');
      fireEvent.click(manualButton);

      await waitFor(() => {
        expect(projectsService.createProject).toHaveBeenCalledWith({
          title: 'Untitled Project',
          description: '',
          type: 'other',
          isShowcase: true,
          content: { blocks: [] },
        });
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/testuser/untitled-project/edit');
      });
    });

    it('should display coming soon message for AI features', async () => {
      renderComponent();

      // Click "Describe Your Project"
      fireEvent.click(screen.getByText('Describe Your Project'));

      await waitFor(() => {
        expect(screen.getByText(/AI project description feature coming soon/)).toBeInTheDocument();
      });

      // Click "Build Something New"
      fireEvent.click(screen.getByText('Build Something New'));

      await waitFor(() => {
        expect(screen.getByText(/AI-assisted project builder coming soon/)).toBeInTheDocument();
      });
    });
  });
});
