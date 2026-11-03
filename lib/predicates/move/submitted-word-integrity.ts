import { extractWords, type ExtractedWord } from '@/lib/dictionary';
import type { BoardCell } from '@/lib/game-store';
import { positionKey } from '@/lib/util/position-key';
export type SubmittedWordState = {
    coveredPositions: Set<string>;
    wordCounts: Map<string, number>;
};
function normalizeWord(word: string): string {
    return word.toLowerCase();
}
export function collectFullySubmittedWordState(board: BoardCell[][], submittedPositions: Set<string> | null, options?: {
    acceptWord?: (word: ExtractedWord) => boolean;
    submittedBentWordPositions?: Set<string> | null;
}): SubmittedWordState {
    const coveredPositions = new Set<string>();
    const wordCounts = new Map<string, number>();
    if (!submittedPositions || submittedPositions.size === 0) {
        return { coveredPositions, wordCounts };
    }
    for (const word of extractWords(board)) {
        if (options?.acceptWord && !options.acceptWord(word))
            continue;
        const isFullySubmitted = word.positions.every((pos) => submittedPositions.has(positionKey(pos.row, pos.col)));
        if (!isFullySubmitted)
            continue;
        for (const pos of word.positions)
            coveredPositions.add(positionKey(pos.row, pos.col));
        const normalized = normalizeWord(word.word);
        wordCounts.set(normalized, (wordCounts.get(normalized) ?? 0) + 1);
    }
    if (options?.submittedBentWordPositions) {
        for (const key of options.submittedBentWordPositions) {
            coveredPositions.add(key);
        }
    }
    return { coveredPositions, wordCounts };
}
export function areSubmittedPositionsCovered(submittedPositions: Set<string> | null, coveredPositions: Set<string>): boolean {
    if (!submittedPositions || submittedPositions.size === 0)
        return true;
    for (const key of submittedPositions) {
        if (!coveredPositions.has(key))
            return false;
    }
    return true;
}
export function buildWordMultiset(words: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const word of words) {
        const normalized = normalizeWord(word);
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return counts;
}
export function wordMultisetContains(actual: Map<string, number>, required: Map<string, number>): boolean {
    for (const [word, count] of required) {
        if ((actual.get(word) ?? 0) < count)
            return false;
    }
    return true;
}
export function wordMultisetsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size)
        return false;
    for (const [word, count] of a) {
        if ((b.get(word) ?? 0) !== count)
            return false;
    }
    return true;
}
