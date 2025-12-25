/**
 * PromptEditor Component Tests
 *
 * Comprehensive tests for the battle prompt editor including:
 * - Character counting and validation
 * - Typing indicators
 * - Submission flow
 * - Timer display
 * - Error handling
 * - Keyboard shortcuts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor as _waitFor, act } from '@testing-library/react';
import _userEvent from '@testing-library/user-event';
import { PromptEditor } from './PromptEditor';

// Mock framer-motion to avoid animation timing issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/solid', () => ({
  PaperAirplaneIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="paper-airplane-icon" {...props} />
  ),
  SparklesIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="sparkles-icon" {...props} />
  ),
  ExclamationTriangleIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="exclamation-icon" {...props} />
  ),
}));

// Mock the useBattleTimer hook
vi.mock('@/hooks/useBattleTimer', () => ({
  useBattleTimer: vi.fn(({ serverTimeRemaining }) => ({
    timeRemaining: serverTimeRemaining,
    formattedTime: serverTimeRemaining !== null
      ? `${Math.floor(serverTimeRemaining / 60)}:${String(serverTimeRemaining % 60).padStart(2, '0')}`
      : null,
    isWarning: serverTimeRemaining !== null && serverTimeRemaining <= 60,
    isCritical: serverTimeRemaining !== null && serverTimeRemaining <= 30,
  })),
}));

describe('PromptEditor', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onTyping: vi.fn(),
    minLength: 10,
    maxLength: 2000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render the prompt editor with all elements', () => {
      render(<PromptEditor {...defaultProps} />);

      expect(screen.getByLabelText(/your prompt/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute(
        'placeholder',
        expect.stringContaining('Engineer your winning prompt')
      );
    });

    it('should accept custom placeholder', () => {
      render(<PromptEditor {...defaultProps} placeholder="Write your creative prompt here" />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Write your creative prompt here');
    });
  });

  describe('Character Count and Validation', () => {
    it('should display character count', () => {
      render(<PromptEditor {...defaultProps} />);

      expect(screen.getByText('0 / 2000')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(screen.getByText('5 / 2000')).toBeInTheDocument();
    });

    it('should show "too short" warning when below minimum', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Short' } });

      expect(screen.getByText(/min 10 chars/i)).toBeInTheDocument();
    });

    it('should disable submit button when prompt is too short', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Short' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when prompt meets minimum length', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'This is a long enough prompt' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should show error styling when prompt exceeds maximum', async () => {
      render(<PromptEditor {...defaultProps} maxLength={20} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'This prompt is way too long for the limit' },
      });

      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Typing Indicator', () => {
    it('should call onTyping(true) when user starts typing', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'H' } });

      expect(defaultProps.onTyping).toHaveBeenCalledWith(true);
    });

    it('should call onTyping(false) after typing stops (debounced)', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(defaultProps.onTyping).toHaveBeenCalledWith(true);

      // Fast-forward past the debounce timeout
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(defaultProps.onTyping).toHaveBeenCalledWith(false);
    });

    it('should reset debounce timer on continued typing', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      fireEvent.change(textarea, { target: { value: 'H' } });
      expect(defaultProps.onTyping).toHaveBeenCalledWith(true);

      // Type more before timeout
      act(() => {
        vi.advanceTimersByTime(500);
      });

      fireEvent.change(textarea, { target: { value: 'He' } });

      // Not enough time for debounce yet
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // onTyping(false) should NOT have been called yet with only 500ms since last type
      const falseCallsAfterFirstType = defaultProps.onTyping.mock.calls.filter(
        (call: [boolean]) => call[0] === false
      );
      expect(falseCallsAfterFirstType.length).toBe(0);
    });
  });

  describe('Submission', () => {
    it('should call onSubmit with trimmed prompt text', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '  Valid prompt text here  ' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Valid prompt text here');
    });

    it('should not submit when prompt is invalid', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Short' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('should not submit when disabled', async () => {
      render(<PromptEditor {...defaultProps} disabled={true} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Valid prompt text here' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('should support Cmd+Enter keyboard shortcut', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Valid prompt text here' } });

      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Valid prompt text here');
    });

    it('should not submit on Enter without meta key', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Valid prompt text here' } });

      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Timer Display', () => {
    it('should not show timer when timeRemaining is null', () => {
      render(<PromptEditor {...defaultProps} timeRemaining={null} />);

      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('should show timer when timeRemaining is provided', () => {
      render(<PromptEditor {...defaultProps} timeRemaining={120} />);

      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('should format time correctly', () => {
      render(<PromptEditor {...defaultProps} timeRemaining={75} />);

      expect(screen.getByText('1:15')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display error message when provided', () => {
      render(
        <PromptEditor {...defaultProps} error="Failed to submit. Please try again." />
      );

      expect(screen.getByText('Failed to submit. Please try again.')).toBeInTheDocument();
    });

    it('should not display error container when no error', () => {
      render(<PromptEditor {...defaultProps} error={null} />);

      expect(
        screen.queryByText(/failed/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label for textarea', () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAccessibleName();
    });

    it('should announce timer to screen readers', () => {
      render(<PromptEditor {...defaultProps} timeRemaining={120} />);

      const timer = screen.getByRole('timer');
      expect(timer).toHaveAttribute('aria-label', 'Time remaining: 2:00');
    });

    it('should indicate invalid state when over character limit', () => {
      render(<PromptEditor {...defaultProps} maxLength={20} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, {
        target: { value: 'This is way too long for the limit' },
      });

      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Disabled State', () => {
    it('should disable textarea when disabled prop is true', () => {
      render(<PromptEditor {...defaultProps} disabled={true} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should disable submit button when disabled prop is true', () => {
      render(<PromptEditor {...defaultProps} disabled={true} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('should have reduced opacity when disabled', () => {
      render(<PromptEditor {...defaultProps} disabled={true} />);

      const container = screen.getByRole('textbox').closest('div');
      expect(container?.parentElement).toHaveClass('opacity-50');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid typing', async () => {
      render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');

      // Simulate rapid typing
      for (let i = 1; i <= 10; i++) {
        fireEvent.change(textarea, { target: { value: 'a'.repeat(i) } });
      }

      expect(screen.getByText('10 / 2000')).toBeInTheDocument();
    });

    it('should handle exactly minimum length', () => {
      render(<PromptEditor {...defaultProps} minLength={10} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '1234567890' } }); // Exactly 10 chars

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
      expect(screen.queryByText(/min 10 chars/i)).not.toBeInTheDocument();
    });

    it('should handle exactly maximum length', () => {
      render(<PromptEditor {...defaultProps} maxLength={20} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '12345678901234567890' } }); // Exactly 20 chars

      expect(textarea).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('should cleanup typing timeout on unmount', () => {
      const { unmount } = render(<PromptEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      unmount();

      // Should not throw when timer tries to fire after unmount
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    });
  });
});
