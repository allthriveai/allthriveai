import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RightAddProjectChat } from './RightAddProjectChat';
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

// Mock projects service
vi.mock('@/services/projects', () => ({
  createProject: vi.fn(),
}));

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid="fa-icon">{icon.iconName}</span>,
}));

describe('RightAddProjectChat', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('Panel state management', () => {
    it('should reset state when panel closes', async () => {
      const { rerender } = renderComponent({ isOpen: true });

      // Click a button to trigger messages
      fireEvent.click(screen.getByText('Describe Your Project'));

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

  describe('Manual project creation', () => {
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
          isShowcased: true,
          content: { blocks: [] },
        });
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/testuser/untitled-project/edit');
      });
    });

    it('should handle manual project creation errors', async () => {
      vi.mocked(projectsService.createProject).mockRejectedValue(new Error('Creation failed'));

      renderComponent();

      fireEvent.click(screen.getByText('Create Project Page'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to create project/)).toBeInTheDocument();
      });

      // Should not navigate or close
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('GitHub import redirect', () => {
    it('should check GitHub connection when Import from GitHub is clicked', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Import from GitHub'));

      await waitFor(() => {
        expect(screen.getByText(/Checking your GitHub connection/)).toBeInTheDocument();
      });
    });
  });

  describe('AI features (coming soon)', () => {
    it('should display coming soon message for AI project description', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Describe Your Project'));

      await waitFor(() => {
        expect(screen.getByText(/AI project description feature coming soon/)).toBeInTheDocument();
      });
    });

    it('should display coming soon message for AI project builder', async () => {
      renderComponent();

      fireEvent.click(screen.getByText('Build Something New'));

      await waitFor(() => {
        expect(screen.getByText(/AI-assisted project builder coming soon/)).toBeInTheDocument();
      });
    });
  });

  describe('Welcome screen', () => {
    it('should display four option buttons on welcome screen', () => {
      renderComponent();

      expect(screen.getByText('Import from GitHub')).toBeInTheDocument();
      expect(screen.getByText('Describe Your Project')).toBeInTheDocument();
      expect(screen.getByText('Build Something New')).toBeInTheDocument();
      expect(screen.getByText('Create Project Page')).toBeInTheDocument();
    });

    it('should display welcome message', () => {
      renderComponent();

      expect(screen.getByText("Hi! Let's add a project to your portfolio.")).toBeInTheDocument();
      expect(screen.getByText('How would you like to get started?')).toBeInTheDocument();
    });
  });
});
