/**
 * InlineActionsMessage - Displays assistant message with clickable action pills
 *
 * Used for interactive responses like the "I don't know where to start" flow
 * where the user can click pills to continue the conversation.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import type { InlineAction } from '@/hooks/useIntelligentChat';

interface InlineActionsMessageProps {
  content: string;
  actions: InlineAction[];
  onActionClick: (message: string) => void;
}

export function InlineActionsMessage({
  content,
  actions,
  onActionClick,
}: InlineActionsMessageProps) {
  return (
    <div className="flex justify-start w-full">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center flex-shrink-0 mr-4">
        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
      </div>
      <div className="flex-1 glass-message px-5 py-4 rounded-2xl rounded-bl-sm">
        <div className="text-lg text-slate-700 dark:text-slate-200">
          {content}
        </div>
        {/* Action pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onActionClick(action.message)}
              className="px-4 py-2 rounded-full text-sm font-medium
                bg-white/10 hover:bg-white/20
                border border-white/20 hover:border-cyan-400/50
                text-slate-600 dark:text-slate-300
                transition-all duration-200
                hover:shadow-lg hover:shadow-cyan-500/10
                active:scale-95"
            >
              {action.emoji && <span className="mr-1.5">{action.emoji}</span>}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
