/**
 * MediaUploader - Drag and drop media uploader for creators
 *
 * Supports:
 * - Images (JPEG, PNG, GIF, WebP)
 * - Videos (MP4, WebM, MOV)
 * - Documents (PDF, DOCX, XLSX, PPTX)
 *
 * Features:
 * - Drag and drop with visual feedback
 * - Click to upload
 * - Upload progress tracking
 * - Preview for images
 * - Multiple file support
 * - File type validation
 */

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import {
  CloudArrowUpIcon,
  XMarkIcon,
  PhotoIcon,
  FilmIcon,
  DocumentIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { uploadImage, uploadFile } from '@/services/upload';

export type MediaType = 'image' | 'video' | 'document' | 'all';

export interface UploadedMedia {
  id: string;
  url: string;
  filename: string;
  type: 'image' | 'video' | 'document';
  size: number;
  thumbnailUrl?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  result?: UploadedMedia;
  abortController?: AbortController;
}

interface MediaUploaderProps {
  /**
   * Accepted media types
   */
  accept?: MediaType;
  /**
   * Called when files are successfully uploaded
   */
  onUpload: (media: UploadedMedia[]) => void;
  /**
   * Allow multiple file uploads
   */
  multiple?: boolean;
  /**
   * Maximum file size in MB
   */
  maxSizeMB?: number;
  /**
   * Folder path for organizing uploads
   */
  folder?: string;
  /**
   * Whether uploaded files should be publicly accessible
   */
  isPublic?: boolean;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Compact mode (smaller dropzone)
   */
  compact?: boolean;
  /**
   * Show uploaded files gallery
   */
  showGallery?: boolean;
  /**
   * Currently uploaded media (for controlled mode)
   */
  value?: UploadedMedia[];
  /**
   * Called when media is removed from gallery
   */
  onRemove?: (media: UploadedMedia) => void;
}

// File type configurations
const FILE_TYPE_CONFIG = {
  image: {
    accept: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSizeMB: 10,
    label: 'Images',
    icon: PhotoIcon,
  },
  video: {
    accept: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxSizeMB: 100,
    label: 'Videos',
    icon: FilmIcon,
  },
  document: {
    accept: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
    maxSizeMB: 25,
    label: 'Documents',
    icon: DocumentIcon,
  },
};

function getFileTypeFromMime(mimeType: string): 'image' | 'video' | 'document' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType.startsWith('application/') ||
    mimeType.startsWith('text/')
  ) {
    return 'document';
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploader({
  accept = 'all',
  onUpload,
  multiple = false,
  maxSizeMB,
  folder = 'creator-media',
  isPublic = true,
  className = '',
  compact = false,
  showGallery = false,
  value = [],
  onRemove,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build accepted file types
  const acceptedTypes =
    accept === 'all'
      ? [...FILE_TYPE_CONFIG.image.accept, ...FILE_TYPE_CONFIG.video.accept, ...FILE_TYPE_CONFIG.document.accept]
      : FILE_TYPE_CONFIG[accept].accept;

  const acceptedExtensions =
    accept === 'all'
      ? [...FILE_TYPE_CONFIG.image.extensions, ...FILE_TYPE_CONFIG.video.extensions, ...FILE_TYPE_CONFIG.document.extensions]
      : FILE_TYPE_CONFIG[accept].extensions;

  const getMaxSize = (fileType: 'image' | 'video' | 'document'): number => {
    if (maxSizeMB) return maxSizeMB;
    return FILE_TYPE_CONFIG[fileType].maxSizeMB;
  };

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const fileType = getFileTypeFromMime(file.type);
      if (!fileType) {
        return 'Unsupported file type';
      }

      if (accept !== 'all' && fileType !== accept) {
        return `Only ${FILE_TYPE_CONFIG[accept].label.toLowerCase()} are allowed`;
      }

      if (!acceptedTypes.includes(file.type)) {
        return `File type ${file.type} is not supported`;
      }

      // Check file size
      const maxSize = getMaxSize(fileType) * 1024 * 1024;
      if (file.size > maxSize) {
        return `File too large. Maximum size for ${fileType}s: ${getMaxSize(fileType)}MB`;
      }

      return null;
    },
    [accept, acceptedTypes, maxSizeMB]
  );

  const uploadSingleFile = async (
    file: File,
    uploadId: string,
    signal?: AbortSignal
  ): Promise<UploadedMedia | null> => {
    const fileType = getFileTypeFromMime(file.type);
    if (!fileType) return null;

    try {
      let result;
      if (fileType === 'image') {
        result = await uploadImage(file, folder, isPublic, signal);
      } else {
        result = await uploadFile(file, folder, isPublic, signal);
      }

      return {
        id: uploadId,
        url: result.url,
        filename: result.filename,
        type: fileType,
        size: file.size,
        thumbnailUrl: fileType === 'image' ? result.url : undefined,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const filesToUpload = multiple ? fileArray : [fileArray[0]];
      const successfulUploads: UploadedMedia[] = [];

      // Create upload entries with AbortController for each
      const newUploads: UploadingFile[] = filesToUpload.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: 'uploading' as const,
        abortController: new AbortController(),
      }));

      // Validate all files first
      for (const upload of newUploads) {
        const error = validateFile(upload.file);
        if (error) {
          upload.status = 'error';
          upload.error = error;
        }
      }

      setUploadingFiles((prev) => [...prev, ...newUploads]);

      // Upload valid files
      for (const upload of newUploads) {
        if (upload.status === 'error') continue;

        try {
          // Simulate progress (since we can't track actual upload progress with fetch)
          const progressInterval = setInterval(() => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === upload.id && f.progress < 90
                  ? { ...f, progress: f.progress + 10 }
                  : f
              )
            );
          }, 200);

          const result = await uploadSingleFile(
            upload.file,
            upload.id,
            upload.abortController?.signal
          );

          clearInterval(progressInterval);

          if (result) {
            successfulUploads.push(result);
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === upload.id
                  ? { ...f, progress: 100, status: 'success', result }
                  : f
              )
            );
          }
        } catch (error: unknown) {
          // Don't show error for cancelled uploads
          const errorObj = error as { name?: string };
          if (errorObj?.name === 'AbortError' || errorObj?.name === 'CanceledError') {
            setUploadingFiles((prev) => prev.filter((f) => f.id !== upload.id));
            continue;
          }

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === upload.id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : f
            )
          );
        }
      }

      // Notify parent of successful uploads
      if (successfulUploads.length > 0) {
        onUpload(successfulUploads);
      }

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((f) => f.status === 'uploading')
        );
      }, 3000);
    },
    [multiple, validateFile, folder, isPublic, onUpload]
  );

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the dropzone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveMedia = (media: UploadedMedia) => {
    onRemove?.(media);
  };

  const handleCancelUpload = (uploadId: string) => {
    // Find the upload and abort the request
    const upload = uploadingFiles.find((f) => f.id === uploadId);
    if (upload?.abortController) {
      upload.abortController.abort();
    }
    setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
  };

  const getTypeIcon = (type: 'image' | 'video' | 'document') => {
    const Icon = FILE_TYPE_CONFIG[type].icon;
    return <Icon className="w-8 h-8" />;
  };

  return (
    <div className={className}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        multiple={multiple}
        className="hidden"
        aria-label="Upload media files"
      />

      {/* Dropzone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Upload media - click or drag and drop files"
        className={`
          relative border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          ${compact ? 'p-4' : 'p-8'}
          ${
            isDragging
              ? 'border-primary-500 bg-primary-500/10 scale-[1.02]'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-800/50'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <CloudArrowUpIcon
            className={`text-gray-400 dark:text-gray-500 mb-3 ${
              compact ? 'w-8 h-8' : 'w-12 h-12'
            } ${isDragging ? 'text-primary-500 animate-bounce' : ''}`}
          />

          <p
            className={`font-medium text-gray-700 dark:text-gray-300 ${
              compact ? 'text-sm' : 'text-base'
            }`}
          >
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            or <span className="text-primary-500 hover:text-primary-600">browse</span> to upload
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {accept === 'all' ? (
              <>Images, videos, and documents</>
            ) : (
              <>{FILE_TYPE_CONFIG[accept].label}</>
            )}
            {' • '}
            {acceptedExtensions.slice(0, 4).join(', ')}
            {acceptedExtensions.length > 4 && '...'}
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              {/* File type icon */}
              <div className="flex-shrink-0 text-gray-400">
                {getTypeIcon(getFileTypeFromMime(upload.file.type) || 'document')}
              </div>

              {/* File info and progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {upload.file.name}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {formatFileSize(upload.file.size)}
                  </span>
                </div>

                {upload.status === 'uploading' && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}

                {upload.status === 'error' && (
                  <p className="text-xs text-red-500">{upload.error}</p>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex-shrink-0">
                {upload.status === 'uploading' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelUpload(upload.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Cancel upload"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
                {upload.status === 'success' && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Gallery */}
      {showGallery && value.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Uploaded Media ({value.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {value.map((media) => (
              <div
                key={media.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                {media.type === 'image' ? (
                  <img
                    src={media.url}
                    alt={media.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                    {getTypeIcon(media.type)}
                    <span className="text-xs mt-2 truncate w-full text-center">
                      {media.filename}
                    </span>
                  </div>
                )}

                {/* Remove button overlay */}
                {onRemove && (
                  <button
                    onClick={() => handleRemoveMedia(media)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    aria-label={`Remove ${media.filename}`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}

                {/* Type badge */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
                  {media.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
