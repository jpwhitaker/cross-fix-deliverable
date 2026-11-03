import type { BoardCell } from '@/lib/game-store';
import { positionKey } from '@/lib/util/position-key';
export function isSelectedBoardCell(board: BoardCell[][], row: number, col: number, selectedTileIds: Set<string>): boolean {
    const cell = board[row]?.[col];
    if (!cell || cell.kind === 'empty' || !cell.handTileId)
        return false;
    return selectedTileIds.has(cell.handTileId);
}
export function getSelectedPositionKeys(board: BoardCell[][], selectedTileIds: Set<string>): Set<string> {
    if (selectedTileIds.size === 0)
        return new Set<string>();
    const keys = new Set<string>();
    for (let row = 0; row < board.length; row++) {
        const cols = board[row]?.length ?? 0;
        for (let col = 0; col < cols; col++) {
            if (!isSelectedBoardCell(board, row, col, selectedTileIds))
                continue;
            keys.add(positionKey(row, col));
        }
    }
    return keys;
}
