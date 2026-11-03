import type { Pos } from './word-ledger-types';
const FIXED_TILE_ID_PREFIX = 'fixed:';
export function fixedTileId(pos: Pos): string;
export function fixedTileId(row: number, col: number): string;
export function fixedTileId(posOrRow: Pos | number, col?: number): string {
    const pos = typeof posOrRow === 'number'
        ? { row: posOrRow, col: col ?? Number.NaN }
        : posOrRow;
    return `${FIXED_TILE_ID_PREFIX}${pos.row},${pos.col}`;
}
export function parseFixedTileId(tileId: string): Pos | null {
    const match = /^fixed:(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(tileId);
    if (!match)
        return null;
    return {
        row: Number(match[1]),
        col: Number(match[2]),
    };
}
export function isFixedTileId(tileId: string): boolean {
    return parseFixedTileId(tileId) !== null;
}
