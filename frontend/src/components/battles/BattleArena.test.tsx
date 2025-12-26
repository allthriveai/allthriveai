/**
 * BattleArena Component Tests
 *
 * Comprehensive tests for the main battle interface including:
 * - Player card rendering
 * - Challenge display
 * - Submission states
 * - Async/invitation battle handling
 * - Guest user experience
 * - AI opponent (Pip) battles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BattleArena } from './BattleArena';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, transition: _transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, whileHover: _whileHover, whileTap: _whileTap, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/solid', () => ({
  BoltIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="bolt-icon" {...props} />
  ),
}));

// Mock child components
vi.mock('./PlayerCard', () => ({
  PlayerCard: ({ username, isCurrentUser, status, side, isAi }: any) => (
    <div
      data-testid={`player-card-${side}`}
      data-username={username}
      data-is-current-user={isCurrentUser}
      data-status={status}
      data-is-ai={isAi}
    >
      {username} ({status})
    </div>
  ),
}));

vi.mock('./ChallengeDisplay', () => ({
  ChallengeDisplay: ({ challengeText, canRefresh, onRefresh, isRefreshing }: any) => (
    <div data-testid="challenge-display" data-can-refresh={canRefresh}>
      <p>{challengeText}</p>
      {canRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          data-testid="refresh-challenge-btn"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      )}
    </div>
  ),
}));

vi.mock('./PromptEditor', () => ({
  PromptEditor: ({ onSubmit, onTyping, timeRemaining, error }: any) => (
    <div data-testid="prompt-editor">
      <textarea
        data-testid="prompt-input"
        onChange={(e) => onTyping(e.target.value.length > 0)}
      />
      <button
        data-testid="submit-prompt-btn"
        onClick={() => onSubmit('Test prompt submission')}
      >
        Submit
      </button>
      {error && <div data-testid="submit-error">{error}</div>}
      {timeRemaining !== null && (
        <span data-testid="time-remaining">{timeRemaining}</span>
      )}
    </div>
  ),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('BattleArena', () => {
  const mockCurrentUser = {
    id: 1,
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar1.jpg',
  };

  const mockOpponent = {
    id: 2,
    username: 'opponent',
    avatarUrl: 'https://example.com/avatar2.jpg',
  };

  const mockPipOpponent = {
    id: 99,
    username: 'Pip',
    avatarUrl: 'https://example.com/pip-avatar.jpg',
    isAi: true,
  };

  const defaultProps = {
    challengeText: 'Create an image of a futuristic city at sunset',
    challengeType: { key: 'creative', name: 'Creative Writing' },
    currentUser: mockCurrentUser,
    opponent: mockOpponent,
    currentUserStatus: 'connected' as const,
    opponentStatus: 'connected' as const,
    timeRemaining: 180,
    hasSubmitted: false,
    onSubmit: vi.fn(),
    onTyping: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render battle in progress header', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText(/battle in progress/i)).toBeInTheDocument();
    });

    it('should render both player cards', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const leftPlayer = screen.getByTestId('player-card-left');
      const rightPlayer = screen.getByTestId('player-card-right');

      expect(leftPlayer).toHaveAttribute('data-username', 'testuser');
      expect(leftPlayer).toHaveAttribute('data-is-current-user', 'true');

      expect(rightPlayer).toHaveAttribute('data-username', 'opponent');
      expect(rightPlayer).not.toHaveAttribute('data-is-current-user', 'true');
    });

    it('should render VS badge', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('VS')).toBeInTheDocument();
    });

    it('should render challenge display', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByTestId('challenge-display')).toBeInTheDocument();
      expect(
        screen.getByText('Create an image of a futuristic city at sunset')
      ).toBeInTheDocument();
    });

    it('should render prompt editor when not submitted', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByTestId('prompt-editor')).toBeInTheDocument();
    });
  });

  describe('Player Status Display', () => {
    it('should show current user status', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} currentUserStatus="typing" />
      );

      const leftPlayer = screen.getByTestId('player-card-left');
      expect(leftPlayer).toHaveAttribute('data-status', 'typing');
    });

    it('should show opponent status', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="submitted" />
      );

      const rightPlayer = screen.getByTestId('player-card-right');
      expect(rightPlayer).toHaveAttribute('data-status', 'submitted');
    });

    it('should show disconnected opponent', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="disconnected" />
      );

      const rightPlayer = screen.getByTestId('player-card-right');
      expect(rightPlayer).toHaveAttribute('data-status', 'disconnected');
    });
  });

  describe('Submission Flow', () => {
    it('should call onSubmit when prompt is submitted', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const submitBtn = screen.getByTestId('submit-prompt-btn');
      fireEvent.click(submitBtn);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Test prompt submission');
    });

    it('should call onTyping when user types', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByTestId('prompt-input');
      fireEvent.change(input, { target: { value: 'Hello' } });

      expect(defaultProps.onTyping).toHaveBeenCalledWith(true);
    });

    it('should show submitted state after submission', () => {
      renderWithRouter(<BattleArena {...defaultProps} hasSubmitted={true} />);

      expect(screen.getByText('Prompt Submitted!')).toBeInTheDocument();
      expect(screen.queryByTestId('prompt-editor')).not.toBeInTheDocument();
    });

    it('should show waiting message when user submitted but opponent has not', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          hasSubmitted={true}
          opponentStatus="connected"
        />
      );

      expect(
        screen.getByText(/waiting for your opponent to submit/i)
      ).toBeInTheDocument();
    });

    it('should show generating message when both have submitted', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          hasSubmitted={true}
          opponentStatus="submitted"
        />
      );

      expect(
        screen.getByText(/both players have submitted.*generating/i)
      ).toBeInTheDocument();
    });
  });

  describe('AI Opponent (Pip) Battles', () => {
    const pipProps = {
      ...defaultProps,
      opponent: mockPipOpponent,
      isAiOpponent: true,
    };

    it('should show AI opponent indicator', () => {
      renderWithRouter(<BattleArena {...pipProps} />);

      const rightPlayer = screen.getByTestId('player-card-right');
      expect(rightPlayer).toHaveAttribute('data-is-ai', 'true');
    });

    it('should allow challenge refresh for Pip battles', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <BattleArena
          {...pipProps}
          onRefreshChallenge={onRefresh}
        />
      );

      const challengeDisplay = screen.getByTestId('challenge-display');
      expect(challengeDisplay).toHaveAttribute('data-can-refresh', 'true');
    });

    it('should not allow challenge refresh after submission', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <BattleArena
          {...pipProps}
          hasSubmitted={true}
          onRefreshChallenge={onRefresh}
        />
      );

      expect(screen.queryByTestId('refresh-challenge-btn')).not.toBeInTheDocument();
    });

    it('should handle challenge refresh click', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <BattleArena
          {...pipProps}
          onRefreshChallenge={onRefresh}
        />
      );

      const refreshBtn = screen.getByTestId('refresh-challenge-btn');
      fireEvent.click(refreshBtn);

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should disable refresh button while refreshing', () => {
      renderWithRouter(
        <BattleArena
          {...pipProps}
          onRefreshChallenge={vi.fn()}
          isRefreshingChallenge={true}
        />
      );

      const refreshBtn = screen.getByTestId('refresh-challenge-btn');
      expect(refreshBtn).toBeDisabled();
      expect(refreshBtn).toHaveTextContent('Refreshing...');
    });
  });

  describe('Async/Invitation Battles', () => {
    const asyncProps = {
      ...defaultProps,
      isAsyncBattle: true,
      challengerName: 'Alice',
    };

    it('should show appropriate message after submission in async battle', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={true}
          opponentStatus="connected"
        />
      );

      expect(
        screen.getByText(/now it's alice's turn/i)
      ).toBeInTheDocument();
    });

    it('should show explore link for authenticated users after async submission', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={true}
          opponentStatus="connected"
          isGuestUser={false}
        />
      );

      expect(screen.getByRole('link', { name: /explore feed/i })).toHaveAttribute(
        'href',
        '/explore'
      );
    });

    it('should show waiting message when not user turn in async battle', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={false}
          isMyTurn={false}
        />
      );

      expect(screen.getByText(/waiting for alice/i)).toBeInTheDocument();
      expect(
        screen.getByText(/you'll be able to submit once they finish/i)
      ).toBeInTheDocument();
    });

    it('should show prompt editor when it is user turn', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={false}
          isMyTurn={true}
        />
      );

      expect(screen.getByTestId('prompt-editor')).toBeInTheDocument();
    });
  });

  describe('Guest User Experience', () => {
    const guestProps = {
      ...defaultProps,
      isAsyncBattle: true,
      isGuestUser: true,
      onSignupClick: vi.fn(),
    };

    it('should show signup CTA for guest after submission', () => {
      renderWithRouter(
        <BattleArena
          {...guestProps}
          hasSubmitted={true}
        />
      );

      expect(
        screen.getByRole('button', { name: /create account to get notified/i })
      ).toBeInTheDocument();
    });

    it('should call onSignupClick when guest clicks signup', () => {
      renderWithRouter(
        <BattleArena
          {...guestProps}
          hasSubmitted={true}
        />
      );

      const signupBtn = screen.getByRole('button', {
        name: /create account to get notified/i,
      });
      fireEvent.click(signupBtn);

      expect(guestProps.onSignupClick).toHaveBeenCalled();
    });

    it('should show appropriate guest message after submission', () => {
      renderWithRouter(
        <BattleArena
          {...guestProps}
          hasSubmitted={true}
          challengerName="Bob"
        />
      );

      expect(screen.getByText(/now it's bob's turn/i)).toBeInTheDocument();
      expect(
        screen.getByText(/they're not currently active/i)
      ).toBeInTheDocument();
    });
  });

  describe('Timer Display', () => {
    it('should pass time remaining to prompt editor', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} timeRemaining={120} />
      );

      const timeDisplay = screen.getByTestId('time-remaining');
      expect(timeDisplay).toHaveTextContent('120');
    });

    it('should handle null time remaining', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} timeRemaining={null} />
      );

      expect(screen.queryByTestId('time-remaining')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display submit error', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          submitError="Failed to submit. Please try again."
        />
      );

      expect(screen.getByTestId('submit-error')).toHaveTextContent(
        'Failed to submit. Please try again.'
      );
    });

    it('should not display error container when no error', () => {
      renderWithRouter(<BattleArena {...defaultProps} submitError={null} />);

      expect(screen.queryByTestId('submit-error')).not.toBeInTheDocument();
    });
  });

  describe('Challenge Type Display', () => {
    it('should pass challenge type to display', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          challengeType={{ key: 'portrait', name: 'Portrait Challenge' }}
        />
      );

      expect(screen.getByTestId('challenge-display')).toBeInTheDocument();
    });

    it('should handle null challenge type', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} challengeType={null} />
      );

      expect(screen.getByTestId('challenge-display')).toBeInTheDocument();
    });
  });

  describe('Timer Reset', () => {
    it('should pass timerResetKey to prompt editor', () => {
      const { rerender } = renderWithRouter(
        <BattleArena {...defaultProps} timerResetKey={0} />
      );

      // Re-render with new reset key (simulating challenge refresh)
      rerender(
        <BrowserRouter>
          <BattleArena {...defaultProps} timerResetKey={1} />
        </BrowserRouter>
      );

      expect(screen.getByTestId('prompt-editor')).toBeInTheDocument();
    });
  });

  describe('Background Effects', () => {
    it('should render background effects container', () => {
      const { container } = renderWithRouter(<BattleArena {...defaultProps} />);

      // Background effects are purely visual, just verify the structure exists
      expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should render VS badge for all screen sizes', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const vsBadge = screen.getByText('VS');
      expect(vsBadge).toBeInTheDocument();
    });

    it('should render both player cards side by side', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const leftPlayer = screen.getByTestId('player-card-left');
      const rightPlayer = screen.getByTestId('player-card-right');

      expect(leftPlayer).toBeInTheDocument();
      expect(rightPlayer).toBeInTheDocument();
    });
  });
});
