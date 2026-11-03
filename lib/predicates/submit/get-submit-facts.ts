import type { BoardCell } from '@/lib/game-store';
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
export function hasPlacedTiles(board: BoardCell[][]): boolean {
    return board.some((row) => row.some((cell) => cell.kind !== 'empty' && 'origin' in cell && cell.origin === 'placed'));
}
export function hasPlacedTilesTouchingSubmitted(board: BoardCell[][], submittedPositions: Set<string> | null): boolean {
    if (!submittedPositions || submittedPositions.size === 0)
        return false;
    return board.some((row, r) => row.some((cell, c) => {
        if (cell.kind === 'empty' || !('origin' in cell) || cell.origin !== 'placed')
            return false;
        if (submittedPositions.has(`${r}-${c}`))
            return false;
        return ORTHOGONAL_DIRS.some(([dr, dc]) => submittedPositions.has(`${r + dr}-${c + dc}`));
    }));
}
