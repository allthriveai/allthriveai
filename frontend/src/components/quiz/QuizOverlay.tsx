import { useEffect, useState, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getQuiz, startQuiz, submitAnswer, completeQuiz } from '@/services/quiz';
import { QuizCard } from '@/components/quiz/QuizCard';
import { QuizProgress } from '@/components/quiz/QuizProgress';
import { QuizResults } from '@/components/quiz/QuizResults';
import type { Quiz, QuizQuestion } from '@/components/quiz/types';

type QuizState = 'intro' | 'taking' | 'feedback' | 'results';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizSlug: string;
  /** Optional ref to the feed scroll container for scroll-to-close on mobile */
  feedScrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function QuizOverlay({ isOpen, onClose, quizSlug, feedScrollContainerRef }: QuizOverlayProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>('intro');
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionStartTime = useRef<number>(Date.now());

  // Scroll-to-close refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Feed scroll detection - close overlay when user scrolls down on the feed behind it (mobile only)
  useEffect(() => {
    if (!isOpen || !feedScrollContainerRef?.current || !isMobileRef.current) return;

    const feedContainer = feedScrollContainerRef.current;
    let lastScrollTop = feedContainer.scrollTop;
    let scrollDownAccumulator = 0;
    const SCROLL_DOWN_THRESHOLD = 80;

    const handleFeedScroll = () => {
      const currentScrollTop = feedContainer.scrollTop;
      const delta = currentScrollTop - lastScrollTop;

      if (delta > 0) {
        scrollDownAccumulator += delta;
        if (scrollDownAccumulator > SCROLL_DOWN_THRESHOLD) {
          onCloseRef.current();
          scrollDownAccumulator = 0;
        }
      } else {
        scrollDownAccumulator = 0;
      }

      lastScrollTop = currentScrollTop;
    };

    feedContainer.addEventListener('scroll', handleFeedScroll, { passive: true });
    return () => {
      feedContainer.removeEventListener('scroll', handleFeedScroll);
    };
  }, [isOpen, feedScrollContainerRef]);

  // Wheel event detection for desktop - close overlay when user scrolls past bottom
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!isOpen || !scrollContainer) return;

    let overscrollAccumulator = 0;
    const OVERSCROLL_THRESHOLD = 100;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) {
        overscrollAccumulator = 0;
        return;
      }

      const isAtBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 5;

      if (isAtBottom) {
        overscrollAccumulator += e.deltaY;
        if (overscrollAccumulator > OVERSCROLL_THRESHOLD) {
          onCloseRef.current();
          overscrollAccumulator = 0;
        }
      } else {
        overscrollAccumulator = 0;
      }
    };

    scrollContainer.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // Mobile: detect overscroll at bottom using touch events
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!isOpen || !scrollContainer) return;

    let touchStartY = 0;
    let wasAtBottom = false;
    let overscrollCount = 0;
    const OVERSCROLL_COUNT_THRESHOLD = 2;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobileRef.current) return;
      touchStartY = e.touches[0].clientY;
      wasAtBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 5;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isMobileRef.current) return;

      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;

      const isAtBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 5;

      if (wasAtBottom && isAtBottom && deltaY > 30) {
        overscrollCount++;
        if (overscrollCount >= OVERSCROLL_COUNT_THRESHOLD) {
          onCloseRef.current();
          overscrollCount = 0;
        }
      } else if (!isAtBottom) {
        overscrollCount = 0;
      }
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCloseRef.current();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && quizSlug) {
      loadQuiz(quizSlug);
    }
  }, [isOpen, quizSlug]);

  async function loadQuiz(slug: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await getQuiz(slug);
      setQuiz(data);
      setQuizState('intro');
    } catch (err: any) {
      console.error('Failed to load quiz:', err);
      setError(err?.error || 'Quiz not found');
    } finally {
      setLoading(false);
    }
  }

  const handleStartQuiz = async () => {
    if (!quizSlug) return;

    try {
      const response = await startQuiz(quizSlug);
      setAttemptId(response.attemptId);
      setQuestions(response.questions);
      setQuizState('taking');
      setCurrentQuestionIndex(0);
      setScore(0);
      questionStartTime.current = Date.now();
    } catch (err: any) {
      console.error('Failed to start quiz:', err);
      const errorMessage = err?.error || 'Please log in to take quizzes.';
      setError(errorMessage);
      setQuizState('intro');
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!attemptId || !questions[currentQuestionIndex] || submittingAnswer) {
      return;
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime.current) / 1000);
    const question = questions[currentQuestionIndex];

    try {
      setSubmittingAnswer(true);
      const response = await submitAnswer(attemptId, question.id, answer, timeSpent);

      setLastAnswerCorrect(response.correct);
      if (response.correct) {
        setScore(prev => prev + 1);
      }

      setShowFeedback(true);
      setQuizState('feedback');

      const FEEDBACK_DISPLAY_DURATION = 2000;
      setTimeout(() => {
        setShowFeedback(false);
        setSubmittingAnswer(false);

        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setQuizState('taking');
          questionStartTime.current = Date.now();
        } else {
          handleCompleteQuiz();
        }
      }, FEEDBACK_DISPLAY_DURATION);
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setSubmittingAnswer(false);
    }
  };

  const handleCompleteQuiz = async () => {
    if (!attemptId) return;

    try {
      await completeQuiz(attemptId);
      setQuizState('results');
    } catch (err) {
      console.error('Failed to complete quiz:', err);
      setQuizState('results');
    }
  };

  const handleRetake = () => {
    setQuizState('intro');
    setCurrentQuestionIndex(0);
    setScore(0);
    setAttemptId(null);
    setQuestions([]);
  };

  const handleClose = () => {
    // Reset state when closing
    setQuizState('intro');
    setCurrentQuestionIndex(0);
    setScore(0);
    setAttemptId(null);
    setQuestions([]);
    setShowFeedback(false);
    onClose();
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300 ease-in-out pointer-events-none"
        onClick={handleClose}
      />

      {/* Quiz Overlay Panel */}
      <aside className="fixed right-0 top-0 h-full w-full md:w-[700px] lg:w-[900px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transform transition-transform duration-300 ease-in-out animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {quiz?.title || 'Quiz'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-y-contain p-6 pb-16">
          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-primary-600"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quiz...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <p className="text-red-700 dark:text-red-300 text-lg mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Intro State */}
          {quiz && !loading && !error && quizState === 'intro' && (
            <div className="glass-strong rounded-xl p-6">
              {quiz.thumbnailUrl && (
                <img
                  src={quiz.thumbnailUrl}
                  alt={quiz.title}
                  className="w-full h-48 object-cover rounded-lg mb-6"
                />
              )}

              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {quiz.title}
              </h3>

              <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
                {quiz.description}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  quiz.difficulty === 'beginner' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                  quiz.difficulty === 'intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {quiz.difficulty}
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {quiz.estimatedTime} minutes
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {quiz.questionCount} questions
                </span>
              </div>

              {/* Taxonomy Pills - Topics, Tools, Categories */}
              {(quiz.topics?.length > 0 || quiz.tools?.length > 0 || quiz.categories?.length > 0) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">What You'll Learn:</h4>
                  <div className="flex flex-wrap gap-2">
                    {/* Topic Tags */}
                    {quiz.topics?.map((topic) => (
                      <span
                        key={topic}
                        className="px-3 py-1 text-sm rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium"
                      >
                        {topic}
                      </span>
                    ))}

                    {/* Tool Pills */}
                    {quiz.tools?.map((tool) => (
                      <span
                        key={tool.id}
                        className="px-3 py-1 text-sm rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium flex items-center gap-2"
                        title={tool.tagline}
                      >
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt="" className="w-4 h-4 object-contain" />
                        )}
                        {tool.name}
                      </span>
                    ))}

                    {/* Category Pills */}
                    {quiz.categories?.map((category) => (
                      <span
                        key={category.id}
                        className="px-3 py-1 text-sm rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium"
                        title={category.description}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Quiz Button */}
              <div className="text-center">
                <button
                  onClick={handleStartQuiz}
                  className="w-full px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white rounded-xl text-lg font-bold transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Start Quiz
                </button>
              </div>
            </div>
          )}

          {/* Taking Quiz State */}
          {(quizState === 'taking' || quizState === 'feedback') && currentQuestion && (
            <div>
              <QuizProgress
                current={currentQuestionIndex + 1}
                total={questions.length}
              />
              <div className="relative mt-4">
                <QuizCard
                  question={currentQuestion}
                  onAnswer={handleAnswer}
                  showFeedback={showFeedback}
                  isCorrect={lastAnswerCorrect}
                  isSubmitting={submittingAnswer}
                />
              </div>
            </div>
          )}

          {/* Results State */}
          {quizState === 'results' && (
            <QuizResults
              score={score}
              totalQuestions={questions.length}
              onRetake={handleRetake}
              onBackToList={handleClose}
            />
          )}
        </div>
      </aside>
    </>
  );
}
