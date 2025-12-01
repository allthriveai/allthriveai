import { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface YouTubeImportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId?: number | null;
  videoCount?: number;
}

export function YouTubeImportProgressModal({
  isOpen,
  onClose,
  sourceId,
  videoCount = 0,
}: YouTubeImportProgressModalProps) {
  const [importedCount, setImportedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

  useEffect(() => {
    if (!isOpen || !sourceId) {
      setPollingActive(false);
      return;
    }

    setPollingActive(true);
    setImportedCount(0);
    setIsComplete(false);
    setError(null);

    // Poll for import progress
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/integrations/youtube/sources/${sourceId}/`);

        if (response.data?.data?.metadata?.total_videos_imported) {
          const imported = response.data.data.metadata.total_videos_imported;
          setImportedCount(imported);

          // Check if import is complete (imported >= expected or no new imports in 5 seconds)
          if (videoCount > 0 && imported >= videoCount) {
            setIsComplete(true);
            setPollingActive(false);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch import progress:', err);
        // Continue polling even if there's an error
      }
    }, 2000);

    // Auto-complete after 30 seconds of inactivity or if videoCount reached
    const timeoutId = setTimeout(() => {
      setIsComplete(true);
      setPollingActive(false);
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [isOpen, sourceId, videoCount]);

  const progress = videoCount > 0 ? Math.min(100, Math.round((importedCount / videoCount) * 100)) : 0;

  return isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        {error ? (
          // Error state
          <div className="text-center">
            <div className="text-4xl mb-3">❌</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Import Failed
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {error}
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors font-medium"
            >
              Close
            </button>
          </div>
        ) : isComplete ? (
          // Success state
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Import Complete!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Successfully imported <span className="font-semibold text-slate-900 dark:text-slate-100">{importedCount} video{importedCount !== 1 ? 's' : ''}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {videoCount > 0 && importedCount < videoCount
                ? `Note: Import is processing in the background. ${importedCount} of ${videoCount} videos imported.`
                : 'Videos will appear on your profile shortly.'}
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          // Loading state
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin">
                <div className="text-4xl">⏳</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Importing Videos
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {videoCount > 0
                ? `${importedCount} of ${videoCount} videos imported`
                : 'Processing your YouTube channel...'}
            </p>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {progress}% complete
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              This may take a few minutes. You can close this dialog and check your profile later.
            </p>

            <button
              onClick={onClose}
              className="mt-4 w-full px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;
}
