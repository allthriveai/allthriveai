import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '@/services/api';
import type { ApiError } from '@/types/api';

// File signature (magic bytes) mapping for image validation
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG/JFIF
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF (WebP starts with RIFF, then size, then WEBP)
  ],
};

// Check if file bytes match expected signature
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

// Validate file signature (magic bytes)
async function validateFileSignature(file: File, acceptedFormats: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        resolve('Could not read file');
        return;
      }

      const bytes = new Uint8Array(arrayBuffer);

      // Check if file matches any accepted format's signature
      for (const format of acceptedFormats) {
        const signatures = FILE_SIGNATURES[format];
        if (signatures) {
          for (const signature of signatures) {
            if (matchesSignature(bytes, signature)) {
              // Additional check for WebP (must have WEBP after RIFF header)
              if (format === 'image/webp') {
                // WebP format: RIFF <size> WEBP
                const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
                if (bytes.length >= 12 && matchesSignature(bytes.slice(8), webpMarker)) {
                  resolve(null);
                  return;
                }
              } else {
                resolve(null);
                return;
              }
            }
          }
        }
      }

      resolve('File content does not match declared file type. Please upload a valid image file.');
    };

    reader.onerror = () => {
      resolve('Could not read file');
    };

    // Read first 12 bytes (enough for all signatures we check)
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  className?: string;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export function ImageUpload({
  currentImage,
  onImageUploaded,
  onImageRemoved,
  className = '',
  maxSizeMB = 10,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImage prop changes
  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Please upload: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const response = await api.post('/upload/image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { url } = response.data;
      setPreview(url);
      onImageUploaded(url);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMsg = apiError.error || 'Failed to upload image. Please try again.';
      setError(errorMsg);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Basic validation (type and size)
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Validate file signature (magic bytes) to prevent spoofed extensions
    const signatureError = await validateFileSignature(file, acceptedFormats);
    if (signatureError) {
      setError(signatureError);
      return;
    }

    uploadFile(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`${className} flex flex-col items-center`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        aria-label="Upload profile image"
        className="hidden"
      />

      {preview ? (
        <div className="relative inline-block" role="img" aria-label="Profile image preview">
          <img
            src={preview}
            alt="Profile picture preview"
            className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700"
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=U&size=128&background=6366f1&color=fff`;
            }}
          />
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-0 right-0 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors transform translate-x-1/4 -translate-y-1/4"
              aria-label="Remove image"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center" role="status" aria-live="polite">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              <span className="sr-only">Uploading image...</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload image - click or drag and drop"
          aria-disabled={isUploading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          className={`
            relative w-32 h-32 rounded-full border-4 border-dashed
            flex flex-col items-center justify-center cursor-pointer
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            ${isDragging
              ? 'border-primary-500 bg-primary-500/10 scale-105'
              : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 bg-slate-50 dark:bg-slate-800/50'
            }
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" role="status"></div>
              <span className="sr-only">Uploading...</span>
            </>
          ) : (
            <>
              <PhotoIcon className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-1" />
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
                {isDragging ? 'Drop here' : 'Click or drag'}
              </span>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Max {maxSizeMB}MB • {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}
      </p>
    </div>
  );
}
