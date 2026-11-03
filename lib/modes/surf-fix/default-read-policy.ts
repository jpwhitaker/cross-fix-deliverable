import { isSpliceOfIndependentReads, shareIndependentRewriteEndpoint } from '@/lib/predicates/reads/independent-rewrite';
import { surfFixReadingAcceptance } from './reading-acceptance';
import { dropStructurallyContainedReads } from '@/lib/surf-fix-rules/game/word-consumption';
import { sharedEndingExtensions, type EndingOwner } from '@/lib/predicates/reads/shared-ending-extensions';
import type { ReadingTile } from '@/lib/predicates/reads/board-traversal';
type Read = {
    text: string;
    cells: readonly {
        row: number;
        col: number;
    }[];
    tileIds: readonly string[];
};
export function requiredSurfFixEndingExtensions(claimedTileIds: readonly string[] | undefined, words: readonly EndingOwner[], tiles: ReadonlyMap<string, ReadingTile>) {
    return claimedTileIds ? sharedEndingExtensions(claimedTileIds, words, tiles) : [];
}
export function isSurfFixAutomaticOrClaimedRead(read: {
    tileIds: readonly string[];
    wholeWordExtension?: boolean;
}, claimedTileIds?: readonly string[], requiredPathKeys?: ReadonlySet<string>): boolean {
    return !read.wholeWordExtension || !!requiredPathKeys?.has(read.tileIds.join('|')) || !!claimedTileIds
        && read.tileIds.length === claimedTileIds.length
        && read.tileIds.every((id, index) => id === claimedTileIds[index]);
}
export function selectSurfFixDefaultReads<T extends Read>(candidates: readonly T[], occupied: ReadonlySet<string>, claimedTileIds?: readonly string[], requiredPathKeys?: ReadonlySet<string>): T[] {
    const words = candidates.filter(read => surfFixReadingAcceptance(read) === 'word');
    const pairs = words.flatMap(a => words.filter(b => a !== b
        && shareIndependentRewriteEndpoint(a, b, occupied)).map(b => [a, b] as const));
    const claimKey = claimedTileIds?.join('|');
    return candidates.filter(candidate => candidate.tileIds.join('|') === claimKey
        || requiredPathKeys?.has(candidate.tileIds.join('|'))
        || !pairs.some(([a, b]) => isSpliceOfIndependentReads(candidate, a, b)));
}
export function pickDefaultSurfFixRide<T extends Read>(candidates: readonly T[]): T | null {
    const complete = dropStructurallyContainedReads(candidates);
    const words = complete.filter(read => surfFixReadingAcceptance(read) !== 'sbs');
    return (words.length ? words : complete).sort(compareReadPathOrder)[0] ?? null;
}
function compareReadPathOrder(a: Read, b: Read): number {
    for (let i = 0; i < Math.min(a.cells.length, b.cells.length); i++) {
        const difference = a.cells[i].row - b.cells[i].row || a.cells[i].col - b.cells[i].col;
        if (difference)
            return difference;
    }
    return a.tileIds.join('|').localeCompare(b.tileIds.join('|'));
}
