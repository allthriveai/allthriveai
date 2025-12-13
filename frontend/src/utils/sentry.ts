/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for production error monitoring and reporting.
 *
 * FIXED VERSION - Addresses:
 * - Circular dependency issues
 * - Consistent production checks
 * - Configurable sample rates
 * - Proper error handling
 */

import * as Sentry from '@sentry/react';
import React from 'react';

/**
 * Initialize Sentry error tracking
 *
 * This should be called as early as possible in the application lifecycle,
 * ideally in main.tsx before rendering the React app.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
  const isProduction = import.meta.env.PROD;

  // Skip initialization if no DSN configured
  if (!dsn) {
    if (!isProduction) {
      console.info('[Sentry] DSN not configured. Error tracking is disabled.');
    }
    return;
  }

  // Skip initialization in development even with DSN
  if (!isProduction) {
    console.info('[Sentry] Skipping initialization in development mode.');
    return;
  }

  // Get configurable sample rates from env (with defaults)
  const tracesSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1');
  const replaysSessionSampleRate = parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1');
  const replaysOnErrorSampleRate = parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_ERROR_SAMPLE_RATE || '1.0');

  try {
    Sentry.init({
      dsn,
      environment,
      release: import.meta.env.VITE_APP_VERSION || 'unknown',

      // Performance monitoring
      tracesSampleRate,

      // Session replay
      replaysSessionSampleRate,
      replaysOnErrorSampleRate,

      // Enable React-specific features
      integrations: [
        // Note: React Router integration moved to createSentryRouterIntegration()
        // to avoid circular dependencies

        // Session replay for debugging
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),

        // Browser profiling
        Sentry.browserProfilingIntegration(),
      ],

      // Filter out low-value errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',

        // Network errors (handled by our error handler)
        'Network Error',
        'NetworkError',
        'Failed to fetch',
        'Load failed',

        // Browser quirks
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',

        // User cancelled actions
        'AbortError',
        'The user aborted a request',

        // Third-party script errors
        'Script error',

        // Non-Error promise rejections from third-party libraries (e.g., PostHog, Stripe)
        // These are typically timeout strings from minified code like "Timeout (b)"
        /^Timeout/,
        /^Non-Error promise rejection captured/,
      ],

      // Ignore specific URLs
      denyUrls: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,
      ],

      // Add custom tags to all events
      initialScope: {
        tags: {
          app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
          app_environment: environment,
        },
      },

      // Before sending error, clean sensitive data
      beforeSend(event) {
        // Sanitize URLs
        if (event.request?.url) {
          event.request.url = sanitizeUrl(event.request.url);
        }

        // Sanitize breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data?.url) {
              breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url);
            }
            return breadcrumb;
          });
        }

        // Sanitize request headers
        if (event.request?.headers) {
          const sanitized = sanitizeHeaders(event.request.headers);
          event.request.headers = sanitized as Record<string, string>;
        }

        // Sanitize extra context
        if (event.extra) {
          const sanitized = sanitizeObject(event.extra);
          event.extra = sanitized as Record<string, unknown>;
        }

        return event;
      },

      // Transport options for better reliability
      transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
    });

    console.info('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Create React Router integration
 * Call this from your router setup to avoid circular dependencies
 */
export function createSentryRouterIntegration() {
  // Dynamic import to avoid circular dependencies
  return import('react-router-dom').then(({ useLocation, useNavigationType, createRoutesFromChildren, matchRoutes }) => {
    return Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    });
  });
}

/**
 * Sanitize URL by removing sensitive query parameters
 */
function sanitizeUrl(url: string): string {
  try {
    return url
      .replace(/([?&])(access_token|api_key|apikey|token|password|secret|auth)=[^&]*/gi, '$1$2=REDACTED')
      .replace(/([?&])(client_secret|client_id)=[^&]*/gi, '$1$2=REDACTED');
  } catch {
    return url;
  }
}

/**
 * Sanitize headers by redacting sensitive values
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-access-token',
  ];

  const sanitized = { ...headers };

  Object.keys(sanitized).forEach(key => {
    if (sensitiveHeaders.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = 'REDACTED';
    }
  });

  return sanitized;
}

/**
 * Recursively sanitize object by removing sensitive keys
 */
function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'accessToken', 'access_token'];

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;

  for (const key in objRecord) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = 'REDACTED';
    } else if (typeof objRecord[key] === 'object') {
      sanitized[key] = sanitizeObject(objRecord[key]);
    } else {
      sanitized[key] = objRecord[key];
    }
  }

  return sanitized;
}

/**
 * Capture an exception to Sentry with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
    user?: Sentry.User;
    fingerprint?: string[];
  }
) {
  // Only send in production
  if (!import.meta.env.PROD) {
    return;
  }

  Sentry.withScope((scope) => {
    // Add tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Add extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, sanitizeObject(value));
      });
    }

    // Set severity level
    if (context?.level) {
      scope.setLevel(context.level);
    }

    // Set user information
    if (context?.user) {
      scope.setUser(context.user);
    }

    // Set custom fingerprint for grouping
    if (context?.fingerprint) {
      scope.setFingerprint(context.fingerprint);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message to Sentry
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!import.meta.env.PROD) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, sanitizeObject(value));
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set the current user for error tracking
 * Call this when user logs in/out
 */
export function setUser(user: { id: string; email?: string; username?: string; [key: string]: unknown } | null) {
  if (!import.meta.env.PROD) {
    return;
  }

  if (user) {
    // Only include safe user properties
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      // Add any other safe properties
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
) {
  if (!import.meta.env.PROD) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data: data ? (sanitizeObject(data) as Record<string, unknown>) : undefined,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Re-export Sentry for direct access if needed
export { Sentry };

// Note: Don't import React or React Router here to avoid circular dependencies
// Those imports should be handled in the router setup
