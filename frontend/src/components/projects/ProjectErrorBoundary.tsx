import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary for Project components
 * Prevents a single malformed project from crashing the entire page
 */
export class ProjectErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ProjectErrorBoundary caught an error:', error, errorInfo);
    }

    // In production, you'd send this to an error tracking service like Sentry
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackMessage, componentName } = this.props;

      return (
        <div className="relative rounded-xl overflow-hidden border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                {componentName ? `Error loading ${componentName}` : 'Something went wrong'}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                {fallbackMessage || 'This project could not be displayed due to an error.'}
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-4">
                  <summary className="text-sm font-medium text-red-800 dark:text-red-200 cursor-pointer hover:underline">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/20 rounded text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
