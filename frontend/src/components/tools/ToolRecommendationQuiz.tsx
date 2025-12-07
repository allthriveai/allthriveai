import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  StarIcon,
  CheckBadgeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  PencilIcon,
  CodeBracketIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  GiftIcon,
  CreditCardIcon,
  CalendarIcon,
  ArrowPathIcon,
  FireIcon,
  HandThumbUpIcon,
  AdjustmentsHorizontalIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  CloudArrowDownIcon,
  LockOpenIcon,
  BuildingOfficeIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/solid';
import {
  getRecommendationQuizQuestions,
  submitRecommendationQuiz,
  type QuizData,
  type QuizAnswers,
  type ToolRecommendation,
} from '@/services/toolRecommendation';

// Icon mapping
const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  pencil: PencilIcon,
  code: CodeBracketIcon,
  photo: PhotoIcon,
  video: VideoCameraIcon,
  'musical-note': MusicalNoteIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  bolt: BoltIcon,
  'chat-bubble': ChatBubbleLeftRightIcon,
  'academic-cap': AcademicCapIcon,
  'chart-bar': ChartBarIcon,
  'rocket-launch': RocketLaunchIcon,
  gift: GiftIcon,
  sparkles: SparklesIcon,
  'credit-card': CreditCardIcon,
  calendar: CalendarIcon,
  'arrow-path': ArrowPathIcon,
  fire: FireIcon,
  'hand-thumb-up': HandThumbUpIcon,
  star: StarIcon,
  'adjustments-horizontal': AdjustmentsHorizontalIcon,
  'code-bracket': CodeBracketIcon,
  'puzzle-piece': PuzzlePieceIcon,
  'shield-check': ShieldCheckIcon,
  'user-group': UserGroupIcon,
  'device-phone-mobile': DevicePhoneMobileIcon,
  'globe-alt': GlobeAltIcon,
  'cloud-arrow-down': CloudArrowDownIcon,
  'lock-open': LockOpenIcon,
  'building-office': BuildingOfficeIcon,
  'minus-circle': MinusCircleIcon,
};

interface ToolRecommendationQuizProps {
  onComplete?: (recommendations: ToolRecommendation[]) => void;
  onClose?: () => void;
  embedded?: boolean;
}

export function ToolRecommendationQuiz({
  onComplete,
  onClose,
  embedded = false,
}: ToolRecommendationQuizProps) {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ToolRecommendation[] | null>(null);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        setIsLoading(true);
        const data = await getRecommendationQuizQuestions();
        setQuizData(data);
      } catch (err) {
        console.error('Failed to fetch quiz questions:', err);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  const currentQuestion = quizData?.questions[currentStep];
  const isLastQuestion = currentStep === (quizData?.questions.length ?? 0) - 1;
  const progress = quizData ? ((currentStep + 1) / quizData.questions.length) * 100 : 0;

  const handleSelectOption = (value: string) => {
    if (!currentQuestion) return;

    if (currentQuestion.type === 'multi_choice') {
      const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
      const maxSelections = currentQuestion.maxSelections || 3;

      if (currentAnswers.includes(value)) {
        // Deselect
        setAnswers({
          ...answers,
          [currentQuestion.id]: currentAnswers.filter((v) => v !== value),
        });
      } else if (currentAnswers.length < maxSelections) {
        // Select if under max
        setAnswers({
          ...answers,
          [currentQuestion.id]: [...currentAnswers, value],
        });
      }
    } else {
      // Single choice - select and auto-advance after a short delay
      setAnswers({
        ...answers,
        [currentQuestion.id]: value,
      });

      // Auto-advance for single choice after a brief moment
      if (!isLastQuestion) {
        setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
        }, 300);
      }
    }
  };

  const isOptionSelected = (value: string): boolean => {
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.id];
    if (Array.isArray(answer)) {
      return answer.includes(value);
    }
    return answer === value;
  };

  const canProceed = (): boolean => {
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.id];
    if (currentQuestion.type === 'multi_choice') {
      return Array.isArray(answer) && answer.length > 0;
    }
    return !!answer;
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      // Submit the quiz
      try {
        setIsSubmitting(true);
        const result = await submitRecommendationQuiz(answers);
        setRecommendations(result.recommendations);
        onComplete?.(result.recommendations);
      } catch (err) {
        console.error('Failed to submit quiz:', err);
        setError('Failed to get recommendations. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentStep(0);
    setRecommendations(null);
    setError(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-primary-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quiz...</p>
      </div>
    );
  }

  // Error state
  if (error && !recommendations) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <p className="text-red-700 dark:text-red-300 text-xl mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Results state
  if (recommendations) {
    return (
      <div className={`${embedded ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        <div className="glass-strong rounded-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium mb-4">
              <CheckIcon className="w-4 h-4" />
              Quiz Complete
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Your Recommended Tools</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Based on your answers, here are the AI tools we think you'll love.
            </p>
          </div>

          {/* Recommendations */}
          <div className="space-y-4 mb-8">
            {recommendations.map((rec, index) => (
              <motion.div
                key={rec.tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {rec.tool.logoUrl ? (
                      <img
                        src={rec.tool.logoUrl}
                        alt={rec.tool.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <SparklesIcon className="w-8 h-8 text-primary-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{rec.tool.name}</h3>
                      {rec.tool.isVerified && (
                        <CheckBadgeIcon className="w-5 h-5 text-primary-500" />
                      )}
                      {rec.tool.isFeatured && (
                        <StarIcon className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-base text-gray-600 dark:text-gray-400 mb-3">{rec.tool.tagline}</p>

                    {/* Match reasons */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {rec.matchReasons.map((reason, i) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 font-medium"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    {/* Pricing & Category */}
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <span>{rec.tool.categoryDisplay}</span>
                      <span>•</span>
                      <span>{rec.tool.pricingDisplay}</span>
                      {rec.tool.hasFreeTier && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">Free tier available</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Match Score & Action */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-center px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {rec.matchScore}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">match</div>
                    </div>
                    <Link
                      to={`/tools/${rec.tool.slug}`}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                    >
                      View Tool
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRestart}
              className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Take Quiz Again
            </button>
            <Link
              to="/tools"
              className="px-8 py-3 text-sm font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            >
              Browse All Tools
            </Link>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Quiz state
  return (
    <div className={`${embedded ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'} relative`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-10"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      )}

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>
            Question {currentStep + 1} of {quizData?.questions.length}
          </span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="glass-strong rounded-xl p-8 mb-6"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{currentQuestion.question}</h3>

            {currentQuestion.type === 'multi_choice' && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Select up to {currentQuestion.maxSelections || 3} options
              </p>
            )}

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const Icon = iconMap[option.icon] || SparklesIcon;
                const isSelected = isOptionSelected(option.value);

                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelectOption(option.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/40'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <span className={`flex-1 font-medium ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <CheckIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            currentStep === 0
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>

        {/* Only show Next button for multi-choice or last question */}
        {(currentQuestion?.type === 'multi_choice' || isLastQuestion) && (
          <button
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-all ${
              canProceed() && !isSubmitting
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Getting Recommendations...
              </>
            ) : isLastQuestion ? (
              <>
                Get My Recommendations
                <SparklesIcon className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default ToolRecommendationQuiz;
