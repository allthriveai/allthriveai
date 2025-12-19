import { api } from './api';
import type { ApiResponse } from '@/types/api';
import { logError } from '@/utils/errorHandler';

/**
 * Enhanced error with additional context for imports
 */
export class FigmaImportError extends Error {
  errorCode?: string;
  suggestion?: string;

  constructor(message: string, options?: { errorCode?: string; suggestion?: string }) {
    super(message);
    this.name = 'FigmaImportError';
    this.errorCode = options?.errorCode;
    this.suggestion = options?.suggestion;
  }
}

/**
 * Figma user info
 */
export interface FigmaUser {
  id: string;
  email: string;
  handle: string;
  imgUrl: string;
}

/**
 * Figma file preview
 */
export interface FigmaFilePreview {
  name: string;
  thumbnailUrl: string;
  lastModified: string;
  version: string;
  editorType: 'figma' | 'figjam' | 'slides';
  pageCount: number;
  pages: Array<{ id: string; name: string }>;
}

/**
 * Check if Figma is connected for the current user
 */
export async function checkFigmaConnection(): Promise<boolean> {
  try {
    const response = await api.get<ApiResponse<{ connected: boolean }>>('/social/status/figma/');
    const data = response.data.data || response.data;
    return data?.connected ?? false;
  } catch (error) {
    logError('figma.checkFigmaConnection', error);
    return false;
  }
}

/**
 * Get current Figma user info
 */
export async function getFigmaUserInfo(): Promise<FigmaUser | null> {
  try {
    const response = await api.get<ApiResponse<{ user: FigmaUser }>>('/figma/files/');

    if (!response.data.success) {
      return null;
    }

    return response.data.data?.user || null;
  } catch (error: any) {
    logError('figma.getFigmaUserInfo', error);

    if (error.response?.status === 401) {
      throw new Error('Please connect your Figma account first.');
    }

    throw new Error(error.response?.data?.error || 'Failed to fetch Figma user info');
  }
}

/**
 * Get preview info for a specific Figma file
 */
export async function getFigmaFilePreview(fileKey: string): Promise<FigmaFilePreview> {
  try {
    const response = await api.get<ApiResponse<FigmaFilePreview>>(
      `/figma/files/${fileKey}/preview/`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get file preview');
    }

    return response.data.data!;
  } catch (error: any) {
    logError('figma.getFigmaFilePreview', error);

    if (error.response?.status === 401) {
      throw new FigmaImportError('Please connect your Figma account first.', {
        errorCode: 'auth_required',
      });
    }

    if (error.response?.status === 404) {
      throw new FigmaImportError('File not found. Make sure you have access to this file.', {
        errorCode: 'not_found',
      });
    }

    if (error.response?.status === 403) {
      throw new FigmaImportError('You do not have access to this file.', {
        errorCode: 'access_denied',
      });
    }

    if (error.response?.status === 429) {
      throw new FigmaImportError('Figma API rate limit exceeded. Please try again later.', {
        errorCode: 'rate_limit',
      });
    }

    throw new Error(error.response?.data?.error || 'Failed to get file preview');
  }
}

/**
 * Parse a Figma URL to extract the file key
 */
export function parseFigmaUrl(url: string): { fileKey: string; name?: string } | null {
  if (!url) return null;

  // Match file/design URLs: https://www.figma.com/file/KEY/name or https://www.figma.com/design/KEY/name
  const filePattern = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)(?:\/([^/?]+))?/;
  const match = url.match(filePattern);

  if (match) {
    return {
      fileKey: match[1],
      name: match[2] ? decodeURIComponent(match[2].replace(/-/g, ' ')) : undefined,
    };
  }

  return null;
}

/**
 * Check if a URL is a valid Figma URL
 */
export function isFigmaUrl(url: string): boolean {
  return parseFigmaUrl(url) !== null;
}
