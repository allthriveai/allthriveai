/**
 * Idea Card Component
 * US-004: Ideas Tab with list view and quick capture
 */

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faArchive, faPaintBrush, faCalendar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { PlatformBadge } from './PlatformBadge';
import { StatusBadge } from './StatusBadge';
import type { ContentIdea } from '@/types/contentEngine';

interface IdeaCardProps {
  idea: ContentIdea;
  onArchive?: (id: number) => void;
  onCreateClip?: (id: number) => void;
  onSchedule?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export function IdeaCard({ idea, onArchive, onCreateClip, onSchedule, onDelete }: IdeaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleMenuAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="glass-card p-4 rounded-xl hover:shadow-lg transition-shadow relative group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-white truncate">{idea.title}</h3>

          {/* Description */}
          {idea.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{idea.description}</p>
          )}

          {/* Platform badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {idea.platforms.map((platform) => (
              <PlatformBadge key={platform} platform={platform} />
            ))}
          </div>

          {/* Status */}
          <div className="mt-2">
            <StatusBadge status={idea.status} />
          </div>
        </div>

        {/* Menu button */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            aria-label="Idea actions"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 glass-panel rounded-lg shadow-xl border border-slate-700/50 py-1 z-10">
              {onCreateClip && (
                <button
                  onClick={() => handleMenuAction(() => onCreateClip(idea.id))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faPaintBrush} className="w-4 text-cyan-400" />
                  Create Clip
                </button>
              )}
              {onSchedule && (
                <button
                  onClick={() => handleMenuAction(() => onSchedule(idea.id))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faCalendar} className="w-4 text-green-400" />
                  Schedule
                </button>
              )}
              {onArchive && idea.status !== 'archived' && (
                <button
                  onClick={() => handleMenuAction(() => onArchive(idea.id))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faArchive} className="w-4 text-amber-400" />
                  Archive
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => handleMenuAction(() => onDelete(idea.id))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
