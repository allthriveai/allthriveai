import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LeftSidebar } from './LeftSidebar';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/explore',
      search: '',
    }),
  };
});

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { username: 'testuser' },
    logout: vi.fn(),
  }),
}));

// Mock useTheme hook
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock tools service
vi.mock('@/services/tools', () => ({
  getTools: vi.fn().mockResolvedValue({ results: [] }),
}));

// Mock projects service
vi.mock('@/services/projects', () => ({
  createProject: vi.fn(),
}));

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid="fa-icon">{icon.iconName}</span>,
}));

describe('LeftSidebar', () => {
  const mockOnMenuClick = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnAddProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLeftSidebar = (props = {}) => {
    return render(
      <BrowserRouter>
        <LeftSidebar
          onMenuClick={mockOnMenuClick}
          isOpen={true}
          onToggle={mockOnToggle}
          onAddProject={mockOnAddProject}
          {...props}
        />
      </BrowserRouter>
    );
  };

  describe('Section onClick vs path prioritization', () => {
    it('should call section.onClick handler when both onClick and path are present', async () => {
      renderLeftSidebar();

      // Find the SUPPORT section which has onClick
      const supportSection = screen.getByText('SUPPORT');
      expect(supportSection).toBeInTheDocument();

      // Click on the SUPPORT section header button
      const sectionButton = supportSection.closest('button');
      expect(sectionButton).toBeInTheDocument();
      fireEvent.click(sectionButton!);

      // Should call the onClick handler, not navigate to path
      await waitFor(() => {
        expect(mockOnMenuClick).toHaveBeenCalledWith('Chat');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('should navigate to section.path when only path is present', async () => {
      renderLeftSidebar();

      // Find the EXPLORE section which has path but no onClick
      const exploreSection = screen.getByText('EXPLORE');
      expect(exploreSection).toBeInTheDocument();

      // Click on the EXPLORE section
      fireEvent.click(exploreSection.closest('button')!);

      // Should navigate to the path
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/explore');
        expect(mockOnMenuClick).not.toHaveBeenCalled();
      });
    });

    it('should prioritize item.onClick over item.path for menu items', async () => {
      renderLeftSidebar();

      // Find all toggle submenu buttons and click the one after MEMBERSHIP
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      // MEMBERSHIP is the 4th section, so its toggle button should be the 3rd one (0-indexed: PLAY, LEARN, MEMBERSHIP)
      const membershipToggle = toggleButtons[2]; // PLAY (0), LEARN (1), MEMBERSHIP (2)

      fireEvent.click(membershipToggle);

      // Wait for the submenu to expand
      await waitFor(() => {
        expect(screen.getByText('Events Calendar')).toBeInTheDocument();
      });

      // Click on "Events Calendar" which has onClick handler
      const eventsCalendarItem = screen.getByText('Events Calendar');
      fireEvent.click(eventsCalendarItem);

      // Should call the onClick handler
      await waitFor(() => {
        expect(mockOnMenuClick).toHaveBeenCalledWith('Events Calendar');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('should navigate to item.path when item has no onClick handler', async () => {
      renderLeftSidebar();

      // Find PLAY section toggle (index 0)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const playToggle = toggleButtons[0];

      fireEvent.click(playToggle);

      // Wait for the submenu to expand
      await waitFor(() => {
        expect(screen.getByText('Side Quests')).toBeInTheDocument();
      });

      // Click on "Side Quests" which has only path, no onClick
      const sideQuestsItem = screen.getByText('Side Quests');
      fireEvent.click(sideQuestsItem);

      // Should navigate to the path
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/play/side-quests');
        expect(mockOnMenuClick).not.toHaveBeenCalled();
      });
    });

    it('should handle menu items with neither onClick nor valid path', async () => {
      renderLeftSidebar();

      // Find PLAY section toggle (index 0)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const playToggle = toggleButtons[0];

      fireEvent.click(playToggle);

      // Wait for the submenu to expand
      await waitFor(() => {
        expect(screen.getByText("This Week's Challenge")).toBeInTheDocument();
      });

      // Click on "This Week's Challenge" which has path='#'
      const challengeItem = screen.getByText("This Week's Challenge");
      fireEvent.click(challengeItem);

      // Should not navigate or call onMenuClick, but should not throw error
      await waitFor(() => {
        // Path is '#', so it should show coming soon toast instead
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockOnMenuClick).not.toHaveBeenCalled();
      });
    });

    it('should call item.onClick even when item also has path="#"', async () => {
      renderLeftSidebar();

      // Find SUPPORT section toggle (index 3)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const supportToggle = toggleButtons[3];

      fireEvent.click(supportToggle);

      // Wait for the submenu to expand
      await waitFor(() => {
        expect(screen.getByText('Chat')).toBeInTheDocument();
      });

      // Click on "Chat" which has onClick handler
      const chatItem = screen.getByText('Chat');
      fireEvent.click(chatItem);

      // Should call the onClick handler
      await waitFor(() => {
        expect(mockOnMenuClick).toHaveBeenCalledWith('Chat');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });

  describe('Section behavior', () => {
    it('should expand/collapse sections with items', async () => {
      renderLeftSidebar();

      // Initially collapsed, items should not be visible
      expect(screen.queryByText('Learning Paths')).not.toBeInTheDocument();

      // Find LEARN section toggle (index 1)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const learnToggle = toggleButtons[1];

      // Click to expand
      fireEvent.click(learnToggle);

      // Items should now be visible
      await waitFor(() => {
        expect(screen.getByText('Learning Paths')).toBeInTheDocument();
        expect(screen.getByText('Quizzes')).toBeInTheDocument();
        expect(screen.getByText('Mentorship Program')).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(learnToggle);

      // Items should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Learning Paths')).not.toBeInTheDocument();
      });
    });

    it('should handle external links correctly', async () => {
      renderLeftSidebar();

      // Find SUPPORT section toggle (index 3)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const supportToggle = toggleButtons[3];

      fireEvent.click(supportToggle);

      // Wait for the submenu to expand
      await waitFor(() => {
        expect(screen.getByText('Report an Issue')).toBeInTheDocument();
      });

      // Find the external link
      const externalLink = screen.getByText('Report an Issue').closest('a');
      expect(externalLink).toHaveAttribute('target', '_blank');
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(externalLink).toHaveAttribute('href', 'https://github.com/allthriveai/allthriveai/issues');
    });
  });

  describe('Submenu items with onClick', () => {
    it('should prioritize subItem.onClick over subItem.path', async () => {
      renderLeftSidebar();

      // Find SUPPORT section toggle (index 3)
      const toggleButtons = screen.queryAllByLabelText('Toggle submenu');
      const supportToggle = toggleButtons[3];

      fireEvent.click(supportToggle);

      // Wait for the submenu to expand and find "About All Thrive"
      await waitFor(() => {
        expect(screen.getByText('About All Thrive')).toBeInTheDocument();
      });

      // Click to expand "About All Thrive" submenu
      const aboutAllThriveItem = screen.getByText('About All Thrive');
      fireEvent.click(aboutAllThriveItem);

      // Wait for subitems to appear
      await waitFor(() => {
        expect(screen.getByText('About Us')).toBeInTheDocument();
        expect(screen.getByText('Our Values')).toBeInTheDocument();
      });

      // Click on "About Us" which has onClick handler
      const aboutUsItem = screen.getByText('About Us');
      fireEvent.click(aboutUsItem);

      // Should call the onClick handler
      await waitFor(() => {
        expect(mockOnMenuClick).toHaveBeenCalledWith('About Us');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });

  describe('Add Project button', () => {
    it('should call onAddProject when Add Project button is clicked', () => {
      renderLeftSidebar();

      // Find and click the Add Project button
      const addProjectButton = screen.getByText('Add Project');
      fireEvent.click(addProjectButton);

      expect(mockOnAddProject).toHaveBeenCalledTimes(1);
    });

    it('should not render Add Project button when onAddProject prop is not provided', () => {
      render(
        <BrowserRouter>
          <LeftSidebar
            onMenuClick={mockOnMenuClick}
            isOpen={true}
            onToggle={mockOnToggle}
          />
        </BrowserRouter>
      );

      expect(screen.queryByText('Add Project')).not.toBeInTheDocument();
    });
  });
});
