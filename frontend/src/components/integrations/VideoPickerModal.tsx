import { Fragment, useEffect, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { api } from '@/services/api';
import { getYouTubeErrorMessage, type UserFriendlyError } from '@/utils/errorMessages';

console.log('[VideoPickerModal] MODULE LOADED - File imported successfully');

interface VideoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (videoIds: string[]) => Promise<void>;
  selectedVideoIds: Set<string>;
  onSelectionChange: (videoIds: Set<string>) => void;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  alreadyImported: boolean;
}

const VIDEOS_PER_PAGE = 16; // 4x4 grid

export function VideoPickerModal({
  isOpen,
  onClose,
  onImport,
  selectedVideoIds,
  onSelectionChange,
}: VideoPickerModalProps) {
  console.log('[VideoPickerModal] Rendering, isOpen:', isOpen, 'selectedCount:', selectedVideoIds.size);

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Fetch videos when modal opens
  useEffect(() => {
    console.log('[VideoPickerModal] useEffect triggered, isOpen:', isOpen);
    let isMounted = true;
    const controller = new AbortController();

    const fetchVideos = async () => {
      if (!isOpen) {
        console.log('[VideoPickerModal] Modal not open, skipping fetch');
        return; // Don't fetch if modal isn't open
      }

      console.log('[VideoPickerModal] Starting video fetch...');
      setLoading(true);
      setError(null);

      try {
        console.log('[VideoPickerModal] Calling API /integrations/youtube/my-videos/');
        const response = await api.get('/integrations/youtube/my-videos/', {
          params: { max_results: 50 },
          signal: controller.signal,
        });
        console.log('[VideoPickerModal] API response:', response.data);

        if (isMounted && response.data?.success) {
          console.log('[VideoPickerModal] Setting videos, count:', response.data.videos?.length || 0);
          setVideos(response.data.videos || []);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('[VideoPickerModal] Failed to fetch videos:', error);
          console.error('[VideoPickerModal] Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
          // Translate error to user-friendly message
          const friendlyError = getYouTubeErrorMessage(error);
          setError(friendlyError);
        } else if (error.name === 'AbortError') {
          console.log('[VideoPickerModal] Fetch aborted');
        }
      } finally {
        if (isMounted) {
          console.log('[VideoPickerModal] Fetch complete, setting loading to false');
          setLoading(false);
        }
      }
    };

    fetchVideos();

    return () => {
      console.log('[VideoPickerModal] useEffect cleanup, aborting fetch');
      isMounted = false;
      controller.abort();
    };
  }, [isOpen]);

  // Pagination logic
  const totalPages = Math.ceil(videos.length / VIDEOS_PER_PAGE);
  const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const currentVideos = videos.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    console.log('[VideoPickerModal] Page change to:', page);
    setCurrentPage(page);
    // Scroll to top of video grid
    gridRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleVideo = (videoId: string, alreadyImported: boolean) => {
    console.log('[VideoPickerModal] Toggle video:', videoId, 'alreadyImported:', alreadyImported);
    if (alreadyImported) {
      console.log('[VideoPickerModal] Cannot select already imported video');
      return; // Can't select already imported videos
    }

    const newSelection = new Set(selectedVideoIds);
    if (newSelection.has(videoId)) {
      console.log('[VideoPickerModal] Removing video from selection');
      newSelection.delete(videoId);
    } else {
      console.log('[VideoPickerModal] Adding video to selection');
      newSelection.add(videoId);
    }
    console.log('[VideoPickerModal] New selection count:', newSelection.size);
    onSelectionChange(newSelection);
  };

  const handleImport = async () => {
    console.log('[VideoPickerModal] Import clicked, selected count:', selectedVideoIds.size);
    if (selectedVideoIds.size === 0) {
      console.log('[VideoPickerModal] No videos selected, skipping import');
      return;
    }

    console.log('[VideoPickerModal] Starting import process...');
    setImporting(true);
    try {
      await onImport(Array.from(selectedVideoIds));
      console.log('[VideoPickerModal] Import successful, closing modal');
      onClose(); // Close modal on success
    } catch (error) {
      // Error is handled by parent, modal stays open
      console.error('[VideoPickerModal] Import error:', error);
    } finally {
      console.log('[VideoPickerModal] Import process complete, setting importing to false');
      setImporting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl transform transition-all">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Select Videos to Import
                  </Dialog.Title>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedVideoIds.size} video{selectedVideoIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  {loading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="bg-slate-200 dark:bg-slate-700 aspect-video rounded-t-lg" />
                          <div className="p-2 space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="text-center py-12">
                      <div className="max-w-md mx-auto">
                        {/* Error Icon */}
                        <div className="mb-4">
                          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
                            error.variant === 'error' ? 'bg-red-100 dark:bg-red-900/20' :
                            error.variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                            'bg-blue-100 dark:bg-blue-900/20'
                          }`}>
                            <span className="text-3xl">
                              {error.variant === 'error' ? '⚠️' :
                               error.variant === 'warning' ? '⏸️' :
                               'ℹ️'}
                            </span>
                          </div>
                        </div>

                        {/* Error Title */}
                        <h3 className={`text-lg font-semibold mb-2 ${
                          error.variant === 'error' ? 'text-red-700 dark:text-red-400' :
                          error.variant === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                          'text-blue-700 dark:text-blue-400'
                        }`}>
                          {error.title}
                        </h3>

                        {/* Error Message */}
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                          {error.message}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                          {error.actionText && error.actionHref && (
                            <a
                              href={error.actionHref}
                              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                            >
                              {error.actionText}
                            </a>
                          )}
                          <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!loading && !error && videos.length === 0 && (
                    <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                      No videos found
                    </div>
                  )}

                  {!loading && !error && videos.length > 0 && (
                    <>
                      {/* Video Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" ref={gridRef}>
                        {currentVideos.map((video) => (
                          <div
                            key={video.id}
                            onClick={() => handleToggleVideo(video.id, video.alreadyImported)}
                            className={`
                              relative cursor-pointer rounded-lg border-2 transition-all
                              ${
                                video.alreadyImported
                                  ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-slate-600'
                                  : selectedVideoIds.has(video.id)
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'
                              }
                            `}
                          >
                            {/* Checkbox overlay */}
                            {!video.alreadyImported && (
                              <div className="absolute top-2 left-2 z-10">
                                <div
                                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                                    selectedVideoIds.has(video.id)
                                      ? 'bg-primary-500 border-primary-500'
                                      : 'bg-white border-slate-300'
                                  }`}
                                >
                                  {selectedVideoIds.has(video.id) && (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Already imported badge */}
                            {video.alreadyImported && (
                              <div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium rounded bg-green-500/90 text-white">
                                Imported
                              </div>
                            )}

                            {/* Thumbnail */}
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full aspect-video object-cover rounded-t-lg"
                            />

                            {/* Info */}
                            <div className="p-2">
                              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                                {video.title}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {video.viewCount?.toLocaleString()} views
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-6">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Previous
                          </button>

                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Page {currentPage} of {totalPages}
                          </span>

                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer - Actions */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedVideoIds.size === 0 || importing}
                    className="px-6 py-2 text-sm font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? 'Importing...' : `Import ${selectedVideoIds.size} Video${selectedVideoIds.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
