/**
 * EchoAvatar - Echo Creator Coach avatar icon
 * US-018: Echo's avatar/icon for brainstorm chat
 */

interface EchoAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export function EchoAvatar({ size = 'md', className = '' }: EchoAvatarProps) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full
        bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600
        flex items-center justify-center
        shadow-lg shadow-cyan-500/30
        ring-2 ring-cyan-400/30
        ${className}
      `}
      aria-label="Echo"
    >
      {/* Echo icon - stylized "E" or spark */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-1/2 h-1/2 text-white"
      >
        {/* Lightning bolt / spark icon */}
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}
