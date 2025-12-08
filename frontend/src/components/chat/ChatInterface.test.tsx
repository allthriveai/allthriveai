import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInterface } from './ChatInterface';
import type { ChatMessage } from '@/types/chat';

// Mock scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-mark-icon" {...props} />,
  PaperAirplaneIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="paper-airplane-icon" {...props} />,
  PhotoIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="photo-icon" {...props} />,
  XCircleIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-circle-icon" {...props} />,
  DocumentIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="document-icon" {...props} />,
  FilmIcon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="film-icon" {...props} />,
}));

describe('ChatInterface', () => {
  const mockMessages: ChatMessage[] = [
    { id: '1', content: 'Hello from user', sender: 'user', timestamp: new Date() },
    { id: '2', content: 'Hello from assistant', sender: 'assistant', timestamp: new Date() },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    messages: mockMessages,
    isLoading: false,
    onSendMessage: vi.fn(),
  };

  describe('Message rendering with customContent prop', () => {
    it('should render messages when customContent is undefined', () => {
      render(<ChatInterface {...defaultProps} customContent={undefined} />);

      expect(screen.getByText('Hello from user')).toBeInTheDocument();
      expect(screen.getByText('Hello from assistant')).toBeInTheDocument();
    });

    it('should render messages when customContent is not provided', () => {
      render(<ChatInterface {...defaultProps} />);

      expect(screen.getByText('Hello from user')).toBeInTheDocument();
      expect(screen.getByText('Hello from assistant')).toBeInTheDocument();
    });

    it('should render customContent instead of messages when customContent has actual content', () => {
      render(
        <ChatInterface
          {...defaultProps}
          customContent={<div data-testid="custom-content">Custom UI Here</div>}
        />
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByText('Custom UI Here')).toBeInTheDocument();
      // Messages should NOT be rendered
      expect(screen.queryByText('Hello from user')).not.toBeInTheDocument();
      expect(screen.queryByText('Hello from assistant')).not.toBeInTheDocument();
    });

    /**
     * CRITICAL TEST: This is the exact bug that was fixed.
     *
     * An empty React fragment (<></>) is truthy in JavaScript, which means
     * the condition `customContent ? customContent : messages.map(...)`
     * would never reach the messages.map() branch if customContent was
     * an empty fragment.
     *
     * The fix requires callers to pass `undefined` instead of an empty fragment
     * when they don't have custom content to show.
     */
    it('should NOT render messages when customContent is an empty React fragment (truthy value)', () => {
      // This test documents the expected behavior:
      // Empty fragment is truthy, so customContent takes precedence
      // Callers MUST pass undefined, not an empty fragment, to show messages
      render(
        <ChatInterface
          {...defaultProps}
          customContent={<></>}
        />
      );

      // With an empty fragment, messages will NOT be rendered
      // This is the EXPECTED behavior - the component trusts that if customContent
      // is provided (even empty), the caller wants to use custom content
      expect(screen.queryByText('Hello from user')).not.toBeInTheDocument();
      expect(screen.queryByText('Hello from assistant')).not.toBeInTheDocument();
    });

    it('should render messages when customContent is null', () => {
      render(<ChatInterface {...defaultProps} customContent={null} />);

      // null is falsy, so messages should render
      expect(screen.getByText('Hello from user')).toBeInTheDocument();
      expect(screen.getByText('Hello from assistant')).toBeInTheDocument();
    });

    it('should render messages when customContent is false', () => {
      render(<ChatInterface {...defaultProps} customContent={false as unknown as React.ReactNode} />);

      // false is falsy, so messages should render
      expect(screen.getByText('Hello from user')).toBeInTheDocument();
      expect(screen.getByText('Hello from assistant')).toBeInTheDocument();
    });

    it('should render customContent when it contains only null children (fragment is still truthy)', () => {
      // This documents the edge case that caused the original bug
      // A fragment with null children is still a truthy object
      render(
        <ChatInterface
          {...defaultProps}
          customContent={
            <>
              {null}
              {null}
            </>
          }
        />
      );

      // Fragment with null children is still truthy, so messages won't render
      expect(screen.queryByText('Hello from user')).not.toBeInTheDocument();
      expect(screen.queryByText('Hello from assistant')).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show initial message when messages array is empty and no customContent', () => {
      render(
        <ChatInterface
          {...defaultProps}
          messages={[]}
          config={{
            agentId: 'test-agent',
            agentName: 'Test Agent',
            initialMessage: 'Welcome! How can I help?'
          }}
        />
      );

      expect(screen.getByText('Welcome! How can I help?')).toBeInTheDocument();
    });

    it('should show custom empty state when provided', () => {
      render(
        <ChatInterface
          {...defaultProps}
          messages={[]}
          customEmptyState={<div data-testid="empty-state">No messages yet</div>}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<ChatInterface {...defaultProps} isLoading={true} />);

      // The loading indicator has animated bouncing dots
      const loadingDots = document.querySelectorAll('.animate-bounce');
      expect(loadingDots.length).toBe(3);
    });
  });

  describe('Visibility', () => {
    it('should be hidden when isOpen is false', () => {
      const { container } = render(<ChatInterface {...defaultProps} isOpen={false} />);

      // Check for translate-x-full class which hides the panel
      const panel = container.querySelector('[aria-hidden="true"]');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass('translate-x-full');
    });

    it('should be visible when isOpen is true', () => {
      const { container } = render(<ChatInterface {...defaultProps} isOpen={true} />);

      const panel = container.querySelector('[aria-hidden="false"]');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass('translate-x-0');
    });
  });
});
