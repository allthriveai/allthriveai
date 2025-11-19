import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

interface BattleInvitation {
  id: number;
  sender_data: {
    username: string;
    avatar_url?: string;
  };
  battle_data: {
    challenge_text: string;
    battle_type: string;
    duration_minutes: number;
  };
  message: string;
  created_at: string;
  expires_at: string;
}

interface Battle {
  id: number;
  challenger_username: string;
  opponent_username: string;
  challenge_text: string;
  status: string;
  battle_type: string;
  time_remaining?: number;
  created_at: string;
}

interface BattleStats {
  total_battles: number;
  wins: number;
  losses: number;
  active_battles: number;
  pending_invitations: number;
  win_rate: number;
  average_score: number;
}

export default function PromptBattlePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeBattles, setActiveBattles] = useState<Battle[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<BattleInvitation[]>([]);
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState('');
  const [battleType, setBattleType] = useState('text_prompt');
  const [duration, setDuration] = useState(10);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [battlesRes, invitesRes, statsRes] = await Promise.all([
        fetch('/api/v1/me/battles/active/', { credentials: 'include' }),
        fetch('/api/v1/me/battle-invitations/pending/', { credentials: 'include' }),
        fetch('/api/v1/battles/stats/', { credentials: 'include' }),
      ]);

      if (battlesRes.ok) setActiveBattles(await battlesRes.json());
      if (invitesRes.ok) setPendingInvitations(await invitesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());

      setLoading(false);
    } catch (err) {
      console.error('Error fetching battle data:', err);
      setLoading(false);
    }
  };

  const sendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/v1/me/battle-invitations/create_invitation/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          opponent_username: opponentUsername,
          battle_type: battleType,
          duration_minutes: duration,
          message,
        }),
      });

      if (response.ok) {
        setShowInviteModal(false);
        setOpponentUsername('');
        setMessage('');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send invitation');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const acceptInvitation = async (inviteId: number) => {
    try {
      const response = await fetch(`/api/v1/me/battle-invitations/${inviteId}/accept/`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const battle = await response.json();
        navigate(`/play/prompt-battle/${battle.id}`);
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
    }
  };

  const declineInvitation = async (inviteId: number) => {
    try {
      await fetch(`/api/v1/me/battle-invitations/${inviteId}/decline/`, {
        method: 'POST',
        credentials: 'include',
      });
      fetchData();
    } catch (err) {
      console.error('Error declining invitation:', err);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto h-full">
        <div className="max-w-6xl mx-auto p-8 pb-24">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Prompt Battle Arena
            </h1>
            <p className="text-lg text-muted">
              Challenge other users to timed prompt generation battles!
            </p>
          </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.total_battles}</div>
              <div className="text-sm text-muted">Total Battles</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-success-600 dark:text-success-400">{stats.wins}</div>
              <div className="text-sm text-muted">Wins</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-accent-600 dark:text-accent-400">{stats.win_rate}%</div>
              <div className="text-sm text-muted">Win Rate</div>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-info-600 dark:text-info-400">{stats.average_score}</div>
              <div className="text-sm text-muted">Avg Score</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-primary"
          >
            Challenge User
          </button>
          <button
            onClick={() => navigate('/play/prompt-battle/leaderboard')}
            className="btn-secondary"
          >
            Leaderboard
          </button>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Pending Invitations ({pendingInvitations.length})
            </h2>
            <div className="space-y-4">
              {pendingInvitations.map((invite) => (
                <div
                  key={invite.id}
                  className="card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {invite.sender_data.avatar_url && (
                          <img
                            src={invite.sender_data.avatar_url}
                            alt={invite.sender_data.username}
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {invite.sender_data.username}
                          </div>
                          <div className="text-sm text-muted">
                            {invite.battle_data.battle_type.replace('_', ' ')} • {invite.battle_data.duration_minutes} min
                          </div>
                        </div>
                      </div>
                      <div className="text-body mb-2">
                        <strong>Challenge:</strong> {invite.battle_data.challenge_text}
                      </div>
                      {invite.message && (
                        <div className="text-sm text-muted italic">
                          "{invite.message}"
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptInvitation(invite.id)}
                        className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 font-medium transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineInvitation(invite.id)}
                        className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 font-medium transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Battles */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Active Battles ({activeBattles.length})
          </h2>
          {activeBattles.length === 0 ? (
            <div className="card-solid text-center text-muted">
              No active battles. Challenge someone to get started!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeBattles.map((battle) => (
                <div
                  key={battle.id}
                  onClick={() => navigate(`/play/prompt-battle/${battle.id}`)}
                  className="card-hover cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-semibold text-lg text-gray-900 dark:text-white">
                      {battle.challenger_username} vs {battle.opponent_username}
                    </div>
                    {battle.time_remaining && (
                      <div className="text-error-600 dark:text-error-400 font-bold">
                        {Math.floor(battle.time_remaining / 60)}:{String(Math.floor(battle.time_remaining % 60)).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-body mb-2">
                    {battle.challenge_text}
                  </div>
                  <div className="text-xs text-muted">
                    {battle.battle_type.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <>
            <div className="backdrop" onClick={() => { setShowInviteModal(false); setError(''); }} />
            <div className="modal max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Challenge User
              </h2>
              <form onSubmit={sendInvitation}>
                <div className="mb-4">
                  <label className="label">
                    Username
                  </label>
                  <input
                    type="text"
                    value={opponentUsername}
                    onChange={(e) => setOpponentUsername(e.target.value)}
                    className="input"
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="label">
                    Battle Type
                  </label>
                  <select
                    value={battleType}
                    onChange={(e) => setBattleType(e.target.value)}
                    className="input"
                  >
                    <option value="text_prompt">Text Prompt</option>
                    <option value="image_prompt">Image Prompt</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="label">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    min="1"
                    max="60"
                    className="input"
                  />
                </div>
                <div className="mb-4">
                  <label className="label">
                    Message (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="textarea"
                    rows={3}
                    placeholder="Add a personal message..."
                  />
                </div>
                {error && (
                  <div className="mb-6 p-4 glass-subtle border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 rounded-lg">
                    <p className="text-error-600 dark:text-error-400">{error}</p>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setError('');
                    }}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Send Challenge
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
