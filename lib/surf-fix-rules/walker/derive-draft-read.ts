import type { Pos } from '@/lib/surf-fix-rules/game/types';
import { isForwardReadingStep } from '@/lib/surf-fix-rules/game/reading-order';
export type DraftTile = Pos & {
    id: string;
    letter: string;
};
export type DraftRead = {
    kind: 'stable';
    text: string;
    tileTexts: string[];
    cells: Pos[];
    tileIds: string[];
} | {
    kind: 'ambiguous';
    reason: string;
};
export function deriveDraftRead(tiles: readonly DraftTile[]): DraftRead {
    if (tiles.length === 0)
        return { kind: 'ambiguous', reason: 'empty-draft' };
    if (tiles.length === 1) {
        const tile = tiles[0];
        return {
            kind: 'stable',
            text: tile.letter,
            tileTexts: [tile.letter],
            cells: [{ row: tile.row, col: tile.col }],
            tileIds: [tile.id],
        };
    }
    const byKey = new Map<string, DraftTile>();
    for (const tile of tiles) {
        const key = posKey(tile);
        if (byKey.has(key))
            return { kind: 'ambiguous', reason: 'overlapping-tiles' };
        byKey.set(key, tile);
    }
    const degrees = new Map<string, number>();
    for (const tile of tiles) {
        degrees.set(posKey(tile), neighbors(tile, byKey).length);
    }
    const endpoints = tiles.filter((tile) => degrees.get(posKey(tile)) === 1);
    if (endpoints.length !== 2)
        return { kind: 'ambiguous', reason: 'not-a-simple-path' };
    if (tiles.some((tile) => (degrees.get(posKey(tile)) ?? 0) > 2))
        return { kind: 'ambiguous', reason: 'branching-path' };
    const start = chooseReadingStart(endpoints);
    const cells = walkPath(start, byKey);
    if (!cells)
        return { kind: 'ambiguous', reason: 'disconnected-path' };
    if (!hasForwardReadingOrder(cells))
        return { kind: 'ambiguous', reason: 'not-forward-reading-order' };
    const readTiles = cells.map((cell) => byKey.get(posKey(cell))).filter((tile): tile is DraftTile => !!tile);
    const tileTexts = readTiles.map((tile) => tile.letter);
    return {
        kind: 'stable',
        text: tileTexts.join(''),
        tileTexts,
        cells,
        tileIds: readTiles.map((tile) => tile.id),
    };
}
function walkPath(start: DraftTile, byKey: ReadonlyMap<string, DraftTile>): Pos[] | null {
    const cells: Pos[] = [];
    let current: DraftTile | undefined = start;
    let previousKey: string | null = null;
    while (current) {
        const currentKey = posKey(current);
        cells.push({ row: current.row, col: current.col });
        const nextTiles: DraftTile[] = neighbors(current, byKey).filter((tile) => posKey(tile) !== previousKey);
        if (nextTiles.length === 0)
            break;
        if (nextTiles.length > 1)
            return null;
        previousKey = currentKey;
        current = nextTiles[0];
    }
    return cells.length === byKey.size ? cells : null;
}
function chooseReadingStart(endpoints: readonly DraftTile[]): DraftTile {
    return [...endpoints].sort((a, b) => a.row - b.row || a.col - b.col)[0];
}
function neighbors(tile: Pos, byKey: ReadonlyMap<string, DraftTile>): DraftTile[] {
    return [
        byKey.get(posKey({ row: tile.row - 1, col: tile.col })),
        byKey.get(posKey({ row: tile.row, col: tile.col + 1 })),
        byKey.get(posKey({ row: tile.row + 1, col: tile.col })),
        byKey.get(posKey({ row: tile.row, col: tile.col - 1 })),
    ].filter((neighbor): neighbor is DraftTile => !!neighbor);
}
function hasForwardReadingOrder(cells: readonly Pos[]): boolean {
    return cells.every((cell, index) => {
        const next = cells[index + 1];
        return !next || isForwardReadingStep(cell, next);
    });
}
function posKey(pos: Pos): string {
    return `${pos.row},${pos.col}`;
}
