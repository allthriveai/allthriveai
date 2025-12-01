export function ProjectCardSkeleton() {
  return (
    <div className="break-inside-avoid mb-2">
      <div className="glass-subtle rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-pulse">
        {/* Image skeleton */}
        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700" />

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />

          {/* Description */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
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
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />

        <div className="flex-1 space-y-3">
          {/* Name */}
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />

          {/* Bio */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
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
  if (type === 'profile') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <ProfileCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
