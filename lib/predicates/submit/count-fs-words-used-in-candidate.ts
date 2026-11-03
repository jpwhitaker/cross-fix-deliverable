import type { ExtractedWord } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
import type { FreestandingWord } from './get-freestanding-words';
export function countFreestandingComponentsUsedInCandidate(fsWords: readonly FreestandingWord[], candidateWords: readonly ExtractedWord[]): number {
    if (fsWords.length === 0 || candidateWords.length === 0)
        return 0;
    const candidateKeys = new Set<string>();
    for (const word of candidateWords) {
        for (const pos of word.positions)
            candidateKeys.add(positionKey(pos.row, pos.col));
    }
    const usedComponentIds = new Set<number>();
    for (const fs of fsWords) {
        for (const key of fs.positionKeys) {
            if (!candidateKeys.has(key))
                continue;
            usedComponentIds.add(fs.componentId);
            break;
        }
    }
    return usedComponentIds.size;
}
