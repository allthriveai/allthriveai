/**
 * BattleArena Component Tests - Real User Scenarios
 *
 * Tests actual user-facing behavior without mocking child components:
 * - Player display (usernames, avatars, badges)
 * - Challenge prompt visibility
 * - Typing and submitting prompts
 * - Timer behavior
 * - State transitions (submitted, waiting)
 * - AI opponent (Pip) features
 * - Guest user experience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { BattleArena } from './BattleArena';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
  const filterMotionProps = (props: any) => {
    const {
      initial: _initial, animate: _animate, exit: _exit, variants: _variants, transition: _transition,
      whileHover: _whileHover, whileTap: _whileTap, whileFocus: _whileFocus, whileInView: _whileInView,
      onAnimationStart: _onAnimationStart, onAnimationComplete: _onAnimationComplete,
      ...rest
    } = props;
    return rest;
  };

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
      button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...filterMotionProps(props)}>{children}</button>
      ),
      p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock heroicons - just need them to render
vi.mock('@heroicons/react/24/solid', () => ({
  BoltIcon: () => <span data-testid="bolt-icon" />,
  UserCircleIcon: () => <span data-testid="user-circle-icon" />,
  CheckCircleIcon: () => <span data-testid="check-circle-icon" />,
  PencilIcon: () => <span data-testid="pencil-icon" />,
  SparklesIcon: () => <span data-testid="sparkles-icon" />,
  WifiIcon: () => <span data-testid="wifi-icon" />,
  FireIcon: () => <span data-testid="fire-icon" />,
  ArrowPathIcon: ({ className }: any) => (
    <span data-testid="arrow-path-icon" className={className} />
  ),
  PaperAirplaneIcon: () => <span data-testid="paper-airplane-icon" />,
  ExclamationTriangleIcon: () => <span data-testid="exclamation-icon" />,
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('BattleArena - Real User Scenarios', () => {
  const mockCurrentUser = {
    id: 1,
    username: 'alice',
    avatarUrl: 'https://example.com/alice.jpg',
  };

  const mockOpponent = {
    id: 2,
    username: 'bob',
    avatarUrl: 'https://example.com/bob.jpg',
  };

  const mockPipOpponent = {
    id: 99,
    username: 'Pip',
    avatarUrl: '/pip-avatar.jpg',
    isAi: true,
  };

  const defaultProps = {
    challengeText: 'Create a magical forest at sunset',
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

  describe('Player Display', () => {
    it('shows both player usernames', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('shows YOU badge on current user card', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('YOU')).toBeInTheDocument();
    });

    it('shows VS badge between players', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('VS')).toBeInTheDocument();
    });

    it('shows "Battle in Progress" header', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('Battle in Progress')).toBeInTheDocument();
    });
  });

  describe('AI Opponent (Pip)', () => {
    it('shows AI badge for Pip opponent', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          opponent={mockPipOpponent}
          isAiOpponent={true}
        />
      );

      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Pip')).toBeInTheDocument();
    });

    it('shows refresh button for AI battles', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          opponent={mockPipOpponent}
          isAiOpponent={true}
          onRefreshChallenge={onRefresh}
        />
      );

      expect(screen.getByRole('button', { name: /try a different prompt/i })).toBeInTheDocument();
    });

    it('calls onRefreshChallenge when refresh button clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn().mockResolvedValue(undefined);

      renderWithRouter(
        <BattleArena
          {...defaultProps}
          opponent={mockPipOpponent}
          isAiOpponent={true}
          onRefreshChallenge={onRefresh}
        />
      );

      const refreshBtn = screen.getByRole('button', { name: /try a different prompt/i });
      await user.click(refreshBtn);

      expect(onRefresh).toHaveBeenCalled();
    });

    it('disables refresh button while refreshing', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          opponent={mockPipOpponent}
          isAiOpponent={true}
          onRefreshChallenge={vi.fn()}
          isRefreshingChallenge={true}
        />
      );

      const refreshBtn = screen.getByRole('button', { name: /getting new prompt/i });
      expect(refreshBtn).toBeDisabled();
    });

    it('hides refresh button after user submits', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          opponent={mockPipOpponent}
          isAiOpponent={true}
          hasSubmitted={true}
          onRefreshChallenge={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /try a different prompt/i })).not.toBeInTheDocument();
    });
  });

  describe('Challenge Display', () => {
    it('shows the challenge text in quotes', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('"Create a magical forest at sunset"')).toBeInTheDocument();
    });

    it('shows challenge type badge', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('Creative Writing')).toBeInTheDocument();
    });

    it('shows "Your Challenge" label', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('Your Challenge')).toBeInTheDocument();
    });
  });

  describe('Prompt Editor', () => {
    it('shows prompt input with placeholder', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('Engineer your winning prompt'));
    });

    it('shows character count', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      expect(screen.getByText('0 / 2000')).toBeInTheDocument();
    });

    it('updates character count as user types', async () => {
      const user = userEvent.setup();
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello world');

      expect(screen.getByText('11 / 2000')).toBeInTheDocument();
    });

    it('shows minimum character warning when prompt is too short', async () => {
      const user = userEvent.setup();
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Short');

      expect(screen.getByText('Min 10 chars')).toBeInTheDocument();
    });

    it('disables submit button when prompt is too short', async () => {
      const user = userEvent.setup();
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Short');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit button when prompt meets minimum length', async () => {
      const user = userEvent.setup();
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'This is a valid prompt with enough characters');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it('calls onSubmit with prompt text when submitted', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithRouter(<BattleArena {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'This is my creative prompt for the battle');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledWith('This is my creative prompt for the battle');
    });

    it('calls onTyping when user starts typing', async () => {
      const user = userEvent.setup();
      const onTyping = vi.fn();
      renderWithRouter(<BattleArena {...defaultProps} onTyping={onTyping} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'H');

      expect(onTyping).toHaveBeenCalledWith(true);
    });
  });

  describe('Timer Display', () => {
    it('shows formatted time remaining', () => {
      renderWithRouter(<BattleArena {...defaultProps} timeRemaining={180} />);

      expect(screen.getByText('3:00')).toBeInTheDocument();
    });

    it('counts down every second', async () => {
      vi.useFakeTimers();
      try {
        renderWithRouter(<BattleArena {...defaultProps} timeRemaining={180} />);

        expect(screen.getByText('3:00')).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('2:59')).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('2:58')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not show timer when timeRemaining is null', () => {
      renderWithRouter(<BattleArena {...defaultProps} timeRemaining={null} />);

      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });
  });

  describe('Submission States', () => {
    it('shows "Prompt Submitted!" after user submits', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} hasSubmitted={true} />
      );

      expect(screen.getByText('Prompt Submitted!')).toBeInTheDocument();
    });

    it('hides prompt editor after submission', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} hasSubmitted={true} />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('shows waiting message when user submitted but opponent has not', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          hasSubmitted={true}
          opponentStatus="connected"
        />
      );

      expect(screen.getByText('Waiting for your opponent to submit...')).toBeInTheDocument();
    });

    it('shows generating message when both have submitted', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          hasSubmitted={true}
          opponentStatus="submitted"
        />
      );

      expect(screen.getByText('Both players have submitted. Generating images...')).toBeInTheDocument();
    });

    it('displays submit error when provided', () => {
      renderWithRouter(
        <BattleArena
          {...defaultProps}
          submitError="Connection lost. Please try again."
        />
      );

      expect(screen.getByText('Connection lost. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Async/Invitation Battles', () => {
    const asyncProps = {
      ...defaultProps,
      isAsyncBattle: true,
      challengerName: 'Charlie',
    };

    it('shows turn message after submission in async battle', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={true}
          opponentStatus="connected"
        />
      );

      expect(screen.getByText(/now it's charlie's turn/i)).toBeInTheDocument();
    });

    it('shows explore link after async submission for authenticated users', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={true}
          opponentStatus="connected"
          isGuestUser={false}
        />
      );

      const exploreLink = screen.getByRole('link', { name: /explore feed/i });
      expect(exploreLink).toHaveAttribute('href', '/explore');
    });

    it('shows waiting message when not users turn in async battle', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={false}
          isMyTurn={false}
        />
      );

      expect(screen.getByText(/waiting for charlie/i)).toBeInTheDocument();
      expect(screen.getByText(/you'll be able to submit once they finish/i)).toBeInTheDocument();
    });

    it('shows prompt editor when it is users turn', () => {
      renderWithRouter(
        <BattleArena
          {...asyncProps}
          hasSubmitted={false}
          isMyTurn={true}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Guest User Experience', () => {
    const guestProps = {
      ...defaultProps,
      isAsyncBattle: true,
      isGuestUser: true,
      onSignupClick: vi.fn(),
      challengerName: 'Dave',
    };

    it('shows signup CTA for guest after submission', () => {
      renderWithRouter(
        <BattleArena {...guestProps} hasSubmitted={true} />
      );

      expect(
        screen.getByRole('button', { name: /create account to get notified/i })
      ).toBeInTheDocument();
    });

    it('calls onSignupClick when guest clicks signup', async () => {
      const user = userEvent.setup();
      const onSignupClick = vi.fn();

      renderWithRouter(
        <BattleArena
          {...guestProps}
          hasSubmitted={true}
          onSignupClick={onSignupClick}
        />
      );

      const signupBtn = screen.getByRole('button', { name: /create account to get notified/i });
      await user.click(signupBtn);

      expect(onSignupClick).toHaveBeenCalled();
    });

    it('shows appropriate guest message after submission', () => {
      renderWithRouter(
        <BattleArena {...guestProps} hasSubmitted={true} />
      );

      expect(screen.getByText(/now it's dave's turn/i)).toBeInTheDocument();
      expect(screen.getByText(/they're not currently active/i)).toBeInTheDocument();
    });
  });

  describe('Player Status Indicators', () => {
    it('shows Ready status for connected players', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="connected" />
      );

      // Both players should show "Ready" status text
      const readyElements = screen.getAllByText('Ready');
      expect(readyElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Writing status when player is typing', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="typing" />
      );

      expect(screen.getByText('Writing...')).toBeInTheDocument();
    });

    it('shows Submitted status when player submitted', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="submitted" />
      );

      expect(screen.getByText('Submitted!')).toBeInTheDocument();
    });

    it('shows Disconnected status when player disconnects', () => {
      renderWithRouter(
        <BattleArena {...defaultProps} opponentStatus="disconnected" />
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('submits with Cmd+Enter when prompt is valid', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithRouter(<BattleArena {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'This is a valid prompt');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(onSubmit).toHaveBeenCalled();
    });

    it('does not submit with Cmd+Enter when prompt is invalid', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithRouter(<BattleArena {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Short');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible label on prompt input', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      const input = screen.getByLabelText('Your Prompt');
      expect(input).toBeInTheDocument();
    });

    it('timer has aria-label for screen readers', () => {
      renderWithRouter(<BattleArena {...defaultProps} timeRemaining={120} />);

      const timer = screen.getByRole('timer');
      expect(timer).toHaveAttribute('aria-label', 'Time remaining: 2:00');
    });

    it('character count is announced to screen readers', () => {
      renderWithRouter(<BattleArena {...defaultProps} />);

      // Screen reader text should be present
      expect(screen.getByText('0 of 2000 characters')).toBeInTheDocument();
    });
  });
});
