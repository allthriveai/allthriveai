import { SparklesIcon, ClockIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import type { Quiz } from './types';

interface QuizPreviewCardProps {
  quiz: Quiz;
  variant?: 'default' | 'compact';
  onOpen?: () => void;
}

const difficultyColors = {
  beginner: {
    bg: 'from-emerald-400/20 to-teal-400/20',
    border: 'border-emerald-400/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/20 border-emerald-500/40',
  },
  intermediate: {
    bg: 'from-amber-400/20 to-orange-400/20',
    border: 'border-amber-400/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/20 border-amber-500/40',
  },
  advanced: {
    bg: 'from-rose-400/20 to-pink-400/20',
    border: 'border-rose-400/30',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/20 border-rose-500/40',
  },
};

export function QuizPreviewCard({ quiz, variant = 'default', onOpen }: QuizPreviewCardProps) {
  const colors = difficultyColors[quiz.difficulty];
  const isCompact = variant === 'compact';

  const handleClick = (e: React.MouseEvent) => {
    if (onOpen) {
      e.preventDefault();
      onOpen();
    }
  };

  const Component = onOpen ? 'button' : 'a';
  const linkProps = onOpen ? {} : { href: `/quizzes/${quiz.slug}` };

  return (
    <Component
      {...linkProps}
      onClick={handleClick}
      className="block group w-full text-left"
    >
      <div className={`relative overflow-hidden rounded transition-all duration-500 hover:scale-[1.02] ${!isCompact && 'hover:-translate-y-2'}`}>
        {/* Glassmorphism Container */}
        <div className={`
          relative glass-card backdrop-blur-xl bg-gradient-to-br ${colors.bg}
          ${isCompact ? 'border' : 'border-2'} ${colors.border}
          shadow-glass-lg hover:shadow-glass-xl
          transition-all duration-500
        `}>
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Shimmer Effect on Hover */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Image Container with Overlay */}
          <div className={`relative ${isCompact ? 'h-32' : 'h-56'} overflow-hidden rounded-t`}>
            {/* Background Image */}
            {quiz.thumbnailUrl ? (
              <img
                src={quiz.thumbnailUrl}
                alt={quiz.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${colors.bg} relative`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <SparklesIcon className={`w-20 h-20 ${colors.text} opacity-40`} />
                </div>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Difficulty Badge - Floating */}
            <div className={`absolute ${isCompact ? 'top-2 right-2' : 'top-4 right-4'}`}>
              <div className={`
                ${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'} rounded-full backdrop-blur-md ${colors.badge}
                border ${colors.border}
                font-semibold ${colors.text}
                shadow-lg
              `}>
                {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
              </div>
            </div>

            {/* Completion Badge if completed */}
            {quiz.userCompleted && !isCompact && (
              <div className="absolute top-4 left-4">
                <div className="px-4 py-2 rounded-full backdrop-blur-md bg-primary-500/30 border border-primary-400/40 font-semibold text-sm text-primary-200 shadow-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                  Completed
                </div>
              </div>
            )}

            {/* Topic Tag - Bottom Left */}
            <div className={`absolute ${isCompact ? 'bottom-2 left-2' : 'bottom-4 left-4'}`}>
              <div className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded backdrop-blur-md bg-white/20 border border-white/30 text-white font-medium shadow-lg`}>
                {quiz.topic}
              </div>
            </div>
          </div>

          {/* Content Section - CTA Focused */}
          <div className={`${isCompact ? 'p-4' : 'p-6'} relative z-10 flex flex-col justify-between min-h-[140px]`}>
            <div>
              {/* Title with Gradient */}
              <h3 className={`
                ${isCompact ? 'text-base mb-2' : 'text-xl mb-2'} font-bold bg-gradient-to-r ${colors.text}
                group-hover:from-primary-600 group-hover:to-accent-600
                dark:group-hover:from-primary-400 dark:group-hover:to-accent-400
                bg-clip-text transition-all duration-500
                line-clamp-2
              `}>
                {quiz.title}
              </h3>

              {/* Hook/Description */}
              <p className={`text-gray-600 dark:text-gray-400 ${isCompact ? 'text-xs mb-3 line-clamp-1' : 'text-sm mb-3 line-clamp-2'} leading-relaxed`}>
                {quiz.description}
              </p>

              {/* Taxonomy Pills - Topics, Tools, Categories */}
              {!isCompact && (quiz.topics?.length > 0 || quiz.tools?.length > 0 || quiz.categories?.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {/* Topic Tags */}
                  {quiz.topics?.slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 text-xs rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      {topic}
                    </span>
                  ))}

                  {/* Tool Pills */}
                  {quiz.tools?.slice(0, 2).map((tool) => (
                    <span
                      key={tool.id}
                      className="px-2 py-0.5 text-xs rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1"
                      title={tool.tagline}
                    >
                      {tool.logoUrl && (
                        <img src={tool.logoUrl} alt="" className="w-3 h-3 object-contain" />
                      )}
                      {tool.name}
                    </span>
                  ))}

                  {/* Category Pills */}
                  {quiz.categories?.slice(0, 2).map((category) => (
                    <span
                      key={category.id}
                      className="px-2 py-0.5 text-xs rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      title={category.description}
                    >
                      {category.name}
                    </span>
                  ))}

                  {/* Show count if more items */}
                  {((quiz.topics?.length || 0) + (quiz.tools?.length || 0) + (quiz.categories?.length || 0)) > 7 && (
                    <span className="px-2 py-0.5 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      +{((quiz.topics?.length || 0) + (quiz.tools?.length || 0) + (quiz.categories?.length || 0)) - 7} more
                    </span>
                  )}
                </div>
              )}

              {/* Stats Row - Compact */}
              <div className={`flex items-center ${isCompact ? 'gap-3 mb-3' : 'gap-4 mb-4'} ${isCompact ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>{quiz.estimatedTime} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <ChartBarIcon className="w-3.5 h-3.5" />
                  <span>{quiz.questionCount} {isCompact ? 'Q' : 'questions'}</span>
                </div>
                {quiz.userBestScore !== null && !isCompact && (
                  <div className={`flex items-center gap-1 ${colors.text} font-semibold`}>
                    <SparklesIcon className="w-3.5 h-3.5" />
                    <span>{quiz.userBestScore}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Call to Action Button - Prominent Glassmorphism CTA */}
            <div className={`
              w-full ${isCompact ? 'px-4 py-2.5 text-sm' : 'px-6 py-4 text-base'} font-bold
              relative overflow-hidden
              backdrop-blur-lg bg-gradient-to-r from-white/80 to-white/60
              dark:from-white/15 dark:to-white/10
              ${isCompact ? 'border' : 'border-2'} border-white/40 dark:border-white/20
              ${colors.text}
              shadow-glass-lg hover:shadow-glass-xl
              transform transition-all duration-300
              hover:scale-[1.03] hover:-translate-y-0.5
              group/button
              rounded
            `}>
              {/* Animated gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300" />

              {/* Button Shimmer */}
              <div className="absolute inset-0 -translate-x-full group-hover/button:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

              <span className="relative z-10 flex items-center justify-center gap-2">
                <SparklesIcon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} group-hover/button:rotate-12 transition-transform`} />
                {quiz.userHasAttempted ? 'Retake Quiz' : 'Take Quiz'}
              </span>
            </div>

            {/* Attempt Counter - if attempted */}
            {quiz.userAttemptCount > 0 && !isCompact && (
              <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                Attempted {quiz.userAttemptCount}×
              </div>
            )}
          </div>

          {/* Decorative Corners */}
          {!isCompact && (
            <>
              <div className={`absolute top-0 left-0 w-20 h-20 ${colors.border} opacity-20 pointer-events-none`}>
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <path d="M0,0 L100,0 L100,20 Q80,20 80,40 L80,100 L60,100 L60,40 Q60,20 40,20 L0,20 Z" fill="currentColor" />
                </svg>
              </div>
              <div className={`absolute bottom-0 right-0 w-20 h-20 ${colors.border} opacity-20 pointer-events-none rotate-180`}>
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <path d="M0,0 L100,0 L100,20 Q80,20 80,40 L80,100 L60,100 L60,40 Q60,20 40,20 L0,20 Z" fill="currentColor" />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* Outer Glow on Hover */}
        <div className={`
          absolute -inset-1 rounded ${colors.bg} opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 -z-10
        `} />
      </div>
    </Component>
  );
}
