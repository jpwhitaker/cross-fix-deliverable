import type { ExtractedWord } from '@/lib/dictionary';
import type { BoardCell } from '@/lib/game-store';
import { positionKey } from '@/lib/util/position-key';
export function countRoundPickTilesInCandidate(board: BoardCell[][], submittedPositions: Set<string> | null, candidateWords: readonly ExtractedWord[]): number {
    const counted = new Set<string>();
    for (const word of candidateWords) {
        for (const pos of word.positions) {
            const key = positionKey(pos.row, pos.col);
            if (submittedPositions?.has(key))
                continue;
            if (counted.has(key))
                continue;
            const cell = board[pos.row]?.[pos.col];
            if (!(cell && cell.kind === 'regular' && cell.isPickTile))
                continue;
            counted.add(key);
        }
    }
    return counted.size;
}
export function hasRoundPickTileInCandidate(board: BoardCell[][], submittedPositions: Set<string> | null, candidateWords: readonly ExtractedWord[]): boolean {
    return countRoundPickTilesInCandidate(board, submittedPositions, candidateWords) > 0;
}
