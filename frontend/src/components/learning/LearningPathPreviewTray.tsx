import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, ArrowRightIcon, ClockIcon, AcademicCapIcon, SignalIcon, PlayCircleIcon, DocumentTextIcon, BookOpenIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/hooks/useTheme';
import type { PublicLearningPath } from '@/services/learningPaths';

// Icon mapping for curriculum item types
const curriculumTypeIcons: Record<string, typeof PlayCircleIcon> = {
  video: PlayCircleIcon,
  article: DocumentTextIcon,
  lesson: BookOpenIcon,
  quiz: PuzzlePieceIcon,
  micro_lesson: BookOpenIcon,
};

// Threshold for dismissing the tray (in pixels)
const DISMISS_THRESHOLD = 100;
// Velocity threshold for dismissing (pixels per ms)
const VELOCITY_THRESHOLD = 0.3;

interface LearningPathPreviewTrayProps {
  isOpen: boolean;
  onClose: () => void;
  learningPath: PublicLearningPath | null;
  feedScrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function LearningPathPreviewTray({ isOpen, onClose, learningPath }: LearningPathPreviewTrayProps) {
  useTheme(); // For theme-aware styling
  const navigate = useNavigate();

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  // Track the visual open state (delayed to allow animation)
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Mobile swipe-to-dismiss state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ y: number; time: number; scrollTop: number } | null>(null);
  const isMobileRef = useRef(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
    } else {
      setVisuallyOpen(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset drag state when closing
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Touch handlers for swipe-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobileRef.current) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
      scrollTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobileRef.current || !touchStartRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current.y;

    // Only start dragging if scrolled to top and swiping down
    if (touchStartRef.current.scrollTop <= 0 && deltaY > 0) {
      setIsDragging(true);
      setDragOffset(Math.max(0, deltaY));
    }
  };

  const handleTouchEnd = () => {
    if (!isMobileRef.current || !touchStartRef.current) return;

    if (isDragging) {
      const velocity = dragOffset / (Date.now() - touchStartRef.current.time);
      if (dragOffset > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        onClose();
      } else {
        setDragOffset(0);
      }
      setIsDragging(false);
    }
    touchStartRef.current = null;
  };

  // Handle "View Full Path" click
  const handleViewFullPath = () => {
    if (learningPath) {
      navigate(`/${learningPath.username}/learn/${learningPath.slug}`);
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!shouldRender || !learningPath) return null;

  const trayContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300 ${
          visuallyOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Tray */}
      <aside
        ref={trayRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${learningPath.title}`}
        className={`fixed z-[9999] bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-out
          md:right-0 md:top-0 md:h-full md:w-[420px] md:max-w-[90vw]
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[85vh] max-md:rounded-t-2xl
          ${visuallyOpen ? 'translate-x-0 max-md:translate-y-0' : 'translate-x-full max-md:translate-x-0 max-md:translate-y-full'}
        `}
        style={{
          transform: isDragging
            ? `translateY(${dragOffset}px)`
            : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Learning Path</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close preview"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: 'calc(100% - 140px)' }}
        >
          {/* Cover image */}
          {learningPath.coverImage && (
            <div className="relative aspect-video bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <img
                src={learningPath.coverImage}
                alt={learningPath.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {learningPath.title}
            </h2>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" />
                <span>{learningPath.estimatedHours}h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <SignalIcon className="w-4 h-4" />
                <span className="capitalize">{learningPath.difficulty}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AcademicCapIcon className="w-4 h-4" />
                <span>{learningPath.curriculumCount} items</span>
              </div>
            </div>

            {/* Curriculum Preview */}
            {learningPath.curriculumPreview && learningPath.curriculumPreview.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Curriculum
                </h3>
                <ul className="space-y-2">
                  {learningPath.curriculumPreview.map((item, index) => {
                    const Icon = curriculumTypeIcons[item.type] || BookOpenIcon;
                    return (
                      <li key={index} className="flex items-start gap-2">
                        <Icon className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
                          {item.title}
                        </span>
                      </li>
                    );
                  })}
                  {learningPath.curriculumCount > learningPath.curriculumPreview.length && (
                    <li className="text-sm text-gray-500 dark:text-gray-400 pl-6">
                      +{learningPath.curriculumCount - learningPath.curriculumPreview.length} more items
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Topics */}
            {learningPath.topicsCovered && learningPath.topicsCovered.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Topics Covered
                </h3>
                <div className="flex flex-wrap gap-2">
                  {learningPath.topicsCovered.map((topic) => (
                    <span
                      key={topic}
                      className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm"
                    >
                      {topic.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleViewFullPath}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            <span>View Full Path</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(trayContent, document.body);
}
