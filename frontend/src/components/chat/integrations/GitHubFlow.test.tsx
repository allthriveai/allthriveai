/**
 * Unit tests for GitHubFlow component.
 *
 * CRITICAL: These tests ensure the GitHub integration UI works correctly.
 * They cover all flow states: connect, install, select, loading, and error.
 *
 * Run with: npm test -- --run GitHubFlow.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GitHubFlow } from './GitHubFlow';
import type { IntegrationFlowState } from '../core/types';
import type { GitHubRepository } from '@/services/github';

// Mock FontAwesome to avoid import issues in tests
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: { icon: unknown }) => <span data-testid="icon">{String(icon)}</span>,
}));

vi.mock('@fortawesome/free-brands-svg-icons', () => ({
  faGithub: 'github-icon',
}));

describe('GitHubFlow', () => {
  const mockRepos: GitHubRepository[] = [
    {
      name: 'test-repo-1',
      fullName: 'testuser/test-repo-1',
      description: 'First test repository',
      htmlUrl: 'https://github.com/testuser/test-repo-1',
      language: 'TypeScript',
      stars: 100,
      forks: 10,
      isPrivate: false,
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      name: 'private-repo',
      fullName: 'testuser/private-repo',
      description: 'A private repository',
      htmlUrl: 'https://github.com/testuser/private-repo',
      language: 'Python',
      stars: 5,
      forks: 0,
      isPrivate: true,
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  const defaultProps = {
    state: {
      step: 'idle' as const,
      message: '',
      error: null,
    } as IntegrationFlowState,
    repos: [],
    searchQuery: '',
    onSearchChange: vi.fn(),
    onSelectRepo: vi.fn(),
    onConnect: vi.fn(),
    onInstallApp: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state with message', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          state={{ step: 'loading', message: 'Checking your GitHub connection...', error: null }}
        />
      );

      expect(screen.getByText('Checking your GitHub connection...')).toBeInTheDocument();
    });

    it('should show skeleton loaders while loading', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          state={{ step: 'loading', message: 'Loading repositories...', error: null }}
        />
      );

      // Should have animated loading skeletons
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Connect State', () => {
    it('should render connect button when not connected', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          state={{
            step: 'connect',
            message: 'You need to connect your GitHub account first.',
            error: null,
          }}
        />
      );

      // Use role query to find the button specifically
      expect(screen.getByRole('button', { name: /Connect GitHub/i })).toBeInTheDocument();
      expect(screen.getByText('You need to connect your GitHub account first.')).toBeInTheDocument();
    });

    it('should call onConnect when connect button is clicked', () => {
      const onConnect = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          onConnect={onConnect}
          state={{ step: 'connect', message: '', error: null }}
        />
      );

      // Click the button (not the heading)
      fireEvent.click(screen.getByRole('button', { name: /Connect GitHub/i }));

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('should show back button in connect state', () => {
      const onBack = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          onBack={onBack}
          state={{ step: 'connect', message: '', error: null }}
        />
      );

      fireEvent.click(screen.getByText('Back'));

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Install State', () => {
    it('should render install button when app needs installation', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          state={{
            step: 'install',
            message: 'Select which repositories to share with All Thrive AI.',
            error: null,
          }}
        />
      );

      expect(screen.getByText('Install AllThrive App')).toBeInTheDocument();
      expect(screen.getByText('Install GitHub App')).toBeInTheDocument();
    });

    it('should call onInstallApp when install button is clicked', () => {
      const onInstallApp = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          onInstallApp={onInstallApp}
          state={{ step: 'install', message: '', error: null }}
        />
      );

      fireEvent.click(screen.getByText('Install AllThrive App'));

      expect(onInstallApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Select State', () => {
    it('should render repository list', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: 'Found 2 repositories!', error: null }}
        />
      );

      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
      expect(screen.getByText('private-repo')).toBeInTheDocument();
    });

    it('should show repository descriptions', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('First test repository')).toBeInTheDocument();
      expect(screen.getByText('A private repository')).toBeInTheDocument();
    });

    it('should show repository languages', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('should show star counts', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show private badge for private repos', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('Private')).toBeInTheDocument();
    });

    it('should call onSelectRepo when a repository is clicked', () => {
      const onSelectRepo = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          onSelectRepo={onSelectRepo}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      fireEvent.click(screen.getByText('test-repo-1'));

      expect(onSelectRepo).toHaveBeenCalledWith(mockRepos[0]);
    });

    it('should render search input', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();
    });

    it('should call onSearchChange when search input changes', () => {
      const onSearchChange = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          onSearchChange={onSearchChange}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('Search repositories...'), {
        target: { value: 'test' },
      });

      expect(onSearchChange).toHaveBeenCalledWith('test');
    });

    it('should filter repos by search query', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          searchQuery="private"
          state={{ step: 'select', message: '', error: null }}
        />
      );

      // Should only show private-repo
      expect(screen.queryByText('test-repo-1')).not.toBeInTheDocument();
      expect(screen.getByText('private-repo')).toBeInTheDocument();
    });

    it('should show empty message when no repos match search', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          searchQuery="nonexistent"
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('No repositories found matching your search.')).toBeInTheDocument();
    });

    it('should show empty message when no repos at all', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={[]}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      expect(screen.getByText('No repositories found.')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error message', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          state={{
            step: 'idle',
            message: '',
            error: 'Failed to connect to GitHub. Please try again.',
          }}
        />
      );

      expect(
        screen.getByText('Failed to connect to GitHub. Please try again.')
      ).toBeInTheDocument();
    });

    it('should show back button in error state', () => {
      const onBack = vi.fn();
      render(
        <GitHubFlow
          {...defaultProps}
          onBack={onBack}
          state={{ step: 'idle', message: '', error: 'Something went wrong' }}
        />
      );

      fireEvent.click(screen.getByText('Back'));

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Idle State', () => {
    it('should render nothing for idle state without error', () => {
      const { container } = render(
        <GitHubFlow
          {...defaultProps}
          state={{ step: 'idle', message: '', error: null }}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible search input', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      const input = screen.getByPlaceholderText('Search repositories...');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should have clickable repository items', () => {
      render(
        <GitHubFlow
          {...defaultProps}
          repos={mockRepos}
          state={{ step: 'select', message: '', error: null }}
        />
      );

      const buttons = screen.getAllByRole('button');
      // Should have back button + repo buttons
      expect(buttons.length).toBeGreaterThan(1);
    });
  });
});
