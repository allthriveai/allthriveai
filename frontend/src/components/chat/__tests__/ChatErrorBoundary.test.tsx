/**
 * ChatErrorBoundary Tests
 *
 * Tests for the chat error boundary including:
 * - Error catching and fallback rendering
 * - Inline vs card error display modes
 * - Custom fallback UI
 * - onError callback
 * - Retry functionality
 * - resetKey prop behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatErrorBoundary } from '../ChatErrorBoundary';

// Mock FontAwesome to avoid icon loading issues
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: { icon: { iconName: string } }) => (
    <span data-testid={`icon-${icon?.iconName || 'unknown'}`} />
  ),
}));

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child content rendered successfully</div>;
};

// Component that throws after initial render
const DelayedThrowingComponent = ({ throwOnUpdate }: { throwOnUpdate: boolean }) => {
  if (throwOnUpdate) {
    throw new Error('Delayed error');
  }
  return <div>Working component</div>;
};

describe('ChatErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('normal rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ChatErrorBoundary>
          <div>Normal child content</div>
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Normal child content')).toBeInTheDocument();
    });

    it('renders multiple children without error', () => {
      render(
        <ChatErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ChatErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('catches errors and shows card fallback by default', () => {
      render(
        <ChatErrorBoundary>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/still working on bugs while in beta mode/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('shows inline error when inline prop is true', () => {
      render(
        <ChatErrorBoundary inline>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Failed to render message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      // Card mode title should not be present
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('uses custom fallback when provided', () => {
      render(
        <ChatErrorBoundary fallback={<div>Custom error UI</div>}>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('logs error to console', () => {
      render(
        <ChatErrorBoundary>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('onError callback', () => {
    it('calls onError with error and errorInfo', () => {
      const onError = vi.fn();

      render(
        <ChatErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error message' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('does not call onError when no error occurs', () => {
      const onError = vi.fn();

      render(
        <ChatErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('retry functionality', () => {
    it('resets error state when Try Again is clicked (card mode)', () => {
      const { rerender } = render(
        <ChatErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      // Update child to not throw
      rerender(
        <ChatErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Now should show the child content
      expect(screen.getByText('Child content rendered successfully')).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('resets error state when Retry is clicked (inline mode)', () => {
      const { rerender } = render(
        <ChatErrorBoundary inline>
          <ThrowingComponent shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Failed to render message')).toBeInTheDocument();

      // Update child to not throw
      rerender(
        <ChatErrorBoundary inline>
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      // Now should show the child content
      expect(screen.getByText('Child content rendered successfully')).toBeInTheDocument();
    });
  });

  describe('resetKey behavior', () => {
    it('resets error state when resetKey changes', () => {
      const { rerender } = render(
        <ChatErrorBoundary resetKey="key-1">
          <ThrowingComponent shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      // Change resetKey (simulating conversation change) with non-throwing child
      rerender(
        <ChatErrorBoundary resetKey="key-2">
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      // Error should be cleared and child content shown
      expect(screen.getByText('Child content rendered successfully')).toBeInTheDocument();
    });

    it('does not reset when resetKey stays the same', () => {
      const { rerender } = render(
        <ChatErrorBoundary resetKey="same-key">
          <ThrowingComponent shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      // Rerender with same key but different child
      rerender(
        <ChatErrorBoundary resetKey="same-key">
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      // Error should still be shown (didn't reset)
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('works with numeric resetKey', () => {
      const { rerender } = render(
        <ChatErrorBoundary resetKey={1}>
          <ThrowingComponent shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      rerender(
        <ChatErrorBoundary resetKey={2}>
          <ThrowingComponent shouldThrow={false} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Child content rendered successfully')).toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('shows dragon icon in card mode', () => {
      render(
        <ChatErrorBoundary>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(screen.getByTestId('icon-dragon')).toBeInTheDocument();
    });

    it('shows warning icon in inline mode', () => {
      render(
        <ChatErrorBoundary inline>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      expect(screen.getByTestId('icon-triangle-exclamation')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles errors during update phase', () => {
      const { rerender } = render(
        <ChatErrorBoundary>
          <DelayedThrowingComponent throwOnUpdate={false} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();

      // Cause error on update
      rerender(
        <ChatErrorBoundary>
          <DelayedThrowingComponent throwOnUpdate={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles errors with no message', () => {
      const NoMessageError = () => {
        throw new Error();
      };

      render(
        <ChatErrorBoundary>
          <NoMessageError />
        </ChatErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles nested error boundaries', () => {
      render(
        <ChatErrorBoundary>
          <div>Outer content</div>
          <ChatErrorBoundary inline>
            <ThrowingComponent />
          </ChatErrorBoundary>
        </ChatErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getByText('Outer content')).toBeInTheDocument();
      expect(screen.getByText('Oops! Failed to render message')).toBeInTheDocument();
      // Outer boundary error should not be shown
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('retry button is focusable in card mode', () => {
      render(
        <ChatErrorBoundary>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });

    it('retry button is focusable in inline mode', () => {
      render(
        <ChatErrorBoundary inline>
          <ThrowingComponent />
        </ChatErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });
  });
});
