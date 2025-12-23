/**
 * FigmaFlow Component Tests
 *
 * Tests for the self-contained Figma integration flow component.
 * Run with: npm test -- FigmaFlow.test.tsx
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FigmaFlow } from './FigmaFlow';
import type { IntegrationFlowState } from '../core/types';

// Default props for testing
const defaultProps = {
  state: { step: 'select', message: 'Paste your Figma URL' } as IntegrationFlowState,
  onConnect: vi.fn(),
  onImportUrl: vi.fn().mockResolvedValue(undefined),
  isFigmaUrl: (url: string) => {
    const figmaPatterns = [
      /figma\.com\/(file|design|proto|make|board)\//,
      /\.figma\.site/,
    ];
    return figmaPatterns.some((pattern) => pattern.test(url));
  },
  onBack: vi.fn(),
};

describe('FigmaFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state with message', () => {
      const loadingState: IntegrationFlowState = {
        step: 'loading',
        message: 'Checking connection...',
      };

      render(<FigmaFlow {...defaultProps} state={loadingState} />);

      expect(screen.getByText('Checking connection...')).toBeInTheDocument();
    });

    it('should show loading animation', () => {
      const loadingState: IntegrationFlowState = {
        step: 'loading',
        message: 'Loading...',
      };

      render(<FigmaFlow {...defaultProps} state={loadingState} />);

      // Check for animate-pulse class on container
      const container = screen.getByText('Loading...').parentElement?.parentElement;
      expect(container?.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Connect State', () => {
    it('should render connect state with connect button', () => {
      const connectState: IntegrationFlowState = {
        step: 'connect',
        message: 'Connect your Figma account to import designs',
      };

      render(<FigmaFlow {...defaultProps} state={connectState} />);

      // Use getByRole to specifically find the button (avoids matching the h3 heading)
      expect(screen.getByRole('button', { name: /Connect Figma/i })).toBeInTheDocument();
    });

    it('should show back button in connect state', () => {
      const connectState: IntegrationFlowState = {
        step: 'connect',
        message: 'Connect your Figma account',
      };

      render(<FigmaFlow {...defaultProps} state={connectState} />);

      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('should call onConnect when connect button is clicked', async () => {
      const connectState: IntegrationFlowState = {
        step: 'connect',
        message: 'Connect to Figma',
      };
      const onConnect = vi.fn();

      render(<FigmaFlow {...defaultProps} state={connectState} onConnect={onConnect} />);

      const connectButton = screen.getByRole('button', { name: /Connect Figma/i });
      await userEvent.click(connectButton);

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('should call onBack when back button is clicked', async () => {
      const connectState: IntegrationFlowState = {
        step: 'connect',
        message: 'Connect to Figma',
      };
      const onBack = vi.fn();

      render(<FigmaFlow {...defaultProps} state={connectState} onBack={onBack} />);

      const backButton = screen.getByRole('button', { name: /Back/i });
      await userEvent.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Select (URL Input) State', () => {
    it('should render URL input form', () => {
      render(<FigmaFlow {...defaultProps} />);

      expect(screen.getByText('Import from Figma')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/figma.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Import Design/i })).toBeInTheDocument();
    });

    it('should show back button', () => {
      render(<FigmaFlow {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('should have disabled import button when input is empty', () => {
      render(<FigmaFlow {...defaultProps} />);

      const importButton = screen.getByRole('button', { name: /Import Design/i });
      expect(importButton).toBeDisabled();
    });

    it('should enable import button when valid URL is entered', async () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://www.figma.com/design/abc123/My-Design');

      const importButton = screen.getByRole('button', { name: /Import Design/i });
      expect(importButton).toBeEnabled();
    });

    it('should show error for invalid URL', async () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://google.com/invalid');

      expect(screen.getByText(/Please enter a valid Figma/i)).toBeInTheDocument();
    });

    it('should clear error when valid URL is entered', async () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);

      // Enter invalid URL
      await userEvent.type(input, 'https://google.com/invalid');
      expect(screen.getByText(/Please enter a valid Figma/i)).toBeInTheDocument();

      // Clear and enter valid URL
      await userEvent.clear(input);
      await userEvent.type(input, 'https://www.figma.com/design/abc123/My-Design');

      expect(screen.queryByText(/Please enter a valid Figma/i)).not.toBeInTheDocument();
    });

    it('should call onImportUrl when form is submitted with valid URL', async () => {
      const onImportUrl = vi.fn().mockResolvedValue(undefined);

      render(<FigmaFlow {...defaultProps} onImportUrl={onImportUrl} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://www.figma.com/design/abc123/My-Design');

      const importButton = screen.getByRole('button', { name: /Import Design/i });
      await userEvent.click(importButton);

      expect(onImportUrl).toHaveBeenCalledWith('https://www.figma.com/design/abc123/My-Design');
    });

    it('should not call onImportUrl when form is submitted with invalid URL', async () => {
      const onImportUrl = vi.fn();

      render(<FigmaFlow {...defaultProps} onImportUrl={onImportUrl} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://google.com/invalid');

      // Try to submit by pressing Enter
      fireEvent.submit(input.closest('form')!);

      expect(onImportUrl).not.toHaveBeenCalled();
    });
  });

  describe('URL Validation', () => {
    const testCases = [
      { url: 'https://www.figma.com/design/abc123/My-Design', valid: true },
      { url: 'https://www.figma.com/file/abc123/My-Design', valid: true },
      { url: 'https://figma.com/design/abc123/My-Design', valid: true },
      { url: 'https://www.figma.com/proto/abc123/Prototype', valid: true },
      { url: 'https://www.figma.com/make/abc123/Slides', valid: true },
      { url: 'https://www.figma.com/board/abc123/FigJam', valid: true },
      { url: 'https://my-portfolio.figma.site', valid: true },
      { url: 'https://google.com', valid: false },
      { url: 'https://github.com/user/repo', valid: false },
      { url: 'not a url', valid: false },
    ];

    testCases.forEach(({ url, valid }) => {
      it(`should ${valid ? 'accept' : 'reject'} "${url}"`, async () => {
        render(<FigmaFlow {...defaultProps} />);

        const input = screen.getByPlaceholderText(/figma.com/i);
        await userEvent.type(input, url);

        if (valid) {
          expect(screen.queryByText(/Please enter a valid Figma/i)).not.toBeInTheDocument();
        } else {
          expect(screen.getByText(/Please enter a valid Figma/i)).toBeInTheDocument();
        }
      });
    });
  });

  describe('Error State', () => {
    it('should render error state with message', () => {
      // Use a step that isn't handled (error state takes precedence over unhandled steps)
      const errorState: IntegrationFlowState = {
        step: 'error' as IntegrationFlowState['step'],
        message: '',
        error: 'Failed to import design. Please try again.',
      };

      render(<FigmaFlow {...defaultProps} state={errorState} />);

      expect(screen.getByText('Failed to import design. Please try again.')).toBeInTheDocument();
    });

    it('should show back button in error state', () => {
      const errorState: IntegrationFlowState = {
        step: 'error' as IntegrationFlowState['step'],
        message: '',
        error: 'Something went wrong',
      };

      render(<FigmaFlow {...defaultProps} state={errorState} />);

      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible input field', () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      expect(input).toHaveAttribute('type', 'url');
    });

    it('should have accessible buttons', () => {
      render(<FigmaFlow {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /Back/i });
      const importButton = screen.getByRole('button', { name: /Import Design/i });

      expect(backButton).toBeInTheDocument();
      expect(importButton).toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('should show red border on invalid URL', async () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://invalid.com');

      // Check for red border class
      expect(input).toHaveClass('border-red-500');
    });

    it('should show normal border on valid URL', async () => {
      render(<FigmaFlow {...defaultProps} />);

      const input = screen.getByPlaceholderText(/figma.com/i);
      await userEvent.type(input, 'https://www.figma.com/design/abc123/Design');

      // Should not have red border
      expect(input).not.toHaveClass('border-red-500');
    });
  });

  describe('Message Display', () => {
    it('should display custom message from state', () => {
      const customState: IntegrationFlowState = {
        step: 'select',
        message: 'Custom message for user',
      };

      render(<FigmaFlow {...defaultProps} state={customState} />);

      expect(screen.getByText('Custom message for user')).toBeInTheDocument();
    });

    it('should display supported formats hint', () => {
      render(<FigmaFlow {...defaultProps} />);

      expect(screen.getByText(/Supported: Figma design files/i)).toBeInTheDocument();
    });
  });
});
