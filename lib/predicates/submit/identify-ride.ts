import type { ExtractedWord } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
export function wordKey(word: ExtractedWord): string {
    return word.positions.map((p) => positionKey(p.row, p.col)).join('|');
}
function countNewTiles(word: ExtractedWord, submittedPositions: Set<string> | null): number {
    return word.positions.filter((pos) => !submittedPositions?.has(positionKey(pos.row, pos.col))).length;
}
export function identifyRide(newAcceptedWords: readonly ExtractedWord[], submittedPositions: Set<string> | null): ExtractedWord | null {
    if (newAcceptedWords.length === 0)
        return null;
    return [...newAcceptedWords].reduce((best, w) => {
        const wNew = countNewTiles(w, submittedPositions);
        const bestNew = countNewTiles(best, submittedPositions);
        if (wNew > bestNew)
            return w;
        if (wNew === bestNew && w.letterCount > best.letterCount)
            return w;
        return best;
    });
}
