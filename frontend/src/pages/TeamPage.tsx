/**
 * TeamPage - Meet the All Thrive Team
 *
 * Displays the AI team members that power All Thrive:
 * - Core Team: AI personas (Ember, Pip, Sage, Haven)
 * - Expert Contributors: RSS/YouTube curators
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { UserAvatar } from '@/components/common/UserAvatar';
import { getTeamMembers, type TeamMember, type TeamResponse } from '@/services/team';
import { analytics } from '@/utils/analytics';

function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <Link
      to={`/${member.username}`}
      className="glass-card p-6 hover:bg-white/5 transition-all group"
    >
      <div className="flex items-start gap-4">
        <UserAvatar
          avatarUrl={member.avatarUrl}
          username={member.username}
          size="lg"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-bright transition-colors">
              {member.fullName}
            </h3>
            {member.pronouns && (
              <span className="text-xs text-slate-400">({member.pronouns})</span>
            )}
          </div>
          {member.tagline && (
            <p className="text-sm text-cyan-bright mt-0.5">{member.tagline}</p>
          )}
          {member.currentStatus && (
            <p className="text-xs text-slate-400 mt-1">{member.currentStatus}</p>
          )}
        </div>
      </div>

      {/* Bio excerpt */}
      {member.bio && (
        <div
          className="mt-4 text-sm text-slate-300 line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: member.bio.replace(/<[^>]*>/g, ' ').slice(0, 200) + '...',
          }}
        />
      )}

      {/* Interests/Topics */}
      {member.agentInterests && member.agentInterests.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {member.agentInterests.slice(0, 4).map((interest, idx) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs rounded-full bg-white/5 text-slate-300"
            >
              {interest}
            </span>
          ))}
          {member.agentInterests.length > 4 && (
            <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-slate-400">
              +{member.agentInterests.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Signature phrases preview */}
      {member.signaturePhrases && member.signaturePhrases.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-slate-400 italic">
            &ldquo;{member.signaturePhrases[0]}&rdquo;
          </p>
        </div>
      )}
    </Link>
  );
}

function CoreTeamSection({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          Core Team
        </h2>
        <p className="text-slate-400 mt-1">
          The AI personas at the heart of All Thrive
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map((member) => (
          <TeamMemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

function ContributorsSection({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">✨</span>
          Expert Contributors
        </h2>
        <p className="text-slate-400 mt-1">
          Curators who bring the best AI content to All Thrive
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <TeamMemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

export default function TeamPage() {
  const [teamData, setTeamData] = useState<TeamResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.pageView('team');

    async function fetchTeam() {
      try {
        const data = await getTeamMembers();
        setTeamData(data);
      } catch (err) {
        console.error('Failed to fetch team:', err);
        setError('Failed to load team members');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
  }, []);

  return (
    <DashboardLayout>
      <SEO
        title="Meet the Team | All Thrive"
        description="Meet the AI team members that power All Thrive - from guides and teachers to battle champions and community support."
      />
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Banner */}
          <div className="relative w-full h-48 bg-gradient-to-br from-orange-500/20 via-background to-cyan-500/10 flex items-center justify-center overflow-hidden rounded-2xl mb-8">
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
            <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[80px]" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[60px]" />
            <div className="relative text-center z-10">
              <div className="text-6xl mb-3">👋</div>
              <p className="text-3xl font-bold text-white">Meet the Team</p>
              <p className="text-lg text-cyan-bright">The AI crew that makes All Thrive tick</p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="glass-card p-6 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Team Content */}
          {teamData && (
            <div className="space-y-12">
              <CoreTeamSection members={teamData.coreTeam} />
              <ContributorsSection members={teamData.contributors} />

              {/* Empty State */}
              {teamData.coreTeam.length === 0 && teamData.contributors.length === 0 && (
                <div className="glass-card p-8 text-center">
                  <p className="text-slate-400">No team members found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
