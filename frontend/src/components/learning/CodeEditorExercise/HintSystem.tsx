/**
 * Hint System Component
 * Progressive hint revelation based on skill level
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faEye } from '@fortawesome/free-solid-svg-icons';
import type { HintSystemProps } from './types';

export function HintSystem({ hints, currentIndex, maxHints, onRevealHint }: HintSystemProps) {
  // No hints available
  if (!hints || hints.length === 0 || maxHints === 0) {
    return null;
  }

  const availableHints = hints.slice(0, maxHints);
  const revealedHints = availableHints.slice(0, currentIndex);
  const remainingHints = maxHints - currentIndex;
  const hasMoreHints = currentIndex < availableHints.length;

  return (
    <div className="space-y-3">
      {/* Revealed hints */}
      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((hint, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
            >
              <FontAwesomeIcon
                icon={faLightbulb}
                className="text-amber-400 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-xs text-amber-400/70 font-medium">
                  Hint {index + 1}
                </span>
                <p className="text-sm text-amber-100 mt-0.5">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reveal hint button */}
      {hasMoreHints && (
        <button
          onClick={onRevealHint}
          className="flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faEye} />
          <span>
            {currentIndex === 0 ? 'Need a hint?' : 'Get another hint'}
            {remainingHints > 1 && (
              <span className="text-amber-400/60 ml-1">
                ({remainingHints} remaining)
              </span>
            )}
            {remainingHints === 1 && (
              <span className="text-amber-400/60 ml-1">(last one!)</span>
            )}
          </span>
        </button>
      )}

      {/* No more hints message */}
      {!hasMoreHints && currentIndex > 0 && (
        <p className="text-sm text-slate-500 italic">
          You've used all available hints. Try asking Sage for more help!
        </p>
      )}
    </div>
  );
}

export default HintSystem;
