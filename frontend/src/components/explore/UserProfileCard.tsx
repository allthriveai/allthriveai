import { useNavigate } from 'react-router-dom';
import { FolderIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { User } from '@/services/explore';

interface UserProfileCardProps {
  user: User;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <button
      onClick={() => navigate(`/${user.username}`)}
      className="w-full text-left glass-subtle hover:glass-hover rounded-xl p-6 transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
    >
      {/* Avatar and Name */}
      <div className="flex items-start gap-4 mb-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            className="w-16 h-16 rounded-full object-cover border-2 border-primary-200 dark:border-primary-800"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-xl border-2 border-primary-200 dark:border-primary-800">
            {getInitials(user.fullName)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {user.fullName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            @{user.username}
          </p>

          {/* Thrive Circle Badge */}
          {user.tierDisplay && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium">
              <SparklesIcon className="w-3 h-3" />
              <span>{user.tierDisplay} Circle</span>
            </div>
          )}
        </div>
      </div>

      {/* Bio/Tagline */}
      {(user.bio || user.tagline) && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {user.tagline || user.bio}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <FolderIcon className="w-4 h-4" />
          <span className="font-medium text-gray-900 dark:text-white">
            {user.projectCount}
          </span>
          <span className="hidden sm:inline">
            {user.projectCount === 1 ? 'Project' : 'Projects'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <SparklesIcon className="w-4 h-4" />
          <span className="font-medium text-gray-900 dark:text-white">
            {(user.totalPoints ?? 0).toLocaleString()}
          </span>
          <span className="hidden sm:inline">
            {(user.totalPoints ?? 0) === 1 ? 'Point' : 'Points'}
          </span>
        </div>
      </div>
    </button>
  );
}
