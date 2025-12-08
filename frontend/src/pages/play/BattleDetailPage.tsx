import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export default function BattleDetailPage() {
  const { battleId } = useParams<{ battleId: string }>();
  const { } = useAuth();
  const navigate = useNavigate();

  const [battle, setBattle] = useState<any>(null);
  const [promptText, setPromptText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBattle();
    const interval = setInterval(fetchBattle, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);

  }, [battleId]);

  const fetchBattle = async () => {
    try {
      const url = `${API_BASE_URL}/me/battles/${battleId}/`;

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBattle(data);
        setLoading(false);
      } else {
        const text = await response.text();
        console.error('Battle fetch failed:', response.status, response.statusText);
        console.error('Response body (first 200 chars):', text.substring(0, 200));
        setLoading(false);
        setError(`Failed to load battle (${response.status})`);
      }
    } catch (err) {
      console.error('Error fetching battle:', err);
      setLoading(false);
      setError('Network error loading battle');
    }
  };

  const submitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Get CSRF token
      const getCookie = (name: string): string | null => {
        const cookies = document.cookie ? document.cookie.split('; ') : [];
        for (const cookie of cookies) {
          if (cookie.startsWith(name + '=')) {
            return decodeURIComponent(cookie.substring(name.length + 1));
          }
        }
        return null;
      };

      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_BASE_URL}/me/battles/${battleId}/submit/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          prompt_text: promptText,
          submission_type: battle.battle_type === 'image_prompt' ? 'image' : 'text',
        }),
      });

      if (response.ok) {
        fetchBattle();
        setPromptText('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to submit prompt');
      }
    } catch (_err) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl">Loading battle...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!battle) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl">Battle not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const timeRemaining = battle.time_remaining || 0;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const isActive = battle.status === 'active';
  const canSubmit = battle.can_submit;
  const hasSubmitted = battle.user_has_submitted;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <button
          onClick={() => navigate('/play/prompt-battle')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back to Battles
        </button>

        {/* Battle Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {battle.challenger_data.username} vs {battle.opponent_data.username}
              </h1>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {battle.battle_type.replace('_', ' ')} • {battle.duration_minutes} minutes
              </div>
            </div>
            {isActive && (
              <div className="text-right">
                <div className="text-4xl font-bold text-red-600">
                  {minutes}:{String(seconds).padStart(2, '0')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Time Remaining
                </div>
              </div>
            )}
            {battle.status === 'completed' && battle.winner_data && (
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  Winner: {battle.winner_data.username}
                </div>
              </div>
            )}
          </div>

          {/* Challenge */}
          <div className="bg-blue-50 dark:bg-blue-900 p-6 rounded-lg mb-6">
            <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              CHALLENGE
            </div>
            <div className="text-lg text-blue-900 dark:text-blue-100">
              {battle.challenge_text}
            </div>
          </div>

          {/* Submission Form */}
          {isActive && canSubmit && !hasSubmitted && (
            <form onSubmit={submitPrompt} className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Prompt
              </label>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={6}
                placeholder="Write your creative prompt here..."
                required
                minLength={10}
                maxLength={5000}
              />
              <div className="flex justify-between items-center mt-3">
                <div className="text-sm text-gray-500">
                  {promptText.length} / 5000 characters
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Prompt'}
                </button>
              </div>
              {error && (
                <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
                  {error}
                </div>
              )}
            </form>
          )}

          {hasSubmitted && isActive && (
            <div className="p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg mb-6">
              ✓ You have submitted your prompt. Waiting for opponent...
            </div>
          )}

          {/* Submissions */}
          {battle.submissions && battle.submissions.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Submissions ({battle.submissions.length}/2)
              </h2>
              <div className="space-y-4">
                {battle.submissions.map((submission: any) => (
                  <div
                    key={submission.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-6"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {submission.user_avatar && (
                          <img
                            src={submission.user_avatar}
                            alt={submission.username}
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {submission.username}
                          </div>
                          {submission.score !== null && (
                            <div className="text-sm font-bold text-blue-600">
                              Score: {submission.score}/100
                            </div>
                          )}
                        </div>
                      </div>
                      {battle.status === 'completed' && battle.winner?.id === submission.user && (
                        <div className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-bold">
                          🏆 Winner
                        </div>
                      )}
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {submission.prompt_text}
                    </div>
                    {submission.evaluation_feedback && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 italic border-l-4 border-blue-500 pl-4">
                        <strong>AI Feedback:</strong> {submission.evaluation_feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
