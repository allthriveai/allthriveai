/**
 * Error message translation utility
 * Converts technical backend errors into user-friendly messages
 */

export interface ErrorResponse {
  error?: string;
  message?: string;
  action?: string;
  statusCode?: number;
  response?: {
    data?: {
      error?: string;
      message?: string;
      action?: string;
    };
    status?: number;
  };
}

export interface UserFriendlyError {
  title: string;
  message: string;
  actionText?: string;
  actionHref?: string;
  variant?: 'error' | 'warning' | 'info';
}

/**
 * Translate backend errors into user-friendly messages for YouTube integration
 */
export function getYouTubeErrorMessage(error: ErrorResponse): UserFriendlyError {
  // Extract error details from various error formats
  const errorData = error?.response?.data || error;
  const statusCode = error?.response?.status || error?.statusCode;
  const errorType = errorData?.error || error?.error;
  const errorMessage = errorData?.message || error?.message || '';
  const action = errorData?.action || error?.action;

  // Circuit breaker errors
  if (errorMessage.toLowerCase().includes('circuit breaker')) {
    return {
      title: 'YouTube is Temporarily Unavailable',
      message: 'We\'re experiencing connection issues with YouTube. Please try again in a few minutes. This is not an issue with your account.',
      variant: 'warning',
    };
  }

  // Quota exceeded
  if (errorType === 'quota_exceeded' || errorMessage.toLowerCase().includes('quota')) {
    return {
      title: 'Daily Import Limit Reached',
      message: 'You\'ve reached the maximum number of videos you can import today. Your quota will reset at midnight. Already imported videos are safe!',
      variant: 'warning',
    };
  }

  // Authentication errors
  if (statusCode === 401 || action === 'connect_youtube' || errorType === 'auth_error') {
    if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('expired')) {
      return {
        title: 'YouTube Connection Expired',
        message: 'Your YouTube connection needs to be refreshed for security. Please reconnect your account.',
        actionText: 'Reconnect YouTube',
        actionHref: '/settings/integrations',
        variant: 'warning',
      };
    }

    return {
      title: 'YouTube Not Connected',
      message: 'Please connect your YouTube account to import videos.',
      actionText: 'Connect YouTube',
      actionHref: '/settings/integrations',
      variant: 'info',
    };
  }

  // Video not found
  if (errorType === 'not_found' || statusCode === 404) {
    return {
      title: 'Video Not Found',
      message: 'This video may be private, deleted, or unavailable. Please check the video URL and try again.',
      variant: 'error',
    };
  }

  // Rate limiting
  if (statusCode === 429) {
    return {
      title: 'Too Many Requests',
      message: 'You\'re making requests too quickly. Please wait a moment before trying again.',
      variant: 'warning',
    };
  }

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('timeout')) {
    return {
      title: 'Connection Problem',
      message: 'We couldn\'t connect to YouTube. Please check your internet connection and try again.',
      variant: 'error',
    };
  }

  // Duplicate video
  if (errorType === 'duplicate') {
    return {
      title: 'Video Already Imported',
      message: 'This video is already in your projects. You can find it on your profile page.',
      actionText: 'View My Projects',
      actionHref: '/profile',
      variant: 'info',
    };
  }

  // No channel found
  if (errorMessage.toLowerCase().includes('no youtube channel') || errorMessage.toLowerCase().includes('no channel found')) {
    return {
      title: 'YouTube Channel Not Found',
      message: 'We couldn\'t find a YouTube channel associated with your Google account. Make sure you have a YouTube channel and try reconnecting.',
      actionText: 'Create YouTube Channel',
      actionHref: 'https://www.youtube.com/create_channel',
      variant: 'info',
    };
  }

  // Server errors (5xx)
  if (statusCode && statusCode >= 500) {
    return {
      title: 'Server Error',
      message: 'Our servers encountered an error. Our team has been notified. Please try again in a few minutes.',
      variant: 'error',
    };
  }

  // Generic fallback with helpful context
  return {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected error while working with YouTube. Please try again, or contact support if the problem persists.',
    actionText: 'Contact Support',
    actionHref: 'mailto:support@allthrive.ai',
    variant: 'error',
  };
}

/**
 * Translate backend errors into user-friendly messages for GitHub integration
 */
export function getGitHubErrorMessage(error: ErrorResponse): UserFriendlyError {
  const errorData = error?.response?.data || error;
  const statusCode = error?.response?.status || error?.statusCode;
  const errorMessage = errorData?.message || error?.message || '';

  // Authentication errors
  if (statusCode === 401) {
    return {
      title: 'GitHub Not Connected',
      message: 'Please connect your GitHub account to import repositories.',
      actionText: 'Connect GitHub',
      actionHref: '/settings/integrations',
      variant: 'info',
    };
  }

  // Rate limiting
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      title: 'GitHub Rate Limit Reached',
      message: 'You\'ve made too many requests to GitHub. Please wait about an hour before trying again.',
      variant: 'warning',
    };
  }

  // Repository not found
  if (statusCode === 404) {
    return {
      title: 'Repository Not Found',
      message: 'This repository may be private, deleted, or you may not have access to it.',
      variant: 'error',
    };
  }

  return {
    title: 'GitHub Connection Error',
    message: 'We encountered an error connecting to GitHub. Please try again.',
    variant: 'error',
  };
}

/**
 * Generic error translator - automatically detects integration type
 */
export function getUserFriendlyError(error: ErrorResponse, integration?: 'youtube' | 'github'): UserFriendlyError {
  // Auto-detect integration from error context
  const errorData = error?.response?.data || error;
  const errorMessage = errorData?.message || error?.message || '';

  if (!integration) {
    if (errorMessage.toLowerCase().includes('youtube') || errorMessage.toLowerCase().includes('google')) {
      integration = 'youtube';
    } else if (errorMessage.toLowerCase().includes('github')) {
      integration = 'github';
    }
  }

  // Route to appropriate translator
  switch (integration) {
    case 'youtube':
      return getYouTubeErrorMessage(error);
    case 'github':
      return getGitHubErrorMessage(error);
    default:
      return getYouTubeErrorMessage(error); // Default to YouTube for now
  }
}
