import type { ExtractedWord } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
export function getNewAcceptedWords(words: readonly ExtractedWord[], submittedPositions: Set<string> | null, isAcceptedWord: (word: ExtractedWord) => boolean): ExtractedWord[] {
    return words.filter((word) => isAcceptedWord(word) &&
        word.positions.some((pos) => !submittedPositions?.has(positionKey(pos.row, pos.col))));
}
