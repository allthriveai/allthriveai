/**
 * ChatErrorBoundary - Error boundary specialized for chat components
 *
 * Provides graceful error handling for chat message rendering,
 * onboarding flows, and integration UIs with Ava-themed styling.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface ChatErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to show on error (uses default if not provided) */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show a minimal inline error vs card error */
  inline?: boolean;
  /** Reset key - changing this will reset the error boundary */
  resetKey?: string | number;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for chat components with Ava theming.
 *
 * Usage:
 *   <ChatErrorBoundary>
 *     <OnboardingIntroMessage ... />
 *   </ChatErrorBoundary>
 *
 *   // Inline mode for individual messages
 *   <ChatErrorBoundary inline>
 *     {renderMessage(message)}
 *   </ChatErrorBoundary>
 */
export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ChatErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: ChatErrorBoundaryProps) {
    // Reset error state when resetKey changes (e.g., conversation change)
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChatErrorBoundary] Error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Inline mode - minimal error indicator
      if (this.props.inline) {
        return (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4" />
                Oops! Failed to render message
                <button onClick={this.handleRetry} className="ml-2 text-xs underline hover:no-underline">
                  Retry
                </button>
                <a href="/feedback" className="text-xs underline hover:no-underline">
                  Report
                </a>
              </span>
            </div>
          </div>
        );
      }

      // Card mode - friendly error with Ava branding
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <div className="w-full max-w-sm text-center">
            {/* Ava avatar with error state */}
            <div className="mb-4 mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faDragon}
                className="w-8 h-8 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              />
            </div>

            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Oops! Something went wrong
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              We're still working on bugs while in beta mode. Try again, or file this as an issue to help us improve!
            </p>

            {/* Error details in dev mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto max-h-32 text-red-600 dark:text-red-400">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
              <a
                href="/feedback"
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Report Issue
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChatErrorBoundary;
