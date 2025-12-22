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
 * @param fileKey - The file key from the Figma URL
 * @param fileType - The type of file (design, slides, site) to help with error handling
 */
export async function getFigmaFilePreview(
  fileKey: string,
  fileType: 'design' | 'slides' | 'site' = 'design'
): Promise<FigmaFilePreview> {
  try {
    const response = await api.get<ApiResponse<FigmaFilePreview>>(
      `/figma/files/${fileKey}/preview/`,
      {
        params: { is_slides: fileType === 'slides' ? 'true' : 'false' },
      }
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
      // Check if this is a Slides file - Figma doesn't support REST API for Slides
      const responseData = error.response?.data;
      if (responseData?.unsupportedFileType === 'slides' || fileType === 'slides') {
        throw new FigmaImportError(
          'Figma Slides files are not yet supported. Please try importing a regular Figma Design file instead.',
          {
            errorCode: 'slides_not_supported',
            suggestion: 'Use a /file/ or /design/ URL instead of /make/',
          }
        );
      }
      throw new FigmaImportError(
        error.response?.data?.error ||
          'Access denied. You may need to reconnect your Figma account.',
        {
          errorCode: 'access_denied',
          suggestion: 'Try disconnecting and reconnecting Figma in Settings.',
        }
      );
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
 * Parsed Figma URL result
 */
export interface ParsedFigmaUrl {
  fileKey: string;
  name?: string;
  fileType: 'design' | 'slides' | 'site';
}

/**
 * Parse a Figma URL to extract the file key and determine file type
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl | null {
  if (!url) return null;

  // Match file/design URLs: https://www.figma.com/file/KEY/name or /design/KEY/name
  const designPattern = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)(?:\/([^/?]+))?/;
  const designMatch = url.match(designPattern);

  if (designMatch) {
    return {
      fileKey: designMatch[1],
      name: designMatch[2] ? decodeURIComponent(designMatch[2].replace(/-/g, ' ')) : undefined,
      fileType: 'design',
    };
  }

  // Match Slides URLs: https://www.figma.com/make/KEY/name
  const slidesPattern = /figma\.com\/make\/([a-zA-Z0-9]+)(?:\/([^/?]+))?/;
  const slidesMatch = url.match(slidesPattern);

  if (slidesMatch) {
    return {
      fileKey: slidesMatch[1],
      name: slidesMatch[2] ? decodeURIComponent(slidesMatch[2].replace(/-/g, ' ')) : undefined,
      fileType: 'slides',
    };
  }

  // Match .figma.site URLs: https://name.figma.site or https://subdomain.figma.site/path
  // The file key is typically the subdomain for published sites
  const sitePattern = /([a-zA-Z0-9-]+)\.figma\.site/;
  const siteMatch = url.match(sitePattern);

  if (siteMatch) {
    return {
      fileKey: siteMatch[1],
      name: siteMatch[1].replace(/-/g, ' '),
      fileType: 'site',
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
