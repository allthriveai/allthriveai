/**
 * Error handling utilities for type-safe error handling in TypeScript.
 *
 * Usage:
 *   try {
 *     await someAsyncOperation();
 *   } catch (error) {
 *     const message = getErrorMessage(error);
 *     console.error(message);
 *   }
 */

/**
 * Safely extract an error message from any caught error.
 *
 * Handles:
 * - Error instances (returns error.message)
 * - Strings (returns the string)
 * - Objects with message property (returns obj.message)
 * - Everything else (returns String(error))
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}

/**
 * Type guard to check if an error is an Error instance.
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if an error has a specific code property.
 * Useful for checking HTTP error codes or custom error codes.
 */
export function hasErrorCode(
  error: unknown,
  code: string | number
): error is Error & { code: string | number } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === code
  );
}

/**
 * Create a standardized error for API responses.
 */
export function createApiError(
  message: string,
  status?: number,
  code?: string
): Error & { status?: number; code?: string } {
  const error = new Error(message) as Error & { status?: number; code?: string };
  if (status !== undefined) error.status = status;
  if (code !== undefined) error.code = code;
  return error;
}
