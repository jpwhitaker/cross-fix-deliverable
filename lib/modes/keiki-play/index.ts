import type { GameMode } from '@/lib/modes/types';
import { buildKeikiPlayBags } from './bag-builder';
import { keikiPlayRoundConfig, KEIKI_PICK_TILE_POOL } from './round-config';
import { validateKeikiPlaySubmit } from './submit-validator';
import { validateKeikiPlayBatchMove } from './move-policy';
export const KeikiPlayMode: GameMode = {
    id: 'keiki-play',
    boardSize: { rows: 17, cols: 17 },
    pickTilePool: KEIKI_PICK_TILE_POOL,
    validateSubmit: validateKeikiPlaySubmit,
    validateBatchMove: validateKeikiPlayBatchMove,
    buildBags: buildKeikiPlayBags,
    getRoundConfig: keikiPlayRoundConfig,
    shouldWordHaveLengthBonus: () => false,
};
