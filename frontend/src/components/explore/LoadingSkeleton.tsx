export function ProjectCardSkeleton() {
  // Vary skeleton heights to match masonry natural layout
  const heights = ['h-64', 'h-72', 'h-80', 'h-96'];
  const randomHeight = heights[Math.floor(Math.random() * heights.length)];

  return (
    <div className="break-inside-avoid mb-2">
      <div className={`glass-subtle rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative ${randomHeight}`}>
        {/* Image skeleton with gradient animation */}
        <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer" style={{
          backgroundSize: '200% 200%'
        }} />

        {/* Content skeleton overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5 space-y-3">
          {/* Title */}
          <div className="h-5 bg-white/20 rounded w-3/4" />

          {/* Description */}
          <div className="space-y-2">
            <div className="h-3 bg-white/20 rounded" />
            <div className="h-3 bg-white/20 rounded w-5/6" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full" />
              <div className="h-8 bg-white/20 rounded-full w-16" />
            </div>
            <div className="h-8 bg-white/20 rounded-full w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="glass-subtle rounded-lg p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex-shrink-0" />

        <div className="flex-1 space-y-3">
          {/* Name */}
          <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32" />

          {/* Bio */}
          <div className="space-y-2">
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded" />
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-4/5" />
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-20" />
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  count?: number;
  type: 'project' | 'profile';
}

export function LoadingSkeleton({ count = 6, type }: LoadingSkeletonProps) {
  // Return array directly (not Fragment) so MasonryGrid can distribute items across columns
  if (type === 'profile') {
    return Array.from({ length: count }).map((_, i) => (
      <ProfileCardSkeleton key={`profile-skeleton-${i}`} />
    ));
  }

  return Array.from({ length: count }).map((_, i) => (
    <ProjectCardSkeleton key={`project-skeleton-${i}`} />
  ));
}
