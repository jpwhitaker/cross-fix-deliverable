import type { BoardCell } from '@/lib/game-store';
import type { ExtractedWord } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
export function isWildcardForceUseSatisfied(board: BoardCell[][], submittedPositions: Set<string> | null, candidateWords: readonly ExtractedWord[], round: number, wildcardMustBeUsedAsXRound: number | null): boolean {
    if (wildcardMustBeUsedAsXRound !== round)
        return true;
    for (const word of candidateWords) {
        for (const pos of word.positions) {
            const key = positionKey(pos.row, pos.col);
            if (submittedPositions?.has(key))
                continue;
            const cell = board[pos.row]?.[pos.col];
            if (cell?.kind === 'regular' && cell.origin === 'placed' && cell.letter === 'X') {
                return true;
            }
        }
    }
    return false;
}
