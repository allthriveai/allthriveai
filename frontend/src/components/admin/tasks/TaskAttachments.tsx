import { useState, useEffect, useRef } from 'react';
import {
  PaperClipIcon,
  PhotoIcon,
  VideoCameraIcon,
  DocumentIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import type { TaskAttachment, TaskAdminUser } from '@/types/tasks';
import adminTasksService from '@/services/adminTasks';
import { uploadImage, uploadFile } from '@/services/upload';
import { formatDistanceToNow } from 'date-fns';

interface TaskAttachmentsProps {
  taskId: number;
  currentUser: TaskAdminUser | null;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Get icon for attachment type
function AttachmentIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'image':
      return <PhotoIcon className={className} />;
    case 'video':
      return <VideoCameraIcon className={className} />;
    default:
      return <DocumentIcon className={className} />;
  }
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load attachments
  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const loadAttachments = async () => {
    try {
      setIsLoading(true);
      const data = await adminTasksService.getAttachments(taskId);
      setAttachments(data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
      setError('Failed to load attachments');
    } finally {
      setIsLoading(false);
    }
  };

  // Process and upload files (shared by input and drag/drop)
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setError(null);
    setIsDragOver(false);

    for (const file of fileArray) {
      try {
        setUploadProgress(`Uploading ${file.name}...`);

        // Determine if it's an image or other file
        const isImage = file.type.startsWith('image/');
        let uploadResult;

        if (isImage) {
          uploadResult = await uploadImage(file, 'task-attachments', true);
        } else {
          uploadResult = await uploadFile(file, 'task-attachments', true);
        }

        // Create the attachment record
        await adminTasksService.createAttachment({
          task: taskId,
          fileUrl: uploadResult.url,
          filename: uploadResult.filename,
          originalFilename: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        setUploadProgress(null);
      } catch (err: any) {
        console.error('Failed to upload file:', err);
        setError(err?.message || `Failed to upload ${file.name}`);
      }
    }

    // Reload attachments
    await loadAttachments();
    setIsUploading(false);
    setUploadProgress(null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file selection from input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  // Handle delete
  const handleDelete = async (attachmentId: number) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await adminTasksService.deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setError('Failed to delete attachment');
    }
  };

  // Render attachment preview
  const renderAttachment = (attachment: TaskAttachment) => {
    const isImage = attachment.attachmentType === 'image';
    const isVideo = attachment.attachmentType === 'video';

    return (
      <div
        key={attachment.id}
        className="group relative flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 transition-colors"
      >
        {/* Preview/Icon */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          {isImage ? (
            <img
              src={attachment.fileUrl}
              alt={attachment.originalFilename}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewUrl(attachment.fileUrl)}
            />
          ) : isVideo ? (
            <video
              src={attachment.fileUrl}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewUrl(attachment.fileUrl)}
            />
          ) : (
            <AttachmentIcon
              type={attachment.attachmentType}
              className="w-8 h-8 text-slate-400"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <a
            href={attachment.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 truncate block"
          >
            {attachment.originalFilename}
          </a>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formatFileSize(attachment.fileSize)}
            {attachment.uploadedByDetail && (
              <> • {attachment.uploadedByDetail.firstName || attachment.uploadedByDetail.email}</>
            )}
            <> • {formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true })}</>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => handleDelete(attachment.id)}
          className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete attachment"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <PaperClipIcon className="w-4 h-4" />
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Add File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-lg text-sm">
          <div className="animate-spin w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full" />
          {uploadProgress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachments list / Drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative transition-colors ${
          isDragOver ? 'ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-slate-900' : ''
        }`}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-cyan-500/10 border-2 border-dashed border-cyan-500 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <ArrowUpTrayIcon className="w-10 h-10 text-cyan-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                Drop files to upload
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full" />
          </div>
        ) : attachments.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isDragOver
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
            }`}
          >
            <PaperClipIcon className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Images, videos, or documents (max 100MB)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map(renderAttachment)}
            {/* Add more drop zone when there are attachments */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center justify-center py-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
              }`}
            >
              <p className="text-xs text-slate-400">
                Drop more files or click to add
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image/Video preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
          {previewUrl.match(/\.(mp4|webm|mov|avi)$/i) ? (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
