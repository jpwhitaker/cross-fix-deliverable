import { canTurnAfterReusedSuffix } from './shared-suffix-turn';
import { existingRunOwners } from './existing-run-owners';
import { canExtendWholeWord } from './whole-word-extension';
export type ReadingCell = {
    row: number;
    col: number;
};
export type ReadingTile = ReadingCell & {
    id: string;
    text: string;
    isNew: boolean;
};
export type ReadingWord = {
    id: string;
    text: string;
    tileIds: readonly string[];
};
export type ReadingMembership = {
    wordId: string;
    word: string;
    index: number;
    length: number;
    before?: string;
    after?: string;
    bend: boolean;
};
export type ReadingNode = ReadingTile & {
    memberships: ReadingMembership[];
};
export type ReadingGraph = {
    nodes: ReadonlyMap<string, ReadingNode>;
    byCell: ReadonlyMap<string, ReadingNode>;
    error?: string;
};
export type ReadingScope = 'automatic' | 'selectable';
export type WalkDecision = 'start' | 'new-tile' | 'follow-word' | 'cross-shared' | 'enter-bend' | 'leave-bend' | 'leave-shared-suffix' | 'extend-word-end' | 'seed' | 'blocked-turn' | 'word-path-switch' | 'unrelated-existing-tiles' | 'unestablished-word-start' | 'occupied-pre-space';
export type WalkPath = {
    tileIds: string[];
    wholeWordExtension?: true;
};
export type BoardWalk = {
    paths: WalkPath[];
    visits: number;
    exhausted: boolean;
};
const key = (cell: ReadingCell) => `${cell.row},${cell.col}`;
const direction = (from: ReadingCell, to: ReadingCell) => from.row === to.row ? 'right' : 'down';
export function buildReadingGraph(tiles: readonly ReadingTile[], words: readonly ReadingWord[]): ReadingGraph {
    const nodes = new Map<string, ReadingNode>();
    const byCell = new Map<string, ReadingNode>();
    for (const tile of tiles) {
        if (nodes.has(tile.id) || byCell.has(key(tile)))
            return { nodes, byCell, error: 'overlapping-tiles' };
        const node: ReadingNode = { ...tile, memberships: [] };
        nodes.set(tile.id, node);
        byCell.set(key(tile), node);
    }
    for (const word of words) {
        for (let index = 0; index < word.tileIds.length; index++) {
            const node = nodes.get(word.tileIds[index]);
            if (!node)
                return { nodes, byCell, error: 'missing-word-tile' };
            const before = nodes.get(word.tileIds[index - 1]);
            const after = nodes.get(word.tileIds[index + 1]);
            node.memberships.push({ wordId: word.id, word: word.text, index, length: word.tileIds.length,
                before: before?.id, after: after?.id,
                bend: !!before && !!after && direction(before, node) !== direction(node, after),
            });
        }
    }
    return { nodes, byCell };
}
export function readingTransition(before: ReadingNode | undefined, current: ReadingNode, next: ReadingNode, path: readonly ReadingNode[], scope: ReadingScope = 'automatic'): {
    allowed: boolean;
    reason: WalkDecision;
} {
    if (!current.isNew && !next.isNew && !current.memberships.some((owner) => owner.after === next.id)) {
        return { allowed: false, reason: 'unrelated-existing-tiles' };
    }
    if (!before) {
        const established = current.memberships.some((owner) => owner.index === 0 && owner.after === next.id);
        return current.isNew || next.isNew || established
            ? { allowed: true, reason: 'start' }
            : { allowed: false, reason: 'unestablished-word-start' };
    }
    if (current.isNew)
        return { allowed: true, reason: 'new-tile' };
    const owners = existingRunOwners(path).filter(owner => owner.enteredFromNew || owner.first.index === 0);
    const following = current.memberships.some((owner) => owner.before === before.id && owner.after === next.id);
    if (following)
        return owners.some(({ last }) => last.after === next.id)
            ? { allowed: true, reason: 'follow-word' }
            : { allowed: false, reason: 'word-path-switch' };
    if (!before.isNew && !next.isNew)
        return { allowed: false, reason: 'unrelated-existing-tiles' };
    if (owners.some(({ last }) => last.length === 1))
        return { allowed: true, reason: 'seed' };
    if (direction(before, current) !== direction(current, next)) {
        if (next.isNew && canTurnAfterReusedSuffix(path))
            return { allowed: true, reason: 'leave-shared-suffix' };
        if (scope === 'selectable' && next.isNew && canExtendWholeWord(path)) {
            return { allowed: true, reason: 'extend-word-end' };
        }
        return { allowed: false, reason: 'blocked-turn' };
    }
    const reason = owners.some(({ last }) => last.bend && last.after === next.id) ? 'enter-bend'
        : owners.some(({ last }) => last.bend && last.before === before.id) ? 'leave-bend' : 'cross-shared';
    return { allowed: true, reason };
}
export function walkReadingGraph(graph: ReadingGraph, options: {
    maxVisits?: number;
    scope?: ReadingScope;
} = {}): BoardWalk {
    const paths: WalkPath[] = [];
    const maxVisits = options.maxVisits ?? 100000;
    let visits = 0, exhausted = false;
    const open = (cell: ReadingCell) => !graph.byCell.has(key(cell)) || graph.byCell.get(key(cell))?.text === '-';
    const visit = (node: ReadingNode, path: ReadingNode[], reason: WalkDecision, hasNew: boolean, wholeWordExtension = false) => {
        if (++visits > maxVisits) {
            exhausted = true;
            return;
        }
        const before = path.at(-1);
        const nextPath = [...path, node];
        const ids = nextPath.map((tile) => tile.id);
        const touchesNew = hasNew || node.isNew;
        const optionalExtension = wholeWordExtension || reason === 'extend-word-end';
        if (touchesNew && (!before || open({ row: 2 * node.row - before.row, col: 2 * node.col - before.col }))) {
            paths.push({ tileIds: ids, ...(optionalExtension ? { wholeWordExtension: true } : {}) });
        }
        for (const cell of [{ row: node.row, col: node.col + 1 }, { row: node.row + 1, col: node.col }]) {
            if (exhausted)
                break;
            const next = graph.byCell.get(key(cell));
            if (!next)
                continue;
            const decision = !before && !open({ row: 2 * node.row - next.row, col: 2 * node.col - next.col })
                ? { allowed: false, reason: 'occupied-pre-space' as const } : readingTransition(before, node, next, nextPath, options.scope);
            if (decision.allowed)
                visit(next, nextPath, decision.reason, touchesNew, optionalExtension);
        }
    };
    if (!graph.error) {
        for (const node of [...graph.nodes.values()].sort((a, b) => a.row - b.row || a.col - b.col || a.id.localeCompare(b.id))) {
            if (exhausted)
                break;
            visit(node, [], 'start', false);
        }
    }
    return { paths, visits, exhausted };
}
