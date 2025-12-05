/**
 * BattleProjectLayout - Layout for Prompt Battle projects
 *
 * Displays saved battle results with both submissions side by side,
 * scores, criteria breakdown, and feedback.
 */

import { Link } from 'react-router-dom';
import { useProjectContext } from '@/context/ProjectContext';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { BattleResultSection } from '../sections/BattleResultSection';

export function BattleProjectLayout() {
  const {
    project,
    isOwner,
    isLiked,
    heartCount,
    isLiking,
    toggleLike,
    likeRewardId,
    isShareModalOpen,
    openShareModal,
    closeShareModal,
    handleDelete,
    isAuthenticated,
  } = useProjectContext();

  // Get battle result data from project content
  const battleResult = project.content?.battleResult;

  if (!battleResult) {
    // Fallback if no battle data
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Battle data not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-8 pb-4">
          <div className="flex items-center justify-between">
            {/* Author and date */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-xl px-4 py-2 rounded-full border border-slate-700/50 text-slate-300 text-sm">
                <span className="opacity-70">by</span>
                <Link
                  to={`/${project.username}`}
                  className="font-semibold hover:text-cyan-400 transition-colors"
                >
                  @{project.username}
                </Link>
              </div>
              <span className="text-slate-500 text-sm">
                {new Date(project.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Owner actions */}
            {isOwner && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Battle Result Content */}
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pb-16">
          <BattleResultSection content={battleResult} />

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {project.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm rounded-full bg-slate-800/50 text-slate-300 border border-slate-700/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-8 border-t border-slate-800">
            <ProjectActions
              isLiked={isLiked}
              heartCount={heartCount}
              isLiking={isLiking}
              isAuthenticated={isAuthenticated}
              onLikeClick={toggleLike}
              likeRewardId={likeRewardId}
              onShareClick={openShareModal}
              variant="default"
            />
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
        title={project.title}
        username={project.username}
        slug={project.slug}
      />
    </>
  );
}
