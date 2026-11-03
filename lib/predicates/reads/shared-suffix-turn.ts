import type { ReadingNode } from './board-traversal';
import { existingRunOwners } from './existing-run-owners';
export function canTurnAfterReusedSuffix(path: readonly ReadingNode[]): boolean {
    return existingRunOwners(path).some(({ first, last, enteredFromNew }) => enteredFromNew && first.index > 0 && last.index === last.length - 1);
}
