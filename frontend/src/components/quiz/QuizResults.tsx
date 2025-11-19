import { CheckIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { TrophyIcon } from '@heroicons/react/24/solid';

interface QuizResultsProps {
  score: number;
  totalQuestions: number;
  onRetake: () => void;
  onBackToList: () => void;
}

export function QuizResults({ score, totalQuestions, onRetake, onBackToList }: QuizResultsProps) {
  const percentage = Math.round((score / totalQuestions) * 100);
  
  const getScoreMessage = () => {
    if (percentage === 100) return '🎉 Perfect Score!';
    if (percentage >= 80) return '🌟 Excellent Work!';
    if (percentage >= 60) return '👍 Good Job!';
    return '💪 Keep Practicing!';
  };

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-strong rounded-2xl p-8 shadow-2xl text-center">
        {/* Trophy Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center ${percentage >= 80 ? 'animate-bounce' : ''}`}>
            <TrophyIcon className="w-16 h-16 text-white" />
          </div>
        </div>

        {/* Score Message */}
        <h2 className={`text-3xl font-bold mb-4 ${getScoreColor()}`}>
          {getScoreMessage()}
        </h2>

        {/* Score Display */}
        <div className="mb-8">
          <div className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {percentage}%
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {score} out of {totalQuestions} correct
          </p>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-semibold text-green-700 dark:text-green-300">Correct</span>
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {score}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <XMarkIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-700 dark:text-red-300">Incorrect</span>
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {totalQuestions - score}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onRetake}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Retake Quiz
          </button>
          <button
            onClick={onBackToList}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    </div>
  );
}
