import type { ExtractedWord } from '@/lib/dictionary';
import { isContiguousPositionKeys } from '@/lib/validation/isContiguousPositionKeys';
export function isCandidateGroupContiguous(candidateWords: readonly ExtractedWord[]): boolean {
    const keys = new Set<string>();
    for (const word of candidateWords) {
        for (const pos of word.positions)
            keys.add(`${pos.row}-${pos.col}`);
    }
    return isContiguousPositionKeys(keys);
}
