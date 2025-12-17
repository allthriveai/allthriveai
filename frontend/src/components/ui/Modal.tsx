import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Make modal full-screen on mobile (default: false) */
  fullScreenMobile?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  fullScreenMobile = false,
}: ModalProps) {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Save current scroll position
      scrollPositionRef.current = window.scrollY;

      // Lock body scroll - iOS Safari compatible approach
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';

      window.addEventListener('keydown', handleEscape);

      // Cleanup only runs when modal was actually open
      return () => {
        // Restore scroll position and body styles
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        window.scrollTo(0, scrollPositionRef.current);
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      style={{ touchAction: 'none' }}
    >
      <div
        className={`
          relative bg-brand-dark border border-primary-500/20 shadow-2xl
          w-full p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col
          ${fullScreenMobile
            ? 'min-h-[100dvh] sm:min-h-0 sm:max-h-[90vh] sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-none'
            : 'max-w-md mx-4 rounded-2xl max-h-[85dvh]'
          }
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent flex-shrink-0">
            {title}
          </h2>
        )}
        <div
          className="text-gray-300 overflow-y-auto flex-1 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 p-2 -m-2"
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );

  // Use portal to ensure modal is rendered at the top level of the DOM
  return createPortal(modalContent, document.body);
}
