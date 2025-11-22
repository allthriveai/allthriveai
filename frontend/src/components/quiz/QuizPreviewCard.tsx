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
      <div className={`relative overflow-hidden ${isCompact ? 'rounded-xl' : 'rounded-2xl'} transition-all duration-500 hover:scale-[1.02] ${!isCompact && 'hover:-translate-y-2'}`}>
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
          <div className={`relative ${isCompact ? 'h-32' : 'h-56'} overflow-hidden ${isCompact ? 'rounded-t-lg' : 'rounded-t-xl'}`}>
            {/* Background Image */}
            {quiz.thumbnail_url ? (
              <img
                src={quiz.thumbnail_url}
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
            {quiz.user_completed && !isCompact && (
              <div className="absolute top-4 left-4">
                <div className="px-4 py-2 rounded-full backdrop-blur-md bg-primary-500/30 border border-primary-400/40 font-semibold text-sm text-primary-200 shadow-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                  Completed
                </div>
              </div>
            )}

            {/* Topic Tag - Bottom Left */}
            <div className={`absolute ${isCompact ? 'bottom-2 left-2' : 'bottom-4 left-4'}`}>
              <div className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg backdrop-blur-md bg-white/20 border border-white/30 text-white font-medium shadow-lg`}>
                {quiz.topic}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className={`${isCompact ? 'p-3' : 'p-6'} relative z-10`}>
            {/* Title with Gradient */}
            <h3 className={`
              ${isCompact ? 'text-base mb-1.5' : 'text-2xl mb-3'} font-bold bg-gradient-to-r ${colors.text}
              group-hover:from-primary-600 group-hover:to-accent-600
              dark:group-hover:from-primary-400 dark:group-hover:to-accent-400
              bg-clip-text transition-all duration-500
            `}>
              {quiz.title}
            </h3>

            {/* Hook/Description */}
            <p className={`text-gray-700 dark:text-gray-300 ${isCompact ? 'text-xs mb-2 line-clamp-1' : 'text-base mb-4 line-clamp-2'} leading-relaxed`}>
              {quiz.description}
            </p>

            {/* Stats Row */}
            <div className={`flex items-center ${isCompact ? 'gap-2 mb-2' : 'gap-4 mb-5'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <ClockIcon className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
                <span>{quiz.estimated_time} min</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <ChartBarIcon className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
                <span>{quiz.question_count} {isCompact ? 'Q' : 'questions'}</span>
              </div>
              {quiz.user_best_score !== null && !isCompact && (
                <div className={`flex items-center gap-1.5 ${colors.text} font-semibold`}>
                  <SparklesIcon className="w-4 h-4" />
                  <span>{quiz.user_best_score}%</span>
                </div>
              )}
            </div>

            {/* Call to Action Button - Glassmorphism */}
            <div className={`
              w-full ${isCompact ? 'px-3 py-2 text-xs rounded-lg' : 'px-6 py-3.5 text-base rounded-xl'} font-bold
              relative overflow-hidden
              backdrop-blur-md bg-gradient-to-r ${colors.bg}
              ${isCompact ? 'border' : 'border-2'} ${colors.border}
              ${colors.text}
              shadow-lg hover:shadow-xl
              transform transition-all duration-300
              hover:scale-[1.02]
              group/button
            `}>
              {/* Button Shimmer */}
              <div className="absolute inset-0 -translate-x-full group-hover/button:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <span className="relative z-10 flex items-center justify-center gap-2">
                <SparklesIcon className={`${isCompact ? 'w-3 h-3' : 'w-5 h-5'} group-hover/button:rotate-12 transition-transform`} />
                {quiz.user_has_attempted ? 'Retake' : 'Take Quiz'}
              </span>
            </div>

            {/* Attempt Counter - if attempted */}
            {quiz.user_attempt_count > 0 && !isCompact && (
              <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                Attempted {quiz.user_attempt_count} {quiz.user_attempt_count === 1 ? 'time' : 'times'}
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
          absolute -inset-1 rounded-2xl ${colors.bg} opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 -z-10
        `} />
      </div>
    </Component>
  );
}
