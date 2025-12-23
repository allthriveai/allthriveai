import { api } from './api';

export interface UploadResponse {
  url: string;
  filename: string;
  originalSize: number;
  optimizedSize: number;
  isPublic: boolean;
}

export interface UploadOptions {
  folder?: string;
  isPublic?: boolean;
  signal?: AbortSignal;
}

/**
 * Upload an image file to MinIO storage
 * @param file The file to upload
 * @param folder Optional folder path (default: 'images')
 * @param isPublic Whether the file should be publicly accessible (default: true)
 * @param signal Optional AbortSignal for cancellation
 * @returns Upload response with URL and metadata
 */
export async function uploadImage(
  file: File,
  folder: string = 'images',
  isPublic: boolean = true,
  signal?: AbortSignal
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('is_public', String(isPublic));

  try {
    const response = await api.post<UploadResponse>('/upload/image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });

    return response.data;
  } catch (error: any) {
    // Don't log abort errors as failures
    if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
      throw error;
    }
    console.error('[upload] Image upload failed:', error);
    console.error('[upload] Status:', error?.statusCode);
    console.error('[upload] Error details:', error?.details);
    throw error;
  }
}

export interface FileUploadResponse {
  url: string;
  filename: string;
  fileType: string;
  fileSize: number;
  isPublic: boolean;
  extractedText?: string; // PDF text content for AI processing (e.g., resume parsing)
}

/**
 * Upload any file (video, document, etc.) to MinIO storage
 * @param file The file to upload
 * @param folder Optional folder path (default: 'files')
 * @param isPublic Whether the file should be publicly accessible (default: true)
 * @param signal Optional AbortSignal for cancellation
 * @returns Upload response with URL and file metadata
 */
export async function uploadFile(
  file: File,
  folder: string = 'files',
  isPublic: boolean = true,
  signal?: AbortSignal
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('is_public', String(isPublic));

  const response = await api.post<FileUploadResponse>('/upload/file/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    signal,
  });

  return response.data;
}
