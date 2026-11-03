import type { BoardCell } from '@/lib/game-store';
import type { GameMode } from '@/lib/modes/types';
import { LETTER_VALUES } from '@/lib/tiles';
import { buildSurfFixBags } from './bag-builder';
import { applySurfFixBatchMove, validateSurfFixBatchMove } from './move-policy';
import { surfFixRoundConfig, SURF_FIX_PICK_TILE_POOL } from './round-config';
import { surfFixWordQualifiesForLengthBonus } from './score-policy';
import { validateSurfFixSubmit } from './submit-validator';
function seedSurfFixBoard(board: BoardCell[][]): BoardCell[][] {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    if (rows === 0 || cols === 0)
        return board;
    const centerRow = Math.floor(rows / 2);
    const centerCol = Math.floor(cols / 2);
    const next = board.map((row) => row.slice());
    next[centerRow][centerCol] = {
        kind: 'regular',
        letter: 'S',
        value: LETTER_VALUES.S,
        origin: 'fixed',
    };
    return next;
}
export const SurfFixMode: GameMode = {
    id: 'surf-fix',
    boardSize: { rows: 21, cols: 21 },
    seedBoard: seedSurfFixBoard,
    pickTilePool: SURF_FIX_PICK_TILE_POOL,
    validateSubmit: validateSurfFixSubmit,
    validateBatchMove: validateSurfFixBatchMove,
    applyBatchMove: applySurfFixBatchMove,
    buildBags: buildSurfFixBags,
    getRoundConfig: surfFixRoundConfig,
    shouldWordHaveLengthBonus: (wordKey, rideKey, context) => {
        if (rideKey === null || wordKey !== rideKey || !context)
            return false;
        return surfFixWordQualifiesForLengthBonus(context);
    },
};
