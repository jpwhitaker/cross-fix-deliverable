import type { BoardCell } from '@/lib/game-store';
import type { GameMode } from '@/lib/modes/types';
import { LETTER_VALUES } from '@/lib/tiles';
import { buildCrosswordsBags } from './bag-builder';
import { crosswordsRoundConfig, CROSSWORDS_PICK_TILE_POOL } from './round-config';
import { validateCrosswordsSubmit } from './submit-validator';
import { validateCrosswordsBatchMove } from './move-policy';
function seedCrosswordsBoard(board: BoardCell[][]): BoardCell[][] {
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
export const CrosswordsMode: GameMode = {
    id: 'crosswords',
    boardSize: { rows: 21, cols: 21 },
    seedBoard: seedCrosswordsBoard,
    pickTilePool: CROSSWORDS_PICK_TILE_POOL,
    validateSubmit: validateCrosswordsSubmit,
    validateBatchMove: validateCrosswordsBatchMove,
    supportsCompoundArmRotatePivot: true,
    buildBags: buildCrosswordsBags,
    getRoundConfig: crosswordsRoundConfig,
    shouldWordHaveLengthBonus: (wordKey, rideKey) => rideKey !== null && wordKey === rideKey,
};
