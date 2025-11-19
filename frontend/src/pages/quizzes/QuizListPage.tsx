import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getQuizzes } from '@/services/quiz';
import type { Quiz, QuizDifficulty, QuizFilters } from '@/components/quiz/types';

export default function QuizListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    searchParams.getAll('topic')
  );
  const [selectedDifficulties, setSelectedDifficulties] = useState<QuizDifficulty[]>(
    searchParams.getAll('difficulty') as QuizDifficulty[]
  );

  // Fetch quizzes
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const filters: QuizFilters = {
          search: searchQuery || undefined,
          topic: selectedTopics.length > 0 ? selectedTopics : undefined,
          difficulty: selectedDifficulties.length > 0 ? selectedDifficulties : undefined,
        };
        
        const response = await getQuizzes(filters);
        setQuizzes(response.results);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
        setError('Failed to load quizzes. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [searchQuery, selectedTopics, selectedDifficulties]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    selectedTopics.forEach(t => params.append('topic', t));
    selectedDifficulties.forEach(d => params.append('difficulty', d));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedTopics, selectedDifficulties, setSearchParams]);

  // Extract unique topics from quizzes
  const availableTopics = useMemo(() => {
    return Array.from(new Set(quizzes.map(q => q.topic)));
  }, [quizzes]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const toggleDifficulty = (difficulty: QuizDifficulty) => {
    setSelectedDifficulties(prev =>
      prev.includes(difficulty)
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTopics([]);
    setSelectedDifficulties([]);
  };

  const getDifficultyColor = (difficulty: QuizDifficulty) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'intermediate':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'advanced':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    }
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {/* Hero Banner */}
          <div className="relative h-64 bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950">
        <div className="absolute inset-0 bg-[url('/quiz-hero-pattern.svg')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-white mb-4">Quick Quizzes</h1>
          <p className="text-xl text-primary-100 max-w-2xl">
            Test your knowledge on AI frameworks, concepts, and best practices
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters Section */}
        <div className="mb-8 glass-strong rounded-xl p-6">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search quizzes by title, topic, or keyword..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Inline Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Topic Filters */}
            {availableTopics.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Topics:</span>
                <div className="flex flex-wrap gap-2">
                  {availableTopics.map(topic => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedTopics.includes(topic)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {availableTopics.length > 0 && (
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
            )}

            {/* Difficulty Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Difficulty:</span>
              <div className="flex flex-wrap gap-2">
                {(['beginner', 'intermediate', 'advanced'] as QuizDifficulty[]).map(difficulty => (
                  <button
                    key={difficulty}
                    onClick={() => toggleDifficulty(difficulty)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                      selectedDifficulties.includes(difficulty)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(searchQuery || selectedTopics.length > 0 || selectedDifficulties.length > 0) && (
              <>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quizzes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Quiz Grid */}
        {!loading && !error && (
          <>
            {quizzes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                  No quizzes found
                </p>
                <p className="text-gray-500 dark:text-gray-500">
                  Try adjusting your filters or search query
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map(quiz => (
                  <div
                    key={quiz.id}
                    onClick={() => navigate(`/quick-quizzes/${quiz.slug}`)}
                    className="glass-strong rounded-xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative"
                  >
                    {/* Attempted Badge */}
                    {quiz.userHasAttempted && (
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                        <CheckCircleIcon className="w-4 h-4" />
                        {quiz.userBestScore !== null && `${quiz.userBestScore}%`}
                      </div>
                    )}

                    {/* Thumbnail */}
                    {quiz.thumbnailUrl ? (
                      <img
                        src={quiz.thumbnailUrl}
                        alt={quiz.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                        <span className="text-white text-5xl font-bold opacity-50">?</span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {quiz.title}
                      </h3>
                      
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {quiz.description}
                      </p>

                      {/* Meta Info */}
                      <div className="flex items-center justify-between text-sm mb-4">
                        <span className="text-gray-500 dark:text-gray-500">
                          {quiz.estimatedTime} min • {quiz.questionCount} questions
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(quiz.difficulty)}`}>
                          {quiz.difficulty}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {quiz.topic}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
        </div>
      )}
    </DashboardLayout>
  );
}
