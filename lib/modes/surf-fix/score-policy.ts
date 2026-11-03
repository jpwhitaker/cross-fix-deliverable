import type { ExtractedWord } from '@/lib/dictionary';
import type { BoardCell } from '@/lib/game-store';
import { hasMoreNewLettersThanReused } from '@/lib/predicates/score/new-reuse-length-bonus';
import { positionKey } from '@/lib/util/position-key';
export function surfFixWordQualifiesForLengthBonus(input: {
    board: BoardCell[][];
    word: ExtractedWord;
    submittedPositions: Set<string> | null;
}): boolean {
    return hasMoreNewLettersThanReused(input.word.positions.map((pos) => ({
        letterCount: surfFixCellLetterCount(input.board[pos.row]?.[pos.col]),
        reused: input.submittedPositions?.has(positionKey(pos.row, pos.col)) ?? false,
    })));
}
function surfFixCellLetterCount(cell: BoardCell | undefined): number {
    if (!cell || cell.kind === 'empty' || cell.kind === 'surfboard')
        return 0;
    if (cell.kind === 'double')
        return cell.letters.length;
    return 1;
}
