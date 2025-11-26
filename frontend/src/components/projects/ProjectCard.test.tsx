import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectCard } from './ProjectCard';
import * as projectsService from '@/services/projects';
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
  isShowcase: true,
  isHighlighted: false,
  isPrivate: false,
  isArchived: false,
  isPublished: true,
  publishedAt: '2025-01-01T00:00:00Z',
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
});
