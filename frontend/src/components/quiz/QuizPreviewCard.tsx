import { SparklesIcon, ClockIcon, ChartBarIcon, PlayIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { getCategoryColorClasses } from '@/utils/categoryColors';
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
    glow: 'group-hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]',
    ctaBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  intermediate: {
    bg: 'from-amber-400/20 to-orange-400/20',
    border: 'border-amber-400/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/20 border-amber-500/40',
    glow: 'group-hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]',
    ctaBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  advanced: {
    bg: 'from-rose-400/20 to-pink-400/20',
    border: 'border-rose-400/30',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/20 border-rose-500/40',
    glow: 'group-hover:shadow-[0_0_40px_rgba(244,63,94,0.4)]',
    ctaBg: 'bg-gradient-to-r from-rose-500 to-pink-500',
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
  const CtaComponent = onOpen ? 'div' : 'button'; // Use div when wrapper is already a button
  const ctaExtraProps = onOpen ? {} : { type: 'button' as const }; // Only add type when it's actually a button

  // Use category color if available, otherwise use difficulty color
  const categoryColor = quiz.categories?.[0]?.color;
  const categoryColorClasses = categoryColor ? getCategoryColorClasses(categoryColor, false) : null;

  return (
    <Component
      {...linkProps}
      onClick={handleClick}
      className="block group w-full text-left"
    >
      <div className={`relative overflow-hidden rounded transition-all duration-500 hover:scale-[1.03] ${!isCompact && 'hover:-translate-y-2'} ${colors.glow}`}>
        {/* Glassmorphism Container */}
        <div className={`
          relative glass-card backdrop-blur-xl bg-gradient-to-br ${colors.bg}
          ${isCompact ? 'border-2' : 'border-2'} ${colors.border}
          shadow-glass-lg hover:shadow-glass-xl
          transition-all duration-500
          overflow-hidden
        `}>
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Shimmer Effect on Hover */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Pulsing Glow Ring on Hover */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-primary-500 to-pink-500 rounded opacity-0 group-hover:opacity-20 group-hover:animate-pulse blur-sm -z-10" />

          {/* Image Container with Overlay - Taller for vertical mobile design */}
          <div className={`relative ${isCompact ? 'h-48' : 'h-64'} overflow-hidden rounded-t`}>
            {/* Background Image or Gradient */}
            {quiz.thumbnailUrl ? (
              <img
                src={quiz.thumbnailUrl}
                alt={quiz.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${categoryColorClasses?.gradientFrom || 'from-cyan-500'} ${categoryColorClasses?.gradientTo || 'to-pink-500'} relative overflow-hidden`}>
                {/* Animated gradient orbs */}
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <SparklesIcon className="w-24 h-24 text-white opacity-90 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500" />
                    <div className="absolute inset-0 animate-ping">
                      <SparklesIcon className="w-24 h-24 text-white opacity-20" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient Overlay - Stronger for better text visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

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
          <div className="relative z-10 flex flex-col justify-between min-h-[120px]">
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
              <p className={`text-gray-600 dark:text-gray-400 ${isCompact ? 'text-xs mb-2 line-clamp-1' : 'text-sm mb-2 line-clamp-2'} leading-relaxed`}>
                {quiz.description}
              </p>

              {/* Taxonomy Pills - Topics, Tools */}
              {!isCompact && (quiz.topics?.length > 0 || quiz.tools?.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
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

                  {/* Show count if more items */}
                  {((quiz.topics?.length || 0) + (quiz.tools?.length || 0)) > 5 && (
                    <span className="px-2 py-0.5 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      +{((quiz.topics?.length || 0) + (quiz.tools?.length || 0)) - 5} more
                    </span>
                  )}
                </div>
              )}

              {/* Stats Row - Compact */}
              <div className={`flex items-center ${isCompact ? 'gap-2 mb-2' : 'gap-3 mb-3'} ${isCompact ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
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

            {/* Call to Action Button - BOLD & IRRESISTIBLE */}
            <div className="relative">
              {/* Pulsing Glow Behind Button */}
              <div className={`absolute -inset-1 ${colors.ctaBg} opacity-50 blur-lg group-hover/button:opacity-75 animate-pulse -z-10`} />

              <CtaComponent
                {...ctaExtraProps}
                className={`
                  w-full ${isCompact ? 'px-4 py-2.5 text-sm' : 'px-6 py-3 text-base'} font-bold uppercase tracking-wide
                  relative overflow-hidden
                  ${colors.ctaBg}
                  text-white
                  shadow-[0_8px_30px_rgba(0,0,0,0.3)]
                  hover:shadow-[0_12px_50px_rgba(0,0,0,0.4)]
                  transform transition-all duration-300
                  hover:scale-[1.05] hover:-translate-y-1
                  group/button
                  rounded
                  border-2 border-white/20
                `}
              >
                {/* Animated gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300" />

                {/* Button Shimmer - Constant Animation */}
                <div className="absolute inset-0 -translate-x-full group-hover/button:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                {/* Sparkle Particles on Hover */}
                <div className="absolute inset-0 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" />
                  <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                  <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                </div>

                <span className="relative z-10 flex items-center justify-center gap-2">
                  <PlayIcon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} group-hover/button:scale-110 transition-transform`} />
                  <span className="drop-shadow-lg">
                    {quiz.userHasAttempted ? 'Retake Quiz' : 'Start Quiz'}
                  </span>
                  {quiz.userBestScore && quiz.userBestScore === 100 && (
                    <TrophyIcon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-yellow-300 animate-bounce`} />
                  )}
                </span>
              </CtaComponent>

              {/* Attempt Counter & Score - if attempted */}
              {quiz.userAttemptCount > 0 && !isCompact && (
                <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {quiz.userAttemptCount} {quiz.userAttemptCount === 1 ? 'attempt' : 'attempts'}
                  </span>
                  {quiz.userBestScore !== null && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className={`font-bold ${colors.text} flex items-center gap-1`}>
                        <TrophyIcon className="w-3.5 h-3.5" />
                        Best: {quiz.userBestScore}%
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Outer Glow on Hover */}
        <div className={`
          absolute -inset-1 rounded ${colors.bg} opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 -z-10
        `} />
      </div>
    </Component>
  );
}
