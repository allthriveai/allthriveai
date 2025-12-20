/**
 * MiniEthicsDefender - Compact space shooter game for chat panel
 *
 * Uses the shared EthicsDefenderCore component with mini layout.
 */

import { EthicsDefenderCore } from '../../games/EthicsDefenderCore';
import type { MiniGameProps } from './gameRegistry';

export function MiniEthicsDefender({ onGameEnd }: MiniGameProps) {
  return <EthicsDefenderCore variant="mini" onGameEnd={onGameEnd} />;
}
