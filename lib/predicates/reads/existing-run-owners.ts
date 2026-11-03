import type { ReadingMembership, ReadingNode } from './board-traversal';
type ExistingRunOwner = {
    first: ReadingMembership;
    last: ReadingMembership;
    enteredFromNew: boolean;
};
export function existingRunOwners(path: readonly ReadingNode[]): ExistingRunOwner[] {
    const end = path.at(-1);
    if (!end || end.isNew)
        return [];
    return end.memberships.flatMap<ExistingRunOwner>(last => {
        let first = last;
        for (let i = path.length - 2; i >= 0; i--) {
            const previous = path[i];
            if (previous.isNew)
                return [{ first, last, enteredFromNew: true }];
            const membership = previous.memberships.find(candidate => candidate.wordId === last.wordId
                && candidate.index === first.index - 1 && candidate.after === path[i + 1].id && first.before === previous.id);
            if (!membership)
                return [];
            first = membership;
        }
        return [{ first, last, enteredFromNew: false }];
    });
}
