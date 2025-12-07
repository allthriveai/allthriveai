// Standard API response
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  error?: string; // Error message for partial failures
}

// API error response
export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
  statusCode: number;
}

// HTTP methods
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

export type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];

// Type guards
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as ApiError).success === false
  );
}

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as ApiResponse<T>).success === true
  );
}
