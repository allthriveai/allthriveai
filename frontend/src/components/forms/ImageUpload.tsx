import { useState, useRef, useEffect, useMemo } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '@/services/api';
import type { ApiError } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';

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

// Default avatar presets using DiceBear API - generates actual SVG URLs
const AVATAR_PRESETS = [
  { id: 'preset-cyan', seed: 'cyan-default', label: 'Cyan', bgColor: '06b6d4' },
  { id: 'preset-purple', seed: 'purple-default', label: 'Purple', bgColor: 'a855f7' },
  { id: 'preset-pink', seed: 'pink-default', label: 'Pink', bgColor: 'ec4899' },
  { id: 'preset-orange', seed: 'orange-default', label: 'Orange', bgColor: 'f97316' },
  { id: 'preset-green', seed: 'green-default', label: 'Green', bgColor: '22c55e' },
  { id: 'preset-blue', seed: 'blue-default', label: 'Blue', bgColor: '3b82f6' },
];

// Generate preset avatar URL using DiceBear with specific background
function generatePresetUrl(seed: string, bgColor: string): string {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bgColor}`;
}

// Generate a DiceBear avatar URL for a given seed and style
function generateAvatarUrl(seed: string, style: 'initials' | 'shapes' | 'thumbs' = 'initials'): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0891b2,a855f7,ec4899,f97316,22c55e,3b82f6`;
}

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  className?: string;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  showPresets?: boolean;
  username?: string; // Used for generating personalized presets
}

export function ImageUpload({
  currentImage,
  onImageUploaded,
  onImageRemoved,
  className = '',
  maxSizeMB = 50,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  showPresets = false,
  username = '',
}: ImageUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate personalized avatar options based on username (memoized to avoid recalculation)
  const personalizedAvatars = useMemo(() => {
    if (!username) return [];
    return [
      generateAvatarUrl(username, 'initials'),
      generateAvatarUrl(username + '1', 'shapes'),
      generateAvatarUrl(username + '2', 'thumbs'),
    ];
  }, [username]);

  // Pre-generate preset URLs (memoized to avoid recalculation in render loop)
  const presetUrls = useMemo(() => {
    return AVATAR_PRESETS.map(preset => ({
      ...preset,
      url: generatePresetUrl(preset.seed, preset.bgColor),
    }));
  }, []);

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

  const handleSelectPreset = (avatarUrl: string) => {
    setPreview(avatarUrl);
    onImageUploaded(avatarUrl);
    setShowPresetPicker(false);
    setError(null);
  };

  const handleOpenAva = () => {
    // Dispatch event to open Ava chat panel with avatar generation context
    // DashboardLayout catches this and opens ChatSidebar with avatarGenerateContext
    // After a delay, we dispatch open-avatar-creation to trigger the template selector UI
    if (user) {
      // First, open the chat sidebar with avatar context
      window.dispatchEvent(new CustomEvent('openAvatarGenerate', {
        detail: {
          userId: user.id,
          username: user.username,
        }
      }));

      // Then trigger the avatar creation UI flow after chat is mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-avatar-creation', {
          detail: {
            userId: user.id,
            username: user.username,
          }
        }));
      }, 500);
    }
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

      {/* Preset avatars section */}
      {showPresets && (
        <div className="mt-4 w-full">
          <button
            type="button"
            onClick={handleOpenAva}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            Or let Ava create one for you
          </button>

          {showPresetPicker && (
            <div className="mt-3 space-y-3">
              {/* Personalized DiceBear avatars */}
              {personalizedAvatars.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Personalized for you</p>
                  <div className="flex justify-center gap-2">
                    {personalizedAvatars.map((url, index) => (
                      <button
                        key={`personalized-${index}`}
                        type="button"
                        onClick={() => handleSelectPreset(url)}
                        className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        aria-label={`Select personalized avatar ${index + 1}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color presets */}
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Color avatars</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {presetUrls.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700"
                      aria-label={`Select ${preset.label} avatar`}
                    >
                      <img src={preset.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
