/**
 * GiveKudosModal - Modal for giving kudos with Neon Glass aesthetic
 */

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faStar,
  faHeart,
  faLightbulb,
  faPalette,
  faHandshake,
  faHandsHelping,
  faSpinner,
  faPaperPlane,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { CircleMembership, KudosType } from '@/types/models';

interface GiveKudosModalProps {
  member: CircleMembership;
  onClose: () => void;
  onSubmit: (kudosType: KudosType, message: string) => void;
  isSubmitting?: boolean;
}

const KUDOS_OPTIONS: { type: KudosType; icon: typeof faHeart; label: string; color: string; bgColor: string; description: string }[] = [
  { type: 'great_project', icon: faPalette, label: 'Great Project', color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30 hover:border-purple-400', description: 'Amazing work!' },
  { type: 'helpful', icon: faHandshake, label: 'Helpful', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30 hover:border-blue-400', description: 'Thanks for helping!' },
  { type: 'inspiring', icon: faStar, label: 'Inspiring', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30 hover:border-yellow-400', description: 'You inspire me!' },
  { type: 'creative', icon: faLightbulb, label: 'Creative', color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30 hover:border-orange-400', description: 'So creative!' },
  { type: 'supportive', icon: faHandsHelping, label: 'Supportive', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400', description: 'Thanks for support!' },
  { type: 'welcome', icon: faHeart, label: 'Welcome', color: 'text-pink-400', bgColor: 'bg-pink-500/20 border-pink-500/30 hover:border-pink-400', description: 'Welcome to circle!' },
];

export function GiveKudosModal({ member, onClose, onSubmit, isSubmitting }: GiveKudosModalProps) {
  const [selectedType, setSelectedType] = useState<KudosType | null>(null);
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!selectedType) return;
    onSubmit(selectedType, message);
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* Ambient Background Effects */}
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-pink-accent/5 blur-[100px] pointer-events-none" />

      <div
        className="glass-card neon-border max-w-md w-full overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative pb-6 mb-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shadow-neon">
                <FontAwesomeIcon icon={faStar} className="text-cyan-bright" />
              </div>
              <h2 className="text-xl font-bold text-white">Give Kudos</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all"
            >
              <FontAwesomeIcon icon={faTimes} className="text-slate-400" />
            </button>
          </div>

          {/* Member info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-pink-accent/30 border border-cyan-500/50 flex items-center justify-center text-xl font-bold text-white shadow-neon">
              {member.user.avatarUrl ? (
                <img
                  src={member.user.avatarUrl}
                  alt={member.user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                member.user.username.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="font-bold text-white">{member.user.username}</div>
              <div className="text-sm text-slate-500 flex items-center gap-1">
                <FontAwesomeIcon icon={faBolt} className="text-cyan-bright/60 text-xs" />
                +{member.pointsEarnedInCircle} points this week
              </div>
            </div>
          </div>
        </div>

        {/* Kudos options */}
        <div className="mb-6">
          <p className="text-sm text-slate-400 mb-4">What kind of kudos would you like to give?</p>

          <div className="grid grid-cols-3 gap-3">
            {KUDOS_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => setSelectedType(option.type)}
                className={`p-3 rounded-xl text-center transition-all border ${
                  selectedType === option.type
                    ? `${option.bgColor} ${option.color} shadow-[0_0_20px_rgba(0,0,0,0.3)] scale-105`
                    : 'bg-white/5 border-white/10 hover:border-white/30 text-slate-400 hover:text-white'
                }`}
              >
                <FontAwesomeIcon
                  icon={option.icon}
                  className={`text-xl mb-1 ${selectedType === option.type ? option.color : ''}`}
                />
                <div className="text-xs font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            Add a message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something nice..."
            maxLength={280}
            rows={3}
            className="input-glass resize-none"
          />
          <div className="text-xs text-slate-600 text-right mt-1">
            {message.length}/280
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedType || isSubmitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2 shadow-neon disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Sending...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} />
                Send Kudos
              </>
            )}
          </button>
        </div>

        {/* Circuit connector decoration */}
        <div className="circuit-connector absolute bottom-4 opacity-20" />
      </div>
    </div>
  );
}
