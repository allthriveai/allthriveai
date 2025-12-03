/**
 * KudosWall - Kudos received/given with Neon Glass aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faHeart,
  faLightbulb,
  faPalette,
  faHandshake,
  faHandsHelping,
  faAward,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { Kudos, KudosType } from '@/types/models';

interface KudosWallProps {
  kudos: Kudos[];
  currentUserId?: string;
  isLoading?: boolean;
}

const KUDOS_CONFIG: Record<KudosType, { icon: typeof faHeart; label: string; color: string; bgColor: string }> = {
  great_project: { icon: faPalette, label: 'Great Project', color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  helpful: { icon: faHandshake, label: 'Helpful', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  inspiring: { icon: faStar, label: 'Inspiring', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' },
  creative: { icon: faLightbulb, label: 'Creative', color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
  supportive: { icon: faHandsHelping, label: 'Supportive', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
  welcome: { icon: faHeart, label: 'Welcome', color: 'text-pink-400', bgColor: 'bg-pink-500/20 border-pink-500/30' },
};

export function KudosWall({ kudos, currentUserId, isLoading }: KudosWallProps) {
  if (isLoading) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faAward} className="text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Kudos Wall</h3>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Hide the wall completely if no kudos
  if (!kudos || kudos.length === 0) {
    return null;
  }

  // Separate kudos received by current user vs all kudos
  const kudosForYou = kudos.filter((k) => k.toUser.id === currentUserId);

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
          <FontAwesomeIcon icon={faAward} className="text-yellow-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Kudos Wall</h3>
          <p className="text-xs text-slate-500">
            <span className="text-yellow-400">{kudos.length}</span> kudos this week
          </p>
        </div>
      </div>

      {/* Kudos for you section */}
      {kudosForYou.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FontAwesomeIcon icon={faBolt} className="text-cyan-bright text-xs" />
            <span className="text-sm font-medium text-cyan-bright">
              Kudos for you ({kudosForYou.length})
            </span>
          </div>
          <div className="space-y-2">
            {kudosForYou.slice(0, 3).map((k) => {
              const config = KUDOS_CONFIG[k.kudosType];
              return (
                <div
                  key={k.id}
                  className={`p-3 rounded-xl ${config.bgColor} border neon-border`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon icon={config.icon} className={config.color} />
                    <span className="font-medium text-sm text-white">{k.fromUser.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  {k.message && (
                    <p className="text-sm text-slate-400 ml-6">"{k.message}"</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All kudos */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {kudos
          .filter((k) => k.toUser.id !== currentUserId)
          .slice(0, 10)
          .map((k) => {
            const config = KUDOS_CONFIG[k.kudosType];
            return (
              <div
                key={k.id}
                className="flex items-center gap-2 text-sm py-2 border-b border-white/5 last:border-0 group"
              >
                <div className={`w-6 h-6 rounded-md ${config.bgColor} border flex items-center justify-center flex-shrink-0`}>
                  <FontAwesomeIcon icon={config.icon} className={`text-xs ${config.color}`} />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-white group-hover:text-cyan-bright transition-colors">
                    {k.fromUser.username}
                  </span>
                  <span className="text-slate-500"> gave </span>
                  <span className={config.color}>{config.label}</span>
                  <span className="text-slate-500"> to </span>
                  <span className="font-medium text-white">{k.toUser.username}</span>
                </span>
              </div>
            );
          })}
      </div>

      {/* Circuit connector decoration */}
      <div className="circuit-connector mt-4 opacity-20" />
    </div>
  );
}
