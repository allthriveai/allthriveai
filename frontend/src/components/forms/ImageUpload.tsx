import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '@/services/api';

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
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to upload image. Please try again.';
      setError(errorMsg);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
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
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700"
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=U&size=128&background=6366f1&color=fff`;
            }}
          />
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
              aria-label="Remove image"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
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
          className={`
            relative w-32 h-32 rounded-full border-4 border-dashed
            flex flex-col items-center justify-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-primary-500 bg-primary-500/10 scale-105'
              : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 bg-slate-50 dark:bg-slate-800/50'
            }
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
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
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Max {maxSizeMB}MB • {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}
      </p>
    </div>
  );
}
