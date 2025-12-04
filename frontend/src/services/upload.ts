import { api } from './api';

export interface UploadResponse {
  url: string;
  filename: string;
  original_size: number;
  optimized_size: number;
  is_public: boolean;
}

/**
 * Upload an image file to MinIO storage
 * @param file The file to upload
 * @param folder Optional folder path (default: 'images')
 * @param isPublic Whether the file should be publicly accessible (default: true)
 * @returns Upload response with URL and metadata
 */
export async function uploadImage(
  file: File,
  folder: string = 'images',
  isPublic: boolean = true
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('is_public', String(isPublic));

  console.log('[upload] Uploading image:', file.name, 'to folder:', folder);
  console.log('[upload] File type:', file.type, 'size:', file.size);

  try {
    const response = await api.post<UploadResponse>('/upload/image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('[upload] Image upload successful:', response.data.url);
    return response.data;
  } catch (error: any) {
    console.error('[upload] Image upload failed:', error);
    console.error('[upload] Status:', error?.statusCode);
    console.error('[upload] Error details:', error?.details);
    throw error;
  }
}

export interface FileUploadResponse {
  url: string;
  filename: string;
  file_type: string;
  file_size: number;
  is_public: boolean;
}

/**
 * Upload any file (video, document, etc.) to MinIO storage
 * @param file The file to upload
 * @param folder Optional folder path (default: 'files')
 * @param isPublic Whether the file should be publicly accessible (default: true)
 * @returns Upload response with URL and file metadata
 */
export async function uploadFile(
  file: File,
  folder: string = 'files',
  isPublic: boolean = true
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('is_public', String(isPublic));

  const response = await api.post<FileUploadResponse>('/upload/file/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
