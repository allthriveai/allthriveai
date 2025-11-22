import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SlideUpHero } from './SlideUpHero';
import type { Project } from '@/types/models';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  isAuthenticated: boolean;
  isLiked: boolean;
  heartCount: number;
  onLikeToggle: () => void;
  showComments?: boolean; // Open with comments visible
}

export function ProjectModal({
  isOpen,
  onClose,
  project,
  isAuthenticated,
  isLiked,
  heartCount,
  onLikeToggle,
  showComments = false,
}: ProjectModalProps) {
  const navigate = useNavigate();
  const [showCommentSection, setShowCommentSection] = useState(showComments);

  useEffect(() => {
    setShowCommentSection(showComments);
  }, [showComments]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleToolClick = (toolSlug: string) => {
    navigate(`/tools/${toolSlug}`);
  };

  const handleCommentClick = () => {
    setShowCommentSection(!showCommentSection);
  };

  if (!isOpen) return null;

  // Get hero elements from project content
  const element1 = project.content?.heroSlideUpElement1;
  const element2 = project.content?.heroSlideUpElement2;
  const tools = project.toolsDetails;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl mx-auto my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md border border-white/20"
          aria-label="Close"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Project Header */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
          {project.description && (
            <p className="text-lg text-white/80">{project.description}</p>
          )}
        </div>

        {/* SlideUpHero Component */}
        {element1 && element2 ? (
          <SlideUpHero
            element1={element1}
            element2={element2}
            tools={tools}
            onToolClick={handleToolClick}
            isLiked={isLiked}
            heartCount={heartCount}
            onLikeToggle={onLikeToggle}
            onCommentClick={handleCommentClick}
            isAuthenticated={isAuthenticated}
          />
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 text-center">
            <p className="text-white/60">No slide-up content available for this project.</p>
          </div>
        )}

        {/* Comments Section */}
        {showCommentSection && (
          <div className="mt-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Comments</h3>
            {isAuthenticated ? (
              <div className="space-y-4">
                {/* Comment input */}
                <textarea
                  placeholder="Add a comment..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
                <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                  Post Comment
                </button>
                {/* Comments list placeholder */}
                <div className="pt-4 border-t border-white/20">
                  <p className="text-white/60 text-sm">No comments yet. Be the first to comment!</p>
                </div>
              </div>
            ) : (
              <p className="text-white/60">Please log in to comment.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
