/**
 * PromptBattleChooser - Game selection for Prompt Battles
 *
 * Presents two options:
 * - Battle Pip: Start a battle against Pip AI and navigate to battle page
 * - Battle a Friend: Navigate to lobby with human battle modal open
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faRobot,
  faUsers,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { useMatchmaking, type MatchFoundData } from '@/hooks/useMatchmaking';
import type { MiniGameProps } from './gameRegistry';

const PIP_AVATAR_URL = '/prompt-battle.png';

export function PromptBattleChooser({ onGameEnd }: MiniGameProps) {
  const navigate = useNavigate();
  const [isMatchingWithPip, setIsMatchingWithPip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMatchFound = useCallback(
    (data: MatchFoundData) => {
      // Navigate to the battle
      navigate(`/play/prompt-battles/${data.battleId}`);
      onGameEnd?.(0); // Signal game ended (navigating away)
    },
    [navigate, onGameEnd]
  );

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setIsMatchingWithPip(false);
  }, []);

  const { matchWithPip, isSearching, isConnecting } = useMatchmaking({
    onMatchFound: handleMatchFound,
    onError: handleError,
  });

  const handleBattlePip = useCallback(() => {
    setError(null);
    setIsMatchingWithPip(true);
    matchWithPip();
  }, [matchWithPip]);

  const handleBattleFriend = useCallback(() => {
    navigate('/play/prompt-battles?openHumanModal=true');
    onGameEnd?.(0); // Signal game ended (navigating away)
  }, [navigate, onGameEnd]);

  const isLoading = isMatchingWithPip || isSearching || isConnecting;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <FontAwesomeIcon icon={faBolt} className="w-7 h-7 text-purple-400" />
        </motion.div>
        <h3 className="text-lg font-bold text-white mb-1">Prompt Battle</h3>
        <p className="text-slate-400 text-sm">
          Write prompts to generate AI images. Best prompt wins!
        </p>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <p className="text-red-400 text-sm text-center">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options */}
      <div className="w-full space-y-3">
        {/* Battle Pip */}
        <motion.button
          onClick={handleBattlePip}
          disabled={isLoading}
          className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-purple-500/50 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 overflow-hidden shrink-0 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-shadow">
              <img
                src={PIP_AVATAR_URL}
                alt="Pip"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                  Battle Pip
                </span>
                {isLoading && (
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="w-4 h-4 text-purple-400 animate-spin"
                  />
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isLoading ? 'Finding Pip...' : 'Challenge our AI companion'}
              </p>
            </div>
            <FontAwesomeIcon
              icon={faRobot}
              className="w-5 h-5 text-purple-400/50 group-hover:text-purple-400 transition-colors"
            />
          </div>
        </motion.button>

        {/* Battle a Friend */}
        <motion.button
          onClick={handleBattleFriend}
          disabled={isLoading}
          className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/50 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-shadow">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-cyan-400"
              />
            </div>
            <div className="flex-1 text-left">
              <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Battle a Friend
              </span>
              <p className="text-xs text-slate-500">
                Challenge someone you know
              </p>
            </div>
            <FontAwesomeIcon
              icon={faBolt}
              className="w-5 h-5 text-cyan-400/50 group-hover:text-cyan-400 transition-colors"
            />
          </div>
        </motion.button>
      </div>

      {/* How it works */}
      <div className="mt-2 text-center">
        <p className="text-xs text-slate-600">
          Write the best prompt for a challenge. AI judges the winner!
        </p>
      </div>
    </div>
  );
}
