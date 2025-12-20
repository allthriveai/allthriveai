/**
 * EthicsDefenderGame - Full-page space shooter game
 *
 * Uses the shared EthicsDefenderCore component with full-page layout.
 */

import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { EthicsDefenderCore } from '../../components/games/EthicsDefenderCore';

export default function EthicsDefenderGame() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/play/side-quests');
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Back button - fixed position outside game */}
      <button
        onClick={handleBack}
        className="fixed top-4 right-4 z-50 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-700 hover:border-cyan-500/30 transition-all flex items-center gap-2 text-slate-400 hover:text-white text-sm"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        <span className="hidden sm:inline">Exit</span>
      </button>

      {/* Game */}
      <EthicsDefenderCore variant="full" onBack={handleBack} />
    </div>
  );
}
