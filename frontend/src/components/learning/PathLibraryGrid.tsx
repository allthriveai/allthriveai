/**
 * PathLibraryGrid - Grid display of user's saved learning paths
 *
 * Shows a visual grid of learning paths with cover images, difficulty badges,
 * and quick actions (activate, delete).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faClock,
  faCheck,
  faTrash,
  faSpinner,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSavedPaths, useActivateSavedPath, useDeleteSavedPath } from '@/hooks/useLearningPaths';
import type { SavedLearningPathListItem } from '@/services/learningPaths';

interface PathLibraryGridProps {
  onCreateNew: () => void;
}

// Difficulty badge colors
const difficultyColors: Record<string, string> = {
  beginner: 'from-green-500 to-emerald-600',
  intermediate: 'from-yellow-500 to-amber-600',
  advanced: 'from-red-500 to-rose-600',
};

// Difficulty labels
const difficultyLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

interface PathCardProps {
  path: SavedLearningPathListItem;
  username: string;
  onActivate: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isDeleting: boolean;
}

function PathCard({ path, username, onActivate, onDelete, isActivating, isDeleting }: PathCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      className={`
        relative rounded overflow-hidden
        bg-white dark:bg-slate-800/50 backdrop-blur-sm
        border transition-all duration-200
        ${path.isActive
          ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
        }
      `}
    >
      {/* Clickable Link Area */}
      <Link to={`/${username}/learn/${path.slug}`} className="block">
        {/* Cover Image */}
        <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
          {path.coverImage ? (
            <img
              src={path.coverImage}
              alt={path.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="text-3xl text-emerald-500/50 dark:text-emerald-400/50"
                />
              </div>
            </div>
          )}

          {/* Active Badge */}
          {path.isActive && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold flex items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
              Active
            </div>
          )}

          {/* Difficulty Badge */}
          <div
            className={`
              absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-semibold
              bg-gradient-to-r ${difficultyColors[path.difficulty] || difficultyColors.beginner}
            `}
          >
            {difficultyLabels[path.difficulty] || path.difficulty}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-2">
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-2 truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {path.title}
          </h3>

          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} className="text-xs" />
              {path.estimatedHours}h
            </span>
            <span>
              {path.curriculumCount} items
            </span>
          </div>
        </div>
      </Link>

      {/* Actions - outside the link */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          {!path.isActive && (
            <button
              onClick={onActivate}
              disabled={isActivating}
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {isActivating ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                'Set Active'
              )}
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`
              px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50
              ${showDeleteConfirm
                ? 'bg-red-500/20 border border-red-500/50 text-red-500 dark:text-red-400'
                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10'
              }
            `}
          >
            {isDeleting ? (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            ) : showDeleteConfirm ? (
              'Confirm'
            ) : (
              <FontAwesomeIcon icon={faTrash} />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CreateNewCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        h-full min-h-[280px] rounded border border-dashed
        bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm
        border-slate-300 dark:border-white/20
        hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200
        flex flex-col items-center justify-center gap-4 cursor-pointer group
      "
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors">
        <FontAwesomeIcon
          icon={faPlus}
          className="text-2xl text-emerald-500/60 dark:text-emerald-400/60 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors"
        />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-700 dark:text-white/80 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          Create New Path
        </p>
        <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
          Ask Sage to build one for you
        </p>
      </div>
    </motion.button>
  );
}

export function PathLibraryGrid({ onCreateNew }: PathLibraryGridProps) {
  const { user } = useAuth();
  const { data: paths, isLoading, error } = useSavedPaths();
  const { mutate: activatePath, isPending: isActivating, variables: activatingSlug } = useActivateSavedPath();
  const { mutate: deletePath, isPending: isDeleting, variables: deletingSlug } = useDeleteSavedPath();

  const username = user?.username || '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="text-2xl text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Failed to load your learning paths.</p>
      </div>
    );
  }

  const hasPaths = paths && paths.length > 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Your Learning Paths
        </h1>
        <p className="text-slate-600 dark:text-gray-400">
          {hasPaths
            ? 'Select a path to continue learning, or create a new one with Sage.'
            : 'Get started by creating your first personalized learning path with Sage.'
          }
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {paths?.map(path => (
            <PathCard
              key={path.id}
              path={path}
              username={username}
              onActivate={() => activatePath(path.slug)}
              onDelete={() => deletePath(path.slug)}
              isActivating={isActivating && activatingSlug === path.slug}
              isDeleting={isDeleting && deletingSlug === path.slug}
            />
          ))}
        </AnimatePresence>

        {/* Create New Card - always shown */}
        <CreateNewCard onClick={onCreateNew} />
      </div>
    </div>
  );
}

export default PathLibraryGrid;
