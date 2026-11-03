import type { ReadingCell, ReadingTile, ReadingWord } from './board-traversal';
export type RidePath = {
    text: string;
    tileIds: string[];
    cells: ReadingCell[];
};
export type RideClaim = RidePath & {
    boardKey: string;
    additional?: RidePath[];
};
export function isRideClaim(value: unknown): value is RideClaim {
    if (!isRidePath(value))
        return false;
    const claim = value as Partial<RideClaim>;
    return typeof claim.boardKey === 'string' && claim.boardKey.length > 0
        && (claim.additional === undefined || Array.isArray(claim.additional)
            && claim.additional.every(isRidePath)
            && new Set([claim, ...claim.additional].map(path => path.tileIds!.join('|'))).size === claim.additional.length + 1);
}
function isRidePath(value: unknown): value is RidePath {
    if (!value || typeof value !== 'object')
        return false;
    const claim = value as Partial<RidePath>;
    return typeof claim.text === 'string' && claim.text.length > 0
        && Array.isArray(claim.tileIds) && claim.tileIds.length >= 2
        && claim.tileIds.every(id => typeof id === 'string' && id.length > 0)
        && new Set(claim.tileIds).size === claim.tileIds.length
        && Array.isArray(claim.cells) && claim.cells.length === claim.tileIds.length
        && claim.cells.every(cell => cell && Number.isInteger(cell.row) && Number.isInteger(cell.col) && cell.row >= 0 && cell.col >= 0);
}
export function claimedRidePaths(claim?: RideClaim | null): RidePath[] {
    return claim ? [ridePath(claim), ...(claim.additional ?? [])] : [];
}
function ridePath({ text, tileIds, cells }: RidePath): RidePath {
    return { text, tileIds: [...tileIds], cells: cells.map(cell => ({ ...cell })) };
}
export function appendRideClaim(current: RideClaim | null | undefined, next: RideClaim): RideClaim {
    if (!current || current.boardKey !== next.boardKey)
        return next;
    const paths = claimedRidePaths(current);
    if (paths.some(path => path.tileIds.join('|') === next.tileIds.join('|')))
        return current;
    return { ...current, additional: [...paths.slice(1), ridePath(next)] };
}
export function promoteRideClaim(current: RideClaim | null | undefined, next: RideClaim): RideClaim {
    const remaining = current?.boardKey === next.boardKey
        ? claimedRidePaths(current).filter(path => path.tileIds.join('|') !== next.tileIds.join('|'))
        : [];
    return { ...ridePath(next), boardKey: next.boardKey,
        ...(remaining.length ? { additional: remaining.map(ridePath) } : {}) };
}
export function removeRideClaim(current: RideClaim, key: string): RideClaim | null {
    const paths = claimedRidePaths(current).filter(path => path.tileIds.join('|') !== key);
    if (!paths.length)
        return null;
    return { ...paths[0], boardKey: current.boardKey, ...(paths.length > 1 ? { additional: paths.slice(1) } : {}) };
}
export function rideBoardKey(tiles: readonly ReadingTile[], words: readonly ReadingWord[]): string {
    return JSON.stringify([
        [...tiles].sort((a, b) => a.row - b.row || a.col - b.col).map(t => [t.id, t.row, t.col, t.text, t.isNew]),
        words.map(w => [w.id, ...w.tileIds]).sort((a, b) => a[0].localeCompare(b[0])),
    ]);
}
export function createRideClaim(selectedIds: readonly string[], tiles: readonly ReadingTile[], words: readonly ReadingWord[]): {
    ok: true;
    claim: RideClaim;
} | {
    ok: false;
    message: string;
} {
    const ids = new Set(selectedIds);
    const selected = tiles.filter(tile => ids.has(tile.id)).sort((a, b) => a.row + a.col - b.row - b.col);
    if (selected.length !== ids.size)
        return { ok: false, message: 'A selected tile is no longer on the board. Select your Ride again.' };
    if (selected.length < 2)
        return { ok: false, message: 'Select the whole Ride, including at least two tiles.' };
    if (!selected.some(tile => tile.isNew))
        return { ok: false, message: 'Your Ride must include a new tile.' };
    if (tiles.some(tile => tile.isNew && !ids.has(tile.id)))
        return { ok: false, message: 'Include every new board tile in your Ride.' };
    for (let i = 1; i < selected.length; i++) {
        const before = selected[i - 1], after = selected[i];
        if (!((after.row === before.row && after.col === before.col + 1)
            || (after.col === before.col && after.row === before.row + 1))) {
            return { ok: false, message: 'Select one connected word reading right or down, without gaps or branches.' };
        }
    }
    return { ok: true, claim: {
            text: selected.map(tile => tile.text).join(''), tileIds: selected.map(tile => tile.id),
            cells: selected.map(({ row, col }) => ({ row, col })), boardKey: rideBoardKey(tiles, words),
        } };
}
export type RideBrushAction = 'select' | 'erase';
export function rideBrushActionForTile(selected: ReadonlySet<string>, tileId: string): RideBrushAction {
    return selected.has(tileId) ? 'erase' : 'select';
}
export function paintRideBrushTile(selected: ReadonlySet<string>, tileId: string, action: RideBrushAction, automaticIds?: ReadonlySet<string>): Set<string> | null {
    if (!selected.has(tileId) && automaticIds?.has(tileId))
        return null;
    const shouldSelect = action === 'select';
    if (selected.has(tileId) === shouldSelect)
        return null;
    const next = new Set(selected);
    if (shouldSelect)
        next.add(tileId);
    else
        next.delete(tileId);
    return next;
}
