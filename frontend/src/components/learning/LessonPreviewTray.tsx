import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, ArrowRightIcon, ClockIcon, LightBulbIcon, SignalIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/hooks/useTheme';
import type { PublicLesson } from '@/services/learningPaths';

// Threshold for dismissing the tray (in pixels)
const DISMISS_THRESHOLD = 100;
// Velocity threshold for dismissing (pixels per ms)
const VELOCITY_THRESHOLD = 0.3;

interface LessonPreviewTrayProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: PublicLesson | null;
  feedScrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function LessonPreviewTray({ isOpen, onClose, lesson }: LessonPreviewTrayProps) {
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

  // Handle "Start Lesson" click
  const handleStartLesson = () => {
    if (lesson) {
      // Navigate to the learning path page with lesson index
      navigate(`/${lesson.username}/learn/${lesson.pathSlug}?lesson=${lesson.lessonOrder}`);
      onClose();
    }
  };

  // Handle "View Full Path" click
  const handleViewFullPath = () => {
    if (lesson) {
      navigate(`/${lesson.username}/learn/${lesson.pathSlug}`);
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

  // Format lesson type for display
  const formatLessonType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (!shouldRender || !lesson) return null;

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
        aria-label={`Preview of ${lesson.title}`}
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
            <LightBulbIcon className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {formatLessonType(lesson.lessonType)}
            </span>
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
          style={{ maxHeight: 'calc(100% - 180px)' }}
        >
          {/* Cover image */}
          {lesson.imageUrl ? (
            <div className="relative aspect-video bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <img
                src={lesson.imageUrl}
                alt={lesson.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <LightBulbIcon className="w-16 h-16 text-amber-500/50" />
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {lesson.title}
            </h2>

            {/* Summary */}
            {lesson.summary && (
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {lesson.summary}
              </p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" />
                <span>{lesson.estimatedMinutes} min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <SignalIcon className="w-4 h-4" />
                <span className="capitalize">{lesson.difficulty}</span>
              </div>
            </div>

            {/* Parent learning path */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Part of Learning Path
              </h3>
              <button
                onClick={handleViewFullPath}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <AcademicCapIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {lesson.pathTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    by {lesson.userFullName}
                  </p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleStartLesson}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
          >
            <span>Start Lesson</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(trayContent, document.body);
}
