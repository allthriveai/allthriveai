import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ToolRecommendationQuiz } from '@/components/tools/ToolRecommendationQuiz';
import { getQuiz, startQuiz, submitAnswer, completeQuiz } from '@/services/quiz';
import { QuizCard } from '@/components/quiz/QuizCard';
import { QuizProgress } from '@/components/quiz/QuizProgress';
import { QuizResults } from '@/components/quiz/QuizResults';
import { QuestCompletionCelebration } from '@/components/side-quests/QuestCompletionCelebration';
import type { Quiz, QuizQuestion, QuizAnswerResponse, CompletedQuestInfo } from '@/components/quiz/types';

type QuizState = 'intro' | 'taking' | 'feedback' | 'results';

export default function QuizPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Special case: Tool Recommendation Quiz
  if (slug === 'find-your-perfect-ai-tool') {
    return (
      <DashboardLayout>
        {() => (
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ToolRecommendationQuiz
                onComplete={() => {
                  // Optionally navigate somewhere after completion
                }}
              />
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }
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
  const [completedQuests, setCompletedQuests] = useState<CompletedQuestInfo[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const questionStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        const data = await getQuiz(slug);
        setQuiz(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch quiz:', err);
        setError('Quiz not found');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [slug]);

  const handleStartQuiz = async () => {
    if (!slug) return;

    try {
      const response = await startQuiz(slug);
      console.log('Quiz started successfully, attemptId:', response.attemptId);

      setAttemptId(response.attemptId);
      setQuestions(response.questions);
      setQuizState('taking');
      setCurrentQuestionIndex(0);
      setScore(0);
      questionStartTime.current = Date.now();
    } catch (err: any) {
      console.error('Failed to start quiz:', err);
      const errorMessage = err?.error || 'Please log in to take quizzes. Click "Log In" in the sidebar to continue.';
      setError(errorMessage);
      setQuizState('intro');
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!attemptId || !questions[currentQuestionIndex] || submittingAnswer) {
      console.log('handleAnswer blocked:', { attemptId, hasQuestion: !!questions[currentQuestionIndex], submittingAnswer });
      return;
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime.current) / 1000);
    const question = questions[currentQuestionIndex];

    console.log('Submitting answer:', answer, 'for question:', question.id);

    try {
      setSubmittingAnswer(true);
      const response = await submitAnswer(attemptId, question.id, answer, timeSpent);

      setLastAnswerCorrect(response.correct);
      if (response.correct) {
        setScore(prev => prev + 1);
      }

      // Show feedback
      setShowFeedback(true);
      setQuizState('feedback');

      const FEEDBACK_DISPLAY_DURATION = 2000; // ms
      // Auto-advance after FEEDBACK_DISPLAY_DURATION
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
      const response = await completeQuiz(attemptId);
      setQuizState('results');

      // Check if any quests were completed
      if (response.completedQuests && response.completedQuests.length > 0) {
        setCompletedQuests(response.completedQuests);
        setShowCelebration(true);
      }
    } catch (err) {
      console.error('Failed to complete quiz:', err);
      setQuizState('results'); // Show results anyway
    }
  };

  const handleRetake = () => {
    setQuizState('intro');
    setCurrentQuestionIndex(0);
    setScore(0);
    setAttemptId(null);
    setQuestions([]);
  };

  const handleBackToList = () => {
    navigate('/quizzes');
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <DashboardLayout>
      {() => (
        <>
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-primary-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quiz...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                <p className="text-red-700 dark:text-red-300 text-xl mb-4">{error}</p>
                <button
                  onClick={() => navigate('/quizzes')}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Back to Quizzes
                </button>
              </div>
            )}

            {/* Intro State */}
            {quiz && !loading && !error && quizState === 'intro' && (
              <div className="glass-strong rounded-xl p-8">
                {/* Quiz Header */}
                <div className="mb-8">
                  {quiz.bannerUrl && (
                    <img
                      src={quiz.bannerUrl}
                      alt={quiz.title}
                      className="w-full h-64 object-cover rounded-lg mb-6"
                    />
                  )}

                  <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {quiz.title}
                  </h1>

                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                    {quiz.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center flex-wrap gap-3 mb-6">
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                      quiz.difficulty === 'beginner' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      quiz.difficulty === 'intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {quiz.difficulty}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {quiz.estimatedTime} minutes
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {quiz.questionCount} questions
                    </span>
                  </div>

                  {/* Taxonomy Pills - Topics, Tools, Categories */}
                  {(quiz.topics?.length > 0 || quiz.tools?.length > 0 || quiz.categories?.length > 0) && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">What You'll Learn About:</h3>
                      <div className="flex flex-wrap gap-2">
                        {/* Topic Tags */}
                        {quiz.topics?.map((topic) => (
                          <span
                            key={topic}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium"
                          >
                            {topic}
                          </span>
                        ))}

                        {/* Tool Pills */}
                        {quiz.tools?.map((tool) => (
                          <span
                            key={tool.id}
                            className="px-3 py-1.5 text-sm rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium flex items-center gap-2"
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
                            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium"
                            title={category.description}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Quiz Button */}
                <div className="text-center">
                  <button
                    onClick={handleStartQuiz}
                    className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-lg font-semibold transition-colors"
                  >
                    Start Quiz
                  </button>
                </div>

                {/* Back Button */}
                <div className="mt-8 text-center">
                  <button
                    onClick={() => navigate('/quizzes')}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    ← Back to all quizzes
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
                <div className="relative">
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
                onBackToList={handleBackToList}
              />
            )}
          </div>
        </div>

        {/* Quest Completion Celebration */}
        {showCelebration && completedQuests.length > 0 && (
          <QuestCompletionCelebration
            completedQuests={completedQuests}
            onClose={() => {
              setShowCelebration(false);
              setCompletedQuests([]);
            }}
          />
        )}
      </>
      )}
    </DashboardLayout>
  );
}
