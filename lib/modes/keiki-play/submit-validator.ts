import type { BoardCell } from '@/lib/game-store';
import type { SubmitResult } from '@/lib/modes/types';
import { extractWords } from '@/lib/dictionary';
import { hasPlacedTiles, hasPlacedTilesTouchingSubmitted } from '@/lib/predicates/submit/get-submit-facts';
import { getNewAcceptedWords } from '@/lib/predicates/submit/get-new-accepted-words';
import { hasRoundPickTileInCandidate } from '@/lib/predicates/submit/has-round-pick-tile-in-candidate';
export function validateKeikiPlaySubmit(board: BoardCell[][], submittedPositions: Set<string> | null): SubmitResult {
    if (!hasPlacedTiles(board)) {
        return { ok: false, code: 'no-placed-tiles', message: 'Drag some letters to the board first!' };
    }
    if (hasPlacedTilesTouchingSubmitted(board, submittedPositions)) {
        return {
            ok: false,
            code: 'touches-submitted',
            message: "New tiles can't touch previously submitted words!",
        };
    }
    const words = extractWords(board);
    const newAcceptedWords = getNewAcceptedWords(words, submittedPositions, (word) => word.valid);
    if (newAcceptedWords.length === 0) {
        return {
            ok: false,
            code: 'no-new-words',
            message: 'No new words found — keep building!',
        };
    }
    if (!hasRoundPickTileInCandidate(board, submittedPositions, newAcceptedWords)) {
        return {
            ok: false,
            code: 'pick-tile-required',
            message: 'Must include a pick tile!',
        };
    }
    return { ok: true, code: 'ok' };
}
