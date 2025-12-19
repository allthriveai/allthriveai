import type { User } from '@/types/models';
import { sanitizeHtml } from '@/utils/sanitize';
import {
  FireIcon,
  TrophyIcon,
  UserGroupIcon,
  StarIcon,
  GlobeAltIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface ProfileSidebarProps {
  user: User | null;
  projectCount: number;
  showcaseCount: number;
}

export function ProfileSidebar({ user, projectCount, showcaseCount }: ProfileSidebarProps) {
  // Use real data from user object
  const stats = {
    points: user?.totalPoints || 0,
    level: user?.level || 1,
    streak: user?.currentStreak || 0,
    connections: 0, // Future: implement connections feature
  };

  return (
    <div className="space-y-6">
      {/* About / Bio - if provided */}
      {user?.bio && (
        <div className="glass-subtle rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            About
          </h3>
          <div
            className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(user.bio) }}
          />
        </div>
      )}
      {/* Stats Card */}
      <div className="glass-subtle rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Stats
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Points */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-3 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <StarIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Points</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white" aria-label={`${stats.points.toLocaleString()} points`}>
              {stats.points.toLocaleString()}
            </p>
          </div>

          {/* Level */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrophyIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Level</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white" aria-label={`Level ${stats.level}`}>{stats.level}</p>
          </div>

          {/* Streak */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg p-3 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <FireIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Streak</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white" aria-label={`${stats.streak} day streak`}>{stats.streak}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">days</p>
          </div>

          {/* Connections */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <UserGroupIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Connections</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white" aria-label={`${stats.connections} connections`}>{stats.connections}</p>
          </div>
        </div>

        {/* Projects Summary */}
        <div className="pt-4 border-t border-white/20 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Projects</span>
            <span className="font-semibold text-gray-900 dark:text-white">{projectCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">⭐ Showcase</span>
            <span className="font-semibold text-gray-900 dark:text-white">{showcaseCount}</span>
          </div>
        </div>
      </div>

      {/* Connect Card */}
      {(user?.websiteUrl || user?.linkedinUrl || user?.twitterUrl || user?.githubUrl ||
        user?.youtubeUrl || user?.instagramUrl || user?.calendarUrl) && (
        <div className="glass-subtle rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Connect
          </h3>

          <div className="space-y-2">
            {user.websiteUrl && (
              <a
                href={user.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors group"
                aria-label="Visit website"
              >
                <GlobeAltIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" aria-hidden="true" />
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  Website
                </span>
              </a>
            )}

            {user.linkedinUrl && (
              <a
                href={user.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors group"
                aria-label="Visit LinkedIn profile"
              >
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  LinkedIn
                </span>
              </a>
            )}

            {user.twitterUrl && (
              <a
                href={user.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group"
                aria-label="Visit Twitter profile"
              >
                <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  Twitter
                </span>
              </a>
            )}

            {user.githubUrl && (
              <a
                href={user.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group"
                aria-label="Visit GitHub profile"
              >
                <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  GitHub
                </span>
              </a>
            )}

            {user.youtubeUrl && (
              <a
                href={user.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group"
                aria-label="Visit YouTube channel"
              >
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-red-700 dark:group-hover:text-red-300">
                  YouTube
                </span>
              </a>
            )}

            {user.instagramUrl && (
              <a
                href={user.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-500/10 dark:hover:to-pink-500/10 transition-colors group"
                aria-label="Visit Instagram profile"
              >
                <svg className="w-5 h-5 text-pink-600 dark:text-pink-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-pink-700 dark:group-hover:text-pink-300">
                  Instagram
                </span>
              </a>
            )}

            {user.calendarUrl && (
              <a
                href={user.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors group"
                aria-label="Book a meeting"
              >
                <CalendarIcon className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-300">
                  Book a Meeting
                </span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Member Since */}
      {user?.createdAt && (
        <div className="glass-subtle rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Member Since
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {new Date(user.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>
      )}
    </div>
  );
}
