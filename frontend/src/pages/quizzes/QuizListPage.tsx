import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getQuizzes } from '@/services/quiz';
import { QuizPreviewCard } from '@/components/quiz/QuizPreviewCard';
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

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {/* Hero Banner - Neon Glass Style */}
          <div className="relative h-64 bg-[#020617] overflow-hidden">
        {/* Ambient Glow Background */}
        <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-pink-500/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent">Quizzes</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
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
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-cyan-400" />
              <input
                type="text"
                placeholder="Search quizzes by title, topic, or keyword..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          {/* Inline Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Topic Filters */}
            {availableTopics.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300 whitespace-nowrap">Topics:</span>
                <div className="flex flex-wrap gap-2">
                  {availableTopics.map(topic => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                        selectedTopics.includes(topic)
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-cyan-500/50'
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
              <div className="h-6 w-px bg-white/20" />
            )}

            {/* Difficulty Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300 whitespace-nowrap">Difficulty:</span>
              <div className="flex flex-wrap gap-2">
                {(['beginner', 'intermediate', 'advanced'] as QuizDifficulty[]).map(difficulty => (
                  <button
                    key={difficulty}
                    onClick={() => toggleDifficulty(difficulty)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all capitalize ${
                      selectedDifficulties.includes(difficulty)
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-cyan-500/50'
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
                <div className="h-6 w-px bg-white/20" />
                <button
                  onClick={clearFilters}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 min-h-[400px] flex flex-col items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-cyan-500"></div>
            <p className="mt-4 text-gray-400">Loading quizzes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center backdrop-blur-sm">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Quiz Grid */}
        {!loading && !error && (
          <>
            {quizzes.length === 0 ? (
              <div className="text-center py-12 min-h-[400px] flex flex-col items-center justify-center">
                <p className="text-xl text-gray-300 mb-2">
                  No quizzes found
                </p>
                <p className="text-gray-500">
                  Try adjusting your filters or search query
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map(quiz => (
                  <QuizPreviewCard
                    key={quiz.id}
                    quiz={quiz}
                    variant="default"
                  />
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
