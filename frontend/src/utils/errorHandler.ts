/**
 * Centralized error handling for API calls and application errors.
 * Provides consistent logging, user feedback, and error tracking.
 */

import { AxiosError } from 'axios';

export interface ApiErrorResponse {
  message: string;
  details?: Record<string, string[]>;
  code?: string;
  status?: number;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: Record<string, string[]>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    status?: number,
    details?: Record<string, string[]>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Parse API error response into standardized format
 */
export function parseApiError(error: unknown): ApiErrorResponse {
  // Handle Axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;

    // Network errors (no response)
    if (!axiosError.response) {
      return {
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
        status: 0,
      };
    }

    const { data, status } = axiosError.response;

    // Handle different error response formats
    if (data) {
      // Django REST Framework validation errors
      if (typeof data === 'object' && !data.message) {
        const firstError = Object.entries(data)[0];
        if (firstError) {
          const [field, errors] = firstError;
          const errorArray = Array.isArray(errors) ? errors : [errors];
          return {
            message: `${field}: ${errorArray[0]}`,
            details: data,
            status,
          };
        }
      }

      // Standard error format
      if (data.error || data.message) {
        return {
          message: data.error || data.message,
          details: data.details,
          code: data.code,
          status,
        };
      }

      // Content field error (for comment validation)
      if (data.content && Array.isArray(data.content)) {
        return {
          message: data.content[0],
          details: { content: data.content },
          status,
        };
      }
    }

    // Fallback to status text
    return {
      message: axiosError.response.statusText || 'An error occurred',
      status,
    };
  }

  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    };
  }

  // Handle generic Error instances
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
    };
  }

  // Handle unknown error types
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Log error to console with structured format (production-ready logging)
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, any>
): void {
  const errorInfo = parseApiError(error);
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    context,
    error: {
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.status,
      details: errorInfo.details,
    },
    metadata,
    stack: error instanceof Error ? error.stack : undefined,
  };

  // In production, this would send to error tracking service (Sentry, etc.)
  if (import.meta.env.PROD) {
    console.error('[ERROR]', JSON.stringify(logEntry));
    // TODO: Send to error tracking service
    // Sentry.captureException(error, { contexts: { custom: logEntry } });
  } else {
    // Development: Pretty print to console
    console.group(`❌ ${context}`);
    console.error('Message:', errorInfo.message);
    if (errorInfo.code) console.error('Code:', errorInfo.code);
    if (errorInfo.status) console.error('Status:', errorInfo.status);
    if (errorInfo.details) console.error('Details:', errorInfo.details);
    if (metadata) console.error('Metadata:', metadata);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    console.groupEnd();
  }
}

/**
 * Handle error with user-friendly feedback
 */
export function handleError(
  context: string,
  error: unknown,
  options?: {
    showAlert?: boolean;
    metadata?: Record<string, any>;
    fallbackMessage?: string;
  }
): ApiErrorResponse {
  const errorInfo = parseApiError(error);

  // Log error
  logError(context, error, options?.metadata);

  // Show alert to user if requested
  if (options?.showAlert) {
    alert(errorInfo.message || options?.fallbackMessage || 'An error occurred');
  }

  return errorInfo;
}

/**
 * Validation utilities
 */
export const validators = {
  /**
   * Validate comment content
   */
  commentContent: (content: string): { valid: boolean; error?: string } => {
    if (!content || !content.trim()) {
      return { valid: false, error: 'Comment cannot be empty' };
    }

    const trimmed = content.trim();

    if (trimmed.length < 3) {
      return { valid: false, error: 'Comment is too short (minimum 3 characters)' };
    }

    if (trimmed.length > 5000) {
      return { valid: false, error: 'Comment is too long (maximum 5000 characters)' };
    }

    return { valid: true };
  },
};

/**
 * Retry wrapper for API calls with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      const errorInfo = parseApiError(error);
      // Retry on network errors or 5xx server errors
      return !errorInfo.status || errorInfo.status >= 500;
    },
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}
