import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectCard } from './ProjectCard';
import type { Project } from '@/types/models';

// Mock the services
vi.mock('@/services/projects', () => ({
  toggleProjectLike: vi.fn(),
}));

// Mock react-router-dom navigate
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
    user: { id: 1, username: 'testuser' },
  }),
}));

// Mock react-rewards
vi.mock('react-rewards', () => ({
  useReward: () => ({
    reward: vi.fn(),
  }),
}));

// Mock CommentTray, ProjectModal, and ToolTray components
vi.mock('./CommentTray', () => ({
  CommentTray: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="comment-tray">Comment Tray</div> : null,
}));

vi.mock('./ProjectModal', () => ({
  ProjectModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="project-modal">Project Modal</div> : null,
}));

vi.mock('@/components/tools/ToolTray', () => ({
  ToolTray: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="tool-tray">Tool Tray</div> : null,
}));

vi.mock('./SlideUpHero', () => ({
  SlideUpHero: () => <div data-testid="slide-up-hero">Slide Up Hero</div>,
}));

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
  featuredImageUrl: 'https://example.com/featured.jpg',
  externalUrl: 'https://example.com',
  tools: [1, 2],
  toolsDetails: [],
  heartCount: 5,
  isLikedByUser: false,
  content: {
    tags: ['test', 'demo'],
    blocks: [],
  },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockProjectWithTools: Project = {
  ...mockProject,
  id: 2,
  toolsDetails: [
    {
      id: 1,
      name: 'ChatGPT',
      slug: 'chatgpt',
      logoUrl: 'https://example.com/chatgpt-logo.png',
    },
    {
      id: 2,
      name: 'Midjourney',
      slug: 'midjourney',
      logoUrl: 'https://example.com/midjourney-logo.png',
    },
  ],
};

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderProjectCard = (props: Partial<React.ComponentProps<typeof ProjectCard>> = {}) => {
    return render(
      <BrowserRouter>
        <ProjectCard
          project={mockProject}
          userAvatarUrl="https://example.com/avatar.jpg"
          {...props}
        />
      </BrowserRouter>
    );
  };

  describe('Avatar Click Navigation', () => {
    it('should navigate to user profile when avatar is clicked', async () => {
      renderProjectCard({ variant: 'masonry' });

      // Find the avatar button
      const avatarButton = screen.getByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      expect(avatarButton).toBeInTheDocument();

      // Click the avatar
      fireEvent.click(avatarButton);

      // Verify navigation was called with correct path
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/${mockProject.username}`);
      });
    });

    it('should not render avatar in selection mode', () => {
      renderProjectCard({
        selectionMode: true,
        onSelect: vi.fn(),
        variant: 'masonry'
      });

      // Avatar should not be present in selection mode
      const avatarButton = screen.queryByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      expect(avatarButton).not.toBeInTheDocument();
    });

    it('should display user avatar image when userAvatarUrl is provided', () => {
      renderProjectCard({
        variant: 'masonry',
        userAvatarUrl: 'https://example.com/avatar.jpg'
      });

      const avatarButton = screen.getByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      const avatarImage = avatarButton.querySelector('img');
      expect(avatarImage).toBeInTheDocument();
      expect(avatarImage).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(avatarImage).toHaveAttribute('alt', mockProject.username);
    });

    it('should display user initial when no avatar URL is provided', () => {
      renderProjectCard({
        variant: 'masonry',
        userAvatarUrl: undefined
      });

      const avatarButton = screen.getByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      // Should show first letter of username
      expect(avatarButton).toHaveTextContent('T'); // 'T' from 'testuser'
    });

    it('should handle avatar image load error gracefully', () => {
      renderProjectCard({
        variant: 'masonry',
        userAvatarUrl: 'https://example.com/broken-avatar.jpg'
      });

      const avatarButton = screen.getByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      const avatarImage = avatarButton.querySelector('img');
      expect(avatarImage).toBeInTheDocument();

      // Trigger error event
      if (avatarImage) {
        fireEvent.error(avatarImage);
      }

      // After error, should display user initial instead
      // The error handler replaces the image with a div showing the initial
      expect(avatarButton).toHaveTextContent('T');
    });
  });

  describe('Default Variant', () => {
    it('should render in default variant when variant prop is not specified', () => {
      const { container } = renderProjectCard({ variant: 'default' });

      // Default variant has aspect-video thumbnail container
      const thumbnailContainer = container.querySelector('.aspect-video');
      expect(thumbnailContainer).toBeInTheDocument();
    });

    it('should not show avatar in default variant', () => {
      renderProjectCard({ variant: 'default' });

      // Avatar should only appear in masonry variant
      const avatarButton = screen.queryByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      expect(avatarButton).not.toBeInTheDocument();
    });
  });

  describe('Masonry Variant', () => {
    it('should render in masonry variant when specified', () => {
      const { container } = renderProjectCard({ variant: 'masonry' });

      // Masonry variant doesn't use aspect-video container
      const aspectVideoContainer = container.querySelector('.aspect-video');
      expect(aspectVideoContainer).not.toBeInTheDocument();
    });

    it('should display avatar in masonry variant', () => {
      renderProjectCard({ variant: 'masonry' });

      const avatarButton = screen.queryByRole('button', {
        name: `View ${mockProject.username}'s profile`
      });

      expect(avatarButton).toBeInTheDocument();
    });

    it('should display project tags in masonry variant', () => {
      renderProjectCard({ variant: 'masonry' });

      expect(screen.getByText('#test')).toBeInTheDocument();
      expect(screen.getByText('#demo')).toBeInTheDocument();
    });
  });

  describe('Tool Icon Display', () => {
    /**
     * REGRESSION TEST: Tool icon circle on project cards
     *
     * This test ensures the tool icon is displayed on project cards when
     * toolsDetails contains tools with logoUrl. This was broken when
     * ProjectCardSerializer was "optimized" to exclude tools_details.
     *
     * The frontend requires:
     * - project.toolsDetails to be an array (not undefined)
     * - project.toolsDetails[0].logoUrl to display the tool logo
     * - project.toolsDetails[0].name for the button title/alt text
     *
     * If this test fails, check that the backend ProjectCardSerializer
     * includes tools_details with at least: id, name, slug, logo_url
     */
    it('should display tool icon when toolsDetails has logoUrl', () => {
      render(
        <BrowserRouter>
          <ProjectCard
            project={mockProjectWithTools}
            userAvatarUrl="https://example.com/avatar.jpg"
            variant="masonry"
          />
        </BrowserRouter>
      );

      // Find the tool button by its title (the tool name)
      const toolButton = screen.getByTitle('ChatGPT');
      expect(toolButton).toBeInTheDocument();

      // Verify the tool logo image is rendered
      const toolLogo = toolButton.querySelector('img');
      expect(toolLogo).toBeInTheDocument();
      expect(toolLogo).toHaveAttribute('src', 'https://example.com/chatgpt-logo.png');
      expect(toolLogo).toHaveAttribute('alt', 'ChatGPT');
    });

    it('should not display tool icon when toolsDetails is empty', () => {
      renderProjectCard({ variant: 'masonry' });

      // With empty toolsDetails, there should be no tool button
      // The mockProject has toolsDetails: [] so no tool icon should render
      const toolButtons = screen.queryAllByRole('button').filter(
        btn => btn.title && !btn.title.includes('profile')
      );

      // Filter out avatar button, like button, comment button - look for tool-specific button
      const toolButton = toolButtons.find(btn =>
        btn.querySelector('img[alt="ChatGPT"]') ||
        btn.querySelector('img[alt="Midjourney"]')
      );

      expect(toolButton).toBeUndefined();
    });

    it('should display fallback icon when tool has no logoUrl', () => {
      const projectWithToolNoLogo: Project = {
        ...mockProject,
        toolsDetails: [
          {
            id: 1,
            name: 'Custom Tool',
            slug: 'custom-tool',
            // No logoUrl - should show fallback CodeBracketIcon
          },
        ],
      };

      render(
        <BrowserRouter>
          <ProjectCard
            project={projectWithToolNoLogo}
            userAvatarUrl="https://example.com/avatar.jpg"
            variant="masonry"
          />
        </BrowserRouter>
      );

      // Find the tool button
      const toolButton = screen.getByTitle('Custom Tool');
      expect(toolButton).toBeInTheDocument();

      // Should NOT have an img (no logo)
      const toolLogo = toolButton.querySelector('img');
      expect(toolLogo).not.toBeInTheDocument();

      // Should have the fallback SVG icon (CodeBracketIcon)
      const fallbackIcon = toolButton.querySelector('svg');
      expect(fallbackIcon).toBeInTheDocument();
    });
  });
});
