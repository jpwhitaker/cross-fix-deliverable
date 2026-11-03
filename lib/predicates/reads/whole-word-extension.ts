import type { ReadingNode } from './board-traversal';
import { existingRunOwners } from './existing-run-owners';
export function canExtendWholeWord(path: readonly ReadingNode[]): boolean {
    return existingRunOwners(path).some(({ first, last }) => first.index === 0 && last.length > 1 && last.index === last.length - 1);
}
