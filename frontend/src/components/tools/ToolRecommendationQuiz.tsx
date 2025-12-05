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
  type QuizQuestion,
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
      <div className={`${embedded ? '' : 'min-h-[400px]'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !recommendations) {
    return (
      <div className={`${embedded ? '' : 'min-h-[400px]'} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-rose-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-cyan-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Results state
  if (recommendations) {
    return (
      <div className={`${embedded ? '' : 'max-w-2xl mx-auto px-4 py-8'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-4">
            <CheckIcon className="w-3.5 h-3.5" />
            Quiz Complete
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Your Recommended Tools</h2>
          <p className="text-slate-400">
            Based on your answers, here are the AI tools we think you'll love.
          </p>
        </div>

        {/* Recommendations */}
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <motion.div
              key={rec.tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-4 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {rec.tool.logoUrl ? (
                    <img
                      src={rec.tool.logoUrl}
                      alt={rec.tool.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <SparklesIcon className="w-6 h-6 text-cyan-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{rec.tool.name}</h3>
                    {rec.tool.isVerified && (
                      <CheckBadgeIcon className="w-4 h-4 text-cyan-400" />
                    )}
                    {rec.tool.isFeatured && (
                      <StarIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{rec.tool.tagline}</p>

                  {/* Match reasons */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rec.matchReasons.map((reason, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>

                  {/* Pricing & Category */}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{rec.tool.categoryDisplay}</span>
                    <span>•</span>
                    <span>{rec.tool.pricingDisplay}</span>
                    {rec.tool.hasFreeTier && (
                      <>
                        <span>•</span>
                        <span className="text-green-400">Free tier available</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Match Score & Action */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">
                      {rec.matchScore}%
                    </div>
                    <div className="text-xs text-slate-500">match</div>
                  </div>
                  <Link
                    to={`/tools/${rec.tool.slug}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    View Tool
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={handleRestart}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Take Quiz Again
          </button>
          <Link
            to="/tools"
            className="px-6 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-neon transition-all"
          >
            Browse All Tools
          </Link>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Quiz state
  return (
    <div className={`${embedded ? '' : 'max-w-2xl mx-auto px-4 py-8'} relative`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-4">
          <SparklesIcon className="w-3.5 h-3.5" />
          Tool Finder
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{quizData?.title}</h2>
        <p className="text-slate-400">{quizData?.description}</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
          <span>
            Question {currentStep + 1} of {quizData?.questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-xl font-semibold text-white mb-6">{currentQuestion.question}</h3>

            {currentQuestion.type === 'multi_choice' && (
              <p className="text-sm text-slate-400 mb-4">
                Select up to {currentQuestion.maxSelections || 3} options
              </p>
            )}

            {/* Options */}
            <div className="grid gap-3">
              {currentQuestion.options.map((option) => {
                const Icon = iconMap[option.icon] || SparklesIcon;
                const isSelected = isOptionSelected(option.value);

                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelectOption(option.value)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-cyan-500/30' : 'bg-white/10'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    </div>
                    <span className="flex-1 font-medium">{option.label}</span>
                    {isSelected && (
                      <CheckIcon className="w-5 h-5 text-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            currentStep === 0
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white'
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
            className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-xl transition-all ${
              canProceed() && !isSubmitting
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-neon'
                : 'bg-white/10 text-slate-500 cursor-not-allowed'
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
