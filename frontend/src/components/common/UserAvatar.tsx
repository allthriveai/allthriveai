/**
 * UserAvatar - Reusable avatar component with fallback
 *
 * Displays user avatar with:
 * - Image if avatarUrl is provided
 * - Initials fallback with gradient background
 * - Multiple size options
 */

interface UserAvatarProps {
  avatarUrl?: string | null;
  username: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function UserAvatar({
  avatarUrl,
  username,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const initials = username.slice(0, 2).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-medium ${className}`}
    >
      {initials}
    </div>
  );
}
