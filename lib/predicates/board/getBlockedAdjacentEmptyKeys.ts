import type { BoardCell } from '@/lib/game-store';
import { positionKey } from '@/lib/util/position-key';
const ADJ = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
export function isAdjacentToSubmitted(row: number, col: number, submittedKeys: Set<string> | null, ignoreKeys?: Set<string> | null): boolean {
    if (!submittedKeys || submittedKeys.size === 0)
        return false;
    return ADJ.some(([dr, dc]) => {
        const key = positionKey(row + dr, col + dc);
        return !ignoreKeys?.has(key) && submittedKeys.has(key);
    });
}
export function isBlockedAdjacentEmptyCell(board: BoardCell[][], row: number, col: number, submittedKeys: Set<string>, ignoreKeys?: Set<string> | null): boolean {
    const cell = board[row]?.[col];
    if (!cell || cell.kind !== 'empty')
        return false;
    return isAdjacentToSubmitted(row, col, submittedKeys, ignoreKeys);
}
export function getBlockedAdjacentEmptyKeys(board: BoardCell[][], submittedKeys: Set<string>, ignoreKeys?: Set<string> | null): Set<string> {
    if (submittedKeys.size === 0)
        return new Set<string>();
    const keys = new Set<string>();
    for (let row = 0; row < board.length; row++) {
        const cols = board[row]?.length ?? 0;
        for (let col = 0; col < cols; col++) {
            if (!isBlockedAdjacentEmptyCell(board, row, col, submittedKeys, ignoreKeys))
                continue;
            keys.add(positionKey(row, col));
        }
    }
    return keys;
}
